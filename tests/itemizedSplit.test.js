const { computeItemizedSplits, ItemizedSplitError } = require('../src/utils/itemizedSplit');

const byUser = (splits) => Object.fromEntries(splits.map(s => [s.userId, s.amount]));
const sum = (splits) => splits.reduce((acc, s) => acc + s.amount, 0);

describe('computeItemizedSplits', () => {
  test('personal and shared items, no adjustments', () => {
    const { splits } = computeItemizedSplits({
      items: [
        { name: '炒飯', amount: 280, assignees: ['amy'] },
        { name: '啤酒', amount: 450, assignees: ['ben'] },
        { name: '酸辣湯', amount: 180, assignees: ['amy', 'ben'] },
      ],
      total: 910,
    });
    expect(byUser(splits)).toEqual({ amy: 370, ben: 540 });
  });

  test('service charge is shared in proportion to item subtotals', () => {
    // Amy 300, Ben 700 of items; 10% service = 100 → Amy 30, Ben 70
    const { splits } = computeItemizedSplits({
      items: [
        { name: 'A', amount: 300, assignees: ['amy'] },
        { name: 'B', amount: 700, assignees: ['ben'] },
      ],
      adjustments: [{ label: '服務費', amount: 100 }],
      total: 1100,
    });
    expect(byUser(splits)).toEqual({ amy: 330, ben: 770 });
  });

  test('discounts reduce shares proportionally', () => {
    const { splits } = computeItemizedSplits({
      items: [
        { name: 'A', amount: 400, assignees: ['amy'] },
        { name: 'B', amount: 600, assignees: ['ben'] },
      ],
      adjustments: [{ label: '折扣', amount: -100 }],
      total: 900,
    });
    expect(byUser(splits)).toEqual({ amy: 360, ben: 540 });
  });

  test('TWD rounds to whole dollars and the splits add up exactly', () => {
    const { splits } = computeItemizedSplits({
      items: [{ name: '小籠包', amount: 100, assignees: ['amy', 'ben', 'cindy'] }],
      total: 100,
    });
    expect(splits.every(s => Number.isInteger(s.amount))).toBe(true);
    expect(sum(splits)).toBe(100);
    expect(splits.map(s => s.amount).sort()).toEqual([33, 33, 34]);
  });

  test('two-decimal currencies round to cents and add up exactly', () => {
    const { splits } = computeItemizedSplits({
      items: [{ name: 'Pizza', amount: 10, assignees: ['amy', 'ben', 'cindy'] }],
      total: 10,
      currency: 'USD',
    });
    expect(Math.round(sum(splits) * 100)).toBe(1000);
    expect(splits.map(s => s.amount).sort()).toEqual([3.33, 3.33, 3.34]);
  });

  test('rounding with service charge across many people still adds up', () => {
    const { splits } = computeItemizedSplits({
      items: [
        { name: 'A', amount: 333, assignees: ['a', 'b', 'c'] },
        { name: 'B', amount: 517, assignees: ['b', 'd'] },
        { name: 'C', amount: 89, assignees: ['e'] },
      ],
      adjustments: [{ label: '服務費', amount: 94 }],
      total: 1033,
    });
    expect(sum(splits)).toBe(1033);
    expect(splits.every(s => Number.isInteger(s.amount))).toBe(true);
  });

  test('a person listed twice on one item counts once', () => {
    const { splits } = computeItemizedSplits({
      items: [{ name: 'A', amount: 100, assignees: ['amy', 'amy', 'ben'] }],
      total: 100,
    });
    expect(byUser(splits)).toEqual({ amy: 50, ben: 50 });
  });

  test('rejects an item with no one assigned', () => {
    expect(() => computeItemizedSplits({
      items: [{ name: 'A', amount: 100, assignees: [] }],
      total: 100,
    })).toThrow(expect.objectContaining({ code: 'UNASSIGNED_ITEM' }));
  });

  test('rejects totals that do not match items plus adjustments', () => {
    expect(() => computeItemizedSplits({
      items: [{ name: 'A', amount: 100, assignees: ['amy'] }],
      adjustments: [{ label: '服務費', amount: 10 }],
      total: 120,
    })).toThrow(expect.objectContaining({ code: 'TOTAL_MISMATCH' }));
  });

  test('rejects an empty item list', () => {
    expect(() => computeItemizedSplits({ items: [], total: 0 })).toThrow(ItemizedSplitError);
  });
});

describe('computeItemizedSplits with a tax refund', () => {
  const items = [
    { name: '面膜', amount: 1100, refundRate: 10, assignees: ['amy'] },
    { name: '抹茶餅乾', amount: 540, refundRate: 8, assignees: ['amy', 'ben', 'cindy'] },
    { name: '行李箱', amount: 8800, assignees: ['ben'] },
  ];

  test('the refund follows each item to whoever shares it, weighted by its tax rate', () => {
    // Tax on 面膜 100, on 餅乾 40 → 130 received splits 92.86 / 37.14; 行李箱 gets none
    const { splits, refund } = computeItemizedSplits({
      items, taxRefund: { received: 130 }, total: 10440 - 130, currency: 'JPY',
    });
    expect(byUser(splits)).toEqual({ amy: 1175, ben: 8968, cindy: 167 });
    expect(sum(splits)).toBe(10310);
    expect(refund).toEqual({ received: 130, expected: 140, items: [93, 37, 0] });
  });

  test('receiving exactly the expected refund gives each item its own tax back', () => {
    const { refund } = computeItemizedSplits({
      items, taxRefund: { received: 140 }, total: 10300, currency: 'JPY',
    });
    expect(refund.items).toEqual([100, 40, 0]);
  });

  test('tax-exclusive receipts (tax added as an adjustment) use price × rate', () => {
    const { splits, refund } = computeItemizedSplits({
      items: [
        { name: 'A', amount: 1000, refundRate: 10, assignees: ['amy'] },
        { name: 'B', amount: 500, refundRate: 8, assignees: ['ben'] },
      ],
      adjustments: [{ type: 'tax', label: '消費税', amount: 140 }],
      taxRefund: { received: 140 },
      total: 1500,
      currency: 'JPY',
    });
    expect(refund).toEqual({ received: 140, expected: 140, items: [100, 40] });
    expect(sum(splits)).toBe(1500);
  });

  test('rates without a refund change nothing', () => {
    const withRates = computeItemizedSplits({ items, total: 10440, currency: 'JPY' });
    const without = computeItemizedSplits({
      items: items.map(({ refundRate, ...item }) => item), total: 10440, currency: 'JPY',
    });
    expect(withRates.splits).toEqual(without.splits);
    expect(withRates.refund).toEqual({ received: 0, expected: 140, items: [0, 0, 0] });
  });

  test('service charge is still shared on the pre-refund prices', () => {
    const { splits } = computeItemizedSplits({
      items: [
        { name: 'A', amount: 1100, refundRate: 10, assignees: ['amy'] },
        { name: 'B', amount: 1100, assignees: ['ben'] },
      ],
      adjustments: [{ type: 'service_charge', label: '服務費', amount: 220 }],
      taxRefund: { received: 100 },
      total: 2320,
      currency: 'JPY',
    });
    expect(byUser(splits)).toEqual({ amy: 1110, ben: 1210 });
  });

  test('a refund needs at least one item with a tax rate', () => {
    expect(() => computeItemizedSplits({
      items: [{ name: 'A', amount: 100, assignees: ['amy'] }],
      taxRefund: { received: 10 },
      total: 90,
    })).toThrow(expect.objectContaining({ code: 'NO_REFUND_ITEMS' }));
  });

  test('rejects a refund larger than the refundable items', () => {
    expect(() => computeItemizedSplits({
      items: [
        { name: 'A', amount: 100, refundRate: 10, assignees: ['amy'] },
        { name: 'B', amount: 900, assignees: ['ben'] },
      ],
      taxRefund: { received: 150 },
      total: 850,
    })).toThrow(expect.objectContaining({ code: 'REFUND_TOO_LARGE' }));
  });

  test('the total must be net of the refund', () => {
    expect(() => computeItemizedSplits({
      items, taxRefund: { received: 130 }, total: 10440, currency: 'JPY',
    })).toThrow(expect.objectContaining({ code: 'TOTAL_MISMATCH' }));
  });
});

describe('expectedRefund', () => {
  const { expectedRefund } = require('../src/utils/itemizedSplit');

  test('adds up the tax on the items that have a rate', () => {
    expect(expectedRefund({
      items: [{ amount: 1100, refundRate: 10 }, { amount: 540, refundRate: 8 }, { amount: 8800 }],
      currency: 'JPY',
    })).toBe(140);
  });

  test('is zero when no item has a rate, and ignores half-typed amounts', () => {
    expect(expectedRefund({ items: [{ amount: 100 }, { amount: '', refundRate: 10 }] })).toBe(0);
  });
});

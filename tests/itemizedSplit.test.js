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

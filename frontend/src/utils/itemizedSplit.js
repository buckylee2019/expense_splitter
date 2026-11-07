// Itemized ("by receipt line") split calculation.
//
// Each item is split equally among its assignees. Adjustments (service charge,
// tax, discounts, rounding differences) are shared in proportion to each
// person's item subtotal. Results are rounded to the currency's minor unit with
// the largest-remainder method, so the splits always add up to the total.
//
// Copy of src/utils/itemizedSplit.js (the API recomputes with that one and is
// authoritative); used here for the live preview. Keep the two in sync.

const ZERO_DECIMAL_CURRENCIES = ['TWD', 'JPY', 'KRW'];

class ItemizedSplitError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const decimalsFor = (currency) => (ZERO_DECIMAL_CURRENCIES.includes(currency) ? 0 : 2);

const toMinor = (value, decimals) => Math.round(Number(value) * 10 ** decimals);

/**
 * @param {object} input
 * @param {{name: string, amount: number, assignees: string[]}[]} input.items
 * @param {{label?: string, amount: number}[]} [input.adjustments]  negative for discounts
 * @param {number} input.total     the expense amount (receipt total)
 * @param {string} [input.currency]
 * @returns {{splits: {userId: string, amount: number}[], itemsTotal: number, adjustmentsTotal: number}}
 */
function computeItemizedSplits({ items, adjustments = [], total, currency = 'TWD' }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ItemizedSplitError('NO_ITEMS', 'At least one item is required');
  }
  const decimals = decimalsFor(currency);
  const scale = 10 ** decimals;

  // Each person's item subtotal, in minor units (may be fractional before rounding)
  const subtotals = new Map();
  let itemsMinor = 0;
  items.forEach((item, index) => {
    const assignees = [...new Set(item.assignees || [])];
    if (assignees.length === 0) {
      throw new ItemizedSplitError('UNASSIGNED_ITEM', `Item ${index + 1} (${item.name || 'unnamed'}) has no one assigned`);
    }
    const amount = toMinor(item.amount, decimals);
    if (!Number.isFinite(amount)) {
      throw new ItemizedSplitError('INVALID_AMOUNT', `Item ${index + 1} has an invalid amount`);
    }
    itemsMinor += amount;
    assignees.forEach(userId => {
      subtotals.set(userId, (subtotals.get(userId) || 0) + amount / assignees.length);
    });
  });

  const adjustmentsMinor = adjustments.reduce((sum, adj) => {
    const amount = toMinor(adj.amount, decimals);
    if (!Number.isFinite(amount)) {
      throw new ItemizedSplitError('INVALID_AMOUNT', `Adjustment ${adj.label || ''} has an invalid amount`);
    }
    return sum + amount;
  }, 0);

  const totalMinor = toMinor(total, decimals);
  if (itemsMinor + adjustmentsMinor !== totalMinor) {
    throw new ItemizedSplitError(
      'TOTAL_MISMATCH',
      `Items (${itemsMinor / scale}) plus adjustments (${adjustmentsMinor / scale}) don't add up to the total (${totalMinor / scale})`
    );
  }

  // Share adjustments in proportion to item subtotals; equally if there's no positive base
  const people = [...subtotals.keys()];
  const base = people.reduce((sum, userId) => sum + subtotals.get(userId), 0);
  const raw = people.map(userId => {
    const share = base > 0
      ? (adjustmentsMinor * subtotals.get(userId)) / base
      : adjustmentsMinor / people.length;
    return { userId, value: subtotals.get(userId) + share };
  });

  // Largest remainder: floor everything, then hand the leftover units to the largest fractions
  const floored = raw.map(r => ({ ...r, units: Math.floor(r.value + 1e-9), frac: r.value - Math.floor(r.value + 1e-9) }));
  let leftover = totalMinor - floored.reduce((sum, r) => sum + r.units, 0);
  [...floored]
    .sort((a, b) => b.frac - a.frac || people.indexOf(a.userId) - people.indexOf(b.userId))
    .forEach(r => {
      if (leftover > 0) {
        r.units += 1;
        leftover -= 1;
      }
    });

  return {
    splits: floored.map(r => ({ userId: r.userId, amount: r.units / scale })),
    itemsTotal: itemsMinor / scale,
    adjustmentsTotal: adjustmentsMinor / scale,
  };
}

export { computeItemizedSplits, ItemizedSplitError, decimalsFor };

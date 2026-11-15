// Itemized ("by receipt line") split calculation.
//
// Each item is split equally among its assignees. Adjustments (service charge,
// tax, discounts, rounding differences) are shared in proportion to each
// person's item subtotal. Results are rounded to the currency's minor unit with
// the largest-remainder method, so the splits always add up to the total.
//
// Tax refund: an item can carry a `refundRate`, its consumption-tax / VAT rate
// in percent. The refund actually received (after any handling fee) is shared
// between those items in proportion to the tax on each one, and comes off the
// shares of whoever shares that item. `total` is the net cost after the refund.
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

// Largest remainder: floor everything, then hand the leftover units to the largest fractions
const roundToTotal = (values, totalUnits) => {
  const units = values.map(value => Math.floor(value + 1e-9));
  let leftover = totalUnits - units.reduce((sum, u) => sum + u, 0);
  values
    .map((value, index) => ({ index, frac: value - units[index] }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index)
    .forEach(({ index }) => {
      if (leftover > 0) {
        units[index] += 1;
        leftover -= 1;
      }
    });
  return units;
};

// The refund each item gets, in (fractional) minor units, plus the refund the
// tax rates alone would predict. Prices include tax unless the receipt adds tax
// as a separate adjustment.
const allocateRefund = (items, itemAmounts, adjustments, receivedMinor) => {
  const taxExclusive = adjustments.some(adj => adj.type === 'tax' && Number(adj.amount) > 0);
  const taxes = items.map((item, index) => {
    const rate = Number(item.refundRate) || 0;
    if (rate < 0 || rate > 100) {
      throw new ItemizedSplitError('INVALID_RATE', `Item ${index + 1} (${item.name || 'unnamed'}) has an invalid refund rate`);
    }
    return taxExclusive ? (itemAmounts[index] * rate) / 100 : (itemAmounts[index] * rate) / (100 + rate);
  });
  const expected = taxes.reduce((sum, tax) => sum + tax, 0);
  if (receivedMinor === 0) {
    return { perItem: items.map(() => 0), expected };
  }
  if (expected <= 0) {
    throw new ItemizedSplitError('NO_REFUND_ITEMS', 'Choose a tax rate on the items that were refunded');
  }
  const perItem = taxes.map(tax => (receivedMinor * tax) / expected);
  if (perItem.some((refund, index) => refund > itemAmounts[index] + 1e-9)) {
    throw new ItemizedSplitError('REFUND_TOO_LARGE', 'The tax refund is larger than the refundable items');
  }
  return { perItem, expected };
};

/**
 * @param {object} input
 * @param {{name: string, amount: number, assignees: string[], refundRate?: number}[]} input.items
 * @param {{type?: string, label?: string, amount: number}[]} [input.adjustments]  negative for discounts
 * @param {{received: number}|null} [input.taxRefund]  refund actually received, if any
 * @param {number} input.total     the expense amount: items + adjustments − tax refund
 * @param {string} [input.currency]
 * @returns {{
 *   splits: {userId: string, amount: number}[], itemsTotal: number, adjustmentsTotal: number,
 *   refund: {received: number, expected: number, items: number[]}
 * }}
 */
function computeItemizedSplits({ items, adjustments = [], taxRefund = null, total, currency = 'TWD' }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ItemizedSplitError('NO_ITEMS', 'At least one item is required');
  }
  const decimals = decimalsFor(currency);
  const scale = 10 ** decimals;

  const itemAmounts = items.map((item, index) => {
    const amount = toMinor(item.amount, decimals);
    if (!Number.isFinite(amount)) {
      throw new ItemizedSplitError('INVALID_AMOUNT', `Item ${index + 1} has an invalid amount`);
    }
    return amount;
  });
  const itemsMinor = itemAmounts.reduce((sum, amount) => sum + amount, 0);

  const adjustmentsMinor = adjustments.reduce((sum, adj) => {
    const amount = toMinor(adj.amount, decimals);
    if (!Number.isFinite(amount)) {
      throw new ItemizedSplitError('INVALID_AMOUNT', `Adjustment ${adj.label || ''} has an invalid amount`);
    }
    return sum + amount;
  }, 0);

  const receivedMinor = toMinor(taxRefund?.received || 0, decimals);
  if (!Number.isFinite(receivedMinor) || receivedMinor < 0) {
    throw new ItemizedSplitError('INVALID_AMOUNT', 'The tax refund has an invalid amount');
  }
  const refund = allocateRefund(items, itemAmounts, adjustments, receivedMinor);

  // Each person's item subtotal and refund, in minor units (may be fractional before rounding)
  const subtotals = new Map();
  const refunds = new Map();
  items.forEach((item, index) => {
    const assignees = [...new Set(item.assignees || [])];
    if (assignees.length === 0) {
      throw new ItemizedSplitError('UNASSIGNED_ITEM', `Item ${index + 1} (${item.name || 'unnamed'}) has no one assigned`);
    }
    assignees.forEach(userId => {
      subtotals.set(userId, (subtotals.get(userId) || 0) + itemAmounts[index] / assignees.length);
      refunds.set(userId, (refunds.get(userId) || 0) + refund.perItem[index] / assignees.length);
    });
  });

  const totalMinor = toMinor(total, decimals);
  if (itemsMinor + adjustmentsMinor - receivedMinor !== totalMinor) {
    const refundText = receivedMinor > 0 ? ` minus the tax refund (${receivedMinor / scale})` : '';
    throw new ItemizedSplitError(
      'TOTAL_MISMATCH',
      `Items (${itemsMinor / scale}) plus adjustments (${adjustmentsMinor / scale})${refundText} don't add up to the total (${totalMinor / scale})`
    );
  }

  // Share adjustments in proportion to item subtotals (before any refund); equally if there's no positive base
  const people = [...subtotals.keys()];
  const base = people.reduce((sum, userId) => sum + subtotals.get(userId), 0);
  const values = people.map(userId => {
    const share = base > 0
      ? (adjustmentsMinor * subtotals.get(userId)) / base
      : adjustmentsMinor / people.length;
    return subtotals.get(userId) + share - refunds.get(userId);
  });
  const units = roundToTotal(values, totalMinor);

  return {
    splits: people.map((userId, index) => ({ userId, amount: units[index] / scale })),
    itemsTotal: itemsMinor / scale,
    adjustmentsTotal: adjustmentsMinor / scale,
    refund: {
      received: receivedMinor / scale,
      expected: Math.round(refund.expected) / scale,
      // Per item, rounded so they add up to what was received
      items: roundToTotal(refund.perItem, receivedMinor).map(u => u / scale),
    },
  };
}

// The refund the items' tax rates predict, before any handling fee
function expectedRefund({ items, adjustments = [], currency = 'TWD' }) {
  const decimals = decimalsFor(currency);
  const amounts = items.map(item => toMinor(item.amount, decimals) || 0);
  return Math.round(allocateRefund(items, amounts, adjustments, 0).expected) / 10 ** decimals;
}

export { computeItemizedSplits, expectedRefund, ItemizedSplitError, decimalsFor };

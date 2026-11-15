import { decimalsFor } from './itemizedSplit';

// In the expense form, Amount is the bill before any tax refund. The expense is
// saved net of the refund: what the payer really ended up paying.
export const netOfRefund = (amount, taxRefund, currency) => {
  const scale = 10 ** decimalsFor(currency);
  const received = Number(taxRefund?.received) || 0;
  return (Math.round((Number(amount) || 0) * scale) - Math.round(received * scale)) / scale;
};

// The reverse, when loading a saved expense into the form
export const beforeRefund = (amount, taxRefund, currency) => {
  const scale = 10 ** decimalsFor(currency);
  const received = Number(taxRefund?.received) || 0;
  return (Math.round((Number(amount) || 0) * scale) + Math.round(received * scale)) / scale;
};

// What the API stores: only a refund that was actually received
export const cleanTaxRefund = (taxRefund) => {
  const received = Number(taxRefund?.received) || 0;
  return received > 0 ? { received } : null;
};

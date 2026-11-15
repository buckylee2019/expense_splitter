import React, { useMemo } from 'react';
import UserPhoto from './UserPhoto';
import { computeItemizedSplits, expectedRefund, decimalsFor } from '../utils/itemizedSplit';
import { netOfRefund } from '../utils/taxRefund';
import '../styles/receipt.css';

// Tax rates offered for a refunded item; anything else goes through "Other…"
const REFUND_RATES = [5, 8, 10, 20];

// Edit receipt lines and choose who shares each one. Tapping members on an item
// toggles them; one person makes it theirs, several share it equally.
// Adjustments (service charge, discounts) are shared in proportion to items.
// A tax refund (value.taxRefund) is entered as the amount actually received and
// comes off the items that have a tax rate. `total` is the bill before the refund.
const ReceiptItemsEditor = ({ members, value, total, currency, currentUserId, onChange }) => {
  const { items, adjustments, taxRefund = null } = value;
  const allIds = members.map(m => m.user);
  const decimals = decimalsFor(currency);
  const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const nameOf = (userId) => {
    const member = members.find(m => m.user === userId);
    const name = member?.userName || 'Member';
    return userId === currentUserId ? `${name} (You)` : name;
  };

  const setItems = (next) => onChange({ ...value, items: next });
  const setAdjustments = (next) => onChange({ ...value, adjustments: next });
  const updateItem = (index, patch) => setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const updateAdjustment = (index, patch) => setAdjustments(adjustments.map((adj, i) => (i === index ? { ...adj, ...patch } : adj)));

  const toggleAssignee = (index, userId) => {
    const assignees = items[index].assignees;
    updateItem(index, {
      assignees: assignees.includes(userId) ? assignees.filter(id => id !== userId) : [...assignees, userId],
    });
  };
  const toggleEveryone = (index) => {
    const everyone = allIds.every(id => items[index].assignees.includes(id));
    updateItem(index, { assignees: everyone ? [] : [...allIds] });
  };

  const round = (n) => Math.round(n * 10 ** decimals) / 10 ** decimals;
  const itemsTotal = round(items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const adjustmentsTotal = round(adjustments.reduce((sum, adj) => sum + (Number(adj.amount) || 0), 0));
  const difference = round((Number(total) || 0) - itemsTotal - adjustmentsTotal);

  const refundOn = taxRefund !== null;
  const received = Number(taxRefund?.received) || 0;
  const net = netOfRefund(total, taxRefund, currency);
  const setTaxRefund = (next) => onChange({ ...value, taxRefund: next });
  // '' means "Other…" was picked and the rate is still being typed
  const rateChoice = (rate) => {
    if (rate === '') return 'other';
    const number = Number(rate) || 0;
    return number === 0 || REFUND_RATES.includes(number) ? String(number) : 'other';
  };

  const preview = useMemo(() => {
    try {
      return computeItemizedSplits({ items, adjustments, taxRefund, total: net, currency });
    } catch (error) {
      return { error };
    }
  }, [items, adjustments, taxRefund, net, currency]);
  const expected = useMemo(() => {
    try {
      return expectedRefund({ items, adjustments, currency });
    } catch {
      return 0;
    }
  }, [items, adjustments, currency]);

  return (
    <div className="receipt-editor">
      <div className="receipt-section-title">
        <span>Items</span>
        <span className="receipt-hint">Tap people to choose who shares each item</span>
      </div>

      {items.map((item, index) => {
        const everyone = allIds.length > 0 && allIds.every(id => item.assignees.includes(id));
        const unassigned = item.assignees.length === 0;
        return (
          <div key={index} className={`receipt-item ${unassigned ? 'unassigned' : ''}`}>
            <div className="receipt-item-row">
              <input
                className="receipt-item-name"
                value={item.name}
                onChange={(e) => updateItem(index, { name: e.target.value })}
                aria-label={`Item ${index + 1} name`}
              />
              <input
                className="receipt-item-amount"
                type="number"
                inputMode="decimal"
                value={item.amount}
                onChange={(e) => updateItem(index, { amount: e.target.value === '' ? '' : Number(e.target.value) })}
                aria-label={`Item ${index + 1} amount`}
              />
              <button type="button" className="receipt-remove" onClick={() => setItems(items.filter((_, i) => i !== index))} aria-label={`Remove ${item.name}`}>
                <i className="fi fi-rr-cross-small"></i>
              </button>
            </div>
            <div className="receipt-assignees" role="group" aria-label={`Who shares ${item.name}`}>
              <button type="button" className={`assignee-chip everyone ${everyone ? 'selected' : ''}`} aria-pressed={everyone} onClick={() => toggleEveryone(index)}>
                Everyone
              </button>
              {members.map(member => {
                const selected = item.assignees.includes(member.user);
                return (
                  <button
                    key={member.user}
                    type="button"
                    className={`assignee-chip ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleAssignee(index, member.user)}
                  >
                    <UserPhoto user={{ id: member.user, name: member.userName, avatarUrl: member.avatarUrl, avatar: member.avatar }} />
                    <span>{nameOf(member.user)}</span>
                  </button>
                );
              })}
            </div>
            {item.originalName && <div className="receipt-original">Printed: {item.originalName}</div>}
            {refundOn && (
              <div className="receipt-refund-row">
                <label>
                  Tax rate
                  <select
                    value={rateChoice(item.refundRate)}
                    onChange={(e) => updateItem(index, { refundRate: e.target.value === 'other' ? '' : Number(e.target.value) })}
                    aria-label={`Tax rate of ${item.name}`}
                  >
                    <option value="0">No refund</option>
                    {REFUND_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
                    <option value="other">Other…</option>
                  </select>
                </label>
                {rateChoice(item.refundRate) === 'other' && (
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    placeholder="%"
                    value={item.refundRate}
                    onChange={(e) => updateItem(index, { refundRate: e.target.value === '' ? '' : Number(e.target.value) })}
                    aria-label={`Custom tax rate of ${item.name}`}
                  />
                )}
                {preview.refund?.items[index] > 0 && (
                  <span className="receipt-refund-amount">−{fmt(preview.refund.items[index])}</span>
                )}
              </div>
            )}
            {unassigned && <div className="receipt-item-warning">Choose at least one person</div>}
          </div>
        );
      })}
      <button type="button" className="receipt-add" onClick={() => setItems([...items, { name: '', quantity: 1, amount: '', assignees: [...allIds] }])}>
        <i className="fi fi-rr-plus-small"></i> Add item
      </button>

      <div className="receipt-section-title">
        <span>Service charge, tax &amp; discounts</span>
        <span className="receipt-hint">Shared in proportion to each person's items · discounts are negative</span>
      </div>
      {adjustments.map((adj, index) => (
        <React.Fragment key={index}>
          <div className="receipt-item-row adjustment">
            <input
              className="receipt-item-name"
              value={adj.label}
              onChange={(e) => updateAdjustment(index, { label: e.target.value })}
              aria-label={`Adjustment ${index + 1} label`}
            />
            <input
              className="receipt-item-amount"
              type="number"
              inputMode="decimal"
              value={adj.amount}
              onChange={(e) => updateAdjustment(index, { amount: e.target.value === '' ? '' : Number(e.target.value) })}
              aria-label={`Adjustment ${index + 1} amount`}
            />
            <button type="button" className="receipt-remove" onClick={() => setAdjustments(adjustments.filter((_, i) => i !== index))} aria-label={`Remove ${adj.label}`}>
              <i className="fi fi-rr-cross-small"></i>
            </button>
          </div>
          {adj.originalLabel && <div className="receipt-original">Printed: {adj.originalLabel}</div>}
        </React.Fragment>
      ))}
      <button type="button" className="receipt-add" onClick={() => setAdjustments([...adjustments, { type: 'other', label: '', amount: '' }])}>
        <i className="fi fi-rr-plus-small"></i> Add adjustment
      </button>

      <div className="receipt-section-title">
        <span>Tax refund</span>
        <span className="receipt-hint">
          Enter what you actually got back. It comes off the share of whoever shares each refunded item.
        </span>
      </div>
      {refundOn ? (
        <>
          <div className="receipt-item-row adjustment">
            <span className="receipt-refund-label">Refund received</span>
            <input
              className="receipt-item-amount"
              type="number"
              inputMode="decimal"
              min="0"
              value={taxRefund.received}
              onChange={(e) => setTaxRefund({ received: e.target.value === '' ? '' : Number(e.target.value) })}
              aria-label="Tax refund received"
            />
            <button type="button" className="receipt-remove" onClick={() => setTaxRefund(null)} aria-label="Remove tax refund">
              <i className="fi fi-rr-cross-small"></i>
            </button>
          </div>
          <div className="receipt-refund-meta">
            <span>
              {expected > 0
                ? `Tax on the refunded items: ${currency} ${fmt(expected)}`
                : 'Choose a tax rate on each refunded item above'}
            </span>
            <select
              value=""
              onChange={(e) => e.target.value !== '' && setItems(items.map(item => ({ ...item, refundRate: Number(e.target.value) })))}
              aria-label="Set the tax rate of all items"
            >
              <option value="">Set all items…</option>
              <option value="0">No refund</option>
              {REFUND_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
            </select>
          </div>
          {expected > 0 && received > expected && (
            <div className="receipt-item-warning">
              That is more than the tax on these items. Check the amount or the tax rates.
            </div>
          )}
        </>
      ) : (
        <button type="button" className="receipt-add" onClick={() => setTaxRefund({ received: '' })}>
          <i className="fi fi-rr-plus-small"></i> Add tax refund
        </button>
      )}

      <div className={`receipt-totals ${difference !== 0 ? 'mismatch' : ''}`}>
        <div>Items {fmt(itemsTotal)} {adjustmentsTotal !== 0 && <>{adjustmentsTotal > 0 ? '+' : '−'} {fmt(Math.abs(adjustmentsTotal))}</>} = {fmt(itemsTotal + adjustmentsTotal)}</div>
        <div>Receipt total {currency} {fmt(total)}</div>
        {received > 0 && <div>− Tax refund {fmt(received)} = Net {currency} {fmt(net)}</div>}
        {difference !== 0 && (
          <div className="receipt-mismatch">
            <span>Off by {currency} {fmt(difference)}: check the items, or</span>
            <button
              type="button"
              onClick={() => setAdjustments([...adjustments, { type: 'rounding', label: 'Difference', amount: difference }])}
            >
              share the difference
            </button>
          </div>
        )}
      </div>

      <div className="receipt-summary">
        {preview.splits ? (
          preview.splits.map(split => (
            <div key={split.userId} className="receipt-summary-row">
              <span>{nameOf(split.userId)}</span>
              <span>{currency} {fmt(split.amount)}</span>
            </div>
          ))
        ) : (
          <div className="receipt-summary-pending">
            {preview.error?.code === 'UNASSIGNED_ITEM' ? 'Assign every item to see each person\'s share' :
             preview.error?.code === 'TOTAL_MISMATCH' ? 'Totals must match to see each person\'s share' :
             preview.error?.code === 'NO_REFUND_ITEMS' ? 'Choose a tax rate on the refunded items to see each person\'s share' :
             preview.error?.message || 'Add items to see each person\'s share'}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptItemsEditor;

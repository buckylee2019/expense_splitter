import React, { useState, useEffect } from 'react';
import UserPhoto from './UserPhoto';

const MultiplePaidByPopup = ({ 
  isOpen, 
  onClose, 
  members, 
  currentUser,
  totalAmount,
  currency,
  onSave
}) => {
  const [payers, setPayers] = useState([]);

  // Initialize payers when popup opens
  useEffect(() => {
    if (isOpen && members) {
      const initialPayers = members.map(member => ({
        userId: member.user,
        amount: 0,
        included: false
      }));
      setPayers(initialPayers);
    }
  }, [isOpen, members]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAmountChange = (userId, amount) => {
    const numAmount = Math.max(0, parseFloat(amount) || 0);
    setPayers(prev => prev.map(payer => 
      payer.userId === userId 
        ? { ...payer, amount: numAmount, included: numAmount > 0 }
        : payer
    ));
  };

  const handleDone = () => {
    const activePayers = payers.filter(p => p.included && p.amount > 0);
    onSave(activePayers);
    onClose();
  };

  const totalPaid = payers.reduce((sum, payer) => sum + (payer.included ? payer.amount : 0), 0);
  const remainingAmount = Math.max(0, totalAmount - totalPaid);
  const activePayers = payers.filter(p => p.included && p.amount > 0);
  const isValid = activePayers.length > 0;
  
  // Check if amounts match (with small tolerance for rounding)
  const amountsMatch = Math.abs(totalPaid - totalAmount) < 0.01;
  const hasOverpayment = totalPaid > totalAmount + 0.01;
  const hasUnderpayment = totalPaid < totalAmount - 0.01;

  const getCurrencySymbol = (curr) => {
    switch(curr) {
      case 'TWD': return '¥';
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'JPY': return '¥';
      default: return curr;
    }
  };

  return (
    <div className="popup-overlay" onClick={handleBackdropClick}>
      <div className="popup-selector enter-paid-amounts-popup">
        <div className="popup-header">
          <div className="header-left">
            <button className="back-button" onClick={onClose}>
              <i className="fi fi-rr-angle-left"></i>
            </button>
          </div>
          <div className="header-center">
            <h3>Enter paid amounts</h3>
          </div>
          <div className="header-right">
            <button 
              className={`done-button ${!isValid ? 'disabled' : ''}`}
              onClick={handleDone}
              disabled={!isValid}
            >
              Done
            </button>
          </div>
        </div>
        
        <div className="popup-content">
          <div className="paid-amounts-list">
            {members?.map((member) => {
              const payer = payers.find(p => p.userId === member.user);
              const isCurrentUser = member.user === currentUser?.id;
              const displayName = member.userName || member.user;
              const amount = payer?.amount || 0;
              
              return (
                <div 
                  key={member.user} 
                  className="paid-amount-item"
                >
                  <div className="payer-info">
                    <div className="member-profile">
                      <UserPhoto 
                        user={{ 
                          id: member.user, 
                          name: displayName,
                          avatarUrl: member?.avatarUrl,
                          avatar: member?.avatar
                        }} 
                        size="medium"
                      />
                    </div>
                    <div className="member-details">
                      <span className="member-name">
                        {isCurrentUser ? 'Buttchick' : displayName}
                      </span>
                    </div>
                  </div>
                  <div className="amount-input-section">
                    <span className="currency-symbol">{getCurrencySymbol(currency)}</span>
                    <input
                      type="number"
                      value={amount || ''}
                      onChange={(e) => handleAmountChange(member.user, e.target.value)}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className="amount-input-underlined"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="total-summary">
            <div className="total-line">
              {getCurrencySymbol(currency)}{totalPaid.toFixed(2)} of {getCurrencySymbol(currency)}{totalAmount.toFixed(2)}
            </div>
            <div className={`remaining-line ${hasOverpayment ? 'overpaid' : hasUnderpayment ? 'underpaid' : 'balanced'}`}>
              {hasOverpayment ? 
                `${getCurrencySymbol(currency)}${(totalPaid - totalAmount).toFixed(2)} overpaid` :
                hasUnderpayment ?
                `${getCurrencySymbol(currency)}${remainingAmount.toFixed(2)} left` :
                'Amounts match ✓'
              }
            </div>
            {!amountsMatch && (
              <div className="validation-message">
                {hasOverpayment ? 
                  'Warning: Total paid exceeds expense amount' :
                  'Note: Total paid is less than expense amount'
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiplePaidByPopup;

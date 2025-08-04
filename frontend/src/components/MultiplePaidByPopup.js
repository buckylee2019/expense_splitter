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

  const handlePayerToggle = (userId) => {
    setPayers(prev => prev.map(payer => 
      payer.userId === userId 
        ? { ...payer, included: !payer.included, amount: payer.included ? 0 : payer.amount }
        : payer
    ));
  };

  const handleAmountChange = (userId, amount) => {
    const numAmount = Math.max(0, parseFloat(amount) || 0);
    setPayers(prev => prev.map(payer => 
      payer.userId === userId 
        ? { ...payer, amount: numAmount, included: numAmount > 0 }
        : payer
    ));
  };

  const handleSave = () => {
    const activePayers = payers.filter(p => p.included && p.amount > 0);
    onSave(activePayers);
    onClose();
  };

  const totalPaid = payers.reduce((sum, payer) => sum + (payer.included ? payer.amount : 0), 0);
  const activePayers = payers.filter(p => p.included && p.amount > 0);
  const isValid = activePayers.length > 0;

  return (
    <div className="popup-overlay" onClick={handleBackdropClick}>
      <div className="popup-selector multiple-paid-by-popup">
        <div className="popup-header">
          <div className="header-left">
            <h3>Multiple payers</h3>
          </div>
          <button className="popup-close" onClick={onClose}>
            <i className="fi fi-rr-cross"></i>
          </button>
        </div>
        
        <div className="popup-content">
          <div className="multiple-payers-list">
            {members?.map((member) => {
              const payer = payers.find(p => p.userId === member.user);
              const isCurrentUser = member.user === currentUser?.id;
              const displayName = member.userName || member.user;
              const isIncluded = payer?.included || false;
              const amount = payer?.amount || 0;
              
              return (
                <div 
                  key={member.user} 
                  className={`multiple-payer-item ${isIncluded ? 'included' : ''}`}
                >
                  <div className="payer-row">
                    <div className="payer-left">
                      <div className="payer-toggle">
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => handlePayerToggle(member.user)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
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
                          {displayName}{isCurrentUser ? ' (You)' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="payer-right">
                      <div className="amount-input-container">
                        <input
                          type="number"
                          value={amount || ''}
                          onChange={(e) => handleAmountChange(member.user, e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="amount-input"
                          disabled={!isIncluded}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="multiple-payers-summary">
            <div className="summary-row">
              <span className="summary-label">Total paid:</span>
              <span className="summary-value">{totalPaid.toFixed(2)}</span>
            </div>
            {totalAmount > 0 && (
              <div className="summary-row">
                <span className="summary-label">Expense amount:</span>
                <span className="summary-value">{totalAmount.toFixed(2)}</span>
              </div>
            )}
            {totalAmount > 0 && Math.abs(totalPaid - totalAmount) > 0.01 && (
              <div className="summary-row">
                <span className="summary-label">
                  {totalPaid > totalAmount ? 'Overpaid:' : 'Remaining:'}
                </span>
                <span className={`summary-value ${totalPaid > totalAmount ? 'overpaid' : 'remaining'}`}>
                  {Math.abs(totalPaid - totalAmount).toFixed(2)}
                </span>
              </div>
            )}
            {activePayers.length > 0 && (
              <div className="summary-row">
                <span className="summary-label">Active payers:</span>
                <span className="summary-value">{activePayers.length}</span>
              </div>
            )}
          </div>
        </div>

        <div className="popup-actions">
          <button
            type="button"
            onClick={handleSave}
            className={`button primary full-width ${!isValid ? 'disabled' : ''}`}
            disabled={!isValid}
          >
            Save ({activePayers.length} payer{activePayers.length !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiplePaidByPopup;

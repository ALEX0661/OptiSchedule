import React, { useState, useEffect } from 'react';
import '../styles/ScheduleManagement.css'; // Reusing your existing styles

const SaveScheduleModal = ({ isOpen, onClose, onConfirm, currentName, existingSchedules = [] }) => {
  const [scheduleName, setScheduleName] = useState(currentName);
  const [error, setError] = useState('');
  const [isOverwrite, setIsOverwrite] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScheduleName(currentName);
      setError('');
      setIsOverwrite(false);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleNameChange = (e) => {
    setScheduleName(e.target.value);
    // Reset overwrite warning if user changes the name
    if (isOverwrite) {
      setIsOverwrite(false);
      setError('');
    }
    if (error) setError('');
  };

  const handleConfirm = () => {
    const trimmedName = scheduleName.trim();
    
    if (!trimmedName) {
      setError('Schedule name cannot be empty.');
      return;
    }

    // Check for duplicate name
    if (!isOverwrite && existingSchedules.includes(trimmedName)) {
      setError('A schedule with this name already exists.');
      setIsOverwrite(true);
      return;
    }

    onConfirm(trimmedName);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="group-modal" style={{ maxWidth: '450px', maxHeight: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="group-modal-header">
          <h3>{isOverwrite ? 'Confirm Overwrite' : 'Save Schedule'}</h3>
          <button className="group-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="group-modal-content" style={{ overflow: 'visible', padding: '24px' }}>
          <p style={{ marginBottom: '20px', fontSize: '0.9rem', color: '#555', lineHeight: '1.5' }}>
            {isOverwrite 
              ? `Are you sure you want to overwrite "${scheduleName}"? This action cannot be undone.`
              : "Please confirm or edit the name for this schedule before saving."
            }
          </p>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.85rem', color: '#333' }}>
              Schedule Name
            </label>
            <input
              type="text"
              value={scheduleName}
              onChange={handleNameChange}
              className="filter-select"
              style={{ 
                width: '100%', 
                padding: '10px', 
                fontSize: '1rem',
                borderColor: isOverwrite ? '#ed6c02' : undefined // Orange border for warning
              }}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
            {error && (
              <p style={{ 
                color: isOverwrite ? '#ed6c02' : '#d32f2f', // Orange for warning, Red for error
                fontSize: '0.8rem', 
                marginTop: '6px',
                fontWeight: isOverwrite ? '600' : '400',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {isOverwrite && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                )}
                {isOverwrite ? 'Warning: ' + error : error}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
            <button 
              onClick={onClose}
              className="modal-btn cancel-btn"
              style={{ padding: '8px 16px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', color: '#333', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              className="save-schedule-btn"
              style={{ 
                margin: 0,
                backgroundColor: isOverwrite ? '#ed6c02' : undefined, // Orange button for overwrite
                borderColor: isOverwrite ? '#e65100' : undefined
              }}
            >
              {isOverwrite ? 'Yes, Overwrite' : 'Confirm & Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveScheduleModal;
import React, { useState } from 'react';
import "../styles/UnassignModal.css";

const UnassignConfirmationModal = ({ groupEvents = [], onCancel, onConfirm }) => {
  // NEW: State to track processing status
  const [isProcessing, setIsProcessing] = useState(false);

  // Get course info from first event
  const courseInfo =
    groupEvents.length > 0
      ? `${groupEvents[0].title || '-'} (${groupEvents[0].courseCode || '-'})`
      : '-';

  const program = groupEvents.length > 0 ? groupEvents[0].program || '' : '';
  const year = groupEvents.length > 0 && groupEvents[0].year ? `Year ${groupEvents[0].year}` : '';
  
  // Get unique blocks from all events
  const uniqueBlocks = groupEvents.length > 0 
    ? [...new Set(groupEvents.map(e => e.block))].sort()
    : [];

  // FIX: Check if it's an online class
  const isOnline = groupEvents.length > 0 && (groupEvents[0].room || '').toLowerCase() === 'online';
  
  // FIX: Only consider it "Merged" if there are multiple blocks AND it is NOT online
  const isMerged = uniqueBlocks.length > 1 && !isOnline;
  
  // Create block display text
  // If isMerged is false (because it's online), it will default to showing the single block being unassigned
  const blockDisplay = isMerged 
    ? `Blocks ${uniqueBlocks.join(', ')}` 
    : `Block ${uniqueBlocks[0] || ''}`;
  
  const groupSummary = `${program} ${year} ${blockDisplay}`.trim();

  // NEW: Handler to trigger the visual effects
  const handleConfirmClick = () => {
    if (isProcessing) return; // Prevent double clicks
    
    setIsProcessing(true);
    // Call the parent function. The modal will remain in "processing" state
    // until the parent component finishes the API call and unmounts this modal.
    onConfirm();
  };

  return (
    <div className="modal-overlay" onClick={!isProcessing ? onCancel : undefined}>
      <div 
        className={`unassign-modal ${isProcessing ? 'processing' : ''}`} 
        onClick={e => e.stopPropagation()}
      >
        {/* Wrapper to fade all content together */}
        <div className={`modal-inner-content ${isProcessing ? 'faded' : ''}`}>
          <header className="unassign-modal-header">
            <h2>Unassign Schedule</h2>
            <p>
              You are about to unassign all {" "}
              <strong>{courseInfo}</strong>
              {groupSummary && <span> classes of <strong>{groupSummary}</strong></span>}
              {/* Only show Merged Indicator if isMerged is true (which excludes Online) */}
              {isMerged && <span className="merged-indicator"> (Merged Classes)</span>}.
            </p>
          </header>
          <div className="unassign-modal-content">
            <p className="unassign-info">
              The following events will be unassigned:
              {isMerged && (
                <span style={{ fontStyle: 'italic', fontSize: '0.9em', marginLeft: '8px' }}>
                  (Includes all merged blocks)
                </span>
              )}
            </p>
            
            <div className="modal-table-container" style={{ overflowX: 'hidden' }}>
              <table 
                className="assigned-events-table" 
                style={{ width: '100%', tableLayout: 'fixed', minWidth: 'auto' }}
              >
                <colgroup>
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '25%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Block</th>
                    <th>Course</th>
                    <th>Day</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {groupEvents.map(event => (
                    <tr key={event.schedule_id}>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.session || '-'}
                      </td>
                      <td style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        // FIX: Only apply bold/blue styling if truly merged (not online)
                        fontWeight: isMerged ? '600' : 'normal',
                        color: isMerged ? '#2563eb' : 'inherit'
                      }}>
                        {event.block || '-'}
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.title} ({event.courseCode})
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.day}
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.period}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <footer className="unassign-modal-footer">
            <button 
              className="modal-btn cancel-btn" 
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button 
              className="modal-btn confirm-btn" 
              onClick={handleConfirmClick}
              disabled={isProcessing}
            >
              Confirm Unassign
            </button>
          </footer>
        </div>

        {/* NEW: Spinner Overlay */}
        {isProcessing && (
          <div className="modal-processing-overlay">
            <div className="processing-spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnassignConfirmationModal;
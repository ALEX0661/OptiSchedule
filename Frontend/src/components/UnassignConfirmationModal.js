import React from 'react';
import "../styles/UnassignModal.css";

const UnassignConfirmationModal = ({ groupEvents = [], onCancel, onConfirm }) => {
  
  const courseInfo =
    groupEvents.length > 0
      ? `${groupEvents[0].title || '-'} (${groupEvents[0].courseCode || '-'})`
      : '-';

  
  const program = groupEvents.length > 0 ? groupEvents[0].program || '' : '';
  const year = groupEvents.length > 0 && groupEvents[0].year ? `Year ${groupEvents[0].year}` : '';
  const block = groupEvents.length > 0 ? groupEvents[0].block || '' : '';
  const groupSummary = `${program} ${year} ${block}`.trim();

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="unassign-modal" onClick={e => e.stopPropagation()}>
        <header className="unassign-modal-header">
          <h2>Unassign Schedule</h2>
          <p>
            You are about to unassign all {" "}
            <strong>{courseInfo}</strong>
            {groupSummary && <span> classes of <strong>{groupSummary}</strong></span>}.
          </p>
        </header>
        <div className="unassign-modal-content">
          <p className="unassign-info">The following events will be unassigned:</p>
          
          {/* Added overflow-x: hidden to container to prevent scrolling */}
          <div className="modal-table-container" style={{ overflowX: 'hidden' }}>
            
            {/* Added tableLayout: fixed, width: 100%, and removed minWidth to force fit */}
            <table 
              className="assigned-events-table" 
              style={{ width: '100%', tableLayout: 'fixed', minWidth: 'auto' }}
            >
              <colgroup>
                      {/* ADJUSTED WIDTHS: Total is now 100% (15+45+15+25) */}
                      <col style={{ width: '15%' }} /> {/* Session */}
                      <col style={{ width: '45%' }} /> {/* Course - Reduced slightly to fit */}
                      <col style={{ width: '15%' }} /> {/* Day */}
                      <col style={{ width: '25%' }} /> {/* Time - Reduced slightly to fit */}
              </colgroup>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Course</th>
                  <th>Day</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {groupEvents.map(event => (
                  <tr key={event.schedule_id}>
                    {/* Added text truncation styles just in case content is very long */}
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {event.session || '-'}
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
          <button className="modal-btn cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="modal-btn confirm-btn" onClick={onConfirm}>
            Confirm Unassign
          </button>
        </footer>
      </div>
    </div>
  );
};

export default UnassignConfirmationModal;
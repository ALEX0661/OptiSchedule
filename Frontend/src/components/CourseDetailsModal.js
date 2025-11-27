import React from 'react';
import '../styles/CourseDetailsModal.css';
import '../styles/ScheduleManagement.css'; 

const CourseDetailsModal = ({ event, onClose }) => {
  if (!event) return null;

  // Helper to shorten session names
  const shortenSession = (session) => {
    if (!session) return '';
    return session.replace(/Laboratory/gi, 'LAB').replace(/Lecture/gi, 'LEC');
  };

  // Shared style to force text wrapping on all cells
  const wrapStyle = { 
    whiteSpace: 'normal', 
    wordWrap: 'break-word', 
    overflow: 'visible',
    textOverflow: 'clip',
    verticalAlign: 'top' // Ensures multi-line text aligns to the top of the cell
  };

  return (
    <div className="course-details-overlay" onClick={onClose}>
      <div className="course-details-modal wide-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="course-details-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <h2>{event.courseCode}</h2>
            {event.status === 'Merged' && <span className="status-badge merged">Merged</span>}
            {event.status === 'Conflict' && <span className="status-badge conflict">Conflict</span>}
          </div>
          <p>{event.title}</p>
        </div>

        <div className="course-details-content">
          {/* Primary Info Card */}
          <div className="details-card-container">
            <h4 className="details-card-title">Selected Class Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Instructor</span>
                <span className="info-value">{event.faculty || 'Unassigned'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Section</span>
                <span className="info-value">{event.program} {event.year}-{event.block}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Schedule</span>
                <span className="info-value">{event.day}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Schedule</span>
                <span className="info-value">{event.period}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Room</span>
                <span className="info-value">{event.room}</span>
              </div>
            </div>
          </div>

          {/* Related Events Table (Conflicts/Merges) */}
          {event.relatedEvents && event.relatedEvents.length > 0 ? (
            <div className="details-section">
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#333' }}>
                Related Schedule Classes
                <span style={{ fontSize: '0.75em', fontWeight: 'normal', color: '#666' }}>
                  (Conflicts, Merges, or Overlaps)
                </span>
              </h4>
              
              <div className="modal-table-container">
                <table className="assigned-events-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '6%' }} />  {/* Session */}
                    <col style={{ width: '20%' }} /> {/* Course */}
                    <col style={{ width: '12%' }} /> {/* Section */}
                    <col style={{ width: '14%' }} /> {/* Faculty */}
                    <col style={{ width: '6%' }} />  {/* Room */}
                    <col style={{ width: '10%' }} />  {/* Day */}
                    <col style={{ width: '14%' }} /> {/* Time */}
                    <col style={{ width: '18%' }} /> {/* Reason */}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>SESS</th>
                      <th>COURSE</th>
                      <th>SECTION</th>
                      <th>FACULTY</th>
                      <th>ROOM</th>
                      <th>DAY</th>
                      <th>TIME</th>
                      <th>REASON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {event.relatedEvents.map((relEvent, idx) => (
                      <tr key={`${relEvent.schedule_id}-${idx}`}>
                        <td className="center-text" style={wrapStyle}>
                          {shortenSession(relEvent.session)}
                        </td>
                        
                        <td style={wrapStyle}>
                          {/* Removing .course-cell class to prevent CSS ellipsis inheritance */}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--primary-dark)' }}>
                              {relEvent.courseCode}
                            </span>
                            <span style={{ fontSize: '0.6rem', color: '#555', lineHeight: '1.3' }}>
                              {relEvent.title}
                            </span>
                          </div>
                        </td>

                        <td style={wrapStyle}>
                          <div style={{ fontSize: '0.75rem' }}>
                            {relEvent.program} {relEvent.year}-{relEvent.block}
                          </div>
                        </td>

                        <td style={wrapStyle}>
                          <div style={{ fontSize: '0.75rem' }}>
                            {relEvent.faculty || 'Unassigned'}
                          </div>
                        </td>

                        <td className="center-text" style={wrapStyle}>
                          {relEvent.room || '-'}
                        </td>

                        <td className="center-text" style={wrapStyle}>
                          {relEvent.day}
                        </td>

                        <td className="time-cell" style={{ ...wrapStyle, fontSize: '0.85em' }}>
                          {relEvent.period}
                        </td>

                        <td style={{ 
                            ...wrapStyle,
                            fontWeight: "600", 
                            fontSize: "0.85em", 
                            lineHeight: "1.3",
                            color: relEvent.relationType.toLowerCase().includes('conflict') ? 'var(--red)' : 'var(--blue)'
                          }}>
                          {relEvent.relationType}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="no-conflicts-message">
              No conflicts or merged classes found for this event.
            </div>
          )}
        </div>

        <div className="course-details-footer">
          <button className="modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailsModal;
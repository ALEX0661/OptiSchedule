import React from 'react';
import '../styles/CourseDetailsModal.css';

const CourseDetailsModal = ({ event, onClose }) => {
  if (!event) return null;

  // Combine the current event with its related events to show the full list in the table
  // We check if relatedEvents exist and have length > 0 before creating the combined list
  const hasRelated = event.relatedEvents && event.relatedEvents.length > 0;
  
  const allInvolvedEvents = hasRelated ? [
    // Add the current event first, marking it as 'Current' for the table
    { 
      ...event, 
      relationType: event.status === 'Normal' ? 'Current' : event.status 
    },
    // Spread the rest of the related events
    ...event.relatedEvents
  ] : [];

  return (
    <div className="course-details-overlay" onClick={onClose}>
      <div className="course-details-modal" onClick={(e) => e.stopPropagation()}>
        
        <div className="course-details-header">
          <h2>{event.courseCode}</h2>
          <p>{event.title}</p>
        </div>

        <div className="course-details-content">
          {/* Primary Info */}
          <div className="details-section">
            <h4>Session Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Program & Block</span>
                <span className="info-value">{event.program} {event.year}-{event.block}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Schedule</span>
                <span className="info-value">{event.day} | {event.period}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Room</span>
                <span className="info-value">{event.room}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Instructor</span>
                <span className="info-value">{event.faculty || 'Unassigned'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Session Type</span>
                <span className="info-value">{event.session}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status</span>
                <span>
                  <span className={`status-badge ${event.status.toLowerCase()}`}>
                    {event.status}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Related Events Table (Merges/Conflicts) - Shows ALL related schedules including current */}
          {hasRelated && (
            <div className="details-section">
              <h4>
                {event.status === 'Merged' ? 'Merged Sections' : 'Conflicting Classes'}
              </h4>
              <div className="modal-table-container">
                <table className="details-table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Program</th>
                      <th>Room</th>
                      <th>Time</th>
                      <th>Relation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allInvolvedEvents.map((related, idx) => {
                      // Determine badge style
                      const badgeClass = related.relationType === 'Current' 
                        ? 'normal' 
                        : related.relationType.toLowerCase().includes('conflict') 
                          ? 'conflict' 
                          : 'merged';

                      // Highlight the current row slightly
                      const rowStyle = idx === 0 ? { backgroundColor: 'rgba(0, 0, 0, 0.02)' } : {};

                      return (
                        <tr key={idx} style={rowStyle}>
                          <td>
                            <strong>{related.courseCode}</strong><br/>
                            <span style={{fontSize: '0.8em', color: '#666'}}>{related.title}</span>
                          </td>
                          <td>{related.program} {related.year}-{related.block}</td>
                          <td>{related.room}</td>
                          <td>{related.period}</td>
                          <td>
                            <span className={`status-badge ${badgeClass}`}>
                              {idx === 0 ? `${related.relationType} (This)` : related.relationType}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
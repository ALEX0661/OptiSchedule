import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  calculateFacultyUnits,
  getFacultyLoadColor,
  isFacultyAvailableForGroup,
} from '../utils/scheduleHelpers';
import noFacultyLogo from '../assets/noFacultyLogo.png';
import FacultyLoader from '../animations/FacultyLoader';

// --- FIXED: Constants moved OUTSIDE component to avoid dependency issues ---
const dayMapping = {
  Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'Th',
  Friday: 'F', Saturday: 'Sat', Sunday: 'Sun',
};
const dayOrder = ['M', 'T', 'W', 'Th', 'F', 'Sat', 'Sun'];

const FacultyPanel = ({
  faculty,
  facultySearch,
  onFacultySearchChange,
  selectedGroup,
  schedule,
  onAssignFaculty,
  onOpenFacultyModal,
  isLoadingFaculty,
  fetchError,
}) => {
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  
  // NEW: State to track which specific faculty ID is currently being assigned
  const [assigningFacultyId, setAssigningFacultyId] = useState(null);

  // Memoize filtered faculty list
  const filteredFaculty = useMemo(() => {
    return faculty.filter((f) =>
      f.name.toLowerCase().includes(facultySearch.toLowerCase())
    );
  }, [faculty, facultySearch]);

  const getSelectedGroupBlocks = () => {
    if (!selectedGroup || !selectedGroup.groupEvents || selectedGroup.groupEvents.length === 0) {
      return [];
    }
    const blocks = [...new Set(selectedGroup.groupEvents.map(e => e.block))];
    return blocks.sort();
  };

  const toMinutes = (timeStr) => {
    const [time, meridiem] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  // Memoize formatted schedule events
  const formattedScheduleEvents = useMemo(() => {
    if (!selectedGroup?.groupEvents?.length) return [];

    const sortedEvents = selectedGroup.groupEvents.slice().sort((a, b) => {
      const aStart = toMinutes(a.period.split(' - ')[0]);
      const bStart = toMinutes(b.period.split(' - ')[0]);
      return aStart - bStart;
    });

    const mergedEventsMap = sortedEvents.reduce((acc, event) => {
      const key = `${event.courseCode}-${event.session}-${event.program}-${event.year}-${event.block}-${event.room}-${event.period}`;
      const dayAbbrev = dayMapping[event.day] || event.day;
      if (acc[key]) {
        if (dayAbbrev && !acc[key].dayAbbrevs.includes(dayAbbrev)) {
          acc[key].dayAbbrevs.push(dayAbbrev);
        }
      } else {
        acc[key] = { ...event, dayAbbrevs: [dayAbbrev] };
      }
      return acc;
    }, {});

    return Object.values(mergedEventsMap).map((event) => {
      const sortedDayAbbrevs = event.dayAbbrevs.sort(
        (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
      );
      return { ...event, day: sortedDayAbbrevs.join('') };
    });
  }, [selectedGroup]);

  // NEW: Local handler to manage loading state during assignment
  const handleCardClick = async (f, available) => {
    // If no group is selected, just open details
    if (!selectedGroup) {
      onOpenFacultyModal(f);
      return;
    }

    // UPDATED: We no longer return if !available. 
    // We allow the click to proceed even if there is a conflict.

    // If we are already assigning someone, prevent clicks
    if (assigningFacultyId !== null) return;

    // Start assignment process
    setAssigningFacultyId(f.id);
    
    try {
      // await the parent prop function
      await onAssignFaculty(f);
    } catch (error) {
      console.error("Assignment failed within panel:", error);
    } finally {
      // Stop loading state regardless of success/failure
      setAssigningFacultyId(null);
    }
  };

  return (
    <div className="card">
      <div className="faculty-header">
        <h3 className="faculty-title">Faculty Members</h3>
        {selectedGroup && selectedGroup.groupEvents && selectedGroup.groupEvents.length > 0 && (
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="group-info-btn"
            title="View Selected Group Details"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        )}
      </div>

      {/* --- UPDATED: Minimal Selection Hint --- */}
      {selectedGroup && (
        <div className="selection-hint">
          <span className="status-dot"></span>
          Select a faculty to assign
        </div>
      )}
      
      <input
        type="text"
        className="faculty-search"
        placeholder="Search faculty by name..."
        value={facultySearch}
        onChange={onFacultySearchChange}
      />

      <div className="faculty-content">
        {isLoadingFaculty ? (
          <div className="faculty-loader-container"><FacultyLoader /></div>
        ) : fetchError ? (
          <div className="no-faculty-container">
            <img src={noFacultyLogo} alt="Error fetching faculty" className="no-faculty-logo" />
            <p>Error fetching faculty.</p>
          </div>
        ) : filteredFaculty.length === 0 ? (
          <div className="no-faculty-container">
            <img src={noFacultyLogo} alt="No Faculty Found" className="no-faculty-logo" />
            <p>No faculty members found.</p>
          </div>
        ) : (
          <div className="faculty-cards">
            {filteredFaculty.map((f) => {
              const available = selectedGroup ? isFacultyAvailableForGroup(f, selectedGroup, schedule) : true;
              const unitCount = calculateFacultyUnits(f.name, schedule);
              const loadColor = getFacultyLoadColor(f, unitCount);
              
              // Determine states
              const isAssigningThis = assigningFacultyId === f.id;
              const isAnyAssigning = assigningFacultyId !== null;
              
              // UPDATED LOGIC:
              // 1. Conflict State: If selectedGroup exists AND !available
              const hasConflict = selectedGroup && !available;

              // 2. Disabled State: Only disable if we are currently assigning SOMEONE ELSE.
              //    We DO NOT disable if hasConflict is true (per request).
              const isDisabled = isAnyAssigning && !isAssigningThis;

              return (
                <div
                  key={f.id}
                  className={`faculty-card 
                    ${isDisabled ? 'disabled' : ''} 
                    ${isAssigningThis ? 'assigning' : ''}
                    ${hasConflict ? 'conflict' : ''} 
                  `}
                  onClick={() => !isDisabled && handleCardClick(f, available)}
                  style={{ cursor: (!isDisabled && (selectedGroup || !isAnyAssigning)) ? 'pointer' : 'default' }}
                >
                  {/* Content Wrapper - fades when assigning */}
                  <div className={`faculty-info ${isAssigningThis ? 'faded' : ''}`}>
                    <div className="faculty-name-text">{f.name}</div>
                    <div className="faculty-status">
                      <span>{f.Status || f.status}</span>
                      <span className="faculty-workload">{unitCount} units</span>
                      <div className={`status-indicator status-${loadColor}`}></div>
                      {/* Optional: Add a text indicator for conflict */}
                      {hasConflict && <span className="conflict-text">Conflict</span>}
                    </div>
                  </div>

                  {/* Spinner - Only visible when assigning this specific card */}
                  {isAssigningThis && (
                    <div className="assignment-spinner-overlay">
                       <div className="assignment-spinner"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isGroupModalOpen && ReactDOM.createPortal(
        <div className="group-modal-overlay" onClick={() => setIsGroupModalOpen(false)}>
          <div className="group-modal" onClick={(e) => e.stopPropagation()}>
            <div className="group-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h3>Selected Group Details {selectedGroup.isMerged && (<span className="modal-merged-badge">🔗 Merged</span>)}</h3>
              </div>
              <button className="group-modal-close" onClick={() => setIsGroupModalOpen(false)}>×</button>
            </div>

            <div className="group-modal-content">
              <div className="modal-info-grid">
                <div className="modal-info-card modal-info-full">
                  <div className="modal-info-label">Course Title</div>
                  <div className="modal-info-value">{selectedGroup.groupEvents[0].title}</div>
                </div>
                <div className="modal-info-card">
                  <div className="modal-info-label">Course Code</div>
                  <div className="modal-info-value modal-course-code">{selectedGroup.groupEvents[0].courseCode}</div>
                </div>
                <div className="modal-info-card">
                  <div className="modal-info-label">Program & Year</div>
                  <div className="modal-info-value">{selectedGroup.groupEvents[0].program} - Year {selectedGroup.groupEvents[0].year}</div>
                </div>
                <div className="modal-info-card">
                  <div className="modal-info-label">Block{selectedGroup.isMerged ? 's' : ''}</div>
                  <div className="modal-info-value modal-blocks">{getSelectedGroupBlocks().join(' + ')}</div>
                </div>
                <div className="modal-info-card">
                  <div className="modal-info-label">Total Schedules</div>
                  <div className="modal-info-value modal-schedules">{selectedGroup.groupEvents.length}</div>
                </div>
              </div>

              {selectedGroup.isMerged && (
                <div className="modal-notice">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <span>Faculty assignment will apply to all merged blocks in this group.</span>
                </div>
              )}

              <div className="modal-schedules-section">
                <h3 className="modal-section-title">Schedule Events</h3>
                <div className="modal-table-container">
                  <table className="assigned-events-table">
                    <colgroup>
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '15%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Session</th>
                        <th>Program</th>
                        <th>Year</th>
                        <th>Block</th>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Room</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formattedScheduleEvents.map((event, index) => (
                        <tr key={`${event.schedule_id}-${index}`}>
                          <td>{event.session}</td>
                          <td>{event.program}</td>
                          <td>{event.year}</td>
                          <td>{event.block}</td>
                          <td>{event.day}</td>
                          <td>{event.period}</td>
                          <td>{event.room}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button className="group-modal-close-btn" onClick={() => setIsGroupModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FacultyPanel;
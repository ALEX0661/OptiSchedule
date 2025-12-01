import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  calculateFacultyUnits,
  getFacultyLoadColor,
  isFacultyAvailableForGroup,
} from '../utils/scheduleHelpers';
import noFacultyLogo from '../assets/noFacultyLogo.png';
import FacultyLoader from '../animations/FacultyLoader';

// --- Constants moved OUTSIDE component ---
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
  const [assigningFacultyId, setAssigningFacultyId] = useState(null);

  // --- FIXED: Exact course title matching (ignoring spaces and case only) ---
  const calculateMatchScore = (specialization, courseTitle) => {
    if (!specialization || !courseTitle) return 0;
    
    const specLower = (specialization || '').toLowerCase().trim();
    const titleLower = (courseTitle || '').toLowerCase().trim();
    
    // Return 0 if specialization is empty or just whitespace
    if (!specLower || !titleLower) return 0;
    
    // Normalize: remove all spaces for exact comparison
    const normalizeText = (text) => text.replace(/\s+/g, '').toLowerCase();
    const normalizedTitle = normalizeText(courseTitle);
    
    // Split the specialization string by comma (e.g., "Introduction to Computing (5), Game Programming 1 (3)")
    const specs = specLower.split(',').map(s => s.trim()).filter(s => s);
    
    // Return 0 if no valid specializations
    if (specs.length === 0) return 0;
    
    let bestScore = 0;

    specs.forEach(specEntry => {
        // Regex to extract subject name and rating: "Subject Name (5)"
        const match = specEntry.match(/^(.+?)\s*\((\d)\)$/);
        
        if (match) {
            const subjectName = match[1].trim();
            const rating = parseInt(match[2], 10);
            
            // CRITICAL: Skip if rating is 0 or subject name is empty
            if (!subjectName || rating === 0) return;
            
            // Normalize subject name (remove spaces)
            const normalizedSubject = normalizeText(subjectName);
            
            // EXACT MATCH: Compare normalized strings (ignoring spaces only)
            if (normalizedSubject === normalizedTitle) {
                if (rating > bestScore) bestScore = rating;
            }
        }
    });

    return bestScore;
  };

  // Memoize filtered faculty list with FIXED RANKING logic
  const sortedAndFilteredFaculty = useMemo(() => {
    // 1. Basic search filter
    let list = faculty.filter((f) =>
      f.name.toLowerCase().includes(facultySearch.toLowerCase())
    );

    // 2. If a group is selected, apply ranking
    if (selectedGroup && selectedGroup.groupEvents.length > 0) {
      const courseTitle = selectedGroup.groupEvents[0].title;
      
      list = list.map(f => {
        const isAvailable = isFacultyAvailableForGroup(f, selectedGroup, schedule);
        const matchScore = calculateMatchScore(f.specialization, courseTitle);
        
        // Sorting Algorithm:
        // Priority 1: Availability (+1000)
        // Priority 2: Expertise Match (Rating * 100)
        let sortScore = 0;
        if (isAvailable) sortScore += 1000;
        if (matchScore > 0) sortScore += (matchScore * 100);
        
        return { ...f, isAvailable, matchScore, sortScore };
      });

      // Sort by Score (Desc), then Units (Asc) for load balancing
      list.sort((a, b) => {
        if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
        return (a.units || 0) - (b.units || 0);
      });
    }

    return list;
  }, [faculty, facultySearch, selectedGroup, schedule]);

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

  const handleCardClick = async (f, available) => {
    if (!selectedGroup) {
      onOpenFacultyModal(f);
      return;
    }

    if (assigningFacultyId !== null) return;

    setAssigningFacultyId(f.id);
    try {
      await onAssignFaculty(f);
    } catch (error) {
      console.error("Assignment failed within panel:", error);
    } finally {
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
        ) : sortedAndFilteredFaculty.length === 0 ? (
          <div className="no-faculty-container">
            <img src={noFacultyLogo} alt="No Faculty Found" className="no-faculty-logo" />
            <p>No faculty members found.</p>
          </div>
        ) : (
          <div className="faculty-cards">
            {sortedAndFilteredFaculty.map((f) => {
              // Recalculate basic props if not in map (handle normal view vs group view)
              const available = selectedGroup ? (f.isAvailable !== undefined ? f.isAvailable : isFacultyAvailableForGroup(f, selectedGroup, schedule)) : true;
              const unitCount = calculateFacultyUnits(f.name, schedule);
              const loadColor = getFacultyLoadColor(f, unitCount);
              
              const isAssigningThis = assigningFacultyId === f.id;
              const isAnyAssigning = assigningFacultyId !== null;
              const hasConflict = selectedGroup && !available;
              const isDisabled = isAnyAssigning && !isAssigningThis;
              
              // FIXED: Badge Logic - Only show if matchScore > 0
              const isRecommended = selectedGroup && f.matchScore > 0;

              return (
                <div
                  key={f.id}
                  className={`faculty-card 
                    ${isDisabled ? 'disabled' : ''} 
                    ${isAssigningThis ? 'assigning' : ''}
                    ${hasConflict ? 'conflict' : ''} 
                    ${isRecommended ? 'recommended-card' : ''}
                  `}
                  onClick={() => !isDisabled && handleCardClick(f, available)}
                  style={{ cursor: (!isDisabled && (selectedGroup || !isAnyAssigning)) ? 'pointer' : 'default' }}
                >
                  <div className={`faculty-info ${isAssigningThis ? 'faded' : ''}`}>
                    <div className="faculty-name-row">
                      <span className="faculty-name-text">{f.name}</span>
                      {/* FIXED: Only render badge if matchScore > 0 */}
                      {isRecommended && (
                        <span 
                          className={`specialist-badge rating-${f.matchScore}`}
                          title={`Expertise match: ${f.matchScore}/5 stars`}
                        >
                          {'★'.repeat(f.matchScore)}
                        </span>
                      )}
                    </div>
                    <div className="faculty-status">
                      <span>{f.Status || f.status}</span>
                      <span className="faculty-workload">{unitCount} units</span>
                      <div className={`status-indicator status-${loadColor}`}></div>
                      {hasConflict && <span className="conflict-text">Conflict</span>}
                    </div>
                  </div>

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
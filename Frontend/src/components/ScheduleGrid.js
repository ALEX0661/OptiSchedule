import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom'; // Required for Portals
import { parsePeriod, computeGroupKey, computeExtendedGroupKey } from '../utils/scheduleHelpers';
import noScheduleLogo from '../assets/noScheduleLogo.png';
import '../styles/ScheduleManagement.css';

// --- Conflict Badge Component (Fixed Scroll & Compact Size) ---

const ConflictBadge = React.memo(({ 
  type, 
  conflicts, 
  eventId, 
  cellType 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef(null);
  const popoverRef = useRef(null); // Ref to track the popover content
  
  // Close on scroll ONLY if scrolling outside the popover
  useEffect(() => {
    const handleScroll = (event) => {
      if (!isOpen) return;

      // Check if the scroll event originated inside the popover
      if (popoverRef.current && popoverRef.current.contains(event.target)) {
        return; // Ignore scroll events inside the popover
      }

      // If scrolling the main window/body, close the popover
      setIsOpen(false);
    };

    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true); // Capture phase
    }
    
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  if (!conflicts || conflicts.length === 0) return null;
  
  const getConflictTypeLabel = () => {
    if (type === 'merged') return 'Merged';
    switch (cellType) {
      case 'room': return 'Room Conflict';
      case 'faculty': return 'Instructor Conflict';
      case 'time': return 'Time Conflict';
      default: return 'Conflict';
    }
  };

  const conflictTypeLabel = getConflictTypeLabel();
  const badgeColor = type === 'merged' ? '#1976d2' : '#d32f2f';

  const handleToggle = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!isOpen && badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      // COMPACT DIMENSIONS
      const popoverWidth = 260; 
      const popoverHeight = 220; 
      
      let top, left;
      
      // --- Smart Positioning Logic ---
      
      // Horizontal Positioning
      if (cellType === 'room' || cellType === 'faculty') {
        // Right edge -> Show to the Left
        left = rect.left - popoverWidth - 8;
      } else {
        // Center aligned for Time, Block, etc.
        left = rect.left + (rect.width / 2) - (popoverWidth / 2);
      }
      
      // Vertical Positioning
      // Default to showing BELOW the badge with small offset
      top = rect.bottom + 6;

      // Boundary Checks
      if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
      }
      if (left < 10) {
        left = 10;
      }
      // Check Bottom Edge (Flip to top if no space)
      if (top + popoverHeight > window.innerHeight - 10) {
        top = rect.top - popoverHeight - 6;
      }
      
      setPosition({ top, left });
    }
    setIsOpen(!isOpen);
  };

  const popoverContent = (
    <>
      <div 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998, background: 'transparent' }}
        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
      />
      <div 
        ref={popoverRef} // Attach ref here
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderTop: `3px solid ${badgeColor}`, // Slightly thinner border
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          padding: '0',
          width: '260px', // COMPACT WIDTH
          maxHeight: '220px', // COMPACT HEIGHT
          zIndex: 99999, 
          fontSize: '11px', // SMALLER FONT
          overflowY: 'auto',
          fontFamily: "'Poppins', sans-serif"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '8px 12px', // Compact padding
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fff',
          position: 'sticky',
          top: 0
        }}>
          <strong style={{ color: badgeColor, fontSize: '11px' }}>{conflictTypeLabel}</strong>
          <button 
            onClick={() => setIsOpen(false)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '16px', 
              cursor: 'pointer', 
              color: '#999', 
              padding: '0',
              lineHeight: 1,
              display: 'flex'
            }}
          >×</button>
        </div>
        
        <div style={{ padding: '4px 0' }}>
          {conflicts.map((conflict, idx) => (
            <div key={idx} style={{ 
              padding: '8px 12px', // Compact padding
              borderBottom: idx === conflicts.length - 1 ? 'none' : '1px solid #f5f5f5',
              display: 'flex',
              gap: '8px'
            }}>
               <div style={{ width: '3px', backgroundColor: badgeColor, borderRadius: '2px', flexShrink: 0 }}></div>
               <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#333', marginBottom: '2px', fontSize: '11px' }}>
                    {conflict.courseCode}
                  </div>
                  <div style={{ color: '#666', fontSize: '10px', lineHeight: '1.3' }}>
                     {conflict.title}
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '10px', color: '#555', backgroundColor: '#f9f9f9', padding: '4px 6px', borderRadius: '4px' }}>
                     <div><strong>{conflict.program} {conflict.year}-{conflict.block}</strong></div>
                     <div>{conflict.period}</div>
                     {conflict.faculty && <div>{conflict.faculty}</div>}
                     {conflict.room && <div>Rm: {conflict.room}</div>}
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <>
      <div 
        className="conflict-badge-container" 
        style={{ position: 'absolute', top: '3px', right: '3px', zIndex: 10 }} // Adjusted offset
      >
        <button 
          ref={badgeRef}
          className={`conflict-badge ${type}`}
          onClick={handleToggle}
          style={{
            padding: '0', borderRadius: '50%', border: `1.5px solid ${badgeColor}`,
            cursor: 'pointer', fontSize: '9px', fontWeight: '700', backgroundColor: 'white',
            color: badgeColor, width: '16px', height: '16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'all 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
          title={type === 'merged' ? `Merged with ${conflicts.length} class${conflicts.length > 1 ? 'es' : ''}` : `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}`}
        >
          !
        </button>
      </div>
      {isOpen && ReactDOM.createPortal(popoverContent, document.body)}
    </>
  );
});

// --- Main Component ---

const ScheduleGrid = ({
  groupedSchedule,
  daysOrder = [],
  selectedGroup,
  onToggleGroupSelection,
  onOverride,
  displayScheduleName,
  onSaveFinalSchedule,
  onSelectExistingSchedule,
  existingSchedules,
  fetchError,
  onToggleViewMode,
  schedule 
}) => {
  
  // --- Optimization 1: Memoize Sorted Schedule ---
  const sortedGroupedSchedule = useMemo(() => {
    if (!groupedSchedule) return {};
    const sorted = { ...groupedSchedule };
    if (daysOrder && Array.isArray(daysOrder)) {
      daysOrder.forEach((day) => {
        if (sorted[day]) {
          sorted[day] = [...sorted[day]].sort((a, b) => {
            const [aStart] = parsePeriod(a.period);
            const [bStart] = parsePeriod(b.period);
            return aStart - bStart;
          });
        }
      });
    }
    return sorted;
  }, [groupedSchedule, daysOrder]);

  const totalEvents = useMemo(() => {
    return daysOrder.reduce((acc, day) => {
      return acc + (sortedGroupedSchedule[day] ? sortedGroupedSchedule[day].length : 0);
    }, 0);
  }, [daysOrder, sortedGroupedSchedule]);

  // --- Optimization 2: Pre-calculate Conflicts ---
  const conflictMap = useMemo(() => {
    const map = {};
    if (!schedule || !Array.isArray(schedule)) return map;

    const getPeriod = (p) => parsePeriod(p);

    schedule.forEach(currentEvent => {
      const [currentStart, currentEnd] = getPeriod(currentEvent.period);
      const roomConflicts = [];
      const facultyConflicts = [];
      const timeConflicts = [];
      const mergedWith = [];

      for (const other of schedule) {
        if (other.schedule_id === currentEvent.schedule_id) continue;
        if (other.day !== currentEvent.day) continue;

        const [otherStart, otherEnd] = getPeriod(other.period);
        if (currentStart < otherEnd && currentEnd > otherStart) {
          const currentRoom = (currentEvent.room || '').toLowerCase();
          const isOnline = currentRoom === 'online';
          const isRoomOverlap = !isOnline && currentEvent.room === other.room;
          
          const isSameSection = currentEvent.program === other.program &&
                              currentEvent.year === other.year &&
                              currentEvent.block === other.block;

          const matchesMergeCriteria = 
            currentEvent.courseCode === other.courseCode &&
            currentEvent.program === other.program &&
            currentEvent.year === other.year &&
            currentEvent.session === other.session;

          if (isRoomOverlap) {
            // FIX: Ensure Online classes never get marked as mergedWith
            if (matchesMergeCriteria && !isOnline) {
              mergedWith.push(other);
            } else {
              roomConflicts.push(other);
            }
          }
          
          const isFacultyOverlap = currentEvent.faculty && 
                                  other.faculty && 
                                  currentEvent.faculty !== 'Unassigned' && 
                                  other.faculty !== 'Unassigned' &&
                                  currentEvent.faculty.trim() !== '' &&
                                  other.faculty.trim() !== '' &&
                                  currentEvent.faculty === other.faculty;
          
          if (isFacultyOverlap) {
            const isSameRoom = currentEvent.room === other.room;
            if (!matchesMergeCriteria || !isSameRoom) {
              facultyConflicts.push(other);
            }
          }

          if (isSameSection && !isRoomOverlap) {
            timeConflicts.push(other);
          }
        }
      }

      let status = 'normal';
      if (roomConflicts.length > 0 || facultyConflicts.length > 0 || timeConflicts.length > 0) {
        status = 'conflict';
      } else if (mergedWith.length > 0) {
        status = 'merged';
      }

      map[currentEvent.schedule_id] = { status, roomConflicts, facultyConflicts, timeConflicts, mergedWith };
    });

    return map;
  }, [schedule]);

  const getBaseCourseCode = (courseCode) => {
    return courseCode.replace(/[AL]$/, '');
  };

  return (
    <div className="cards schedule-card">
      <div className="save-schedule-container">
        <button className="save-schedule-btn" onClick={onSaveFinalSchedule}>
          Save Schedule
        </button>
        <div className="existing-schedules-dropdown">
          <label htmlFor="existingSchedulesSelect">Existing Schedules:</label>
          <select id="existingSchedulesSelect" onChange={onSelectExistingSchedule}>
            <option value="">Select a schedule</option>
            {existingSchedules &&
              existingSchedules.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="schedule-name-display schedule-header-row">
        <div className="schedule-title-wrapper">
          <h2>Generated Schedule For A.Y. {displayScheduleName}</h2>
        </div>
        {onToggleViewMode && (
          <button className="view-toggle-btn" onClick={onToggleViewMode}>
            Switch to Room View
          </button>
        )}
      </div>

      {totalEvents === 0 ? (
        <div className="no-schedule-container" style={{ padding: '20px', textAlign: 'center' }}>
          <img
            src={noScheduleLogo}
            alt="No Schedule Available"
            className="no-schedule-logo"
            style={{ maxWidth: '200px', width: '100%', height: 'auto', marginBottom: '10px' }}
          />
          <p style={{ fontSize: '1.1em', color: '#555' }}>
            {fetchError ? 'Error fetching schedule.' : 'No schedule available.'}
          </p>
        </div>
      ) : (
        <div className="schedule-table-container">
          {daysOrder.map((day) =>
            sortedGroupedSchedule[day] && sortedGroupedSchedule[day].length > 0 ? (
              <div key={day}>
                <h3 style={{ padding: '10px', backgroundColor: '#f0f0f0' }}>{day}</h3>
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Course (Name & Code)</th>
                      <th>Program</th>
                      <th>Year</th>
                      <th>Block</th>
                      <th>Session</th>
                      <th>Time</th>
                      <th>Room</th>
                      <th>Faculty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGroupedSchedule[day].map((event) => {
                      const conflicts = conflictMap[event.schedule_id] || { 
                        status: 'normal', roomConflicts: [], facultyConflicts: [], timeConflicts: [], mergedWith: [] 
                      };
                      
                      let isSelected = false;
                      if (selectedGroup && selectedGroup.mergedBlocks) {
                        const selectedBaseCourseCode = getBaseCourseCode(selectedGroup.groupEvents[0].courseCode);
                        const eventBaseCourseCode = getBaseCourseCode(event.courseCode);
                        const matchesCourse = 
                          eventBaseCourseCode === selectedBaseCourseCode &&
                          event.program === selectedGroup.groupEvents[0].program &&
                          event.year === selectedGroup.groupEvents[0].year;
                        const isInMergedBlock = selectedGroup.mergedBlocks.includes(event.block);
                        isSelected = matchesCourse && isInMergedBlock;
                      }
                      
                      const rowClass = conflicts.status === 'conflict' ? 'overlap-row' : 
                                       conflicts.status === 'merged' ? 'merged-row' : '';

                      return (
                        <tr key={event.schedule_id} className={rowClass}>
                          <td>
                            <div style={{ textAlign: 'center' }}>
                              <button className="override-btn" onClick={() => onOverride(event.schedule_id)}>
                                ⇄
                              </button>
                              <div style={{ color: 'var(--green)', fontSize: '0.8em', marginTop: '2px', fontWeight: 600 }}>
                                Adjust
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="course-info">
                              <div className="course-title">{event.title}</div>
                              <div className="course-code">{event.courseCode}</div>
                            </div>
                          </td>
                          <td>{event.program}</td>
                          <td>{event.year}</td>
                          <td>
                            <div style={{ display: 'block' }}> 
                              <span>{event.block}</span>
                              {conflicts.mergedWith.length > 0 && (
                                <ConflictBadge 
                                  type="merged"
                                  conflicts={conflicts.mergedWith}
                                  eventId={event.schedule_id}
                                  cellType="block"
                                />
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'block' }}>
                              <span>{event.session}</span>
                              {conflicts.timeConflicts.length > 0 && (
                                <ConflictBadge 
                                  type="conflict"
                                  conflicts={conflicts.timeConflicts}
                                  eventId={event.schedule_id}
                                  cellType="time"
                                />
                              )}
                            </div>
                          </td>
                          <td>{event.period}</td>
                          <td style={{ minWidth: '80px' }}>
                            <div style={{ display: 'block' }}>
                              <span>{event.room}</span>
                              {conflicts.roomConflicts.length > 0 && (
                                <ConflictBadge 
                                  type="conflict"
                                  conflicts={conflicts.roomConflicts}
                                  eventId={event.schedule_id}
                                  cellType="room"
                                />
                              )}
                            </div>
                          </td>
                          <td style={{ minWidth: '100px' }}>
                            <div style={{ display: 'block' }}>
                              <button
                                className={`toggle-faculty-btn toggle-faculty-btn-column ${
                                  isSelected ? 'active' : ''
                                } ${event.faculty && event.faculty.trim() !== '' ? '' : 'unassigned'}`}
                                onClick={() => onToggleGroupSelection(event)}
                                style={{ fontSize: '0.85em', width: '100%', textAlign: 'center'}} 
                              >
                                {event.faculty && event.faculty.trim() !== '' ? event.faculty : 'Unassigned'}
                              </button>
                              {conflicts.facultyConflicts.length > 0 && (
                                <ConflictBadge 
                                  type="conflict"
                                  conflicts={conflicts.facultyConflicts}
                                  eventId={event.schedule_id}
                                  cellType="faculty"
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(ScheduleGrid);
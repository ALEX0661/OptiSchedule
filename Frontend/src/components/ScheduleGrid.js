import React, { useState, useEffect, useMemo } from 'react';
import { parsePeriod, computeGroupKey, computeExtendedGroupKey } from '../utils/scheduleHelpers';
import noScheduleLogo from '../assets/noScheduleLogo.png';
import '../styles/ScheduleManagement.css';

// --- Components defined OUTSIDE ScheduleGrid to prevent re-creation on every render ---

const ConflictBadge = React.memo(({ 
  type, 
  conflicts, 
  eventId, 
  cellType, 
  activePopover, 
  setActivePopover 
}) => {
  if (!conflicts || conflicts.length === 0) return null;
  
  const popoverId = `${eventId}-${cellType}`;
  const isActive = activePopover === popoverId;

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActivePopover(isActive ? null : popoverId);
  };

  const handleClose = (e) => {
    e?.stopPropagation();
    setActivePopover(null);
  };

  const getConflictTypeLabel = () => {
    if (type === 'merged') return 'Merged Classes';
    switch (cellType) {
      case 'room': return 'Room Conflict';
      case 'faculty': return 'Instructor Conflict';
      case 'time': return 'Time Conflict';
      default: return 'Conflict';
    }
  };

  const conflictTypeLabel = getConflictTypeLabel();
  const isRightEdge = cellType === 'faculty' || cellType === 'room';
  const badgeColor = type === 'merged' ? '#1976d2' : '#d32f2f';

  const popoverStyle = isRightEdge 
    ? {
        position: 'absolute', top: '0', right: '100%', marginRight: '12px', marginTop: '-10px',
        backgroundColor: 'white', border: `1px solid ${badgeColor}`, borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: '16px', minWidth: '280px', maxWidth: '350px',
        maxHeight: '300px', zIndex: 10000, fontSize: '11px',
      }
    : {
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '10px',
        backgroundColor: 'white', border: `1px solid ${badgeColor}`, borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: '16px', minWidth: '280px', maxWidth: '350px',
        maxHeight: '300px', zIndex: 10000, fontSize: '11px',
      };

  return (
    <div 
      className="conflict-badge-container" 
      style={{ position: 'absolute', top: '4px', right: '4px', zIndex: isActive ? 9998 : 10 }}
    >
      <button 
        className={`conflict-badge ${type}`}
        onClick={handleToggle}
        style={{
          padding: '0', borderRadius: '50%', border: `1.5px solid ${badgeColor}`,
          cursor: 'pointer', fontSize: '10px', fontWeight: '600', backgroundColor: 'white',
          color: badgeColor, width: '16px', height: '16px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
        title={type === 'merged' ? `Merged with ${conflicts.length} class${conflicts.length > 1 ? 'es' : ''}` : `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}`}
      >
        !
      </button>
      
      {isActive && (
        <div className="conflict-popover" style={{ ...popoverStyle, overflowY: 'auto', scrollbarWidth: 'none' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '8px', borderBottom: `1px solid ${type === 'merged' ? '#e3f2fd' : '#ffebee'}` }}>
            <strong style={{ color: badgeColor, fontSize: '12px', display: 'block' }}>{conflictTypeLabel}</strong>
            <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#999', padding: '0 4px', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {conflicts.map((conflict, idx) => (
              <div key={idx} style={{ padding: '8px 10px', backgroundColor: type === 'merged' ? '#f5f9ff' : '#fff5f5', borderRadius: '6px', borderLeft: `3px solid ${badgeColor}` }}>
                <div style={{ fontWeight: '600', color: '#333', fontSize: '11px', marginBottom: '4px' }}>{conflict.courseCode}</div>
                <div style={{ color: '#555', fontSize: '10px', lineHeight: '1.5' }}>
                   {conflict.title} <br/>
                   <span style={{opacity: 0.8}}>{conflict.program} {conflict.year}-{conflict.block} ({conflict.room})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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
  const [activePopover, setActivePopover] = useState(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activePopover && !event.target.closest('.conflict-badge-container')) {
        setActivePopover(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activePopover]);

  // --- Optimization 1: Memoize Sorted Schedule ---
  // This prevents resorting the entire array on every single render/hover/click
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
  // Instead of calculating conflicts inside the render loop (O(n^2) per render),
  // we calculate them once when the schedule changes and store in a Map (O(1) lookup).
  const conflictMap = useMemo(() => {
    const map = {};
    if (!schedule || !Array.isArray(schedule)) return map;

    // Helper to parse period
    const getPeriod = (p) => parsePeriod(p);

    schedule.forEach(currentEvent => {
      const [currentStart, currentEnd] = getPeriod(currentEvent.period);
      const roomConflicts = [];
      const facultyConflicts = [];
      const timeConflicts = [];
      const mergedWith = [];

      // Loop through schedule to find conflicts for this specific event
      for (const other of schedule) {
        if (other.schedule_id === currentEvent.schedule_id) continue;
        if (other.day !== currentEvent.day) continue;

        const [otherStart, otherEnd] = getPeriod(other.period);
        // Time Overlap Check
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
            if (matchesMergeCriteria) {
              mergedWith.push(other);
            } else {
              roomConflicts.push(other);
            }
          }
          
          const isFacultyOverlap = currentEvent.faculty && 
                                  other.faculty && 
                                  currentEvent.faculty !== 'Unassigned' && 
                                  currentEvent.faculty === other.faculty;
          
          if (isFacultyOverlap && !matchesMergeCriteria) {
            facultyConflicts.push(other);
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
                      const extendedKey = schedule ? computeExtendedGroupKey(event, schedule) : computeGroupKey(event);
                      const isSelected = selectedGroup && extendedKey === selectedGroup.groupKey;
                      
                      // Use cached conflicts (O(1) access)
                      const conflicts = conflictMap[event.schedule_id] || { 
                        status: 'normal', roomConflicts: [], facultyConflicts: [], timeConflicts: [], mergedWith: [] 
                      };
                      
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
                                  activePopover={activePopover}
                                  setActivePopover={setActivePopover}
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
                                  activePopover={activePopover}
                                  setActivePopover={setActivePopover}
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
                                  activePopover={activePopover}
                                  setActivePopover={setActivePopover}
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
                                  activePopover={activePopover}
                                  setActivePopover={setActivePopover}
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
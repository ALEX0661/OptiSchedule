import React, { useMemo, useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom'; // Import ReactDOM for Portals
import { computeGroupKey, parsePeriod } from '../utils/scheduleHelpers';
import "../styles/ScheduleManagement.css";

const toMinutes = timeStr => {
  const [time, meridiem] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Helper to combine consecutive time slots
const mergeConsecutiveEvents = events => {
  const eventsCopy = JSON.parse(JSON.stringify(events));
  eventsCopy.sort((a, b) => {
    if (a.courseCode !== b.courseCode) return a.courseCode.localeCompare(b.courseCode);
    const aStart = toMinutes(a.period.split(' - ')[0]);
    const bStart = toMinutes(b.period.split(' - ')[0]);
    return aStart - bStart;
  });

  const mergedEvents = [];
  let currentEvent = null;

  for (const event of eventsCopy) {
    if (!currentEvent) {
      currentEvent = { ...event };
      continue;
    }

    const canMerge =
      currentEvent.courseCode === event.courseCode &&
      currentEvent.session === event.session &&
      currentEvent.program === event.program &&
      currentEvent.year === event.year &&
      currentEvent.block === event.block &&
      currentEvent.room === event.room &&
      currentEvent.day === event.day;

    if (canMerge) {
      const [currentStartStr, currentEndStr] = currentEvent.period.split(' - ');
      const [newStartStr, newEndStr] = event.period.split(' - ');
      const currentEndMins = toMinutes(currentEndStr);
      const newStartMins = toMinutes(newStartStr);

      if (currentEndMins === newStartMins) {
        currentEvent.period = `${currentStartStr} - ${newEndStr}`;
        continue;
      }
    }

    mergedEvents.push(currentEvent);
    currentEvent = { ...event };
  }

  if (currentEvent) {
    mergedEvents.push(currentEvent);
  }

  return mergedEvents;
};

const dayMapping = { "Monday": "M", "Tuesday": "T", "Wednesday": "W", "Thursday": "Th", "Friday": "F", "Saturday": "Sat", "Sunday": "Sun" };
const dayOrder = ["M", "T", "W", "Th", "F", "Sat", "Sun"];

const shortenSession = (session) => {
  if (!session) return session;
  return session.replace(/Laboratory/gi, 'LAB').replace(/Lecture/gi, 'LEC');
};

// --- Conflict Badge Component (Consistent Design) ---
const ConflictBadge = ({ type, conflicts, eventId, cellType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const badgeRef = useRef(null);
  const popoverRef = useRef(null);
  
  useEffect(() => {
    const handleScroll = (event) => {
      if (!isOpen) return;
      if (popoverRef.current && popoverRef.current.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    };

    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
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
      const popoverWidth = 260; 
      const popoverHeight = 220; 
      
      let top, left;
      
      if (cellType === 'room' || cellType === 'faculty') {
        left = rect.left - popoverWidth - 8;
      } else {
        left = rect.left + (rect.width / 2) - (popoverWidth / 2);
      }
      
      top = rect.bottom + 6;

      if (left + popoverWidth > window.innerWidth - 10) {
        left = window.innerWidth - popoverWidth - 10;
      }
      if (left < 10) {
        left = 10;
      }
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
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          backgroundColor: 'white',
          border: '1px solid #e0e0e0',
          borderTop: `3px solid ${badgeColor}`,
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          padding: '0',
          width: '260px',
          maxHeight: '220px',
          zIndex: 99999, 
          fontSize: '11px',
          overflowY: 'auto',
          fontFamily: "'Poppins', sans-serif"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '8px 12px',
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
              padding: '8px 12px',
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
      <span 
        ref={badgeRef}
        style={{ display: 'inline-block', marginLeft: '6px', verticalAlign: 'middle', lineHeight: 0 }}
      >
        <button 
          className={`conflict-badge ${type}`}
          onClick={handleToggle}
          style={{
            padding: '0', borderRadius: '50%', border: `1.5px solid ${badgeColor}`,
            cursor: 'pointer', fontSize: '9px', fontWeight: '700', backgroundColor: 'white',
            color: badgeColor, width: '16px', height: '16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'all 0.2s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}
          title={`${conflicts.length} item(s)`}
        >
          !
        </button>
      </span>
      {isOpen && ReactDOM.createPortal(popoverContent, document.body)}
    </>
  );
};

// Added onOverride prop
const FacultyModal = ({ faculty, assignedEvents, schedule = [], onClose, onRequestUnassignGroup, onOverride }) => {
  
  // Calculate conflicts for all assigned events
  const conflictMap = useMemo(() => {
    const map = {};
    if (!assignedEvents || assignedEvents.length === 0 || !schedule || schedule.length === 0) return map;

    assignedEvents.forEach(currentEvent => {
      const [currentStart, currentEnd] = parsePeriod(currentEvent.period);
      const roomConflicts = [];
      const facultyConflicts = [];
      const timeConflicts = [];
      const mergedWith = [];

      for (const other of schedule) {
        if (other.schedule_id === currentEvent.schedule_id) continue;
        if (other.day !== currentEvent.day) continue;

        const [otherStart, otherEnd] = parsePeriod(other.period);
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
  }, [assignedEvents, schedule]);

  const finalMergedEvents = useMemo(() => {
    if (!assignedEvents || assignedEvents.length === 0) return [];

    const sortedEvents = assignedEvents.slice().sort((a, b) => {
      const aStart = toMinutes(a.period.split(' - ')[0]);
      const bStart = toMinutes(b.period.split(' - ')[0]);
      return aStart - bStart;
    });

    const mergedEventsMap = sortedEvents.reduce((acc, event) => {
      const key = `${event.courseCode}-${event.session}-${event.program}-${event.year}-${event.block}-${event.room}-${event.faculty}-${event.period}`;
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

    const mergedDaysEvents = Object.values(mergedEventsMap).map(event => {
      const sortedDayAbbrevs = event.dayAbbrevs.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
      return { ...event, day: sortedDayAbbrevs.join('') };
    });

    return mergedDaysEvents.length > 0 ? mergeConsecutiveEvents(mergedDaysEvents) : [];
  }, [assignedEvents]);

  if (!faculty) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="faculty-modal" onClick={e => e.stopPropagation()}>
        <div className="faculty-modal-header">
          {faculty?.name || '—'}
        </div>

        <div className="faculty-modal-content">
          <div className="faculty-info-grid">
            <div className="info-card"><h4>Rank</h4><p>{faculty?.AcademicRank || 'N/A'}</p></div>
            <div className="info-card"><h4>Department</h4><p>{faculty?.Department || faculty?.department || 'N/A'}</p></div>
            <div className="info-card"><h4>Education</h4><p>{faculty?.Educational_attainment || 'N/A'}</p></div>
            <div className="info-card"><h4>Sex</h4><p>{faculty?.Sex || 'N/A'}</p></div>
            <div className="info-card"><h4>Status</h4><p>{faculty?.Status || 'N/A'}</p></div>
            <div className="info-card"><h4>Specialization</h4><p>{faculty?.specialization || 'N/A'}</p></div>
          </div>

          <hr className="modal-divider" />

          <h3 className="section-title">Assigned Schedule Events</h3>
          
          {finalMergedEvents.length > 0 ? (
            <div className="modal-table-container">
              <table className="assigned-events-table">
                {/* Adjusted widths to accommodate new column */}
                <colgroup>
                  <col style={{ width: '5%' }} /> {/* Adjust */}
                  <col style={{ width: '7%' }} /> {/* Session */}
                  <col style={{ width: '15%' }} /> {/* Section */}
                  <col style={{ width: '30%' }} /> {/* Course */}
                  <col style={{ width: '11%' }} /> {/* Day */}
                  <col style={{ width: '18%' }} /> {/* Time */}
                  <col style={{ width: '8%' }} /> {/* Room */}
                  <col style={{ width: '6%' }} /> {/* Unassign */}
                </colgroup>
                <thead>
                  <tr>
                    <th></th> {/* Empty header for Adjust button */}
                    <th>SESS</th>
                    <th>SECTION</th>
                    <th>COURSE</th>
                    <th>DAY</th>
                    <th>TIME</th>
                    <th>ROOM</th>
                    <th>ACT</th>
                  </tr>
                </thead>
                <tbody>
                  {finalMergedEvents.map(event => {
                    const conflicts = conflictMap[event.schedule_id] || { 
                      status: 'normal', roomConflicts: [], facultyConflicts: [], timeConflicts: [], mergedWith: [] 
                    };
                    
                    const rowClass = conflicts.status === 'conflict' ? 'overlap-row' : 
                                     conflicts.status === 'merged' ? 'merged-row' : '';

                    const rowStyle = {
                      fontFamily: 'Poppins, sans-serif',
                      backgroundColor: conflicts.status === 'conflict' ? 'rgba(198, 40, 40, 0.25)' : 
                                       conflicts.status === 'merged' ? 'rgba(25, 118, 210, 0.08)' : 'inherit'
                    };

                    return (
                      <tr key={event.schedule_id} className={rowClass} style={rowStyle}>
                        {/* New Adjust Column */}
                        <td className="center-text">
                           <div style={{ textAlign: 'center' }}>
                              <button 
                                className="override-btn" 
                                onClick={() => onOverride && onOverride(event.schedule_id)}
                                title="Adjust Schedule"
                              >
                                ⇄
                              </button>
                              <div style={{ color: 'var(--green)', fontSize: '0.6em', marginTop: '2px', fontWeight: 600 }}>
                                Adjust
                              </div>
                            </div>
                        </td>
                        <td className="center-text">
                          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                            <span>{shortenSession(event.session)}</span>
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
                        <td>
                          <div className="section-cell">
                            <span>{event.program} {event.year}-{event.block}</span>
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
                        <td title={`${event.title} (${event.courseCode})`}>
                          <div className="course-cell">
                            <span className="course-code">{event.courseCode}</span>
                            <span className="course-title">{event.title}</span>
                          </div>
                        </td>
                        <td className="center-text">{event.day}</td>
                        <td className="time-cell">
                          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                             <span>{event.period}</span>
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
                        <td className="center-text">
                          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
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
                        <td className="center-text">
                          <button
                            className="unassign-icon-btn"
                            onClick={() => {
                              const baseCode = event.courseCode.replace(/[AL]$/, '');
                              const clickedEventInOriginal = assignedEvents.find(e => 
                                e.schedule_id === event.schedule_id
                              );

                              if (!clickedEventInOriginal) return;

                              // Check for online on the CLICKED event
                              const isClickedOnline = (clickedEventInOriginal.room || '').toLowerCase() === 'online';

                              const allCourseEvents = assignedEvents.filter(e => {
                                const eBaseCode = e.courseCode.replace(/[AL]$/, '');
                                return (
                                  eBaseCode === baseCode &&
                                  e.program === event.program &&
                                  e.year === event.year
                                );
                              });

                              const timeslotGroups = {};
                              allCourseEvents.forEach(e => {
                                const timeslotKey = `${e.session}-${e.day}-${e.period}-${e.room}`;
                                if (!timeslotGroups[timeslotKey]) {
                                  timeslotGroups[timeslotKey] = [];
                                }
                                timeslotGroups[timeslotKey].push(e);
                              });
                              
                              let hasMergedTimeslot = false;
                              
                              Object.values(timeslotGroups).forEach(group => {
                                const blocksInThisTimeslot = [...new Set(group.map(e => e.block))];
                                
                                // FIX: Check the room for this specific group
                                const groupRoom = (group[0].room || '').toLowerCase();

                                // FIX: Only flag as merged if multiple blocks share a NON-ONLINE room
                                if (blocksInThisTimeslot.length > 1 && groupRoom !== 'online') {
                                  hasMergedTimeslot = true;
                                }
                              });
                              
                              let groupEvents;
                              
                              // FIX: Use the calculated hasMergedTimeslot.
                              // If I clicked a physical class (isClickedOnline=false) and there are NO physical merges (hasMergedTimeslot=false),
                              // then it should NOT act as merged, even if online classes are shared.
                              if (hasMergedTimeslot && !isClickedOnline) {
                                groupEvents = allCourseEvents;
                              } else {
                                // Only current block
                                groupEvents = allCourseEvents.filter(e => 
                                  e.block === clickedEventInOriginal.block
                                );
                              }

                              const targetGroupKey = computeGroupKey(clickedEventInOriginal);
                              onRequestUnassignGroup(targetGroupKey, groupEvents, faculty.name);
                            }}
                            title="Unassign"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="no-events">No assigned schedule events.</p>
          )}

          <button className="close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default FacultyModal;
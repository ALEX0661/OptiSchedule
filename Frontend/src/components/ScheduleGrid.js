import React from 'react';
import { parsePeriod, computeGroupKey, computeExtendedGroupKey } from '../utils/scheduleHelpers';
import noScheduleLogo from '../assets/noScheduleLogo.png';
import '../styles/ScheduleManagement.css';

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
  // Guard against undefined/non-array daysOrder
  if (daysOrder && Array.isArray(daysOrder)) {
    daysOrder.forEach((day) => {
      if (groupedSchedule[day]) {
        groupedSchedule[day].sort((a, b) => {
          const [aStart] = parsePeriod(a.period);
          const [bStart] = parsePeriod(b.period);
          return aStart - bStart;
        });
      }
    });
  }

  const totalEvents = daysOrder.reduce((acc, day) => {
    return acc + (groupedSchedule[day] ? groupedSchedule[day].length : 0);
  }, 0);

  /**
   * Dynamic Status Checker
   */
  const getEventStatus = (currentEvent) => {
    if (!schedule || !Array.isArray(schedule)) return 'normal';

    const [currentStart, currentEnd] = parsePeriod(currentEvent.period);

    // Find any event that overlaps in time
    const conflictingEvents = schedule.filter(other => {
      if (other.schedule_id === currentEvent.schedule_id) return false; // Skip self
      if (other.day !== currentEvent.day) return false; // Must be same day

      const [otherStart, otherEnd] = parsePeriod(other.period);
      
      // Check Time Overlap
      const isTimeOverlap = (currentStart < otherEnd && currentEnd > otherStart);
      
      return isTimeOverlap;
    });

    let isMerged = false;
    let isConflict = false;

    for (const other of conflictingEvents) {
      // 1. Check Room Overlap (Ignored if Room is 'Online')
      const currentRoom = (currentEvent.room || '').toLowerCase();
      const isOnline = currentRoom === 'online';
      
      const isRoomOverlap = !isOnline && currentEvent.room === other.room;

      // 2. Check Faculty Overlap
      const isFacultyOverlap = currentEvent.faculty && 
                               other.faculty && 
                               currentEvent.faculty !== 'Unassigned' && 
                               currentEvent.faculty === other.faculty;

      if (isRoomOverlap) {
        // STRICT MERGE CHECK
        const matchesMergeCriteria = 
          currentEvent.courseCode === other.courseCode &&
          currentEvent.program === other.program &&
          currentEvent.year === other.year &&
          currentEvent.session === other.session;

        if (matchesMergeCriteria) {
          isMerged = true;
        } else {
          // Room overlap but NOT a valid merge -> Conflict
          isConflict = true;
        }
      } else if (isFacultyOverlap) {
        // Faculty overlap is always a conflict
        isConflict = true;
      }
    }

    // Conflict takes precedence over Merge styling
    if (isConflict) return 'conflict';
    if (isMerged) return 'merged';
    return 'normal';
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
            groupedSchedule[day] && groupedSchedule[day].length > 0 ? (
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
                    {groupedSchedule[day].map((event) => {
                      // Selection Logic
                      const extendedKey = schedule ? computeExtendedGroupKey(event, schedule) : computeGroupKey(event);
                      const isSelected = selectedGroup && extendedKey === selectedGroup.groupKey;

                      // Dynamic Status Logic
                      const status = getEventStatus(event);
                      const rowClass = status === 'conflict' ? 'overlap-row' : 
                                       status === 'merged' ? 'merged-row' : '';

                      return (
                        <tr
                          key={event.schedule_id}
                          className={rowClass}
                        >
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
                            {event.block}
                            {status === 'merged' && (
                              <span 
                                className="merged-indicator-text" 
                                style={{
                                  marginLeft: '5px',
                                  fontSize: '0.85em',
                                  color: '#1976d2', 
                                  fontWeight: '500'
                                }}
                              >
                                (Merged)
                              </span>
                            )}
                          </td>
                          <td>{event.session}</td>
                          <td>{event.period}</td>
                          <td>{event.room}</td>
                          <td>
                            <button
                              className={`toggle-faculty-btn toggle-faculty-btn-column ${
                                isSelected ? 'active' : ''
                              } ${event.faculty && event.faculty.trim() !== '' ? '' : 'unassigned'}`}
                              onClick={() => onToggleGroupSelection(event)}
                              style={{ fontSize: '0.85em' }}
                            >
                              {event.faculty && event.faculty.trim() !== '' ? event.faculty : 'Unassigned'}
                            </button>
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

export default ScheduleGrid;
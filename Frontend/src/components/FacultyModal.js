import React, { useMemo } from 'react';
import { computeGroupKey } from '../utils/scheduleHelpers';
import "../styles/ScheduleManagement.css";

const toMinutes = timeStr => {
  const [time, meridiem] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Helper to combine consecutive time slots of the exact same class for cleaner display
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

const FacultyModal = ({ faculty, assignedEvents, onClose, onRequestUnassignGroup }) => {
  
  // --- Optimization: Memoize Final Merged Events (Display Logic Only) ---
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
                <colgroup>
                  <col style={{ width: '8%' }} />  {/* Session */}
                  <col style={{ width: '15%' }} /> {/* Section */}
                  <col style={{ width: '34%' }} /> {/* Course Title */}
                  <col style={{ width: '10%' }} />  {/* Day */}
                  <col style={{ width: '19%' }} /> {/* Time */}
                  <col style={{ width: '8%' }} /> {/* Room */}
                  <col style={{ width: '6%' }} /> {/* Action */}
                </colgroup>
                <thead>
                  <tr>
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
                    return (
                      <tr key={event.schedule_id} style={{ fontFamily: 'Poppins, sans-serif' }}>
                        <td className="center-text">{shortenSession(event.session)}</td>
                        <td>
                          <div className="section-cell">
                            <span>{event.program} {event.year}-{event.block}</span>
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
                           {event.period}
                        </td>
                        <td className="center-text">
                          {event.room}
                        </td>
                        <td className="center-text">
                          <button
                            className="unassign-icon-btn"
                            onClick={() => {
                              const groupKey = computeGroupKey(event);
                              const groupEvents = assignedEvents.filter(e => computeGroupKey(e) === groupKey);
                              onRequestUnassignGroup(groupKey, groupEvents);
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
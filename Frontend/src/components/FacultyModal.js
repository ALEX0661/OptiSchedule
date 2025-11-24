import React from 'react';
import { computeGroupKey, isMergedClass, getBaseScheduleId } from '../utils/scheduleHelpers';
import "../styles/ScheduleManagement.css";

const toMinutes = timeStr => {
  const [time, meridiem] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const mergeConsecutiveEvents = events => {
  const eventsCopy = JSON.parse(JSON.stringify(events));
  eventsCopy.sort((a, b) => {
    if (a.courseCode !== b.courseCode) return a.courseCode.localeCompare(b.courseCode);
    if (a.title !== b.title) return a.title.localeCompare(b.title);
    if (a.session !== b.session) return a.session.localeCompare(b.session);
    if (a.program !== b.program) return a.program.localeCompare(b.program);
    if (a.year !== b.year) return a.year - b.year;
    if (a.block !== b.block) return a.block.localeCompare(b.block);
    if (a.room !== b.room) return a.room.localeCompare(b.room);
    if (a.day !== b.day) return a.day.localeCompare(b.day);
    if (a.faculty !== b.faculty) return a.faculty.localeCompare(b.faculty);

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
      currentEvent.title === event.title &&
      currentEvent.session === event.session &&
      currentEvent.program === event.program &&
      currentEvent.year === event.year &&
      currentEvent.block === event.block &&
      currentEvent.room === event.room &&
      currentEvent.day === event.day &&
      currentEvent.faculty === event.faculty;

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

const dayMapping = {
  "Monday": "M",
  "Tuesday": "T",
  "Wednesday": "W",
  "Thursday": "Th",
  "Friday": "F",
  "Saturday": "Sat",
  "Sunday": "Sun"
};

const dayOrder = ["M", "T", "W", "Th", "F", "Sat", "Sun"];

const FacultyModal = ({ faculty, assignedEvents, onClose, onRequestUnassignGroup }) => {
  
  if (!faculty) return null;

  const mergedDaysEvents = assignedEvents && assignedEvents.length > 0 ? (() => {
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

    return Object.values(mergedEventsMap).map(event => {
      const sortedDayAbbrevs = event.dayAbbrevs.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
      return { ...event, day: sortedDayAbbrevs.join('') };
    });
  })() : [];

  const finalMergedEvents = mergedDaysEvents.length > 0 ? mergeConsecutiveEvents(mergedDaysEvents) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="faculty-modal" onClick={e => e.stopPropagation()}>
        <div className="faculty-modal-header">
          {faculty?.name || '—'}
        </div>

        <div className="faculty-modal-content">
          <div className="faculty-info-grid">
            <div className="info-card">
              <h4>Rank</h4>
              <p>{faculty?.AcademicRank || 'N/A'}</p>
            </div>
            <div className="info-card">
              <h4>Department</h4>
              <p>{faculty?.Department || faculty?.department || 'N/A'}</p>
            </div>
            <div className="info-card">
              <h4>Education</h4>
              <p>{faculty?.Educational_attainment || 'N/A'}</p>
            </div>
            <div className="info-card">
              <h4>Sex</h4>
              <p>{faculty?.Sex || 'N/A'}</p>
            </div>
            <div className="info-card">
              <h4>Status</h4>
              <p>{faculty?.Status || 'N/A'}</p>
            </div>
            <div className="info-card">
              <h4>Specialization</h4>
              <p>{faculty?.specialization || 'N/A'}</p>
            </div>
          </div>

          <hr />

          <h3 className="section-title">Assigned Schedule Events</h3>
          {finalMergedEvents.length > 0 ? (
            <div className="modal-table-container">
              <table className="assigned-events-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Program</th>
                    <th>Block</th>
                    <th>Year</th>
                    <th>Course</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Unassign</th>
                  </tr>
                </thead>
                <tbody>
                  {finalMergedEvents.map(event => {
                    // NEW: Check if this is a merged class
                    const isMerged = isMergedClass(event);
                    
                    return (
                      <tr key={event.schedule_id}>
                        <td>{event.session}</td>
                        <td>{event.program}</td>
                        <td>
                          {event.block}
                          {isMerged && (
                            <span 
                              style={{ 
                                marginLeft: '5px', 
                                fontSize: '0.8em',
                                color: '#007bff',
                                fontWeight: 'bold'
                              }}
                              title="Merged class"
                            >
                              🔗
                            </span>
                          )}
                        </td>
                        <td>{event.year}</td>
                        <td>{event.title} ({event.courseCode})</td>
                        <td>{event.day}</td>
                        <td>{event.period}</td>
                        <td>{event.room}</td>
                        <td>
                          <button
                            className="unassign-btn"
                            onClick={() => {
                              const groupKey = computeGroupKey(event);
                              const groupEvents = assignedEvents.filter(
                                e => computeGroupKey(e) === groupKey
                              );
                              onRequestUnassignGroup(groupKey, groupEvents);
                            }}
                            title={isMerged ? "Unassign all merged blocks" : "Unassign this group"}
                          >
                            Unassign
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
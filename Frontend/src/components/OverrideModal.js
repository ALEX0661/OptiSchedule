import React, { useState, useEffect, useCallback } from "react";
import { getRooms } from "../services/settingService";
import { parsePeriod } from "../utils/scheduleHelpers";
import "../styles/ScheduleManagement.css";

const OverrideModal = ({ event, schedule, onClose, onSave }) => {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [availableRooms, setAvailableRooms] = useState([]);
  const [occupiedRooms, setOccupiedRooms] = useState([]);
  const [allRooms, setAllRooms] = useState({ lecture: [], lab: [] });
  const [hasOverlap, setHasOverlap] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [conflictingEvents, setConflictingEvents] = useState([]);
  const [pendingSaveData, setPendingSaveData] = useState(null);
  const [isOccupiedRoom, setIsOccupiedRoom] = useState(false);

  const fixedDuration = event.session.toLowerCase() === "lecture" ? 60 : 90;

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const rooms = await getRooms();
      if (rooms && rooms.lecture && rooms.lab) {
        setAllRooms(rooms);
      } else {
        console.error("Error: getRooms API did not return expected structure", rooms);
        setAllRooms({ lecture: [], lab: [] });
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      setAllRooms({ lecture: [], lab: [] });
    }
  };

  const snapTo30Min = (timeStr) => {
    if (!timeStr || timeStr === "") return "";
    const [hours, minutes] = timeStr.split(":").map(Number);
    const snappedMin = Math.round(minutes / 30) * 30;
    let newHours = hours;
    let newMin = snappedMin;
    if (snappedMin === 60) {
      newHours = (hours + 1) % 24;
      newMin = 0;
    }
    return `${newHours.toString().padStart(2, "0")}:${newMin.toString().padStart(2, "0")}`;
  };

  const convertTo24 = (timeStr) => {
    const parts = timeStr.split(" ");
    if (parts.length < 2) return timeStr;
    const [time, meridiem] = parts;
    let [hours, minutes] = time.split(":").map(Number);
    if (meridiem.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (meridiem.toUpperCase() === "AM" && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime12Hour = (minutes) => {
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  // Helper to shorten session names for the table
  const shortenSession = (session) => {
    if (!session) return session;
    return session.replace(/Laboratory/gi, 'LAB').replace(/Lecture/gi, 'LEC');
  };

  const updateFields = useCallback(
    (newStart, dayValue) => {
      const startMinutes = timeToMinutes(newStart);
      const newEndMinutes = startMinutes + fixedDuration;
      const endHours = Math.floor(newEndMinutes / 60) % 24;
      const endMins = newEndMinutes % 60;
      setEndTime(
        `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`
      );

      const usedRooms = new Set();
      schedule.forEach((ev) => {
        if (ev.day === dayValue && ev.schedule_id !== event.schedule_id) {
          const [s, e] = parsePeriod(ev.period);
          if (startMinutes < e && s < newEndMinutes && ev.room) {
            usedRooms.add(ev.room);
          }
        }
      });

      const eventType = event.session.toLowerCase();
      const relevantRooms = eventType === "lecture" ? allRooms.lecture : allRooms.lab;
      const filteredRooms = (Array.isArray(relevantRooms) ? relevantRooms : []).filter(
        (room) => !usedRooms.has(room)
      );
      const occupied = (Array.isArray(relevantRooms) ? relevantRooms : []).filter(
        (room) => usedRooms.has(room)
      );
      setAvailableRooms(filteredRooms);
      setOccupiedRooms(occupied);
    },
    [event, schedule, allRooms, fixedDuration]
  );

  const determineConflictType = (conflictEvent, newStartMinutes, newEndMinutes, dayToCheck, newRoom) => {
    const conflicts = [];
    const [evStart, evEnd] = parsePeriod(conflictEvent.period);
    
    // Check time overlap
    const hasTimeOverlap = !(newEndMinutes <= evStart || newStartMinutes >= evEnd);
    
    // Check if same section (program, year, block)
    const isSameSection = conflictEvent.program === event.program &&
                          conflictEvent.block === event.block &&
                          conflictEvent.year === event.year;
    
    // Check if same faculty
    const isSameFaculty = event.faculty && conflictEvent.faculty === event.faculty;
    
    // Check if same room
    const isSameRoom = conflictEvent.room === newRoom;
    
    if (hasTimeOverlap) {
      if (isSameSection) conflicts.push("Section Time Conflict");
      if (isSameFaculty) conflicts.push("Instructor Time Conflict");
      if (isSameRoom) conflicts.push("Room Conflict");
    }
    
    return conflicts.length > 0 ? conflicts.join(" + ") : "Unknown Conflict";
  };

  const checkForOverlap = useCallback((selectedRoom = null) => {
    if (!startTime) return;
    const newStartMinutes = timeToMinutes(startTime);
    const newEndMinutes = newStartMinutes + fixedDuration;
    let overlapFound = false;
    const conflicts = [];
    const dayToCheck = selectedDay || event.day;
    const roomToCheck = selectedRoom || document.querySelector('input[name="override-room"]:checked')?.value || "";

    schedule.forEach((ev) => {
      if (ev.schedule_id === event.schedule_id) return;
      
      const [evStart, evEnd] = parsePeriod(ev.period);
      const hasTimeOverlap = !(newEndMinutes <= evStart || newStartMinutes >= evEnd);
      
      if (ev.day === dayToCheck && hasTimeOverlap) {
        // Check for section conflict
        if (ev.program === event.program &&
            ev.block === event.block &&
            ev.year === event.year) {
          overlapFound = true;
          const conflictType = determineConflictType(ev, newStartMinutes, newEndMinutes, dayToCheck, roomToCheck);
          if (!conflicts.find(c => c.schedule_id === ev.schedule_id)) {
            conflicts.push({ ...ev, conflictType });
          }
        }
        
        // Check for faculty conflict
        if (event.faculty && ev.faculty === event.faculty) {
          if (!conflicts.find(c => c.schedule_id === ev.schedule_id)) {
            overlapFound = true;
            const conflictType = determineConflictType(ev, newStartMinutes, newEndMinutes, dayToCheck, roomToCheck);
            conflicts.push({ ...ev, conflictType });
          } else {
            // Update existing conflict type to include faculty
            const existingConflict = conflicts.find(c => c.schedule_id === ev.schedule_id);
            if (existingConflict) {
              existingConflict.conflictType = determineConflictType(ev, newStartMinutes, newEndMinutes, dayToCheck, roomToCheck);
            }
          }
        }
        
        // Check for room conflict
        if (roomToCheck && ev.room === roomToCheck) {
          if (!conflicts.find(c => c.schedule_id === ev.schedule_id)) {
            overlapFound = true;
            const conflictType = determineConflictType(ev, newStartMinutes, newEndMinutes, dayToCheck, roomToCheck);
            conflicts.push({ ...ev, conflictType });
          } else {
            // Update existing conflict type to include room
            const existingConflict = conflicts.find(c => c.schedule_id === ev.schedule_id);
            if (existingConflict) {
              existingConflict.conflictType = determineConflictType(ev, newStartMinutes, newEndMinutes, dayToCheck, roomToCheck);
            }
          }
        }
      }
    });
    
    setHasOverlap(overlapFound);
    setConflictingEvents(conflicts);
  }, [startTime, fixedDuration, schedule, event, selectedDay]);

  useEffect(() => {
    if (event) {
      const [startStr] = event.period.split(" - ");
      const convertedStart = convertTo24(startStr);
      const snappedStart = snapTo30Min(convertedStart);
      setStartTime(snappedStart);
      setSelectedDay(event.day || "");
      updateFields(snappedStart, event.day || "");
    }
  }, [event, updateFields]);

  useEffect(() => {
    checkForOverlap();
  }, [startTime, selectedDay, checkForOverlap]);

  const handleStartTimeChange = (e) => {
    const newStart = e.target.value;
    const snapped = snapTo30Min(newStart);
    setStartTime(snapped);
    updateFields(snapped, selectedDay || event.day);
    setWarningMessage("");
  };

  const handleDayChange = (e) => {
    const newDay = e.target.value;
    setSelectedDay(newDay);
    updateFields(startTime, newDay);
    setWarningMessage("");
  };

  const handleRoomChange = () => {
    const selectedRoomRadio = document.querySelector('input[name="override-room"]:checked');
    if (selectedRoomRadio) {
      const selectedRoom = selectedRoomRadio.value;
      const isOccupied = occupiedRooms.includes(selectedRoom);
      setIsOccupiedRoom(isOccupied);
      checkForOverlap(selectedRoom);
    }
  };

  const handleSave = () => {
    const selectedRoomRadio = document.querySelector('input[name="override-room"]:checked');
    const newRoom = selectedRoomRadio ? selectedRoomRadio.value : "";
    if (!startTime || !newRoom) {
      setWarningMessage("Please select a start time and a room.");
      return;
    }
    
    const saveData = {
      schedule_id: event.schedule_id,
      new_start: startTime,
      new_room: newRoom,
      new_day: selectedDay || event.day,
    };

    // Check if occupied room or has conflicts
    const isOccupied = occupiedRooms.includes(newRoom);
    if (isOccupied || (hasOverlap && conflictingEvents.length > 0)) {
      setPendingSaveData(saveData);
      setShowConfirmModal(true);
    } else {
      setWarningMessage("");
      onSave(saveData);
    }
  };

  const handleConfirmOverride = () => {
    setShowConfirmModal(false);
    setWarningMessage("");
    if (pendingSaveData) {
      onSave(pendingSaveData);
    }
  };

  const handleCancelOverride = () => {
    setShowConfirmModal(false);
    setPendingSaveData(null);
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="override-modal" onClick={(e) => e.stopPropagation()}>
          <div className="override-header">
            <h3>Manual Adjustment</h3>
          </div>
          <div className="override-content">
            <div className="override-field">
              <label htmlFor="override-day">Select Day:</label>
              <select id="override-day" value={selectedDay} onChange={handleDayChange}>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
              </select>
            </div>
            <div className="override-field">
              <label htmlFor="override-start">Start Time:</label>
              <input 
                type="time" 
                id="override-start" 
                value={startTime} 
                onChange={handleStartTimeChange} 
                step="1800"
                list="time-options"
              />
              <datalist id="time-options">
                <option value="07:00" />
                <option value="07:30" />
                <option value="08:00" />
                <option value="08:30" />
                <option value="09:00" />
                <option value="09:30" />
                <option value="10:00" />
                <option value="10:30" />
                <option value="11:00" />
                <option value="11:30" />
                <option value="12:00" />
                <option value="12:30" />
                <option value="13:00" />
                <option value="13:30" />
                <option value="14:00" />
                <option value="14:30" />
                <option value="15:00" />
                <option value="15:30" />
                <option value="16:00" />
                <option value="16:30" />
                <option value="17:00" />
                <option value="17:30" />
                <option value="18:00" />
                <option value="18:30" />
                <option value="19:00" />
                <option value="19:30" />
                <option value="20:00" />
              </datalist>
            </div>
            <div className="override-field">
              <label htmlFor="override-end">End Time:</label>
              <input type="time" id="override-end" value={endTime} readOnly />
            </div>
            <div className="override-field">
              <label>Available Rooms:</label>
              <div id="override-room-container">
                {availableRooms.length > 0 ? (
                  availableRooms.map((room) => (
                    <label key={room} className="room-label">
                      <input 
                        type="radio" 
                        name="override-room" 
                        value={room} 
                        defaultChecked={room === availableRooms[0]} 
                        onChange={handleRoomChange}
                      />
                      {room}
                    </label>
                  ))
                ) : (
                  <span>No rooms available</span>
                )}
              </div>
            </div>
            {occupiedRooms.length > 0 && (
              <div className="override-field">
                <label style={{ color: "var(--red)" }}>Occupied Rooms:</label>
                <div id="override-room-container">
                  {occupiedRooms.map((room) => (
                    <label key={room} className="room-label" style={{ color: "var(--red)", border: "1px solid var(--red)" }}>
                      <input 
                        type="radio" 
                        name="override-room" 
                        value={room}
                        onChange={handleRoomChange}
                      />
                      {room}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {warningMessage && (
              <div className="warning-message" style={{ 
                color: "var(--red)", 
                fontSize: "0.85em", 
                marginTop: "10px",
                padding: "8px",
                backgroundColor: "rgba(198, 40, 40, 0.1)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--red)"
              }}>
                {warningMessage}
              </div>
            )}
            {hasOverlap && (
              <div className="overlap-warning" style={{ 
                color: "var(--red)", 
                fontSize: "0.75em", 
                marginTop: "10px",
                padding: "10px",
                backgroundColor: "rgba(198, 40, 40, 0.1)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--red)",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                <div style={{ fontWeight: "800" }}>
                  Schedule Conflict Detected
                </div>
              </div>
            )}
          </div>
          <div className="override-actions">
            <button onClick={handleSave}>
              Save Adjustment
            </button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="modal-overlay" onClick={handleCancelOverride}>
          {/* Manually setting wider style for the confirmation modal to match Faculty Modal width */}
          <div className="unassign-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
            <header className="unassign-modal-header" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
              <h2 style={{ fontSize: '1.2em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                Confirm Schedule Override
              </h2>
            </header>
            
            <div className="unassign-modal-content" style={{ padding: '20px' }}>
              <p style={{ marginBottom: '15px', color: '#555' }}>
                You are about to move <strong>{event.title} ({event.courseCode})</strong>{isOccupiedRoom && !hasOverlap ? ' to an occupied room' : hasOverlap ? ' to a time slot that conflicts with other classes' : ''}.
              </p>

              <div style={{ 
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "15px",
                marginBottom: "20px"
              }}>
                <div style={{ 
                  padding: "14px", 
                  backgroundColor: "#fff3e0", 
                  borderRadius: "var(--radius)",
                  border: "1px solid #ffb74d",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
                }}>
                  <div style={{ fontWeight: "600", marginBottom: "8px", color: "#e65100", fontSize: "0.95em", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Current Schedule
                  </div>
                  <div style={{ fontSize: "0.9em", lineHeight: "1.6", color: "#333" }}>
                    <div style={{ fontWeight: '600', color: '#222' }}>{event.title}</div>
                    <div style={{ color: '#666', fontSize: '0.9em' }}>{event.courseCode} • {event.session}</div>
                    
                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '0.9em' }}>
                      <span style={{ color: '#777' }}>Section:</span> <span>{event.program} {event.year}-{event.block}</span>
                      <span style={{ color: '#777' }}>Time:</span> <span>{event.day}, {event.period}</span>
                      <span style={{ color: '#777' }}>Room:</span> <span>{event.room || 'Not assigned'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ 
                  padding: "14px", 
                  backgroundColor: "#e8f5e9", 
                  borderRadius: "var(--radius)",
                  border: "1px solid #81c784",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)"
                }}>
                  <div style={{ fontWeight: "600", marginBottom: "8px", color: "#2e7d32", fontSize: "0.95em", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    New Schedule
                  </div>
                  <div style={{ fontSize: "0.9em", lineHeight: "1.6", color: "#333" }}>
                    <div style={{ fontWeight: '600', color: '#222' }}>{event.title}</div>
                    <div style={{ color: '#666', fontSize: '0.9em' }}>{event.courseCode} • {event.session}</div>
                    
                    <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '0.9em' }}>
                      <span style={{ color: '#777' }}>Section:</span> <span>{event.program} {event.year}-{event.block}</span>
                      <span style={{ color: '#777' }}>Time:</span> <span>{selectedDay || event.day}, {minutesToTime12Hour(timeToMinutes(startTime))} - {minutesToTime12Hour(timeToMinutes(startTime) + fixedDuration)}</span>
                      <span style={{ color: '#777' }}>Room:</span> <span style={{ fontWeight: '600', color: '#2e7d32' }}>{pendingSaveData?.new_room || 'Not selected'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {conflictingEvents.length > 0 && (
                <>
                  <p className="unassign-info" style={{ color: "var(--red)", fontWeight: "600", marginBottom: '8px', fontSize: '0.95em' }}>
                    ⚠️ The following classes will conflict with this change:
                  </p>
                  <div className="modal-table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    <table className="assigned-events-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <colgroup>
                        <col style={{ width: '8%' }} />  {/* Session */}
                        <col style={{ width: '26%' }} /> {/* Course (Name + Code) */}
                        <col style={{ width: '14%' }} /> {/* Section (Prog + Yr + Blk) */}
                        <col style={{ width: '7%' }} />  {/* Room */}
                        <col style={{ width: '11%' }} />  {/* Day */}
                        <col style={{ width: '14%' }} /> {/* Time */}
                        <col style={{ width: '20%' }} /> {/* Conflict Reason (Wide + Wrap) */}
                      </colgroup>
                      <thead>
                        <tr>
                          <th>SESS</th>
                          <th>COURSE</th>
                          <th>SECTION</th>
                          <th>ROOM</th>
                          <th>DAY</th>
                          <th>TIME</th>
                          <th>CONFLICT REASON</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conflictingEvents.map(conflict => (
                          <tr key={conflict.schedule_id}>
                            <td className="center-text">{shortenSession(conflict.session)}</td>
                            <td>
                              <div className="course-cell">
                                <span className="course-code">{conflict.courseCode}</span>
                                <span className="course-title">{conflict.title}</span>
                              </div>
                            </td>
                            <td>
                              <div className="section-cell">
                                <span>{conflict.program} {conflict.year}-{conflict.block}</span>
                              </div>
                            </td>
                            <td className="center-text">{conflict.room || '-'}</td>
                            <td className="center-text">{conflict.day}</td>
                            <td className="time-cell" style={{ fontSize: '0.7em' }}>{conflict.period}</td>
                            <td style={{ 
                                color: "var(--red)", 
                                fontWeight: "600", 
                                fontSize: "0.85em", 
                                whiteSpace: "normal", /* Allow text wrap */
                                lineHeight: "1.3",
                                padding: "8px"
                              }}>
                              {conflict.conflictType}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <footer className="unassign-modal-footer" style={{ padding: '15px 20px', borderTop: '1px solid #eee' }}>
              <button className="modal-btn cancel-btn" onClick={handleCancelOverride}>
                Cancel
              </button>
              <button className="modal-btn confirm-btn" onClick={handleConfirmOverride} style={{ backgroundColor: 'var(--red)', borderColor: 'var(--red)' }}>
                Confirm Override
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default OverrideModal;
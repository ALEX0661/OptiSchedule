// RoomView.js - With Auto-Scroll & Sticky Room Headers
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getRooms, getDays, getTimeSettings } from '../services/settingService';
import { overrideEvent } from '../services/scheduleService';
import CourseDetailsModal from './CourseDetailsModal';
import '../styles/RoomView.css';

const EnhancedRoomView = ({ schedule: initialSchedule, onScheduleUpdate, onClose }) => {
  const [selectedDay, setSelectedDay] = useState('');
  const [rooms, setRooms] = useState({ lecture: [], lab: [] });
  const [days, setDays] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [timeSettings, setTimeSettings] = useState({ start_time: 7, end_time: 21 });
  
  // Drag and Drop States
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  
  // Hover States
  const [hoveredEventGroup, setHoveredEventGroup] = useState(null);
  const [hoveredEventId, setHoveredEventId] = useState(null);
  
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewEvent, setViewEvent] = useState(null);

  // NEW: Ref for the scrollable container
  const scrollContainerRef = useRef(null);

  // --- Helpers ---

  const parseTimeToMinutes = useCallback((timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }, []);

  const calculateDuration = useCallback((periodStr, sessionType) => {
    if (!periodStr) return 90;
    const parts = periodStr.split(' - ');
    if (parts.length === 2) {
      const start = parseTimeToMinutes(parts[0]);
      const end = parseTimeToMinutes(parts[1]);
      return end - start;
    }
    return sessionType === 'Laboratory' ? 180 : 90;
  }, [parseTimeToMinutes]);

  // --- Initial Data Loading ---

  useEffect(() => {
    if (initialSchedule && initialSchedule.length > 0) {
      setSchedule(initialSchedule);
    }
  }, [initialSchedule]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [daysResponse, roomsResponse, timeResponse] = await Promise.all([
          getDays(),
          getRooms(),
          getTimeSettings()
        ]);

        if (daysResponse && daysResponse.days) {
          setDays(daysResponse.days);
          if (daysResponse.days.length > 0) setSelectedDay(daysResponse.days[0]);
        } else if (daysResponse && Array.isArray(daysResponse)) {
          setDays(daysResponse);
          if (daysResponse.length > 0) setSelectedDay(daysResponse[0]);
        }

        if (roomsResponse && roomsResponse.rooms) setRooms(roomsResponse.rooms);
        else if (roomsResponse) setRooms(roomsResponse);

        if (timeResponse && timeResponse.time_settings) setTimeSettings(timeResponse.time_settings);
        else if (timeResponse) setTimeSettings(timeResponse);

      } catch (err) {
        console.error('Error fetching room view data:', err);
        setError('Failed to load schedule settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- COMPREHENSIVE CONFLICT LOGIC ---
  
  const conflictMap = useMemo(() => {
    const map = {};
    if (!schedule || !Array.isArray(schedule)) return map;

    schedule.forEach(currentEvent => {
      const parts = currentEvent.period.split(' - ');
      const currentStart = parseTimeToMinutes(parts[0]);
      const currentEnd = parseTimeToMinutes(parts[1]);

      const roomConflicts = [];
      const facultyConflicts = [];
      const timeConflicts = [];
      const mergedWith = [];

      for (const other of schedule) {
        if (other.schedule_id === currentEvent.schedule_id) continue;
        if (other.day !== currentEvent.day) continue;

        const otherParts = other.period.split(' - ');
        const otherStart = parseTimeToMinutes(otherParts[0]);
        const otherEnd = parseTimeToMinutes(otherParts[1]);

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

      map[currentEvent.schedule_id] = { 
        status, 
        roomConflicts, 
        facultyConflicts, 
        timeConflicts, 
        mergedWith 
      };
    });

    return map;
  }, [schedule, parseTimeToMinutes]);


  // --- View Calculation Helpers ---

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = timeSettings.start_time; hour < timeSettings.end_time; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const period = hour >= 12 ? 'PM' : 'AM';
        const minuteStr = minute.toString().padStart(2, '0');
        slots.push({
          time: `${displayHour}:${minuteStr} ${period}`,
          startMinutes: hour * 60 + minute,
          endMinutes: hour * 60 + minute + 30,
          displayHour: hour,
          displayMinute: minute
        });
      }
    }
    return slots;
  }, [timeSettings]);

  const slotHeight = 28;

  const allRooms = useMemo(() => {
    if (selectedRoomType === 'lecture') return rooms.lecture.map(r => ({ name: r, type: 'lecture' }));
    if (selectedRoomType === 'lab') return rooms.lab.map(r => ({ name: r, type: 'lab' }));
    return [...rooms.lecture.map(r => ({ name: r, type: 'lecture' })), ...rooms.lab.map(r => ({ name: r, type: 'lab' }))];
  }, [rooms, selectedRoomType]);

  const getRoomEvents = useCallback((roomName) => {
    return schedule.filter(e => e.day === selectedDay && e.room === roomName);
  }, [schedule, selectedDay]);

  const getOverlappingGroups = useCallback((roomName) => {
    const events = getRoomEvents(roomName);
    const groups = [];
    events.forEach(event => {
      const eventStart = parseTimeToMinutes(event.period.split(' - ')[0]);
      const eventEnd = eventStart + calculateDuration(event.period, event.session);
      let addedToGroup = false;
      for (let group of groups) {
        const hasOverlap = group.some(groupEvent => {
          const groupStart = parseTimeToMinutes(groupEvent.period.split(' - ')[0]);
          const groupEnd = groupStart + calculateDuration(groupEvent.period, groupEvent.session);
          return !(eventEnd <= groupStart || eventStart >= groupEnd);
        });
        if (hasOverlap) {
          group.push(event);
          addedToGroup = true;
          break;
        }
      }
      if (!addedToGroup) groups.push([event]);
    });
    return groups;
  }, [getRoomEvents, parseTimeToMinutes, calculateDuration]);

  const getEventPosition = useCallback((event) => {
    const dayStartMinutes = timeSettings.start_time * 60;
    const eventStart = parseTimeToMinutes(event.period.split(' - ')[0]);
    const duration = calculateDuration(event.period, event.session);
    const relativeStart = eventStart - dayStartMinutes;
    const relativeHeight = (duration / 30) * slotHeight;
    const top = (relativeStart / 30) * slotHeight;
    return { top: `${top}px`, height: `${relativeHeight - 2}px` };
  }, [timeSettings, parseTimeToMinutes, calculateDuration, slotHeight]);

  // --- Interaction Handlers ---

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleEventClick = (event) => {
    if (isDragging) return;
    const conflictData = conflictMap[event.schedule_id];
    const relatedEvents = [];

    if (conflictData) {
      conflictData.mergedWith.forEach(item => relatedEvents.push({ ...item, relationType: 'Merged Class' }));
      conflictData.roomConflicts.forEach(item => relatedEvents.push({ ...item, relationType: 'Room Conflict' }));
      conflictData.facultyConflicts.forEach(item => relatedEvents.push({ ...item, relationType: 'Instructor Conflict' }));
      conflictData.timeConflicts.forEach(item => relatedEvents.push({ ...item, relationType: 'Time Conflict' }));
    }

    let status = 'Normal';
    if (conflictData && conflictData.status === 'conflict') status = 'Conflict';
    else if (conflictData && conflictData.status === 'merged') status = 'Merged';

    setViewEvent({ 
      ...event, 
      status, 
      relatedEvents: relatedEvents 
    });
  };

  const closeViewModal = () => setViewEvent(null);

  // --- Auto-Scroll Handler ---
  // This function is attached to the main container to handle scrolling while dragging
  const handleAutoScroll = (e) => {
    if (!isDragging || !scrollContainerRef.current) return;
    
    // We prevent default to allow drag events to bubble, but we need to be careful not to block drops
    e.preventDefault(); 

    const container = scrollContainerRef.current;
    const { left, right, top, bottom } = container.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    const gutter = 80; // Distance in pixels from the edge to trigger scroll
    const speed = 15;  // Scroll speed

    // Horizontal Scroll
    if (x < left + gutter) {
      container.scrollLeft -= speed;
    } else if (x > right - gutter) {
      container.scrollLeft += speed;
    }

    // Vertical Scroll
    if (y < top + gutter) {
      container.scrollTop -= speed;
    } else if (y > bottom - gutter) {
      container.scrollTop += speed;
    }
  };

  // --- Drag and Drop Handlers ---

  const handleDragStart = (e, event) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.schedule_id);
    // Create a custom drag image or use default
    // e.dataTransfer.setDragImage(e.target, 0, 0);
    setTimeout(() => setIsDragging(true), 0);
  };

  const handleDragOver = (e, room, slot) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling to container auto-scroll so we can process drop logic
    
    // We still want auto-scroll to happen even when hovering a cell
    handleAutoScroll(e);

    if (draggedEvent) {
      const sessionType = (draggedEvent.session || '').toLowerCase();
      const roomType = (room.type || '').toLowerCase();
      
      const isLabEvent = sessionType.includes('lab') || sessionType.includes('laboratory');
      const isLectureEvent = !isLabEvent; 

      const isLabRoom = roomType === 'lab';
      const isLectureRoom = roomType === 'lecture';

      // Compatibility Check
      if ((isLabEvent && !isLabRoom) || (isLectureEvent && !isLectureRoom)) {
        e.dataTransfer.dropEffect = 'none';
        setHoveredCell(null); 
        return; 
      }

      const cellKey = `${room.name}-${slot.startMinutes}`;
      if (hoveredCell !== cellKey) setHoveredCell(cellKey);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = () => { };

  const handleDrop = async (e, room, slot) => {
    e.preventDefault();
    setHoveredCell(null);
    if (!draggedEvent) {
      setIsDragging(false);
      return;
    }

    // Safety Check: Room Compatibility
    const sessionType = (draggedEvent.session || '').toLowerCase();
    const roomType = (room.type || '').toLowerCase();
    const isLabEvent = sessionType.includes('lab') || sessionType.includes('laboratory');
    const isLabRoom = roomType === 'lab';

    if (isLabEvent && !isLabRoom) {
      showNotification("Cannot move Laboratory classes to Lecture rooms.", "error");
      setIsDragging(false);
      setDraggedEvent(null);
      return;
    }
    if (!isLabEvent && isLabRoom) {
      showNotification("Cannot move Lecture classes to Laboratory rooms.", "error");
      setIsDragging(false);
      setDraggedEvent(null);
      return;
    }

    const newStartHour = slot.displayHour;
    const newStartMinute = slot.displayMinute;
    const duration = calculateDuration(draggedEvent.period, draggedEvent.session);
    const endMinutes = slot.startMinutes + duration;
    const endHour = Math.floor(endMinutes / 60);
    const endMinute = endMinutes % 60;
    const formatTime = (h, m) => {
      const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const period = h >= 12 ? 'PM' : 'AM';
      return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
    };
    const newPeriod = `${formatTime(newStartHour, newStartMinute)} - ${formatTime(endHour, endMinute)}`;

    try {
      const overrideDetails = {
        schedule_id: String(draggedEvent.schedule_id),
        new_start: `${newStartHour.toString().padStart(2, '0')}:${newStartMinute.toString().padStart(2, '0')}`,
        new_room: room.name,
        new_day: selectedDay
      };
      const response = await overrideEvent(overrideDetails);
      if (response && response.status === 'success') {
        setSchedule(prev => prev.map(event =>
          String(event.schedule_id) === String(draggedEvent.schedule_id)
            ? { ...event, room: room.name, period: newPeriod, day: selectedDay }
            : event
        ));
        showNotification(`Successfully moved ${draggedEvent.courseCode} to ${room.name}`, 'success');
        if (onScheduleUpdate) await onScheduleUpdate();
      } else throw new Error(response?.detail || 'Failed to update schedule');
    } catch (err) {
      showNotification(err.response?.data?.detail || err.message || 'Failed to update schedule', 'error');
    } finally {
      setDraggedEvent(null);
      setIsDragging(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedEvent(null);
    setHoveredCell(null);
    setIsDragging(false);
  };

  // --- Render ---

  if (loading) return <div className="z-room-view-container"><div className="z-loading-state"><div className="z-spinner"></div><p>Loading...</p></div></div>;
  if (error) return <div className="z-room-view-container"><div className="z-error-state"><h2>Error</h2><p>{error}</p><button onClick={onClose} className="z-close-room-view-btn">Back</button></div></div>;
  if (!schedule || schedule.length === 0) return <div className="z-room-view-container"><div className="z-room-view-header"><h2>Room Schedule</h2><button onClick={onClose} className="z-close-room-view-btn">Back</button></div><div className="z-no-schedule-state"><h2>No Data</h2></div></div>;

  return (
    <div className={`z-room-view-container ${isDragging ? 'is-dragging' : ''}`}>
      <div className="z-room-view-header">
        <h2>Room Schedule Overview</h2>
        <button onClick={onClose} className="z-close-room-view-btn">Back to List View</button>
      </div>
      {notification && <div className={`z-notification ${notification.type}`}><span className="z-notification-icon">{notification.type === 'success' ? '✓' : '!'}</span>{notification.message}</div>}

      <div className="z-room-controls">
        <div className="z-control-group">
          <label>Day:</label>
          <select value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
            {days.map(day => <option key={day} value={day}>{day}</option>)}
          </select>
        </div>
        <div className="z-control-group">
          <label>Room Type:</label>
          <select value={selectedRoomType} onChange={(e) => setSelectedRoomType(e.target.value)}>
            <option value="all">All Rooms</option>
            <option value="lecture">Lecture Rooms Only</option>
            <option value="lab">Lab Rooms Only</option>
          </select>
        </div>
        <div className="z-legend">
          <label>Status:</label>
          <div className="z-legend-items">
            <div className="z-legend-item"><span className="z-legend-box normal"></span><span>Normal</span></div>
            <div className="z-legend-item"><span className="z-legend-box merged"></span><span>Merged</span></div>
            <div className="z-legend-item"><span className="z-legend-box conflict"></span><span>Conflict</span></div>
          </div>
        </div>
      </div>

      <div className="z-room-grid-container">
        {/* UPDATED: Added ref and onDragOver to the main container for auto-scroll */}
        <div 
          className="z-timeline-grid" 
          ref={scrollContainerRef}
          onDragOver={handleAutoScroll} 
          style={{ '--slot-height': `${slotHeight}px` }}
        >
          <div className="z-time-column">
            {/* STICKY TIME HEADER */}
            <div 
              className="z-time-header"
              style={{ position: 'sticky', top: 0, zIndex: 600, backgroundColor: '#ffffff', borderBottom: '1px solid #ddd' }}
            >
              Time
            </div>
            {timeSlots.map((slot, idx) => <div key={idx} className="z-time-slot">{slot.time}</div>)}
          </div>
          <div className="z-rooms-container">
            {allRooms.map((room) => {
              const overlappingGroups = getOverlappingGroups(room.name);
              
              const roomHasConflict = Object.values(conflictMap).some(conf => 
                (conf.roomConflicts.some(r => r.room === room.name) && conf.status === 'conflict')
              );

              return (
                <div key={room.name} className={`z-room-column ${room.type} ${roomHasConflict ? 'has-conflict' : ''}`}>
                  {/* STICKY ROOM HEADER */}
                  <div 
                    className="z-room-header" 
                    style={{ position: 'sticky', top: 0, zIndex: 400, backgroundColor: '#f8f9fa', borderBottom: '1px solid #ddd' }}
                  >
                    <span className="z-room-icon">{room.type === 'lecture' ? 'LEC' : 'LAB'}</span>
                    <div className="z-room-info">
                      <div className="z-room-name">{room.name}</div>
                      <div className="z-room-type">{room.type === 'lecture' ? 'Lecture' : 'Lab'}</div>
                    </div>
                  </div>
                  <div className="z-time-slots-wrapper">
                    {timeSlots.map((slot, idx) => {
                      const cellKey = `${room.name}-${slot.startMinutes}`;
                      const isHovered = hoveredCell === cellKey;
                      const isValidDropZone = isHovered && draggedEvent;
                      return (
                        <div key={idx}
                          className={`z-time-slot-cell ${isValidDropZone ? 'valid-drop' : ''}`}
                          onDragOver={(e) => handleDragOver(e, room, slot)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, room, slot)}
                        >
                          {isValidDropZone && <div className="z-drop-indicator valid"><span>Drop Here</span></div>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="z-events-overlay">
                    {overlappingGroups.map((group, groupIdx) => {
                      const groupKey = `${room.name}-group-${groupIdx}`;
                      const isGroupHovered = hoveredEventGroup === groupKey;
                      const isOverlapping = group.length > 1;
                      const totalEvents = group.length;

                      return (
                        <React.Fragment key={groupKey}>
                          {group.map((event, eventIdx) => {
                            const { top, height } = getEventPosition(event);
                            
                            const currentConflicts = conflictMap[event.schedule_id] || { status: 'normal' };
                            const isMerged = currentConflicts.status === 'merged';
                            const isInConflict = currentConflicts.status === 'conflict';

                            const baseSpread = 45;
                            const minSpread = 12;
                            const maxCards = 5;
                            const spreadReduction = Math.min(totalEvents - 1, maxCards) / maxCards;
                            const dynamicSpread = baseSpread - (baseSpread - minSpread) * spreadReduction;
                            const collapsedOffset = 3;
                            const spreadAmount = isGroupHovered ? dynamicSpread : collapsedOffset;
                            const centerOffset = (totalEvents - 1) * spreadAmount / 2;
                            const translateX = (eventIdx * spreadAmount) - centerOffset;
                            let zIndex = 10 + eventIdx;
                            const isSpecificCardHovered = hoveredEventId === event.schedule_id;
                            if (isSpecificCardHovered && isGroupHovered) zIndex = 100;

                            let isDimmedForDrop = false;
                            if (isDragging && draggedEvent && hoveredCell && event.schedule_id !== draggedEvent.schedule_id) {
                              const [hoveredRoom, hoveredStartMinutes] = hoveredCell.split('-');
                              const hoveredStart = parseInt(hoveredStartMinutes);
                              const draggedDuration = calculateDuration(draggedEvent.period, draggedEvent.session);
                              const draggedEnd = hoveredStart + draggedDuration;
                              const eventStart = parseTimeToMinutes(event.period.split(' - ')[0]);
                              const eventDuration = calculateDuration(event.period, event.session);
                              const eventEnd = eventStart + eventDuration;
                              if (room.name === hoveredRoom && !(eventEnd <= hoveredStart || eventStart >= draggedEnd)) isDimmedForDrop = true;
                            }

                            const blockClasses = `z-event-block 
                              ${isMerged ? 'merged' : ''} 
                              ${isInConflict ? 'conflict' : ''} 
                              ${isOverlapping ? 'overlapping' : ''} 
                              ${isDragging && draggedEvent?.schedule_id === event.schedule_id ? 'dragging' : ''} 
                              ${isDimmedForDrop ? 'dim-for-drop' : ''} 
                              ${isSpecificCardHovered ? 'hovered-card' : ''}`;

                            return (
                              <div
                                key={event.schedule_id}
                                className={blockClasses}
                                style={{ 
                                  top, 
                                  height, 
                                  transform: `translateX(${translateX}px)`, 
                                  zIndex: zIndex, 
                                  transition: isDragging ? 'none' : 'transform 0.25s ease-out, box-shadow 0.2s ease, opacity 0.2s ease', 
                                  width: isOverlapping ? '185px' : 'auto', 
                                  left: isOverlapping ? '6px' : '2.8px', 
                                  right: isOverlapping ? 'auto' : '2.8px' 
                                }}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, event)}
                                onDragEnd={handleDragEnd}
                                onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                                onMouseEnter={() => { if (group.length > 1) setHoveredEventGroup(groupKey); setHoveredEventId(event.schedule_id); }}
                                onMouseLeave={() => { setHoveredEventGroup(null); setHoveredEventId(null); }}
                              >
                                <div className="z-event-content">
                                  <div className="z-event-header">
                                    <div className="z-header-left">
                                      <span className="z-event-code">{event.courseCode}</span>
                                      <span className="z-event-section-badge">
                                        {event.program} {event.year}-{event.block}
                                        {isMerged && <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>(Merged)</span>}
                                      </span>
                                    </div>
                                    <span className="z-event-time">{event.period}</span>
                                  </div>
                                  <div className="z-event-body">
                                    <div className="z-event-title">{event.title}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {viewEvent && <CourseDetailsModal event={viewEvent} onClose={closeViewModal} />}
    </div>
  );
};

export default EnhancedRoomView;
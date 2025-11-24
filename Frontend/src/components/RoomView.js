// RoomView.js - Updated with Tint and Text Logic
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [hoveredEventGroup, setHoveredEventGroup] = useState(null);
  const [hoveredEventId, setHoveredEventId] = useState(null);
  const [conflicts, setConflicts] = useState({});
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewEvent, setViewEvent] = useState(null);

  // Parse time string to minutes
  const parseTimeToMinutes = useCallback((timeStr) => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 0;
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour * 60 + minute;
  }, []);

  // Calculate duration from period string
  const calculateDuration = useCallback((periodStr, sessionType) => {
    const parts = periodStr.split(' - ');
    if (parts.length === 2) {
      const start = parseTimeToMinutes(parts[0]);
      const end = parseTimeToMinutes(parts[1]);
      return end - start;
    }
    return sessionType === 'Laboratory' ? 180 : 90;
  }, [parseTimeToMinutes]);

  // Initialize schedule from props
  useEffect(() => {
    if (initialSchedule && initialSchedule.length > 0) {
      setSchedule(initialSchedule);
    }
  }, [initialSchedule]);

  // Fetch data on mount
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

  // Generate time slots
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

  useEffect(() => {
    const newConflicts = {};
    const daySchedule = schedule.filter(e => e.day === selectedDay);
    daySchedule.forEach((event, idx) => {
      const eventStart = parseTimeToMinutes(event.period.split(' - ')[0]);
      const eventEnd = eventStart + calculateDuration(event.period, event.session);
      daySchedule.forEach((other, otherIdx) => {
        if (idx !== otherIdx && event.room === other.room) {
          const otherStart = parseTimeToMinutes(other.period.split(' - ')[0]);
          const otherEnd = otherStart + calculateDuration(other.period, other.session);
          if (!(eventEnd <= otherStart || eventStart >= otherEnd)) {
            const isMerge = event.program === other.program && event.year === other.year &&
              event.courseCode === other.courseCode && event.period === other.period &&
              event.room === other.room && event.session === other.session;
            const key = `${event.schedule_id}-${other.schedule_id}`;
            newConflicts[key] = { event1: event, event2: other, room: event.room, isMerge: isMerge };
          }
        }
      });
    });
    setConflicts(newConflicts);
  }, [schedule, selectedDay, parseTimeToMinutes, calculateDuration]);

  const getEventPosition = useCallback((event) => {
    const dayStartMinutes = timeSettings.start_time * 60;
    const eventStart = parseTimeToMinutes(event.period.split(' - ')[0]);
    const duration = calculateDuration(event.period, event.session);
    const relativeStart = eventStart - dayStartMinutes;
    const relativeHeight = (duration / 30) * slotHeight;
    const top = (relativeStart / 30) * slotHeight;
    return { top: `${top}px`, height: `${relativeHeight - 2}px` };
  }, [timeSettings, parseTimeToMinutes, calculateDuration, slotHeight]);

  const isValidDrop = useCallback((event, targetRoom, targetSlot) => {
    return !!event && !!targetRoom;
  }, []);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const handleEventClick = (event) => {
    if (isDragging) return;

    // Use a Map to ensure unique events by schedule_id
    const relatedMap = new Map();

    Object.values(conflicts).forEach(conf => {
      let otherEvent = null;
      if (conf.event1.schedule_id === event.schedule_id) {
        otherEvent = conf.event2;
      } else if (conf.event2.schedule_id === event.schedule_id) {
        otherEvent = conf.event1;
      }

      if (otherEvent) {
        if (!relatedMap.has(otherEvent.schedule_id)) {
          relatedMap.set(otherEvent.schedule_id, { 
            ...otherEvent, 
            relationType: conf.isMerge ? 'Merged' : 'Conflict' 
          });
        }
      }
    });

    const related = Array.from(relatedMap.values());

    let status = 'Normal';
    if (related.some(r => r.relationType === 'Conflict')) status = 'Conflict';
    else if (related.some(r => r.relationType === 'Merged')) status = 'Merged';

    setViewEvent({ ...event, status, relatedEvents: related });
  };

  const closeViewModal = () => setViewEvent(null);

  const handleDragStart = (e, event) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.schedule_id);
    setTimeout(() => setIsDragging(true), 0);
  };

  const handleDragOver = (e, room, slot) => {
    e.preventDefault();
    if (draggedEvent) {
      const cellKey = `${room.name}-${slot.startMinutes}`;
      if (hoveredCell !== cellKey) setHoveredCell(cellKey);
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDragLeave = () => { };

  const handleDrop = async (e, room, slot) => {
    e.preventDefault();
    setHoveredCell(null);
    if (!draggedEvent || !isValidDrop(draggedEvent, room.name, slot)) {
      showNotification('Invalid drop target!', 'error');
      setDraggedEvent(null);
      setIsDragging(false);
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
        <div className="z-timeline-grid" style={{ '--slot-height': `${slotHeight}px` }}>
          <div className="z-time-column">
            <div className="z-time-header">Time</div>
            {timeSlots.map((slot, idx) => <div key={idx} className="z-time-slot">{slot.time}</div>)}
          </div>
          <div className="z-rooms-container">
            {allRooms.map((room) => {
              const overlappingGroups = getOverlappingGroups(room.name);
              const roomHasConflict = Object.values(conflicts).some(conf => conf.room === room.name);
              return (
                <div key={room.name} className={`z-room-column ${room.type} ${roomHasConflict ? 'has-conflict' : ''}`}>
                  <div className="z-room-header">
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
                            const relatedConflicts = Object.values(conflicts).filter(conf =>
                              (conf.event1.schedule_id === event.schedule_id || conf.event2.schedule_id === event.schedule_id)
                            );
                            const isMerged = relatedConflicts.some(conf => conf.isMerge);
                            const isInConflict = relatedConflicts.some(conf => !conf.isMerge);

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

                            // APPLYING CLASSES BASED ON STATUS
                            // .merged -> Blue tint
                            // .conflict -> Red tint
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
                                        {/* UPDATED: Added (Merged) text logic here */}
                                        {isMerged && <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>(Merged)</span>}
                                      </span>
                                    </div>
                                    <span className="z-event-time">{event.period}</span>
                                  </div>
                                  <div className="z-event-body">
                                    <div className="z-event-title">{event.title}</div>
                                  </div>
                                </div>
                                {/* Hidden old indicators as requested, using Tint instead */}
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
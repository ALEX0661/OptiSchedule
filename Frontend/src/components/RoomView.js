// RoomView.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getRooms, getDays, getTimeSettings } from '../services/settingService';
import { overrideEvent } from '../services/scheduleService';
import CourseDetailsModal from './CourseDetailsModal';
import ScheduleFilters from './ScheduleFilters';
import ScheduleGeneratorLoader from '../animations/ScheduleGeneratorLoader'; // Import the loader
import '../styles/RoomView.css';
import '../styles/AdvancedFilters.css';

const EnhancedRoomView = ({ schedule: initialSchedule, onScheduleUpdate, onClose }) => {
  // --- Filter State ---
  const [filters, setFilters] = useState({
    courseQuery: '',
    program: 'all', year: 'all', block: 'all', day: 'Monday', room: 'all',
    programSelected: [], yearSelected: [], blockSelected: [], daySelected: [], roomSelected: [],
    showUnassignedOnly: false
  });

  const [rooms, setRooms] = useState({ lecture: [], lab: [] });
  const [days, setDays] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [timeSettings, setTimeSettings] = useState({ start_time: 7, end_time: 21 });
  
  // Drag and Drop States
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);
  
  // Conflicts
  const [dragConflicts, setDragConflicts] = useState({ 
    global: new Set(), 
    room: {} 
  });

  const [hoveredEventGroup, setHoveredEventGroup] = useState(null);
  const [hoveredEventId, setHoveredEventId] = useState(null);
  
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewEvent, setViewEvent] = useState(null);

  const scrollContainerRef = useRef(null);

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

        if (daysResponse && (daysResponse.days || Array.isArray(daysResponse))) {
          const loadedDays = daysResponse.days || daysResponse;
          setDays(loadedDays);
          if (loadedDays.length > 0) {
            setFilters(prev => ({ ...prev, day: loadedDays[0] }));
          }
        }

        if (roomsResponse) setRooms(roomsResponse.rooms || roomsResponse);
        if (timeResponse) setTimeSettings(timeResponse.time_settings || timeResponse);

      } catch (err) {
        console.error('Error fetching room view data:', err);
        setError('Failed to load schedule settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Filter Logic ---

  const handleFilterChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  // Helper to check if an event matches current filters
  const isEventVisible = useCallback((event) => {
    // 1. Dynamic Search (Matches Course, Title, Program, Room, or Faculty)
    if (filters.courseQuery) {
      const q = filters.courseQuery.toLowerCase();
      const code = (event.courseCode || '').toLowerCase();
      const title = (event.title || '').toLowerCase();
      const program = (event.program || '').toLowerCase();
      const room = (event.room || '').toLowerCase();
      const faculty = (event.faculty || '').toLowerCase();
      
      const match = code.includes(q) || 
                    title.includes(q) || 
                    program.includes(q) || 
                    room.includes(q) || 
                    faculty.includes(q);
      
      if (!match) return false;
    }

    // 2. Advanced Filters (Checkboxes)
    const checkMatch = (itemValue, multiSelectArray) => {
      if (multiSelectArray && multiSelectArray.length > 0 && !multiSelectArray.includes(itemValue)) return false;
      return true;
    };

    if (!checkMatch(event.program, filters.programSelected)) return false;
    if (!checkMatch(String(event.year), filters.yearSelected?.map(String))) return false;
    if (!checkMatch(event.block, filters.blockSelected)) return false;
    
    // Note: Day filtering is handled by the main view logic (filtering columns), 
    // but if advanced Day filters were present (removed in this update), we'd check them here.

    return true;
  }, [filters]);

  // --- Computed Properties ---

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

  // Filter the Visible Columns (Rooms) based on simple Room dropdown AND Advanced Room Selection
  const visibleRooms = useMemo(() => {
    // Helper for natural sort (e.g., Room 2 comes before Room 10)
    const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

    // Sort lecture and lab rooms separately
    const sortedLecture = [...rooms.lecture].sort(naturalSort);
    const sortedLab = [...rooms.lab].sort(naturalSort);

    // Combine them: Lecture first, then Lab
    let all = [
      ...sortedLecture.map(r => ({ name: r, type: 'lecture' })), 
      ...sortedLab.map(r => ({ name: r, type: 'lab' }))
    ];
    
    // 1. Filter by Simple Dropdown
    if (filters.room !== 'all') {
      if (filters.room === 'lecture') {
        all = all.filter(r => r.type === 'lecture');
      } else if (filters.room === 'lab') {
        all = all.filter(r => r.type === 'lab');
      } else {
        // Specific room selected
        all = all.filter(r => r.name === filters.room);
      }
    }
    
    // 2. Filter by Advanced Checkboxes
    if (filters.roomSelected?.length > 0) {
      all = all.filter(r => filters.roomSelected.includes(r.name));
    }

    return all;
  }, [rooms, filters.room, filters.roomSelected]);

  const currentViewDay = filters.day === 'all' ? (days[0] || 'Monday') : filters.day;

  const getRoomEvents = useCallback((roomName) => {
    return schedule.filter(e => {
      // 1. Must match the current view's day
      if (e.day !== currentViewDay) return false;
      // 2. Must match the specific room column
      if (e.room !== roomName) return false;
      // 3. Must match the content filters (Search & Advanced)
      return isEventVisible(e);
    });
  }, [schedule, currentViewDay, isEventVisible]);

  // --- Conflict Logic & View Calculation (Standard) ---
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
          const isSameSection = currentEvent.program === other.program && currentEvent.year === other.year && currentEvent.block === other.block;
          
          const matchesMergeCriteria = 
            currentEvent.courseCode === other.courseCode && 
            currentEvent.program === other.program && 
            currentEvent.year === other.year && 
            currentEvent.session === other.session;

          if (isRoomOverlap) {
            // FIX: Ensure merge criteria matches AND room is the same (implied by isRoomOverlap here, but explicit is good)
            if (matchesMergeCriteria) mergedWith.push(other);
            else roomConflicts.push(other);
          }
          
          const isFacultyOverlap = currentEvent.faculty && other.faculty && currentEvent.faculty !== 'Unassigned' && currentEvent.faculty === other.faculty;
          
          if (isFacultyOverlap) {
            // FIX: Instructor conflict exists if:
            // 1. It does NOT match merge criteria (different course/year)
            // OR 
            // 2. It DOES match merge criteria, but rooms are different (Physical Conflict)
            const isSameRoom = currentEvent.room === other.room;
            
            if (!matchesMergeCriteria || !isSameRoom) {
               facultyConflicts.push(other);
            }
          }
          
          if (isSameSection && !isRoomOverlap) timeConflicts.push(other);
        }
      }
      let status = 'normal';
      if (roomConflicts.length > 0 || facultyConflicts.length > 0 || timeConflicts.length > 0) status = 'conflict';
      else if (mergedWith.length > 0) status = 'merged';

      map[currentEvent.schedule_id] = { status, roomConflicts, facultyConflicts, timeConflicts, mergedWith };
    });
    return map;
  }, [schedule, parseTimeToMinutes]);

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

  // --- Handlers ---

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
    setViewEvent({ ...event, status, relatedEvents });
  };

  const closeViewModal = () => setViewEvent(null);

  const handleAutoScroll = (e) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault(); 
    const container = scrollContainerRef.current;
    const { left, right, top, bottom } = container.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    const gutter = 80;
    const speed = 15;
    if (x < left + gutter) container.scrollLeft -= speed;
    else if (x > right - gutter) container.scrollLeft += speed;
    if (y < top + gutter) container.scrollTop -= speed;
    else if (y > bottom - gutter) container.scrollTop += speed;
  };

  const handleDragStart = (e, event) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.schedule_id);
    
    const globalBusyTimes = new Set();
    const roomOccupancy = {};

    schedule.forEach(otherEvent => {
      if (String(otherEvent.schedule_id) === String(event.schedule_id)) return;
      if (otherEvent.day !== currentViewDay) return;

      const otherStart = parseTimeToMinutes(otherEvent.period.split(' - ')[0]);
      const otherDuration = calculateDuration(otherEvent.period, otherEvent.session);
      const otherEnd = otherStart + otherDuration;

      const isFacultyConflict = event.faculty && otherEvent.faculty && event.faculty !== 'Unassigned' && event.faculty === otherEvent.faculty;
      const isSectionConflict = event.program === otherEvent.program && event.year === otherEvent.year && event.block === otherEvent.block;

      if (isFacultyConflict || isSectionConflict) {
        for (let t = otherStart; t < otherEnd; t += 30) globalBusyTimes.add(t);
      }
      if (!roomOccupancy[otherEvent.room]) roomOccupancy[otherEvent.room] = new Set();
      for (let t = otherStart; t < otherEnd; t += 30) roomOccupancy[otherEvent.room].add(t);
    });

    setDragConflicts({ global: globalBusyTimes, room: roomOccupancy });
    setTimeout(() => setIsDragging(true), 0);
  };

  const handleDragOver = (e, room, slot) => {
    e.preventDefault();
    e.stopPropagation();
    handleAutoScroll(e);

    if (draggedEvent) {
      const sessionType = (draggedEvent.session || '').toLowerCase();
      const roomType = (room.type || '').toLowerCase();
      const isLabEvent = sessionType.includes('lab') || sessionType.includes('laboratory');
      const isLectureEvent = !isLabEvent; 
      const isLabRoom = roomType === 'lab';
      const isLectureRoom = roomType === 'lecture';

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
    setDragConflicts({ global: new Set(), room: {} });

    if (!draggedEvent) {
      setIsDragging(false);
      return;
    }

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
        new_day: currentViewDay
      };
      const response = await overrideEvent(overrideDetails);
      if (response && response.status === 'success') {
        setSchedule(prev => prev.map(event =>
          String(event.schedule_id) === String(draggedEvent.schedule_id)
            ? { ...event, room: room.name, period: newPeriod, day: currentViewDay }
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
    setDragConflicts({ global: new Set(), room: {} });
  };

  // --- Render ---

  if (loading) return (
    <div className="z-room-view-container">
      <div className="z-loading-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px' }}>
         <ScheduleGeneratorLoader 
           message="Loading room schedule..." 
           showProgress={false} 
           isOverlay={false} 
         />
      </div>
    </div>
  );

  if (error) return (
    <div className="z-room-view-container">
      <div className="z-error-state">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={onClose} className="z-close-room-view-btn">Back</button>
      </div>
    </div>
  );
  
  return (
    <div className={`z-room-view-container ${isDragging ? 'is-dragging' : ''}`}>
      <div className="z-room-view-header">
        <h2>Room Schedule Overview</h2>
        <button onClick={onClose} className="z-close-room-view-btn">Back to List View</button>
      </div>
      
      {/* INTEGRATED FILTERS - Pass mode="room" to hide specific controls */}
      <div>
        <ScheduleFilters 
          filters={filters} 
          onFilterChange={handleFilterChange} 
          rooms={rooms} 
          mode="room" 
        />
      </div>

      {notification && <div className={`z-notification ${notification.type}`}><span className="z-notification-icon">{notification.type === 'success' ? '✓' : '!'}</span>{notification.message}</div>}

      <div className="z-room-controls">
        <div className="z-legend">
          <label>Status:</label>
          <div className="z-legend-items">
            <div className="z-legend-item"><span className="z-legend-box normal"></span><span>Normal</span></div>
            <div className="z-legend-item"><span className="z-legend-box merged"></span><span>Merged</span></div>
            <div className="z-legend-item"><span className="z-legend-box conflict"></span><span>Conflict</span></div>
            {isDragging && <div className="z-legend-item"><span className="z-legend-box conflict-zone"></span><span>Conflict Zone</span></div>}
          </div>
        </div>
      </div>

      {visibleRooms.length === 0 ? (
        <div className="z-no-schedule-state">
          <h2>No rooms match the selected filters.</h2>
        </div>
      ) : (
        <div className="z-room-grid-container">
          <div 
            className="z-timeline-grid" 
            ref={scrollContainerRef}
            onDragOver={handleAutoScroll} 
            style={{ '--slot-height': `${slotHeight}px` }}
          >
            <div className="z-time-column">
              <div 
                className="z-time-header"
                style={{ position: 'sticky', top: 0, zIndex: 600, backgroundColor: '#ffffff', borderBottom: '1px solid #ddd' }}
              >
                Time
              </div>
              {timeSlots.map((slot, idx) => {
                const isGlobalConflict = isDragging && dragConflicts.global.has(slot.startMinutes);
                return (
                  <div key={idx} className={`z-time-slot ${isGlobalConflict ? 'global-conflict-time' : ''}`}>
                    {slot.time}
                  </div>
                );
              })}
            </div>
            <div className="z-rooms-container">
              {visibleRooms.map((room) => {
                const overlappingGroups = getOverlappingGroups(room.name);
                
                const roomHasConflict = Object.values(conflictMap).some(conf => 
                  (conf.roomConflicts.some(r => r.room === room.name) && conf.status === 'conflict')
                );

                return (
                  <div key={room.name} className={`z-room-column ${room.type} ${roomHasConflict ? 'has-conflict' : ''}`}>
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
                        
                        const isGlobalConflict = isDragging && dragConflicts.global.has(slot.startMinutes);
                        const roomSpecificSet = dragConflicts.room[room.name];
                        const isRoomOccupied = isDragging && roomSpecificSet && roomSpecificSet.has(slot.startMinutes);

                        let cellClasses = 'z-time-slot-cell';
                        if (isValidDropZone) cellClasses += ' valid-drop';
                        if (isGlobalConflict) cellClasses += ' global-conflict-zone';
                        else if (isRoomOccupied) cellClasses += ' room-occupied-zone';

                        return (
                          <div key={idx}
                            className={cellClasses}
                            onDragOver={(e) => handleDragOver(e, room, slot)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, room, slot)}
                          >
                            {isValidDropZone && !isGlobalConflict && !isRoomOccupied && (
                              <div className="z-drop-indicator valid"><span>Drop Here</span></div>
                            )}
                            {(isValidDropZone && (isGlobalConflict || isRoomOccupied)) && (
                              <div className="z-drop-indicator invalid"><span>Conflict</span></div>
                            )}
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
                                    width: isOverlapping ? '185px' : 'left', 
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
      )}
      {viewEvent && <CourseDetailsModal event={viewEvent} onClose={closeViewModal} />}
    </div>
  );
};

export default EnhancedRoomView;
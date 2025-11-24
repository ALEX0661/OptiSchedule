// src/utils/scheduleHelpers.js

export const parsePeriod = (periodStr) => {
  const [startStr, endStr] = periodStr.split(' - ');
  const parseTime = (timeStr) => {
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };
  return [parseTime(startStr), parseTime(endStr)];
};

// Updated to use baseCourseCode for consistent grouping with backend
export const computeGroupKey = (event) => {
  const baseCode = event.baseCourseCode || event.courseCode.replace(/[AL]$/, '');
  return `${baseCode}-${event.program}-${event.year}-${event.block}`;
};

// NEW: Function to extract base schedule ID (removes -A, -B suffixes for merged classes)
export const getBaseScheduleId = (scheduleId) => {
  if (typeof scheduleId === 'string' && scheduleId.match(/-[AB]$/)) {
    return scheduleId.replace(/-[AB]$/, '');
  }
  return scheduleId;
};

// NEW: Function to check if an event is part of a merged class
export const isMergedClass = (event) => {
  const id = String(event.schedule_id);
  return id.match(/-[AB]$/) !== null;
};

// NEW: Function to get all merged class events (both blocks)
export const getMergedClassEvents = (schedule, event) => {
  if (!isMergedClass(event)) {
    return [event]; // Not a merged class, return just this event
  }
  
  const baseId = getBaseScheduleId(event.schedule_id);
  const mergedEvents = schedule.filter(e => {
    const eBaseId = getBaseScheduleId(e.schedule_id);
    return eBaseId === baseId && 
           e.courseCode === event.courseCode &&
           e.session === event.session &&
           e.day === event.day &&
           e.period === event.period;
  });
  
  return mergedEvents;
};

// NEW: Function to compute group key including all merged blocks
export const computeExtendedGroupKey = (event, schedule) => {
  const mergedEvents = getMergedClassEvents(schedule, event);
  if (mergedEvents.length > 1) {
    // For merged classes, create a key that includes all blocks
    const blocks = mergedEvents.map(e => e.block).sort().join('+');
    const baseCode = event.baseCourseCode || event.courseCode.replace(/[AL]$/, '');
    return `${baseCode}-${event.program}-${event.year}-${blocks}`;
  }
  return computeGroupKey(event);
};

export const calculateFacultyUnits = (facultyName, schedule) => {
  let units = 0;
  schedule.forEach((event) => {
    if (event.faculty && event.faculty === facultyName) {
      const sessionType = event.session.toLowerCase();
      if (sessionType === 'lecture') units += 1;
      else if (sessionType === 'laboratory') units += 1.5;
    }
  });
  return units;
};

export const getFacultyLoadColor = (facultyObj, unitCount) => {
  const status = facultyObj.Status ? facultyObj.Status.toLowerCase() : 'full time';
  if (status.includes('part')) {
    if (unitCount <= 14) return 'green';
    else if (unitCount <= 23) return 'yellow';
    else return 'red';
  } else {
    if (unitCount <= 21) return 'green';
    else if (unitCount <= 35) return 'yellow';
    else return 'red';
  }
};

export const isFacultyAvailableForGroup = (facultyObj, selectedGroup, schedule) => {
  if (!selectedGroup) return true;
  for (let event of selectedGroup.groupEvents) {
    const [selStart, selEnd] = parsePeriod(event.period);
    for (let e of schedule) {
      if (computeGroupKey(e) === selectedGroup.groupKey) continue; // ignore events in the group
      if (e.day === event.day && e.faculty === facultyObj.name) {
        const [start, end] = parsePeriod(e.period);
        if (Math.min(selEnd, end) - Math.max(selStart, start) > 0) {
          return false;
        }
      }
    }
  }
  return true;
};

export const parseTimeToMinutes = (timeStr) => {
  // Example: "9:00AM", "10:30PM"
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(AM|PM)$/i);
  if (!match) return null;

  let [, hh, mm, meridiem] = match;
  let hours = parseInt(hh, 10);
  const minutes = parseInt(mm, 10);
  if (meridiem.toUpperCase() === "PM" && hours < 12) {
    hours += 12;
  } else if (meridiem.toUpperCase() === "AM" && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
};

// Helper: Convert time string ("7:00 AM") into minutes.
export const toMinutes = timeStr => {
  const [time, meridiem] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

export const computeEventUnits = event => {
  const [startStr, endStr] = event.period.split(' - ');
  const start = toMinutes(startStr);
  const end = toMinutes(endStr);
  const durationHours = (end - start) / 60;

  // count each day—token: M, T, W, Th, F, Sat, Sun
  const dayTokens = event.day.match(/M(?!h)|Th|T(?!h)|W|F|Sat|Sun/g) || [];
  const numDays = dayTokens.length;

  return durationHours * numDays;
};


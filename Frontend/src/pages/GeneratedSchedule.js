import React, { useState, useEffect, useMemo } from 'react';
import '../styles/GeneratedSchedulePage.css';
import { getFinalSchedule, getFinalSchedules } from '../services/scheduleService';
import SuccessModal from '../components/SuccessModal';
import ScheduleFilters from '../components/ScheduleFilters';
import noScheduleLogo from '../assets/noScheduleLogo.png';
import { exportToPDF, exportToExcel } from '../utils/exportUtils';
import ScheduleGeneratorLoader from '../animations/ScheduleGeneratorLoader'; // Import the loader

const toMinutes = timeStr => {
  if (!timeStr) return 0;
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
    if (a.faculty !== b.faculty) return (a.faculty || '').localeCompare(b.faculty || '');
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
      const [currStart, currEnd] = currentEvent.period.split(' - ');
      const [newStart, newEnd] = event.period.split(' - ');
      if (toMinutes(currEnd) === toMinutes(newStart)) {
        currentEvent.period = `${currStart} - ${newEnd}`;
        continue;
      }
    }

    mergedEvents.push(currentEvent);
    currentEvent = { ...event };
  }
  if (currentEvent) mergedEvents.push(currentEvent);

  return mergedEvents;
};

const GeneratedSchedulePage = () => {
  const [schedule, setSchedule] = useState([]);
  const [scheduleName, setScheduleName] = useState('');
  
  // Updated Filter State to support Advanced Filters
  const [filter, setFilter] = useState({
    courseQuery: '',
    programSelected: [],
    yearSelected: [],
    blockSelected: [],
    daySelected: [],
    roomSelected: [],
    showUnassignedOnly: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [finalSchedulesList, setFinalSchedulesList] = useState([]);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [modalType, setModalType] = useState("success");

  const dayMapping = {
    "Monday": "M", "Tuesday": "T", "Wednesday": "W", "Thursday": "Th",
    "Friday": "F", "Saturday": "Sat", "Sunday": "Sun"
  };
  const dayOrder = {
    "M":1, "Monday":1, "T":2, "Tuesday":2, "W":3, "Wednesday":3,
    "Th":4, "Thursday":4, "F":5, "Friday":5, "Sat":6, "Saturday":6, "Sun":7, "Sunday":7
  };

  useEffect(() => {
    const storedName = localStorage.getItem('finalScheduleName') || '2004-2005 Midyear';
    setScheduleName(storedName);
    fetchFinalSchedules();
  }, []);

  const availableRooms = useMemo(() => {
    const lecture = new Set();
    const lab = new Set();
    schedule.forEach(evt => {
      if (evt.room) {
        if (evt.room.match(/(Lab|Com|Mac|Win)/i)) {
          lab.add(evt.room);
        } else {
          lecture.add(evt.room);
        }
      }
    });
    return { lecture: Array.from(lecture), lab: Array.from(lab) };
  }, [schedule]);

  const availableDays = useMemo(() => {
    const days = new Set(schedule.map(s => s.day).filter(Boolean));
    return Array.from(days).sort((a, b) => dayOrder[a] - dayOrder[b]);
  }, [schedule]);

  const fetchFinalSchedules = async () => {
    try {
      const data = await getFinalSchedules();
      if (data?.schedules) setFinalSchedulesList(data.schedules);
    } catch {}
  };

  const showModal = (msg, type = "success") => {
    setSuccessModalMessage(msg);
    setModalType(type);
    setShowSuccessModal(true);
  };
  const closeModal = () => setShowSuccessModal(false);

  const fetchSchedule = async (name) => {
    setLoading(true);
    setError('');
    try {
      const data = await getFinalSchedule(name);
      if (data?.schedule) {
        setSchedule(data.schedule);
        const newName = data.schedule_name || name;
        setScheduleName(newName);
        localStorage.setItem('finalScheduleName', newName);
        showModal("Schedule loaded successfully.", "success");
      } else {
        setError('Schedule not found.');
        setSchedule([]);
        showModal("Schedule not found.", "error");
      }
    } catch {
      setError('Error fetching schedule.');
      setSchedule([]);
      showModal("Error fetching schedule.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilter((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const filteredSchedule = schedule.filter(evt => {
    if (filter.courseQuery) {
      const q = filter.courseQuery.toLowerCase().trim();
      const match =
        evt.courseCode.toLowerCase().includes(q) ||
        evt.title.toLowerCase().includes(q) ||
        evt.program.toLowerCase().includes(q) ||
        String(evt.year).includes(q) ||
        evt.room.toLowerCase().includes(q);
      if (!match) return false;
    }

    if (filter.programSelected?.length > 0 && !filter.programSelected.includes(evt.program)) return false;
    if (filter.yearSelected?.length > 0 && !filter.yearSelected.includes(Number(evt.year))) return false;
    if (filter.blockSelected?.length > 0 && !filter.blockSelected.includes(evt.block)) return false;
    if (filter.daySelected?.length > 0 && !filter.daySelected.includes(evt.day)) return false;
    if (filter.roomSelected?.length > 0 && !filter.roomSelected.includes(evt.room)) return false;

    if (filter.showUnassignedOnly) {
      if (evt.faculty && evt.faculty !== 'Unassigned' && evt.faculty !== '') return false;
    }

    return true;
  });

  const sortedSchedule = filteredSchedule.slice().sort((a, b) => {
    const aStart = toMinutes(a.period.split(' - ')[0]);
    const bStart = toMinutes(b.period.split(' - ')[0]);
    return aStart - bStart;
  });

  const grouped = sortedSchedule.reduce((acc, evt) => {
    const key = `${evt.courseCode}-${evt.session}-${evt.program}-${evt.year}-${evt.block}-${evt.period}-${evt.room}-${evt.faculty}`;
    const dayAbbrev = dayMapping[evt.day] || evt.day;
    if (acc[key]) {
      if (!acc[key].dayAbbrevs.includes(dayAbbrev)) acc[key].dayAbbrevs.push(dayAbbrev);
    } else {
      acc[key] = { ...evt, dayAbbrevs: [dayAbbrev] };
    }
    return acc;
  }, {});

  const dayMergedSchedule = Object.values(grouped).map(evt => ({
    ...evt,
    day: evt.dayAbbrevs
      .sort((a, b) => (dayOrder[a] || 99) - (dayOrder[b] || 99))
      .join('')
  }));

  const mergedSchedule = mergeConsecutiveEvents(dayMergedSchedule);

  const timeSortedSchedule = mergedSchedule.slice().sort((a, b) => {
    const aStart = toMinutes(a.period.split(' - ')[0]);
    const bStart = toMinutes(b.period.split(' - ')[0]);
    return aStart - bStart;
  });

  const handleExportToPDF = () => exportToPDF(timeSortedSchedule, scheduleName, filter);
  const handleExportToExcel = () => exportToExcel(timeSortedSchedule, scheduleName, filter);
  
  const handleSelectExistingSchedule = e => {
    const name = e.target.value;
    if (name) fetchSchedule(name);
  };

  return (
    <div className="Generated-schedule-container">
      {/* Top Section */}
      <div className="top-section">
        <div className="schedule-name-field">
          <label>Schedule Name</label>
          <p className="schedule-name-display">{`A.Y. ${scheduleName}`}</p>
        </div>
        <div className="existing-schedules">
          <label>Existing Schedules:</label>
          <select onChange={handleSelectExistingSchedule}>
            <option value="">Select a schedule</option>
            {finalSchedulesList.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced Filters Section */}
      <ScheduleFilters 
        filters={filter} 
        onFilterChange={handleFilterChange}
        rooms={availableRooms}
        days={availableDays}
        mode="default" 
      />

      {/* Export Buttons */}
      <div className="export-buttons flex space-x-2" style={{ marginTop: '20px', marginBottom: '10px' }}>
        <button onClick={handleExportToExcel} className="excel-btn px-4 py-2 rounded shadow">
          <i className="fa fa-file-excel-o mr-1" /> Export to Excel
        </button>
        <button onClick={handleExportToPDF} className="pdf-btn px-4 py-2 rounded shadow">
          <i className="fa fa-file-pdf-o mr-1" /> Export to PDF
        </button>
      </div>

      {/* Schedule Table or Loading State */}
      {loading ? (
        // Containerized Loading Animation
        <div style={{ 
          minHeight: '400px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          margin: '20px 0',
          border: '1px solid #e0e0e0'
        }}>
          <ScheduleGeneratorLoader 
            message="Loading schedule..." 
            showProgress={false} 
            isOverlay={false} 
          />
        </div>
      ) : error ? (
        <p className="error-msg">{error}</p>
      ) : (
        <div className="schedule-table-container">
          {timeSortedSchedule.length === 0 ? (
            <div className="no-schedule-container">
              <img src={noScheduleLogo} alt="No Schedule Available" className="no-schedule-logo" />
              <p>No schedule data found matching your filters.</p>
            </div>
          ) : (
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Course Title</th>
                  <th>Session</th>
                  <th>Program</th>
                  <th>Year</th>
                  <th>Block</th>
                  <th>Day</th>
                  <th>Time Slot</th>
                  <th>Room</th>
                  <th>Faculty</th>
                </tr>
              </thead>
              <tbody>
                {timeSortedSchedule.map((event, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="font-bold">{event.courseCode}</div>
                      <div className="text-xs">{event.title}</div>
                    </td>
                    <td>{event.session}</td>
                    <td>{event.program}</td>
                    <td>{event.year}</td>
                    <td>{event.block}</td>
                    <td>{event.day || ''}</td>
                    <td>{event.period || ''}</td>
                    <td>{event.room}</td>
                    <td>
                      {event.faculty ? (
                        event.faculty
                      ) : (
                        <span style={{ color: 'red', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <SuccessModal 
          message={successModalMessage} 
          type={modalType}
          onClose={closeModal} 
        />
      )}
    </div>
  );
};

export default GeneratedSchedulePage;
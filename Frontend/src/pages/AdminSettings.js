import React, { useState, useEffect } from 'react';
import {
  getRooms,
  updateRooms,
  getTimeSettings,
  updateTimeSettings,
  getDays,
  updateDays
} from '../services/settingService';
import SuccessModal from '../components/SuccessModal';
import '../styles/AdminSettings.css';

const convertToDropdown = (time24) => {
  let period = time24 >= 12 ? 'PM' : 'AM';
  let hour = time24 % 12;
  if (hour === 0) hour = 12;
  return { hour, period };
};

const convertTo24Hour = (hour, period) => {
  hour = Number(hour);
  return period === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12);
};

// --- HELPER: Natural Sort (Ascending) ---
const sortRooms = (rooms) => {
  return [...rooms].sort((a, b) => 
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
};

const AdminSettings = () => {
  
  const [lectureRooms, setLectureRooms] = useState([]);
  const [labRooms, setLabRooms] = useState([]);
  const [newLectureRoom, setNewLectureRoom] = useState('');
  const [newLabRoom, setNewLabRoom] = useState('');

  // Track rooms currently animating out (to delay removal from state)
  const [exitingRooms, setExitingRooms] = useState([]);

  const [startHour, setStartHour] = useState(7);
  const [startPeriod, setStartPeriod] = useState('AM');
  const [endHour, setEndHour] = useState(9);
  const [endPeriod, setEndPeriod] = useState('PM');
 
  const [days, setDays] = useState([]);
  const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // --- SEPARATE LOADING STATES ---
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [timeLoading, setTimeLoading] = useState(false);
  const [daysLoading, setDaysLoading] = useState(false);

  const [message, setMessage] = useState(''); 

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [modalType, setModalType] = useState("success");

  useEffect(() => {
    loadRooms();
    loadTimeSettings();
    loadDays();
  }, []);

  // --------------------- ROOMS LOGIC ---------------------
  const loadRooms = async () => {
    setRoomsLoading(true);
    try {
      const res = await getRooms(); 
      if (res.lecture && res.lab) {
        setLectureRooms(sortRooms(res.lecture));
        setLabRooms(sortRooms(res.lab));
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setRoomsLoading(false);
    }
  };

  const handleAddLectureRoom = () => {
    if (!newLectureRoom.trim()) return;
    const roomToAdd = newLectureRoom.trim();
    if (!lectureRooms.includes(roomToAdd)) {
      const updatedRooms = [...lectureRooms, roomToAdd];
      setLectureRooms(sortRooms(updatedRooms));
    }
    setNewLectureRoom('');
  };

  const handleAddLabRoom = () => {
    if (!newLabRoom.trim()) return;
    const roomToAdd = newLabRoom.trim();
    if (!labRooms.includes(roomToAdd)) {
      const updatedRooms = [...labRooms, roomToAdd];
      setLabRooms(sortRooms(updatedRooms));
    }
    setNewLabRoom('');
  };

  // Helper to handle Enter key press
  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission if inside a form tag
      action();
    }
  };

  const handleRemoveLectureRoom = (room) => {
    // 1. Add to exiting list to trigger CSS animation
    setExitingRooms((prev) => [...prev, room]);

    // 2. Wait for animation (300ms) then remove from actual state
    setTimeout(() => {
      setLectureRooms((prev) => prev.filter((r) => r !== room));
      setExitingRooms((prev) => prev.filter((r) => r !== room));
    }, 300);
  };

  const handleRemoveLabRoom = (room) => {
    setExitingRooms((prev) => [...prev, room]);

    setTimeout(() => {
      setLabRooms((prev) => prev.filter((r) => r !== room));
      setExitingRooms((prev) => prev.filter((r) => r !== room));
    }, 300);
  };

  const handleUpdateRooms = async () => {
    setRoomsLoading(true);
    try {
      const payload = { lecture: lectureRooms, lab: labRooms };
      const resp = await updateRooms(payload);
      if (resp.status === 'success') {
        showModal('Rooms updated successfully.', "success");
      } else {
        showModal('Error updating rooms.', "error");
      }
    } catch (error) {
      console.error('Error updating rooms:', error);
      showModal('Error updating rooms.', "error");
    } finally {
      setRoomsLoading(false);
    }
  };

  // --------------------- TIME SETTINGS LOGIC ---------------------
  const loadTimeSettings = async () => {
    setTimeLoading(true);
    try {
      const res = await getTimeSettings();
      if (res.time_settings) {
        const { start_time, end_time } = res.time_settings;
        const startObj = convertToDropdown(start_time);
        const endObj = convertToDropdown(end_time);
        setStartHour(startObj.hour);
        setStartPeriod(startObj.period);
        setEndHour(endObj.hour);
        setEndPeriod(endObj.period);
      }
    } catch (error) {
      console.error('Error loading time settings:', error);
    } finally {
      setTimeLoading(false);
    }
  };

  const handleTimeUpdate = async () => {
    setTimeLoading(true);
    try {
      const st = convertTo24Hour(startHour, startPeriod);
      const et = convertTo24Hour(endHour, endPeriod);
      await updateTimeSettings({ start_time: st, end_time: et });
      showModal('Time settings updated successfully.', "success");
    } catch (error) {
      console.error('Error updating time settings:', error);
      showModal('Error updating time settings.', "error");
    } finally {
      setTimeLoading(false);
    }
  };

  // --------------------- DAYS LOGIC ---------------------
  const loadDays = async () => {
    setDaysLoading(true);
    try {
      const res = await getDays();
      if (res.status === 'success' && res.days) {
        setDays(res.days);
      }
    } catch (error) {
      console.error('Error loading days:', error);
    } finally {
      setDaysLoading(false);
    }
  };

  const handleDayToggle = (day) => {
    if (days.includes(day)) {
      setDays(days.filter(d => d !== day));
    } else {
      setDays([...days, day]);
    }
  };

  const handleDaysUpdate = async () => {
    setDaysLoading(true);
    try {
      const resp = await updateDays({ days });
      if (resp.status === 'success') {
        showModal('Days updated successfully.', "success");
      } else {
        showModal('Error updating days.', "error");
      }
    } catch (error) {
      console.error('Error updating days:', error);
      showModal('Error updating days.', "error");
    } finally {
      setDaysLoading(false);
    }
  };

  // --------------------- SUCCESS MODAL LOGIC ---------------------
  const showModal = (msg, type = "success") => {
    setSuccessMessage(msg);
    setModalType(type);
    setShowSuccessModal(true);
  };
 
  const closeModal = () => {
    setShowSuccessModal(false);
  };

  // --------------------- RENDER UI ---------------------
  return (
    <div className="zoom-wrapper">
      <div className="admin-settings-container">
        
        {/* Rooms Card */}
        <div className="card">
          <h2>Update Rooms</h2>
          <div className="form-group">
            <label>Lecture Rooms</label>
            <div className="room-chips">
              {lectureRooms.map(room => (
                <div 
                  key={room} 
                  className={`room-chip ${exitingRooms.includes(room) ? 'exiting' : ''}`}
                >
                  {room}
                  <button onClick={() => handleRemoveLectureRoom(room)} disabled={roomsLoading}>x</button>
                </div>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add new lecture room"
              value={newLectureRoom}
              onChange={(e) => setNewLectureRoom(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleAddLectureRoom)}
              disabled={roomsLoading}
            />
            <button onClick={handleAddLectureRoom} disabled={roomsLoading}>Add</button>
          </div>
          <div className="form-group">
            <label>Lab Rooms</label>
            <div className="room-chips">
              {labRooms.map(room => (
                <div 
                  key={room} 
                  className={`room-chip ${exitingRooms.includes(room) ? 'exiting' : ''}`}
                >
                  {room}
                  <button onClick={() => handleRemoveLabRoom(room)} disabled={roomsLoading}>x</button>
                </div>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add new lab room"
              value={newLabRoom}
              onChange={(e) => setNewLabRoom(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, handleAddLabRoom)}
              disabled={roomsLoading}
            />
            <button onClick={handleAddLabRoom} disabled={roomsLoading}>Add</button>
          </div>
          <button className="update-btn" onClick={handleUpdateRooms} disabled={roomsLoading}>
            {roomsLoading ? <span className="loader-spinner"></span> : 'Update Rooms'}
          </button>
        </div>

        {/* Time Settings Card */}
        <div className="card">
          <h2>Update Time Settings</h2>
          <div className="time-settings-row">
            <div className="time-setting-field">
              <label>Start Time:</label>
              <div className="time-dropdowns">
                <select 
                  value={startHour} 
                  onChange={(e) => setStartHour(Number(e.target.value))}
                  disabled={timeLoading}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(hr => (
                    <option key={hr} value={hr}>{hr}</option>
                  ))}
                </select>
                <select 
                  value={startPeriod} 
                  onChange={(e) => setStartPeriod(e.target.value)}
                  disabled={timeLoading}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div className="time-setting-field">
              <label>End Time:</label>
              <div className="time-dropdowns">
                <select 
                  value={endHour} 
                  onChange={(e) => setEndHour(Number(e.target.value))}
                  disabled={timeLoading}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(hr => (
                    <option key={hr} value={hr}>{hr}</option>
                  ))}
                </select>
                <select 
                  value={endPeriod} 
                  onChange={(e) => setEndPeriod(e.target.value)}
                  disabled={timeLoading}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>
          <button className="update-btn" onClick={handleTimeUpdate} disabled={timeLoading}>
            {timeLoading ? <span className="loader-spinner"></span> : 'Update Time Settings'}
          </button>
        </div>

        {/* Days Card */}
        <div className="card">
          <h2>Update Days</h2>
          <div className="checkbox-group">
            {allDays.map(day => (
              <label key={day} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={days.includes(day)}
                  onChange={() => handleDayToggle(day)}
                  disabled={daysLoading}
                />
                <span className="day-chip">{day}</span>
              </label>
            ))}
          </div>
          <button className="update-btn" onClick={handleDaysUpdate} disabled={daysLoading}>
            {daysLoading ? <span className="loader-spinner"></span> : 'Update Days'}
          </button>
        </div>

        {message && <p className="message">{message}</p>}

        {/* Global Success Modal */}
        {showSuccessModal && (
          <SuccessModal 
            message={successMessage} 
            type={modalType}
            onClose={closeModal} 
          />
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
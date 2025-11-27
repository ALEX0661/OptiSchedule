import React, { useState, useMemo, useCallback, useEffect } from 'react';
import '../styles/AdvancedFilters.css';

const ScheduleFilters = ({ filters, onFilterChange, rooms, days: apiDays, mode = 'default' }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Local state to hold advanced selections temporarily to prevent lag
  const [localFilters, setLocalFilters] = useState({
    programSelected: [],
    yearSelected: [],
    blockSelected: [],
    daySelected: [],
    roomSelected: [],
    showUnassignedOnly: false
  });

  const isRoomView = mode === 'room';
  
  // Separate lecture and lab rooms
  const lectureRooms = useMemo(() => (rooms?.lecture || []).sort(), [rooms]);
  const labRooms = useMemo(() => (rooms?.lab || []).sort(), [rooms]);
  
  // UPDATED: Include lowercase 'online' in allRooms
  const allRooms = useMemo(() => ['online', ...lectureRooms, ...labRooms], [lectureRooms, labRooms]);

  const programs = useMemo(() => [
    { value: 'BSIT', label: 'BS Information Technology' },
    { value: 'BSCS', label: 'BS Computer Science' },
    { value: 'BSEMC-DAT', label: 'BS EMC - DAT' },
    { value: 'BSEMC-GD', label: 'BS EMC - GD' }
  ], []);

  const blocks = useMemo(() => ['A', 'B', 'C', 'D', 'E', 'F'], []);
  const years = useMemo(() => [
    { value: 1, label: 'First Year' },
    { value: 2, label: 'Second Year' },
    { value: 3, label: 'Third Year' },
    { value: 4, label: 'Fourth Year' }
  ], []);

  const days = useMemo(() => {
    if (apiDays && apiDays.length > 0) return apiDays;
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  }, [apiDays]);

  // --- SYNC LOCAL STATE WHEN OPENING PANEL ---
  useEffect(() => {
    if (showAdvanced) {
      setLocalFilters({
        programSelected: filters.programSelected || [],
        yearSelected: filters.yearSelected || [],
        blockSelected: filters.blockSelected || [],
        daySelected: filters.daySelected || [],
        roomSelected: filters.roomSelected || [],
        showUnassignedOnly: filters.showUnassignedOnly || false
      });
    }
  }, [showAdvanced, filters]);

  // --- HELPER TO TRIGGER EVENT TO PARENT ---
  const triggerChange = (name, value, type = 'text', checked = false) => {
    onFilterChange({
      target: { name, value, type, checked }
    });
  };

  // --- 1. HANDLE SIMPLE FILTER CHANGES ---
  const handleSimpleFilterChange = (e) => {
    onFilterChange(e);
  };

  // --- 2. HANDLE ADVANCED LOCAL CHANGES (No Lag) ---
  const handleLocalCheckboxChange = (category, value) => {
    setLocalFilters(prev => {
      const key = `${category}Selected`;
      const currentValues = prev[key] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [key]: newValues };
    });
  };

  const handleLocalToggleChange = (name, checked) => {
    setLocalFilters(prev => ({ ...prev, [name]: checked }));
  };

  const handleLocalSelectAll = (category, allValues) => {
    setLocalFilters(prev => {
      const key = `${category}Selected`;
      const currentValues = prev[key] || [];
      const newValues = currentValues.length === allValues.length ? [] : allValues;
      return { ...prev, [key]: newValues };
    });
  };

  const handleLocalClearAll = () => {
    setLocalFilters({
      programSelected: [],
      yearSelected: [],
      blockSelected: [],
      daySelected: [],
      roomSelected: [],
      showUnassignedOnly: false
    });
  };

  // --- 3. APPLY BUTTON (Pushes Local State to Parent) ---
  const handleApplyAdvanced = () => {
    triggerChange('programSelected', localFilters.programSelected);
    triggerChange('yearSelected', localFilters.yearSelected);
    triggerChange('blockSelected', localFilters.blockSelected);
    triggerChange('daySelected', localFilters.daySelected);
    triggerChange('roomSelected', localFilters.roomSelected);
    triggerChange('showUnassignedOnly', localFilters.showUnassignedOnly, 'checkbox', localFilters.showUnassignedOnly);

    setShowAdvanced(false);
  };

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    if (filters.programSelected?.length > 0) count++;
    if (filters.yearSelected?.length > 0) count++;
    if (filters.blockSelected?.length > 0) count++;
    if (!isRoomView && filters.daySelected?.length > 0) count++; 
    if (filters.roomSelected?.length > 0) count++;
    if (filters.showUnassignedOnly) count++; 
    return count;
  }, [filters, isRoomView]);

  const activeCount = getActiveFilterCount();

  return (
    <div className="cards filters-card">
      <div className="filters-header">
        <h2>Filters</h2>
        {/* UPDATED: Displays number count only if activeCount > 0 */}
        <button 
          className={`filter-icon-btn ${showAdvanced ? 'active' : ''}`}
          onClick={() => setShowAdvanced(!showAdvanced)}
          title={showAdvanced ? "Hide Filters" : "Advanced Filters"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          {activeCount > 0 && (
            <span className="filter-badge-count">{activeCount}</span>
          )}
        </button>
      </div>
      
      {/* --- SIMPLE FILTERS BAR --- */}
      <div className="filters-container">
        <div className="filter-group" style={{ flex: isRoomView ? '2' : '1' }}>
          <label className="filter-label">Search</label>
          <input
            className="filter-select"
            type="text"
            name="courseQuery"
            placeholder={isRoomView ? "Search Program, Course, Room..." : "Enter course code or name"}
            value={filters.courseQuery}
            onChange={onFilterChange} 
          />
        </div>

        {isRoomView && (
          <>
            <div className="filter-group">
              <label className="filter-label">Day</label>
              <select className="filter-select" name="day" value={filters.day} onChange={handleSimpleFilterChange}>
                <option value="all">All Days</option>
                {days.map(day => <option key={day} value={day}>{day}</option>)}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Room</label>
              <select className="filter-select" name="room" value={filters.room} onChange={handleSimpleFilterChange}>
                <option value="all">All Rooms</option>
                <option value="lecture">Lecture Rooms Only</option>
                <option value="lab">Lab Rooms Only</option>
              </select>
            </div>
          </>
        )}
      </div>

      {/* --- ADVANCED FILTERS PANEL --- */}
      {showAdvanced && (
        <div className="advanced-filter-panel">
          <div className="advanced-filter-header">
            <h3>Advanced Filters</h3>
            <div className="advanced-actions">
              {!isRoomView && (
                <label className="checkbox-item" style={{ marginBottom: 0, marginRight: '8px', border: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
                  <input
                    type="checkbox"
                    checked={localFilters.showUnassignedOnly}
                    onChange={(e) => handleLocalToggleChange('showUnassignedOnly', e.target.checked)}
                  />
                  <span>Unassigned Only</span>
                </label>
              )}
              
              <button className="clear-btn" onClick={handleLocalClearAll}>Clear All</button>
              <button className="apply-btn" onClick={handleApplyAdvanced}>Apply</button>
            </div>
          </div>

          <div className="advanced-sections">
            <div className="advanced-section">
              <div className="section-header">
                <h4>Programs</h4>
                <button className="select-all-btn" onClick={() => handleLocalSelectAll('program', programs.map(p => p.value))}>
                  {localFilters.programSelected.length === programs.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="checkbox-grid">
                {programs.map(prog => (
                  <label key={prog.value} className="checkbox-item">
                    <input type="checkbox" checked={localFilters.programSelected.includes(prog.value)} onChange={() => handleLocalCheckboxChange('program', prog.value)} />
                    <span>{prog.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="advanced-section">
              <div className="section-header">
                <h4>Year Levels</h4>
                <button className="select-all-btn" onClick={() => handleLocalSelectAll('year', years.map(y => y.value))}>
                  {localFilters.yearSelected.length === years.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="checkbox-grid">
                {years.map(yr => (
                  <label key={yr.value} className="checkbox-item">
                    <input type="checkbox" checked={localFilters.yearSelected.includes(yr.value)} onChange={() => handleLocalCheckboxChange('year', yr.value)} />
                    <span>{yr.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="advanced-section">
              <div className="section-header">
                <h4>Blocks</h4>
                <button className="select-all-btn" onClick={() => handleLocalSelectAll('block', blocks)}>
                  {localFilters.blockSelected.length === blocks.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="checkbox-grid compact">
                {blocks.map(block => (
                  <label key={block} className="checkbox-item">
                    <input type="checkbox" checked={localFilters.blockSelected.includes(block)} onChange={() => handleLocalCheckboxChange('block', block)} />
                    <span>Block {block}</span>
                  </label>
                ))}
              </div>
            </div>

            {!isRoomView && (
              <div className="advanced-section">
                <div className="section-header">
                  <h4>Days</h4>
                  <button className="select-all-btn" onClick={() => handleLocalSelectAll('day', days)}>
                    {localFilters.daySelected.length === days.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="checkbox-grid">
                  {days.map(day => (
                    <label key={day} className="checkbox-item">
                      <input type="checkbox" checked={localFilters.daySelected.includes(day)} onChange={() => handleLocalCheckboxChange('day', day)} />
                      <span>{day}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className={`advanced-section ${!isRoomView ? 'full-width' : ''}`}>
              <div className="section-header">
                <h4>Rooms</h4>
                <button className="select-all-btn" onClick={() => handleLocalSelectAll('room', allRooms)}>
                  {localFilters.roomSelected.length === allRooms.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <div className="room-category">
                <div className="room-category-header">Lecture & Virtual</div>
                <div className="checkbox-grid rooms-grid">
                  
                  {/* Online Room Checkbox */}
                  <label className="checkbox-item special-room">
                    <input 
                      type="checkbox" 
                      checked={localFilters.roomSelected.includes('online')} 
                      onChange={() => handleLocalCheckboxChange('room', 'online')} 
                    />
                    <span>Online</span>
                  </label>

                  {/* Rest of Lecture Rooms */}
                  {lectureRooms.map(room => (
                    <label key={room} className="checkbox-item">
                      <input type="checkbox" checked={localFilters.roomSelected.includes(room)} onChange={() => handleLocalCheckboxChange('room', room)} />
                      <span>{room}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              {labRooms.length > 0 && (
                <div className="room-category">
                  <div className="room-category-header">Lab Rooms</div>
                  <div className="checkbox-grid rooms-grid">
                    {labRooms.map(room => (
                      <label key={room} className="checkbox-item">
                        <input type="checkbox" checked={localFilters.roomSelected.includes(room)} onChange={() => handleLocalCheckboxChange('room', room)} />
                        <span>{room}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleFilters;
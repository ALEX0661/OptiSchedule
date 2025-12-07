import React, { useState, useEffect, useMemo } from 'react';
import {
  getFacultyList,
  addFaculty,
  updateFaculty,
  deleteFaculty,
  getArchivedFacultyList,
  restoreFaculty
} from '../services/facultyService';
import { getGeneratedSchedule } from '../services/scheduleService';
import {
  parsePeriod,
  computeEventUnits 
} from '../utils/scheduleHelpers';
import FacultyDetails from '../components/FacultyDetails';
import FacultyEventsFilter from '../components/FacultyEventsFilter';
import FacultyEventsTable from '../components/FacultyEventsTable';
import ExportButtons from '../components/ExportButtons';
import FacultyAddModal from '../components/FacultyAddModal';
import FacultyEditModal from '../components/FacultyEditModal';
import SuccessModal from '../components/SuccessModal';
import ConfirmationModal from '../components/ConfirmationModal';
import noFacultyLogo from '../assets/noFacultyLogo.png';
import '../styles/FacultyOverview.css';
import FacultyLoader from '../animations/FacultyLoader';

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
  if (currentEvent) mergedEvents.push(currentEvent);
  return mergedEvents;
};

const FacultyOverviewContainer = () => {
  const [facultyList, setFacultyList] = useState([]);
  const [archivedFacultyList, setArchivedFacultyList] = useState([]); 
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'archived'
  
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [facultyEvents, setFacultyEvents] = useState([]);
  const [filters, setFilters] = useState({
    program: 'all',
    block: 'all',
    year: 'all',
    courseQuery: '',
  });
  
  // Faculty list filters and sorting
  const [facultyFilters, setFacultyFilters] = useState({
    searchQuery: '',
    departmentSelected: [],
    rankSelected: [],
    statusSelected: [],
    sexSelected: []
  });
  
  const [sortOption, setSortOption] = useState('name'); 
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFacultyLoading, setIsFacultyLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [facultyToEdit, setFacultyToEdit] = useState(null);
  const [scheduleError, setScheduleError] = useState(false);
  const [showDeleteFacultyConfirmation, setShowDeleteFacultyConfirmation] = useState(false);
  const [facultyToDelete, setFacultyToDelete] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState(null);

  const storedScheduleName = localStorage.getItem('scheduleName') || 'Default Schedule';
  const scheduleName = `A.Y. ${storedScheduleName}`;

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

  // Available filter options
  const departments = useMemo(() => ['CCS', 'CEAS', 'CHTM', 'CBA', 'CAHS'], []);
  const ranks = useMemo(() => [
    'Instructor 1', 'Instructor 2', 'Instructor 3',
    'Professor 1', 'Professor 2', 'Professor 3',
    'Assistant Professor', 'Assistant Dean', 'Dean'
  ], []);
  const statuses = useMemo(() => ['Full Time', 'Part Time'], []);
  const sexOptions = useMemo(() => ['Male', 'Female', 'Other'], []);

  const fetchFaculty = async () => {
    setIsFacultyLoading(true);
    try {
      const data = await getFacultyList();
      if (data.status === 'success') {
        setFacultyList(data.faculty);
      } else {
        setError('Error fetching faculty.');
      }
    } catch (err) {
      console.error('Error fetching faculty:', err);
      setError('Error fetching faculty.');
    } finally {
      setIsFacultyLoading(false);
    }
  };

  const fetchArchived = async () => {
    setIsFacultyLoading(true);
    try {
      const data = await getArchivedFacultyList();
      if (data.status === 'success') {
        setArchivedFacultyList(data.faculty);
      }
    } catch (err) {
      console.error(err);
      setError('Error fetching archived faculty.');
    } finally {
      setIsFacultyLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchFaculty();
  }, []);

  // Fetch when switching views
  useEffect(() => {
    if (viewMode === 'archived') {
      fetchArchived();
    } else {
      fetchFaculty();
    }
  }, [viewMode]);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const data = await getGeneratedSchedule();
        if (data.status === 'success') {
          setSchedule(data.schedule);
          setScheduleError(false);
        } else {
          setSchedule([]);
          setScheduleError(data.status !== 'empty');
        }
      } catch (err) {
        console.error('Error fetching schedule events:', err);
        setError('Error fetching schedule events.');
        setScheduleError(true);
      }
    };
    fetchSchedule();
  }, []);

  useEffect(() => {
    if (selectedFaculty) {
      const events = schedule.filter(e => e.faculty === selectedFaculty.name);
      setFacultyEvents(events);
    } else {
      setFacultyEvents([]);
    }
  }, [selectedFaculty, schedule]);

  const filteredFacultyList = useMemo(() => {
    // Determine which source list to use based on viewMode
    const sourceList = viewMode === 'active' ? facultyList : archivedFacultyList;

    let result = sourceList.filter(faculty => {
      const { searchQuery, departmentSelected, rankSelected, statusSelected, sexSelected } = facultyFilters;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = faculty.name?.toLowerCase().includes(query);
        const matchesSpecialization = faculty.specialization?.toLowerCase().includes(query);
        const matchesRank = faculty.AcademicRank?.toLowerCase().includes(query);
        const matchesDept = faculty.Department?.toLowerCase().includes(query);
        if (!matchesName && !matchesSpecialization && !matchesRank && !matchesDept) return false;
      }
      if (departmentSelected.length > 0 && !departmentSelected.includes(faculty.Department)) return false;
      if (rankSelected.length > 0 && !rankSelected.includes(faculty.AcademicRank)) return false;
      if (statusSelected.length > 0 && !statusSelected.includes(faculty.Status)) return false;
      if (sexSelected.length > 0 && !sexSelected.includes(faculty.Sex)) return false;
      return true;
    });

    return result.sort((a, b) => {
      if (sortOption === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortOption === 'rank') {
        const rankA = ranks.indexOf(a.AcademicRank);
        const rankB = ranks.indexOf(b.AcademicRank);
        const rA = rankA === -1 ? 999 : rankA;
        const rB = rankB === -1 ? 999 : rankB;
        if (rA !== rB) return rA - rB;
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortOption === 'department') {
        const deptCompare = (a.Department || '').localeCompare(b.Department || '');
        if (deptCompare !== 0) return deptCompare;
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortOption === 'status') {
        const statusCompare = (a.Status || '').localeCompare(b.Status || '');
        if (statusCompare !== 0) return statusCompare;
        return (a.name || '').localeCompare(b.name || '');
      }
      return 0;
    });
  }, [facultyList, archivedFacultyList, viewMode, facultyFilters, sortOption, ranks]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleFacultyFilterChange = (e) => {
    const { name, value } = e.target;
    setFacultyFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (category, value) => {
    setFacultyFilters(prev => {
      const key = `${category}Selected`;
      const currentValues = prev[key] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      return { ...prev, [key]: newValues };
    });
  };

  const handleSortChange = (option) => {
    setSortOption(prev => prev === option ? 'name' : option);
  };

  const handleSelectAll = (category, allValues) => {
    setFacultyFilters(prev => {
      const key = `${category}Selected`;
      const currentValues = prev[key] || [];
      const newValues = currentValues.length === allValues.length ? [] : allValues;
      return { ...prev, [key]: newValues };
    });
  };

  const handleClearAll = () => {
    setFacultyFilters({
      searchQuery: '',
      departmentSelected: [],
      rankSelected: [],
      statusSelected: [],
      sexSelected: []
    });
    setSortOption('name'); 
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (facultyFilters.departmentSelected.length > 0) count++;
    if (facultyFilters.rankSelected.length > 0) count++;
    if (facultyFilters.statusSelected.length > 0) count++;
    if (facultyFilters.sexSelected.length > 0) count++;
    if (sortOption !== 'name') count++; 
    return count;
  };

  const filteredEvents = facultyEvents.filter(event => {
    const { program, block, year, courseQuery } = filters;
    let matches = true;
    if (program !== 'all' && event.program !== program) matches = false;
    if (block !== 'all' && event.block !== block) matches = false;
    if (year !== 'all' && String(event.year) !== year) matches = false;
    if (
      courseQuery &&
      !event.courseCode.toLowerCase().includes(courseQuery.toLowerCase()) &&
      !event.title.toLowerCase().includes(courseQuery.toLowerCase())
    )
      matches = false;
    return matches;
  });

  const sortedEvents = filteredEvents.slice().sort((a, b) => {
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

  const mergedEvents = Object.values(mergedEventsMap).map(event => {
    const sortedDayAbbrevs = event.dayAbbrevs.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
    return { ...event, day: sortedDayAbbrevs.join('') };
  });

  const finalMergedEvents = mergeConsecutiveEvents(mergedEvents);

  const handleSelectFaculty = fac => {
    // Only allow selection if in active mode
    if (viewMode === 'active') {
      setSelectedFaculty(fac);
    }
  };

  const handleBack = () => {
    setSelectedFaculty(null);
  };

  const handleFacultyUpdate = (updatedFaculty) => {
    setFacultyList(prevList => 
      prevList.map(f => f.id === updatedFaculty.id ? updatedFaculty : f)
    );
    setSelectedFaculty(updatedFaculty);
  };

  const openAddModal = () => setIsAddModalOpen(true);
  const closeAddModal = () => setIsAddModalOpen(false);

  const handleSaveFaculty = async facultyData => {
    try {
      setLoading(true);
      const response = await addFaculty(facultyData);
      if (response.status === 'success') {
        setFacultyList(prev => [...prev, response.faculty]);
        await new Promise(resolve => setTimeout(resolve, 500));
        closeAddModal();
        setFeedbackModal({ message: "Faculty added successfully!", type: "success" });
      } else {
        setFeedbackModal({ message: "Error adding faculty: " + response.message, type: "error" });
      }
    } catch (err) {
      console.error("Error adding faculty:", err);
      setFeedbackModal({ message: "Error adding faculty.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleEditFaculty = faculty => {
    setFacultyToEdit(faculty);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setFacultyToEdit(null);
  };

  const handleSaveEditedFaculty = async (facultyId, updatedData) => {
    try {
      setLoading(true);
      const response = await updateFaculty(facultyId, updatedData);
      if (response.status === 'success') {
        handleFacultyUpdate(response.faculty); 
        await new Promise(resolve => setTimeout(resolve, 500));
        closeEditModal();
        setFeedbackModal({ message: "Faculty updated successfully!", type: "success" });
      } else {
        setFeedbackModal({ message: "Error updating faculty: " + response.message, type: "error" });
      }
    } catch (err) {
      console.error("Error updating faculty:", err);
      setFeedbackModal({ message: "Error updating faculty.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFaculty = facultyId => {
    setFacultyToDelete(facultyId);
    setShowDeleteFacultyConfirmation(true);
  };

  const confirmDeleteFaculty = async () => {
    setShowDeleteFacultyConfirmation(false);
    try {
      setLoading(true);
      const facultyId = facultyToDelete;
      const response = await deleteFaculty(facultyId);
      if (response.status === 'success') {
        setFacultyList(prev => prev.filter(f => f.id !== facultyId));
        if (selectedFaculty && selectedFaculty.id === facultyId) {
          setSelectedFaculty(null);
        }
        setFeedbackModal({ message: "Faculty deleted successfully!", type: "success" });
      } else {
        setFeedbackModal({ message: "Error deleting faculty: " + response.message, type: "error" });
      }
    } catch (err) {
      console.error("Error deleting faculty:", err);
      setFeedbackModal({ message: "Error deleting faculty.", type: "error" });
    } finally {
      setLoading(false);
      setFacultyToDelete(null);
    }
  };

  const cancelDeleteFaculty = () => {
    setShowDeleteFacultyConfirmation(false);
    setFacultyToDelete(null);
  };

  // Restore Handler
  const handleRestoreFaculty = async (e, fac) => {
    e.stopPropagation();
    try {
      setLoading(true);
      const response = await restoreFaculty(fac.id);
      if (response.status === 'success') {
        setArchivedFacultyList(prev => prev.filter(f => f.id !== fac.id));
        setFeedbackModal({ message: "Faculty restored successfully!", type: "success" });
      } else {
        setFeedbackModal({ message: "Error restoring: " + response.message, type: "error" });
      }
    } catch (err) {
      setFeedbackModal({ message: "Error restoring faculty.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <div className="faculty-overview-container">
      <div className="overview-header">
        <h1>{scheduleName}</h1>
        {/* Conditional rendering: Hide segmented control if a faculty is selected */}
        {!selectedFaculty && (
          <div className="segmented-control">
            <button 
              className={`tab-segment ${viewMode === 'active' ? 'active' : ''}`}
              onClick={() => setViewMode('active')}
            >
              Active Faculty
            </button>
            <button 
              className={`tab-segment ${viewMode === 'archived' ? 'active' : ''}`}
              onClick={() => setViewMode('archived')}
            >
              Archived
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      )}

      {selectedFaculty && viewMode === 'active' ? (
        <div className="faculty-panel">
          <div className="faculty-panel-header">
            <button className="back-btn" onClick={handleBack} title="Back to Faculty List">
              <span className="back-logo">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="back-text">Back</span>
            </button>
          </div>
          <div className="faculty-details">
            <FacultyDetails
              faculty={selectedFaculty}
              schedule={schedule}
              onEdit={handleEditFaculty}
              onDelete={handleDeleteFaculty}
              onFacultyUpdate={handleFacultyUpdate} 
              onShowFeedback={setFeedbackModal}
            />
            <FacultyEventsFilter filters={filters} onFilterChange={handleFilterChange} />
            <ExportButtons
              events={finalMergedEvents}
              faculty={selectedFaculty}
              scheduleName={scheduleName}
              filterInfo={
                filters.program !== 'all' ||
                filters.year !== 'all' ||
                filters.block !== 'all'
                  ? `${filters.program !== 'all' ? filters.program : ''} ${filters.year !== 'all' ? 'Year' + filters.year : ''} ${filters.block !== 'all' ? 'Block ' + filters.block : ''}`.trim()
                  : ''
              }
            />
            <FacultyEventsTable
              events={finalMergedEvents}
              computeUnits={computeEventUnits} 
              fetchError={scheduleError}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Always show filters if we have list items or filters active, works for both Active and Archive */}
          <div className="cards filters-card faculty-filters-card-container">
            <div className="filters-header">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <h2 style={{ fontSize: '0.95rem', margin: 0 }}>Filters</h2>
                <span className="faculty-count-badge">
                  {filteredFacultyList.length} {filteredFacultyList.length === 1 ? 'Faculty' : 'Faculties'}
                </span>
              </div>

              <button 
                className={`filter-icon-btn ${showAdvancedFilters ? 'active' : ''}`}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                title={showAdvancedFilters ? "Hide Filters" : "Advanced Filters"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                {activeFilterCount > 0 && (
                  <span className="filter-badge-count">{activeFilterCount}</span>
                )}
              </button>
            </div>

            <div className="filters-container" style={{ marginBottom: showAdvancedFilters ? '12px' : '0' }}>
              <div className="filter-group" style={{ flex: 1 }}>
                <input
                  className="filter-select"
                  type="text"
                  name="searchQuery"
                  placeholder="Search by name, specialization, rank, or department..."
                  value={facultyFilters.searchQuery}
                  onChange={handleFacultyFilterChange}
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {showAdvancedFilters && (
              <div className="advanced-filter-panel" style={{ marginTop: '12px', padding: '12px' }}>
                <div className="advanced-filter-header" style={{ marginBottom: '10px', paddingBottom: '8px' }}>
                  <h3 style={{ fontSize: '0.85rem' }}>Advanced Filters</h3>
                  <div className="advanced-actions">
                    <button className="clear-btn" onClick={handleClearAll} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>Clear All</button>
                  </div>
                </div>

                {/* SORTING SECTION */}
                <div className="advanced-section-sorting" style={{ marginBottom: '15px', padding: '10px', borderBottom: '1px solid #eee' }}>
                  <div className="section-header" style={{ marginBottom: '8px', paddingBottom: '6px' }}>
                    <h4 style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Arrange By</h4>
                  </div>
                  <div className="sorting-options" style={{ display: 'flex', gap: '15px', flexDirection: 'row' }}>
                    <label className="checkbox-item" style={{ padding: '4px 6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={sortOption === 'rank'} 
                        onChange={() => handleSortChange('rank')}
                        style={{ width: '12px', height: '12px', marginRight: '5px' }}
                      />
                      <span>Rank</span>
                    </label>

                    <label className="checkbox-item" style={{ padding: '4px 6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={sortOption === 'department'} 
                        onChange={() => handleSortChange('department')}
                        style={{ width: '12px', height: '12px', marginRight: '5px' }}
                      />
                      <span>Department</span>
                    </label>

                    <label className="checkbox-item" style={{ padding: '4px 6px', fontSize: '0.75rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={sortOption === 'status'} 
                        onChange={() => handleSortChange('status')}
                        style={{ width: '12px', height: '12px', marginRight: '5px' }}
                      />
                      <span>Status</span>
                    </label>
                  </div>
                </div>

                <div className="advanced-sections" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div className="advanced-section" style={{ padding: '10px' }}>
                    <div className="section-header" style={{ marginBottom: '8px', paddingBottom: '6px' }}>
                      <h4 style={{ fontSize: '0.7rem' }}>Department</h4>
                      <button className="select-all-btn" onClick={() => handleSelectAll('department', departments)} style={{ fontSize: '0.65rem' }}>
                        {facultyFilters.departmentSelected.length === departments.length ? 'Deselect' : 'Select All'}
                      </button>
                    </div>
                    <div className="checkbox-grid" style={{ maxHeight: '120px', gap: '6px' }}>
                      {departments.map(dept => (
                        <label key={dept} className="checkbox-item" style={{ padding: '4px 6px', fontSize: '0.7rem' }}>
                          <input 
                            type="checkbox" 
                            checked={facultyFilters.departmentSelected.includes(dept)} 
                            onChange={() => handleCheckboxChange('department', dept)}
                            style={{ width: '12px', height: '12px' }}
                          />
                          <span>{dept}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="advanced-section" style={{ padding: '10px' }}>
                    <div className="section-header" style={{ marginBottom: '8px', paddingBottom: '6px' }}>
                      <h4 style={{ fontSize: '0.7rem' }}>Rank</h4>
                      <button className="select-all-btn" onClick={() => handleSelectAll('rank', ranks)} style={{ fontSize: '0.65rem' }}>
                        {facultyFilters.rankSelected.length === ranks.length ? 'Deselect' : 'Select All'}
                      </button>
                    </div>
                    <div className="checkbox-grid" style={{ maxHeight: '120px', gap: '6px' }}>
                      {ranks.map(rank => (
                        <label key={rank} className="checkbox-item" style={{ padding: '4px 6px', fontSize: '0.7rem' }}>
                          <input 
                            type="checkbox" 
                            checked={facultyFilters.rankSelected.includes(rank)} 
                            onChange={() => handleCheckboxChange('rank', rank)}
                            style={{ width: '12px', height: '12px' }}
                          />
                          <span>{rank}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="advanced-section" style={{ padding: '10px' }}>
                    <div className="section-header" style={{ marginBottom: '8px', paddingBottom: '6px' }}>
                      <h4 style={{ fontSize: '0.7rem' }}>Status</h4>
                      <button className="select-all-btn" onClick={() => handleSelectAll('status', statuses)} style={{ fontSize: '0.65rem' }}>
                        {facultyFilters.statusSelected.length === statuses.length ? 'Deselect' : 'Select All'}
                      </button>
                    </div>
                    <div className="checkbox-grid compact" style={{ maxHeight: '120px', gap: '6px' }}>
                      {statuses.map(status => (
                        <label key={status} className="checkbox-item" style={{ padding: '4px 6px', fontSize: '0.7rem' }}>
                          <input 
                            type="checkbox" 
                            checked={facultyFilters.statusSelected.includes(status)} 
                            onChange={() => handleCheckboxChange('status', status)}
                            style={{ width: '12px', height: '12px' }}
                          />
                          <span>{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="advanced-section" style={{ padding: '10px' }}>
                    <div className="section-header" style={{ marginBottom: '8px', paddingBottom: '6px' }}>
                      <h4 style={{ fontSize: '0.7rem' }}>Gender</h4>
                      <button className="select-all-btn" onClick={() => handleSelectAll('sex', sexOptions)} style={{ fontSize: '0.65rem' }}>
                        {facultyFilters.sexSelected.length === sexOptions.length ? 'Deselect' : 'Select All'}
                      </button>
                    </div>
                    <div className="checkbox-grid compact" style={{ maxHeight: '120px', gap: '6px' }}>
                      {sexOptions.map(sex => (
                        <label key={sex} className="checkbox-item" style={{ padding: '4px 6px', fontSize: '0.7rem' }}>
                          <input 
                            type="checkbox" 
                            checked={facultyFilters.sexSelected.includes(sex)} 
                            onChange={() => handleCheckboxChange('sex', sex)}
                            style={{ width: '12px', height: '12px' }}
                          />
                          <span>{sex}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {filteredFacultyList.length === 0 ? (
            <div className="no-faculty-container">
              {isFacultyLoading ? (
                <FacultyLoader />
              ) : (
                <>
                  <img src={noFacultyLogo} alt="No Faculty Found" className="no-faculty-logo" />
                  <p>{error ? "Error fetching faculty." : (viewMode === 'active' && facultyList.length === 0) ? "No faculty found." : "No faculty match the current filters."}</p>
                  {((viewMode === 'active' && facultyList.length > 0) || (viewMode === 'archived' && archivedFacultyList.length > 0)) && (
                    <button 
                      onClick={handleClearAll}
                      style={{
                        marginTop: '10px',
                        padding: '8px 16px',
                        backgroundColor: '#2E7D32',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="faculty-grid">
              {filteredFacultyList.map(fac => (
                <div
                  key={fac.id}
                  className={`faculty-grid-card improved-grid-card ${viewMode === 'archived' ? 'archived-card' : ''}`}
                  onClick={() => viewMode === 'active' && handleSelectFaculty(fac)}
                  title={fac.name}
                  style={{ cursor: viewMode === 'active' ? 'pointer' : 'default' }}
                >
                  <div className="card-header">
                    <div className="card-title-container">
                      <h3 className="card-title">{fac.name}</h3>
                      <p className="card-subtitle">
                        {fac.AcademicRank || 'Academic Rank N/A'}
                      </p>
                      {viewMode === 'archived' && (
                         <span style={{ fontSize: '0.7rem', color: '#ffcdd2', fontWeight: 'bold', marginTop: '4px', display: 'block' }}>ARCHIVED</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {viewMode === 'active' ? (
                       <span className="card-action-text">Click to view details</span>
                    ) : (
                       <button 
                          onClick={(e) => handleRestoreFaculty(e, fac)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#2E7D32',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                       >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                          Restore Faculty
                       </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Only show Add button in Active view */}
      {viewMode === 'active' && (
        <button className="floating-add-btn" onClick={openAddModal} title="Add Faculty">
          +
        </button>
      )}

      {isAddModalOpen && (
        <FacultyAddModal onClose={closeAddModal} onSave={handleSaveFaculty} />
      )}

      {isEditModalOpen && facultyToEdit && (
        <FacultyEditModal
          faculty={facultyToEdit}
          onClose={closeEditModal}
          onSave={handleSaveEditedFaculty}
        />
      )}

      {feedbackModal && (
        <SuccessModal
          message={feedbackModal.message}
          type={feedbackModal.type}
          onClose={() => setFeedbackModal(null)}
        />
      )}

      {showDeleteFacultyConfirmation && (
        <ConfirmationModal
          title="Confirm Delete"
          message="Are you sure you want to delete this faculty?"
          onConfirm={confirmDeleteFaculty}
          onCancel={cancelDeleteFaculty}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          type="warning"
        />
      )}
    </div>
  );
};

export default FacultyOverviewContainer;
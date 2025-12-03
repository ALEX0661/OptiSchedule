import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  calculateFacultyUnits,
  getFacultyLoadColor,
  isFacultyAvailableForGroup,
} from '../utils/scheduleHelpers';
import noFacultyLogo from '../assets/noFacultyLogo.png';
import FacultyLoader from '../animations/FacultyLoader';
import '../styles/FacultyPanel.css'; 
import '../styles/FacultySearch.css'; 

// --- Constants ---
const dayMapping = {
  Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'Th',
  Friday: 'F', Saturday: 'Sat', Sunday: 'Sun',
};
const dayOrder = ['M', 'T', 'W', 'Th', 'F', 'Sat', 'Sun'];

// Filter Constants
const DEPARTMENTS = ['CCS', 'CEAS', 'CHTM', 'CBA', 'CAHS'];
const RANKS = [
  'Instructor 1', 'Instructor 2', 'Instructor 3',
  'Professor 1', 'Professor 2', 'Professor 3',
  'Assistant Professor', 'Assistant Dean', 'Dean'
];
const STATUSES = ['Full Time', 'Part Time'];

const FacultyPanel = ({
  faculty,
  facultySearch,
  onFacultySearchChange,
  selectedGroup,
  schedule,
  onAssignFaculty,
  onOpenFacultyModal,
  isLoadingFaculty,
  fetchError,
}) => {
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [assigningFacultyId, setAssigningFacultyId] = useState(null);
  
  // --- New State for Advanced Filters ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    departments: [],
    ranks: [],
    statuses: []
  });

  // --- Filter Handlers ---
  const handleFilterChange = (category, value) => {
    setActiveFilters(prev => {
      const current = prev[category];
      const updated = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const handleSelectAll = (category, allValues) => {
    setActiveFilters(prev => ({
      ...prev,
      [category]: prev[category].length === allValues.length ? [] : allValues
    }));
  };

  const clearFilters = () => {
    setActiveFilters({ departments: [], ranks: [], statuses: [] });
  };

  const getActiveFilterCount = () => {
    return activeFilters.departments.length + activeFilters.ranks.length + activeFilters.statuses.length;
  };

  // --- Match Score Logic ---
  const calculateMatchScore = (specialization, courseTitle) => {
    if (!specialization || !courseTitle) return 0;
    
    const specLower = (specialization || '').toLowerCase().trim();
    const titleLower = (courseTitle || '').toLowerCase().trim();
    
    if (!specLower || !titleLower) return 0;
    
    const normalizeText = (text) => text.replace(/\s+/g, '').toLowerCase();
    const normalizedTitle = normalizeText(courseTitle);
    
    const specs = specLower.split(',').map(s => s.trim()).filter(s => s);
    
    if (specs.length === 0) return 0;
    
    let bestScore = 0;

    specs.forEach(specEntry => {
        const match = specEntry.match(/^(.+?)\s*\((\d)\)$/);
        
        if (match) {
            const subjectName = match[1].trim();
            const rating = parseInt(match[2], 10);
            
            if (!subjectName || rating === 0) return;
            
            const normalizedSubject = normalizeText(subjectName);
            
            if (normalizedSubject === normalizedTitle) {
                if (rating > bestScore) bestScore = rating;
            }
        }
    });

    return bestScore;
  };

  // --- Main Logic: Filtering & Sorting ---
  const sortedAndFilteredFaculty = useMemo(() => {
    let list = [...faculty]; // Create a copy to avoid mutating original

    // 1. Dynamic Text Search (Name, Dept, Rank, Status, Specialization)
    if (facultySearch.trim()) {
      const searchLower = facultySearch.toLowerCase().trim();
      list = list.filter((f) => {
        // Safe access (?) ensures we don't crash if a field is missing
        return (
          f.name?.toLowerCase().includes(searchLower) ||
          f.Department?.toLowerCase().includes(searchLower) ||
          f.AcademicRank?.toLowerCase().includes(searchLower) ||
          f.Status?.toLowerCase().includes(searchLower) ||
          f.specialization?.toLowerCase().includes(searchLower)
        );
      });
    }

    // 2. Advanced Filters (Checkbox Logic)
    list = list.filter(f => {
      if (activeFilters.departments.length > 0 && !activeFilters.departments.includes(f.Department)) return false;
      if (activeFilters.ranks.length > 0 && !activeFilters.ranks.includes(f.AcademicRank)) return false;
      if (activeFilters.statuses.length > 0 && !activeFilters.statuses.includes(f.Status)) return false;
      return true;
    });

    // 3. Sorting Logic
    if (selectedGroup && selectedGroup.groupEvents.length > 0) {
      // Assignment Mode: Prioritize Availability and Match Score
      const courseTitle = selectedGroup.groupEvents[0].title;
      
      list = list.map(f => {
        const isAvailable = isFacultyAvailableForGroup(f, selectedGroup, schedule);
        const matchScore = calculateMatchScore(f.specialization, courseTitle);
        
        // Sorting Algorithm
        let sortScore = 0;
        if (isAvailable) sortScore += 1000;
        if (matchScore > 0) sortScore += (matchScore * 100);
        
        return { ...f, isAvailable, matchScore, sortScore };
      });

      // Sort by Score (Desc), then Units (Asc), then Name (Asc)
      list.sort((a, b) => {
        if (b.sortScore !== a.sortScore) return b.sortScore - a.sortScore;
        const unitsDiff = (a.units || 0) - (b.units || 0);
        if (unitsDiff !== 0) return unitsDiff;
        return a.name.localeCompare(b.name); // Alphabetical tie-breaker
      });
    } else {
      // List Mode: Simple Alphabetical Sort
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [faculty, facultySearch, activeFilters, selectedGroup, schedule]);

  // --- Helpers ---
  const getSelectedGroupBlocks = () => {
    if (!selectedGroup?.groupEvents?.length) return [];
    return [...new Set(selectedGroup.groupEvents.map(e => e.block))].sort();
  };

  const toMinutes = (timeStr) => {
    const [time, meridiem] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const formattedScheduleEvents = useMemo(() => {
    if (!selectedGroup?.groupEvents?.length) return [];

    const sortedEvents = selectedGroup.groupEvents.slice().sort((a, b) => {
      const aStart = toMinutes(a.period.split(' - ')[0]);
      const bStart = toMinutes(b.period.split(' - ')[0]);
      return aStart - bStart;
    });

    const mergedEventsMap = sortedEvents.reduce((acc, event) => {
      const key = `${event.courseCode}-${event.session}-${event.program}-${event.year}-${event.block}-${event.room}-${event.period}`;
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

    return Object.values(mergedEventsMap).map((event) => {
      const sortedDayAbbrevs = event.dayAbbrevs.sort(
        (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)
      );
      return { ...event, day: sortedDayAbbrevs.join('') };
    });
  }, [selectedGroup]);

  const handleCardClick = async (f, available) => {
    if (!selectedGroup) {
      onOpenFacultyModal(f);
      return;
    }
    if (assigningFacultyId !== null) return;
    setAssigningFacultyId(f.id);
    try {
      await onAssignFaculty(f);
    } catch (error) {
      console.error("Assignment failed:", error);
    } finally {
      setAssigningFacultyId(null);
    }
  };

  // --- Render ---
  return (
    <div className="card">
      <div className="faculty-header">
        <h3 className="faculty-title">Faculty Members</h3>
        {selectedGroup && selectedGroup.groupEvents.length > 0 && (
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="group-info-btn"
            title="View Selected Group Details"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        )}
      </div>

      {selectedGroup && (
        <div className="selection-hint">
          <span className="status-dot"></span>
          Select a faculty to assign
        </div>
      )}
      
      {/* --- Search and Filter Bar --- */}
      <div className="faculty-search-wrapper">
        <input
          type="text"
          className="faculty-search-input"
          placeholder="Search name, rank, dept..." /* Updated Placeholder */
          value={facultySearch}
          onChange={onFacultySearchChange}
        />
        <button 
          className={`faculty-filter-btn ${getActiveFilterCount() > 0 ? 'active' : ''}`}
          onClick={() => setIsFilterModalOpen(true)}
          title="Filter Options"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          {getActiveFilterCount() > 0 && (
            <span className="filter-badge">
              {getActiveFilterCount()}
            </span>
          )}
        </button>
      </div>

      <div className="faculty-content">
        {isLoadingFaculty ? (
          <div className="faculty-loader-container"><FacultyLoader /></div>
        ) : fetchError ? (
          <div className="no-faculty-container">
            <img src={noFacultyLogo} alt="Error fetching faculty" className="no-faculty-logo" />
            <p>Error fetching faculty.</p>
          </div>
        ) : sortedAndFilteredFaculty.length === 0 ? (
          <div className="no-faculty-container">
            <img src={noFacultyLogo} alt="No Faculty Found" className="no-faculty-logo" />
            <p>No faculty members found matching your filters.</p>
            {getActiveFilterCount() > 0 && (
              <button 
                onClick={clearFilters}
                className="btn-primary"
                style={{ marginTop: '10px', fontSize: '0.85rem' }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="faculty-cards">
            {sortedAndFilteredFaculty.map((f) => {
              const available = selectedGroup ? (f.isAvailable !== undefined ? f.isAvailable : isFacultyAvailableForGroup(f, selectedGroup, schedule)) : true;
              const unitCount = calculateFacultyUnits(f.name, schedule);
              const loadColor = getFacultyLoadColor(f, unitCount);
              const isAssigningThis = assigningFacultyId === f.id;
              const isAnyAssigning = assigningFacultyId !== null;
              const hasConflict = selectedGroup && !available;
              const isDisabled = isAnyAssigning && !isAssigningThis;
              const isRecommended = selectedGroup && f.matchScore > 0;

              return (
                <div
                  key={f.id}
                  className={`faculty-card ${isDisabled ? 'disabled' : ''} ${isAssigningThis ? 'assigning' : ''} ${hasConflict ? 'conflict' : ''} ${isRecommended ? 'recommended-card' : ''}`}
                  onClick={() => !isDisabled && handleCardClick(f, available)}
                  style={{ cursor: (!isDisabled && (selectedGroup || !isAnyAssigning)) ? 'pointer' : 'default' }}
                >
                  <div className={`faculty-info ${isAssigningThis ? 'faded' : ''}`}>
                    <div className="faculty-name-row">
                      <span className="faculty-name-text">{f.name}</span>
                      {isRecommended && (
                        <span className={`specialist-badge rating-${f.matchScore}`} title={`Expertise match: ${f.matchScore}/5 stars`}>
                          {'★'.repeat(f.matchScore)}
                        </span>
                      )}
                    </div>
                    <div className="faculty-status">
                      <span>{f.Status || f.status}</span>
                      <span className="faculty-workload">{unitCount} units</span>
                      <div className={`status-indicator status-${loadColor}`}></div>
                      {hasConflict && <span className="conflict-text">Conflict</span>}
                    </div>
                  </div>
                  {isAssigningThis && (
                    <div className="assignment-spinner-overlay"><div className="assignment-spinner"></div></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- SELECTED GROUP MODAL (Unchanged) --- */}
      {isGroupModalOpen && ReactDOM.createPortal(
        <div className="group-modal-overlay" onClick={() => setIsGroupModalOpen(false)}>
          <div className="group-modal" onClick={(e) => e.stopPropagation()}>
            <div className="group-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <h3>Selected Group Details {selectedGroup.isMerged && (<span className="modal-merged-badge">🔗 Merged</span>)}</h3>
              </div>
              <button className="group-modal-close" onClick={() => setIsGroupModalOpen(false)}>×</button>
            </div>
            <div className="group-modal-content">
               <div className="modal-info-grid">
                <div className="modal-info-card modal-info-full">
                  <div className="modal-info-label">Course Title</div>
                  <div className="modal-info-value">{selectedGroup.groupEvents[0].title}</div>
                </div>
                <div className="modal-info-card">
                  <div className="modal-info-label">Course Code</div>
                  <div className="modal-info-value modal-course-code">{selectedGroup.groupEvents[0].courseCode}</div>
                </div>
                <div className="modal-info-card">
                  <div className="modal-info-label">Program & Year</div>
                  <div className="modal-info-value">{selectedGroup.groupEvents[0].program} - Year {selectedGroup.groupEvents[0].year}</div>
                </div>
                <div className="modal-info-card">
                  <div className="modal-info-label">Block{selectedGroup.isMerged ? 's' : ''}</div>
                  <div className="modal-info-value modal-blocks">{getSelectedGroupBlocks().join(' + ')}</div>
                </div>
               </div>
               <div className="modal-schedules-section">
                <h3 className="modal-section-title">Schedule Events</h3>
                <div className="modal-table-container">
                  <table className="assigned-events-table">
                    <thead>
                      <tr><th>Day</th><th>Time</th><th>Room</th></tr>
                    </thead>
                    <tbody>
                      {formattedScheduleEvents.map((event, index) => (
                        <tr key={index}><td>{event.day}</td><td>{event.period}</td><td>{event.room}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <button className="group-modal-close-btn" onClick={() => setIsGroupModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- FILTER MODAL (Using Updated Classes) --- */}
      {isFilterModalOpen && ReactDOM.createPortal(
        <div className="faculty-modal-overlay" onClick={() => setIsFilterModalOpen(false)}>
          <div className="faculty-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="faculty-modal-header">
              <h3>Filter Faculty</h3>
              <button className="faculty-modal-close" onClick={() => setIsFilterModalOpen(false)}>×</button>
            </div>
            
            <div className="faculty-modal-body">
              
              {/* Department Section */}
              <div className="filter-section">
                <div className="filter-section-header">
                  <h4 className="filter-section-title">Department</h4>
                  <button 
                    className="filter-select-toggle"
                    onClick={() => handleSelectAll('departments', DEPARTMENTS)}
                  >
                    {activeFilters.departments.length === DEPARTMENTS.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="filter-grid-2">
                  {DEPARTMENTS.map(dept => (
                    <label key={dept} className="filter-label">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.departments.includes(dept)} 
                        onChange={() => handleFilterChange('departments', dept)}
                      />
                      {dept}
                    </label>
                  ))}
                </div>
              </div>

              {/* Rank Section */}
              <div className="filter-section">
                <div className="filter-section-header">
                  <h4 className="filter-section-title">Academic Rank</h4>
                  <button 
                    className="filter-select-toggle"
                    onClick={() => handleSelectAll('ranks', RANKS)}
                  >
                    {activeFilters.ranks.length === RANKS.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="filter-grid-2">
                  {RANKS.map(rank => (
                    <label key={rank} className="filter-label">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.ranks.includes(rank)} 
                        onChange={() => handleFilterChange('ranks', rank)}
                      />
                      {rank}
                    </label>
                  ))}
                </div>
              </div>

              {/* Status Section */}
              <div className="filter-section">
                <div className="filter-section-header">
                  <h4 className="filter-section-title">Status</h4>
                  <button 
                    className="filter-select-toggle"
                    onClick={() => handleSelectAll('statuses', STATUSES)}
                  >
                    {activeFilters.statuses.length === STATUSES.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="filter-grid-3">
                  {STATUSES.map(status => (
                    <label key={status} className="filter-label">
                      <input 
                        type="checkbox" 
                        checked={activeFilters.statuses.includes(status)} 
                        onChange={() => handleFilterChange('statuses', status)}
                      />
                      {status}
                    </label>
                  ))}
                </div>
              </div>

            </div>
            
            <div className="faculty-modal-footer">
               <button 
                 className="btn-secondary"
                 onClick={clearFilters}
               >
                 Clear All
               </button>
               <button 
                 className="btn-primary"
                 onClick={() => setIsFilterModalOpen(false)}
               >
                 Show Results
               </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default FacultyPanel;
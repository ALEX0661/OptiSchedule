import React, { useMemo } from 'react';

const FacultyEventsFilter = ({ filters, onFilterChange }) => {
  
  // Dynamic data structures matching ScheduleFilters
  const programs = useMemo(() => [
    { value: 'BSIT', label: 'BS Information Technology' },
    { value: 'BSCS', label: 'BS Computer Science' },
    { value: 'BSEMC-DAT', label: 'BS EMC - DAT' },
    { value: 'BSEMC-GD', label: 'BS EMC - GD' }
  ], []);

  const years = useMemo(() => [
    { value: 1, label: 'First Year' },
    { value: 2, label: 'Second Year' },
    { value: 3, label: 'Third Year' },
    { value: 4, label: 'Fourth Year' }
  ], []);

  const blocks = useMemo(() => ['A', 'B', 'C', 'D', 'E', 'F'], []);

  return (
    <div className="filters-card faculty-events-filters">
      <h3>Assigned Class Schedule</h3>
      <div className="filters-grid">
        
        {/* 1. Search Input (Moved to First) */}
        <div className="filter-item" style={{ flexGrow: 2 }}>
          <label className="filter-label">Search</label>
          <input
            type="text"
            name="courseQuery"
            placeholder="Course code or name"
            value={filters.courseQuery}
            onChange={onFilterChange}
            className="filter-select"
          />
        </div>

        {/* 2. Program Select */}
        <div className="filter-item">
          <label className="filter-label">Program</label>
          <select
            name="program"
            value={filters.program}
            onChange={onFilterChange}
            className="filter-select"
          >
            <option value="all">All Programs</option>
            {programs.map((prog) => (
              <option key={prog.value} value={prog.value}>
                {prog.label}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Year Select */}
        <div className="filter-item">
          <label className="filter-label">Year</label>
          <select
            name="year"
            value={filters.year}
            onChange={onFilterChange}
            className="filter-select"
          >
            <option value="all">All Years</option>
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Block Select */}
        <div className="filter-item">
          <label className="filter-label">Block</label>
          <select
            name="block"
            value={filters.block}
            onChange={onFilterChange}
            className="filter-select"
          >
            <option value="all">All Blocks</option>
            {blocks.map((b) => (
              <option key={b} value={b}>
                Block {b}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default FacultyEventsFilter;
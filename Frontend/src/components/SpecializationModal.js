import React, { useState, useEffect } from 'react';
import ConfirmationModal from './ConfirmationModal'; 
import { getCourses } from '../services/courseService';
import '../styles/SpecializationModal.css';

// SVG Icons
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
);
const StarIcon = ({ filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
);
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);
const SpinnerIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="specialization-spinner-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
);
const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
);
const ChevronUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
);
const BookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const SpecializationModal = ({ 
  isOpen, 
  onClose, 
  specializations = [], 
  onSave, 
  facultyName, 
  readOnly = false,
  isSaving = false 
}) => {
  const parseSpecializations = (specs) => {
    if (Array.isArray(specs)) return specs;
    if (!specs || typeof specs !== 'string') return [];
    
    const regex = /([^(,]+)\((\d+)\)/g;
    const parsed = [];
    let match;
    while ((match = regex.exec(specs)) !== null) {
      parsed.push({
        name: match[1].trim(),
        rating: parseInt(match[2])
      });
    }
    return parsed;
  };

  const [localSpecs, setLocalSpecs] = useState(parseSpecializations(specializations));
  const [selectedSpecs, setSelectedSpecs] = useState(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState({ name: '', rating: 3 });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [sortBy, setSortBy] = useState('name');
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  
  // New states for course selection
  const [availableCourses, setAvailableCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [showCourseSelector, setShowCourseSelector] = useState(false);
  const [selectedCourseRating, setSelectedCourseRating] = useState(3);

  useEffect(() => {
    if (isOpen) {
      setLocalSpecs(parseSpecializations(specializations));
      setHasChanges(false);
      setSearchQuery('');
      setIsAddingNew(false);
      setEditingIndex(null);
      setSelectedSpecs(new Set());
      setConfirmModal(null);
      setShowCourseSelector(false);
      setCourseSearchQuery('');
      fetchCourses();
    }
  }, [isOpen, specializations]);

  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      const response = await getCourses();
      let coursesData = null;
      
      if (Array.isArray(response)) {
        coursesData = response;
      } else if (response && response.courses && Array.isArray(response.courses)) {
        coursesData = response.courses;
      } else if (response && response.data && Array.isArray(response.data)) {
        coursesData = response.data;
      }
      
      if (coursesData && coursesData.length > 0) {
        const titleKey = coursesData[0].Title ? 'Title' : 
                        coursesData[0].title ? 'title' :
                        coursesData[0].name ? 'name' :
                        coursesData[0].courseName ? 'courseName' :
                        coursesData[0].course_name ? 'course_name' : null;
        
        if (titleKey) {
          const uniqueTitles = [...new Set(coursesData.map(course => course[titleKey]).filter(Boolean))];
          setAvailableCourses(uniqueTitles.sort());
        }
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  };

  if (!isOpen) return null;

  const existingSpecNames = new Set(localSpecs.map(s => s.name.toLowerCase().trim()));
  
  const filteredAvailableCourses = availableCourses
    .filter(course => 
      course && course.toLowerCase().includes(courseSearchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aAdded = existingSpecNames.has(a.toLowerCase().trim());
      const bAdded = existingSpecNames.has(b.toLowerCase().trim());
      
      if (aAdded && !bAdded) return 1;
      if (!aAdded && bAdded) return -1;
      return a.localeCompare(b);
    });

  const filteredSpecs = localSpecs.filter(spec =>
    spec.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedSpecs = [...filteredSpecs].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'rating') return b.rating - a.rating;
    return 0;
  });

  const displaySpecs = isExpanded ? sortedSpecs : sortedSpecs.slice(0, 8);
  const allFilteredSelected = filteredSpecs.length > 0 && filteredSpecs.every(s => selectedSpecs.has(s.name));

  const updateRating = (index, newRating) => {
    const newSpecs = [...localSpecs];
    const actualIndex = localSpecs.findIndex(s => s === sortedSpecs[index]);
    const currentRating = newSpecs[actualIndex].rating;
    const finalRating = (currentRating === newRating) ? 0 : newRating;
    newSpecs[actualIndex] = { ...newSpecs[actualIndex], rating: finalRating };
    setLocalSpecs(newSpecs);
    setHasChanges(true);
  };

  const toggleSelection = (specName) => {
    const newSelection = new Set(selectedSpecs);
    if (newSelection.has(specName)) {
      newSelection.delete(specName);
    } else {
      newSelection.add(specName);
    }
    setSelectedSpecs(newSelection);
  };

  const toggleSelectAll = () => {
    const newSelection = new Set(selectedSpecs);
    if (allFilteredSelected) {
      filteredSpecs.forEach(s => newSelection.delete(s.name));
    } else {
      filteredSpecs.forEach(s => newSelection.add(s.name));
    }
    setSelectedSpecs(newSelection);
  };

  const handleBulkDelete = () => {
    if (selectedSpecs.size === 0) return;
    setConfirmModal({
      title: 'Delete Specializations',
      message: `Are you sure you want to delete ${selectedSpecs.size} selected items?`,
      type: 'warning',
      onConfirm: () => {
        const newSpecs = localSpecs.filter(spec => !selectedSpecs.has(spec.name));
        setLocalSpecs(newSpecs);
        setSelectedSpecs(new Set());
        setHasChanges(true);
        setConfirmModal(null);
      }
    });
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setEditValue({ ...sortedSpecs[index] });
  };

  const saveEdit = () => {
    if (!editValue.name.trim()) return;
    const newSpecs = [...localSpecs];
    const actualIndex = localSpecs.findIndex(s => s === sortedSpecs[editingIndex]);
    if (selectedSpecs.has(sortedSpecs[editingIndex].name)) {
      const newSel = new Set(selectedSpecs);
      newSel.delete(sortedSpecs[editingIndex].name);
      setSelectedSpecs(newSel);
    }
    newSpecs[actualIndex] = editValue;
    setLocalSpecs(newSpecs);
    setEditingIndex(null);
    setHasChanges(true);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue({ name: '', rating: 3 });
  };

  const removeSpec = (index) => {
    const specToRemove = sortedSpecs[index];
    const actualIndex = localSpecs.findIndex(s => s === specToRemove);
    if (selectedSpecs.has(specToRemove.name)) {
      const newSel = new Set(selectedSpecs);
      newSel.delete(specToRemove.name);
      setSelectedSpecs(newSel);
    }
    setLocalSpecs(localSpecs.filter((_, i) => i !== actualIndex));
    setHasChanges(true);
  };

  const addNewSpec = () => {
    if (!editValue.name.trim()) return;
    setLocalSpecs([...localSpecs, editValue]);
    setEditValue({ name: '', rating: 3 });
    setIsAddingNew(false);
    setHasChanges(true);
  };

  const addCourseAsSpec = (courseName) => {
    const newSpec = { name: courseName, rating: selectedCourseRating };
    setLocalSpecs([...localSpecs, newSpec]);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const formatted = localSpecs.map(s => `${s.name} (${s.rating})`).join(', ');
    await onSave(formatted); 
    setHasChanges(false);
    onClose();
  };

  const handleClose = () => {
    if (isSaving) return;
    if (hasChanges) {
      setConfirmModal({
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to close?',
        type: 'warning',
        onConfirm: () => {
          setConfirmModal(null);
          onClose();
        }
      });
    } else {
      onClose();
    }
  };

  const getRatingColor = (rating) => {
    if (rating >= 5) return 'specialization-rating-excellent';
    if (rating >= 4) return 'specialization-rating-good';
    if (rating >= 3) return 'specialization-rating-average';
    return 'specialization-rating-below';
  };

  const stats = {
    total: localSpecs.length,
    average: localSpecs.length > 0 
      ? (localSpecs.reduce((sum, s) => sum + s.rating, 0) / localSpecs.length).toFixed(1)
      : 0,
    highProficiency: localSpecs.filter(s => s.rating === 5).length
  };

  return (
    <>
      <div className="specialization-modal-overlay" onClick={handleClose}>
        <div className="specialization-modal-content" onClick={(e) => e.stopPropagation()}>
          
          <div className="specialization-modal-header">
            <div className="specialization-header-left">
              <h2 className="specialization-modal-title">Field of Specialization</h2>
              {facultyName && <p className="specialization-modal-subtitle">{facultyName}</p>}
              
              {/* Compact Stats Embedded in Header */}
              {localSpecs.length > 0 && (
                <div className="specialization-header-stats">
                  <span className="spec-stat-badge" title="Total Specializations">
                    {stats.total} Total
                  </span>
                  <span className="spec-stat-badge" title="Average Rating">
                    {stats.average} Avg ★
                  </span>
                  {stats.highProficiency > 0 && (
                    <span className="spec-stat-badge highlight" title="Expert Level Skills">
                      {stats.highProficiency} Expert
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <button onClick={handleClose} className="specialization-modal-close-btn" title="Close" disabled={isSaving}>
              <XIcon />
            </button>
          </div>

          <div className="specialization-controls-area">
            {localSpecs.length > 0 && (
              <>
                {!readOnly && (
                  <div className="specialization-select-all-label" title="Select All Filtered">
                    <div className="specialization-checkbox-wrapper">
                        <input 
                            type="checkbox" 
                            className="specialization-checkbox-input"
                            checked={allFilteredSelected && filteredSpecs.length > 0}
                            onChange={toggleSelectAll}
                            disabled={isSaving}
                        />
                    </div>
                    <span>Select All</span>
                  </div>
                )}

                {selectedSpecs.size > 0 && !readOnly ? (
                  <button onClick={handleBulkDelete} className="specialization-bulk-delete-btn">
                    <TrashIcon />
                    <span>Delete ({selectedSpecs.size})</span>
                  </button>
                ) : (
                  <>
                    <div className="specialization-search-wrapper">
                      <span className="specialization-search-icon">
                        <SearchIcon />
                      </span>
                      <input
                        type="text"
                        placeholder="Search specializations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="specialization-search-field"
                        disabled={isSaving}
                      />
                    </div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="specialization-sort-dropdown"
                      disabled={isSaving}
                    >
                      <option value="name">Sort by Name</option>
                      <option value="rating">Sort by Rating</option>
                    </select>
                  </>
                )}
              </>
            )}
            {!readOnly && (
              <div style={{ display: 'flex', gap: '8px', marginLeft: selectedSpecs.size > 0 ? 'auto' : '0' }}>
                <button
                  onClick={() => {
                    setShowCourseSelector(!showCourseSelector);
                    if (!showCourseSelector) {
                      setIsAddingNew(false);
                    }
                  }}
                  className={`specialization-add-from-courses-btn ${showCourseSelector ? 'active' : ''}`}
                  title="Add from Courses"
                  disabled={isSaving}
                >
                  <BookIcon />
                  <span>From Courses</span>
                </button>
                <button
                  onClick={() => {
                    if (isAddingNew) {
                      setIsAddingNew(false);
                    } else {
                      setIsAddingNew(true);
                      setShowCourseSelector(false);
                    }
                  }}
                  className="specialization-add-new-btn"
                  title={isAddingNew ? "Close Custom Add" : "Add Custom Specialization"}
                  disabled={isSaving}
                >
                  {isAddingNew ? <XIcon /> : <PlusIcon />}
                  <span>{isAddingNew ? "Close" : "Custom"}</span>
                </button>
              </div>
            )}
          </div>

          <div className="specialization-body-scroll">
            
            {/* Custom Add Form */}
            {isAddingNew && (
              <div className="specialization-add-form-panel">
                <input
                  type="text"
                  placeholder="Specialization name"
                  value={editValue.name}
                  onChange={(e) => setEditValue({ ...editValue, name: e.target.value })}
                  className="specialization-text-input"
                  autoFocus
                />
                <div className="specialization-rating-row">
                  <span className="specialization-rating-label">Rating:</span>
                  <select
                    value={editValue.rating}
                    onChange={(e) => setEditValue({ ...editValue, rating: parseInt(e.target.value) })}
                    className="specialization-rating-select"
                  >
                    {[0, 1, 2, 3, 4, 5].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="specialization-star-group">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setEditValue(prev => ({ ...prev, rating: prev.rating === star ? 0 : star }))}
                        className={`specialization-star-btn ${editValue.rating >= star ? 'active' : 'empty'}`}
                        title={`Set rating to ${star}`}
                      >
                        <StarIcon filled={editValue.rating >= star} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="specialization-form-actions">
                  <button onClick={addNewSpec} className="specialization-icon-btn spec-btn-save" title="Save">
                    <SaveIcon />
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingNew(false);
                      setEditValue({ name: '', rating: 3 });
                    }}
                    className="specialization-icon-btn spec-btn-cancel"
                    title="Cancel"
                  >
                    <XIcon />
                  </button>
                </div>
              </div>
            )}

            {displaySpecs.length > 0 ? (
              <div className="specialization-list-container">
                {displaySpecs.map((spec, index) => (
                  <div key={index} className="specialization-item-row">
                    {!readOnly && editingIndex !== index && (
                      <div className="specialization-checkbox-wrapper">
                        <input 
                          type="checkbox" 
                          className="specialization-checkbox-input"
                          checked={selectedSpecs.has(spec.name)}
                          onChange={() => toggleSelection(spec.name)}
                          disabled={isSaving}
                        />
                      </div>
                    )}

                    {editingIndex === index ? (
                      <div className="specialization-edit-mode-row">
                        <input
                          type="text"
                          value={editValue.name}
                          onChange={(e) => setEditValue({ ...editValue, name: e.target.value })}
                          className="specialization-text-input"
                        />
                        <div className="specialization-rating-row">
                          <select
                            value={editValue.rating}
                            onChange={(e) => setEditValue({ ...editValue, rating: parseInt(e.target.value) })}
                            className="specialization-rating-select"
                          >
                            {[0, 1, 2, 3, 4, 5].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div className="specialization-actions-group">
                          <button onClick={saveEdit} className="specialization-icon-btn spec-btn-save" title="Save">
                            <SaveIcon />
                          </button>
                          <button onClick={cancelEdit} className="specialization-icon-btn spec-btn-cancel" title="Cancel">
                            <XIcon />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="specialization-info-col">
                          <span className="specialization-name-text">{spec.name}</span>
                        </div>
                        <div className="specialization-rating-wrapper">
                          {!readOnly ? (
                            <div className="specialization-star-group">
                              {[1, 2, 3, 4, 5].map(rating => (
                                <button
                                  key={rating}
                                  onClick={() => updateRating(index, rating)}
                                  className={`specialization-star-btn ${spec.rating >= rating ? 'active' : 'empty'}`}
                                  title={`Rate ${rating} stars`}
                                  disabled={isSaving}
                                >
                                  <StarIcon filled={spec.rating >= rating} />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="specialization-star-group">
                              {[1, 2, 3, 4, 5].map(star => (
                                <span key={star} className={star <= spec.rating ? 'star-filled' : 'star-empty'}>
                                  <StarIcon filled={star <= spec.rating} />
                                </span>
                              ))}
                            </div>
                          )}
                          <span className={`specialization-rating-badge ${getRatingColor(spec.rating)}`}>
                            {spec.rating}/5
                          </span>
                        </div>
                        {!readOnly && (
                          <div className="specialization-actions-group">
                            <button
                              onClick={() => startEdit(index)}
                              className="specialization-icon-btn spec-btn-edit"
                              title="Edit"
                              disabled={isSaving}
                            >
                              <EditIcon />
                            </button>
                            <button
                              onClick={() => removeSpec(index)}
                              className="specialization-icon-btn spec-btn-delete"
                              title="Remove"
                              disabled={isSaving}
                            >
                              <XIcon />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="specialization-empty-state">
                {searchQuery ? (
                  <p>No specializations found matching "{searchQuery}"</p>
                ) : (
                  <p>No specializations added yet. Click "From Courses" or "Custom" to get started.</p>
                )}
              </div>
            )}

            {filteredSpecs.length > 8 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="specialization-expand-btn"
                disabled={isSaving}
              >
                {isExpanded ? (
                  <>
                    <ChevronUpIcon />
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <ChevronDownIcon />
                    <span>Show {filteredSpecs.length - 8} More</span>
                  </>
                )}
              </button>
            )}
          </div>

          {!readOnly && (
            <div className="specialization-modal-footer">
              <button onClick={handleClose} className="specialization-footer-btn-cancel" disabled={isSaving}>
                Cancel
              </button>
              <button 
                onClick={handleSave} 
                className="specialization-footer-btn-save"
                disabled={!hasChanges || isSaving}
              >
                {isSaving ? <SpinnerIcon /> : <SaveIcon />}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Course Selection Modal Overlay (Now Green Themed) */}
      {showCourseSelector && !readOnly && (
        <div className="course-modal-overlay" onClick={() => setShowCourseSelector(false)}>
          <div className="course-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="course-selector-header">
              <h3>
                <BookIcon />
                <span>Add from Available Courses</span>
              </h3>
              <button 
                onClick={() => setShowCourseSelector(false)}
                className="specialization-icon-btn spec-btn-cancel"
                title="Close"
              >
                <XIcon />
              </button>
            </div>

            <div className="course-selector-controls">
              <div className="specialization-search-wrapper">
                <span className="specialization-search-icon">
                  <SearchIcon />
                </span>
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={courseSearchQuery}
                  onChange={(e) => setCourseSearchQuery(e.target.value)}
                  className="specialization-search-field"
                  autoFocus
                />
              </div>
              <div className="course-rating-selector">
                <span className="course-rating-label">Default Rating:</span>
                <select
                  value={selectedCourseRating}
                  onChange={(e) => setSelectedCourseRating(parseInt(e.target.value))}
                  className="specialization-rating-select"
                >
                  {[0, 1, 2, 3, 4, 5].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <div className="specialization-star-group">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setSelectedCourseRating(prev => prev === star ? 0 : star)}
                      className={`specialization-star-btn ${selectedCourseRating >= star ? 'active' : 'empty'}`}
                      title={`Set rating to ${star}`}
                    >
                      <StarIcon filled={selectedCourseRating >= star} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="course-list-container">
              {loadingCourses ? (
                <div className="course-loading">
                  <SpinnerIcon />
                  <span>Loading courses...</span>
                </div>
              ) : filteredAvailableCourses.length === 0 ? (
                <div className="course-empty-state">
                  {courseSearchQuery ? (
                    <p>No courses found matching "{courseSearchQuery}"</p>
                  ) : (
                    <p>No courses available</p>
                  )}
                </div>
              ) : (
                <div className="course-grid">
                  {filteredAvailableCourses.map((course, index) => {
                    const isAdded = existingSpecNames.has(course.toLowerCase().trim());
                    return (
                      <div key={index} className={`course-item ${isAdded ? 'course-item-disabled' : ''}`}>
                        <span className="course-name" title={course}>{course}</span>
                        <button
                          onClick={() => !isAdded && addCourseAsSpec(course)}
                          className={`course-add-btn ${isAdded ? 'added' : ''}`}
                          title={isAdded ? "Already Added" : "Add this course"}
                          disabled={isAdded}
                        >
                          {isAdded ? (
                            <>
                              <CheckIcon />
                              <span style={{marginLeft: '4px', fontSize: '0.8em'}}>Added</span>
                            </>
                          ) : (
                            <PlusIcon />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmationModal
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </>
  );
};

export default SpecializationModal;
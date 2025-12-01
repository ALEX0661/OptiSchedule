import React, { useState } from 'react';
import '../styles/CreateSchedule.css';

const FacultyEditModal = ({ faculty, onClose, onSave }) => {
  // Initialize state with existing faculty data
  const [formData, setFormData] = useState({ 
    ...faculty,
    // Ensure values are not null/undefined to avoid controlled input warnings
    AcademicRank: faculty.AcademicRank || '',
    Department: faculty.Department || '',
    Educational_attainment: faculty.Educational_attainment || '',
    Sex: faculty.Sex || '',
    Status: faculty.Status || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Simple validation for Name only
    if (!formData.name || !formData.name.trim()) {
      alert("Faculty name is required.");
      return;
    }

    onClose();
    onSave(faculty.id, formData); 
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-window faculty-edit-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">Edit Faculty</div>
        <form onSubmit={handleSubmit}>
          <label>Name: <span style={{color: 'red'}}>*</span></label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <label>Academic Rank:</label>
          <select
            name="AcademicRank"
            value={formData.AcademicRank}
            onChange={handleChange}
          >
            {/* Removed 'disabled' so user can revert to empty */}
            <option value="">Select Academic Rank</option>
            <option value="Instructor 1">Instructor 1</option>
            <option value="Instructor 2">Instructor 2</option>
            <option value="Instructor 3">Instructor 3</option>
            <option value="Professor 1">Professor 1</option>
            <option value="Professor 2">Professor 2</option>
            <option value="Professor 3">Professor 3</option>
            <option value="Assistant Professor">Assistant Professor</option>
            <option value="Assistant Dean">Assistant Dean</option>
            <option value="Dean">Dean</option>
          </select>

          <label>Department:</label>
          <select
            name="Department"
            value={formData.Department}
            onChange={handleChange}
          >
            <option value="">Select Department</option>
            <option value="CCS">CCS</option>
            <option value="CEAS">CEAS</option>
            <option value="CHTM">CHTM</option>
            <option value="CBA">CBA</option>
            <option value="CAHS">CAHS</option>
          </select>

          <label>Educational Attainment:</label>
          <input
            type="text"
            name="Educational_attainment"
            value={formData.Educational_attainment}
            onChange={handleChange}
          />

          <label>Sex:</label>
          <select
            name="Sex"
            value={formData.Sex}
            onChange={handleChange}
          >
            <option value="">Select Sex</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>

          <label>Status:</label>
          <select
            name="Status"
            value={formData.Status}
            onChange={handleChange}
          >
            <option value="">Select Status</option>
            <option value="Full Time">Full Time</option>
            <option value="Part Time">Part Time</option>
          </select>

          <div className="modal-button-row">
            <button type="submit" className="save-btn">Save</button>
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FacultyEditModal;
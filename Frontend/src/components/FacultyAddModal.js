import React, { useState } from 'react';
import '../styles/CreateSchedule.css';

const FacultyAddModal = ({ onClose, onSave }) => {
  const [facultyData, setFacultyData] = useState({
    name: '',
    specialization: '', // Keep this here to ensure API compatibility
    AcademicRank: '',
    Department: '',
    Educational_attainment: '',
    Sex: '',
    Status: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFacultyData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Name is the only strictly required field
    if (!facultyData.name.trim()) {
      alert("Faculty name is required.");
      return;
    }
    onClose();
    onSave(facultyData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-window faculty-add-modal" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">Add Faculty Member</div>
        <form onSubmit={handleSubmit}>
          <label>Name: <span style={{color: 'red'}}>*</span></label>
          <input
            type="text"
            name="name"
            value={facultyData.name}
            onChange={handleChange}
            placeholder="Enter Name"
            required
          />

          <label>Academic Rank:</label>
          <select
            name="AcademicRank"
            value={facultyData.AcademicRank}
            onChange={handleChange}
          >
            {/* Removed 'disabled' so it can be selected to clear the value */}
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
            value={facultyData.Department}
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
            value={facultyData.Educational_attainment}
            onChange={handleChange}
            placeholder="e.g. PhD, Masters"
          />

          <label>Sex:</label>
          <select
            name="Sex"
            value={facultyData.Sex}
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
            value={facultyData.Status}
            onChange={handleChange}
          >
            <option value="">Select Status</option>
            <option value="Full Time">Full Time</option>
            <option value="Part Time">Part Time</option>
          </select>

          <div className="modal-button-row">
            <button type="submit" className="save-btn">Save</button>
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FacultyAddModal;
import React, { useState } from 'react';
import { calculateFacultyUnits } from '../utils/scheduleHelpers';
import SpecializationModal from './SpecializationModal';
import { updateFacultySpecialization } from '../services/facultyService';

const FacultyDetails = ({ 
  faculty, 
  schedule, 
  onEdit, 
  onDelete, 
  onFacultyUpdate,
  onShowFeedback 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!faculty) return null;

  const assignedUnits = calculateFacultyUnits(faculty.name, schedule);

  const getSpecializationCount = (specs) => {
    if (!specs || typeof specs !== 'string') return 0;
    const regex = /([^(,]+)\((\d+)\)/g;
    let count = 0;
    while (regex.exec(specs) !== null) {
      count++;
    }
    return count;
  };

  const specializationCount = getSpecializationCount(faculty.specialization);

  const handleSaveSpecializations = async (updatedSpecs) => {
    setIsSaving(true);
    try {
      const response = await updateFacultySpecialization(faculty.id, updatedSpecs);
      
      if (response.status === 'success') {
        const updatedFaculty = {
          ...faculty,
          specialization: updatedSpecs
        };

        if (onFacultyUpdate) {
          onFacultyUpdate(updatedFaculty);
        }
        
        if (onShowFeedback) {
          onShowFeedback({ message: "Specializations updated successfully!", type: "success" });
        }
      } else {
        if (onShowFeedback) {
          onShowFeedback({ message: "Failed to update specialization.", type: "error" });
        }
      }
    } catch (error) {
      console.error('Failed to update specialization:', error);
      if (onShowFeedback) {
        onShowFeedback({ message: "Failed to update specialization. Please try again.", type: "error" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <article className="faculty-details-card">
        <header className="faculty-details-header">
          <h2 className="faculty-details-name">{faculty.name}</h2>
          <div className="faculty-actions">
            <button
              className="action-btn edit-faculty-btn"
              onClick={() => onEdit(faculty)}
              title="Edit Faculty Details"
              aria-label="Edit faculty member"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button
              className="action-btn delete-btn"
              onClick={() => onDelete(faculty.id)}
              title="Delete Faculty Member"
              aria-label="Delete faculty member"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </header>
        
        <section className="faculty-info">
          <p>
            <strong>Academic Rank:</strong> {faculty.AcademicRank || "N/A"}
          </p>
          <p>
            <strong>Department:</strong> {faculty.Department || "N/A"}
          </p>
          <p>
            <strong>Educational Attainment:</strong>{" "}
            {faculty.Educational_attainment || "N/A"}
          </p>
          <p>
            <strong>Sex:</strong> {faculty.Sex || "N/A"}
          </p>
          <p>
            <strong>Status:</strong> {faculty.Status || "N/A"}
          </p>
          
          <p className="specialization-row">
            <strong>Field of Specializations:</strong>{" "}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="view-specializations-btn"
              title="View and edit specializations"
            >
              {specializationCount > 0 
                ? `View ${specializationCount} Specialization${specializationCount !== 1 ? 's' : ''}`
                : 'Add Specializations'}
            </button>
          </p>
        </section>

        <footer className="faculty-units">
          <p>
            <strong>Assigned Units:</strong> {assignedUnits}
          </p>
        </footer>
      </article>

      <SpecializationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        specializations={faculty.specialization}
        onSave={handleSaveSpecializations}
        facultyName={faculty.name}
        readOnly={false}
        isSaving={isSaving} 
      />
    </>
  );
};

export default FacultyDetails;
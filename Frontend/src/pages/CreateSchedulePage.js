import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getCourses, 
  deleteCourse, 
  updateCourse, 
  addCourse, 
  uploadExcel 
} from '../services/courseService';
import { generateSchedule, getBaseURL } from '../services/scheduleService';
import EditCourseModal from '../components/EditCourseModal';
import AddCourseModal from '../components/AddCourseModal';
import BlockConfigModal from '../components/BlockConfigModal';
import SuccessModal from '../components/SuccessModal';
import ConfirmationModal from '../components/ConfirmationModal';
import BookShelfLoader from '../animations/BookShelfLoader';
import ScheduleGeneratorLoader from '../animations/ScheduleGeneratorLoader';
import noCourseLogo from '../assets/noCourseLogo.png';
import '../styles/CreateSchedule.css';


const CreateSchedulePage = () => {
  const currentYear = new Date().getFullYear();
  const validYears = [];
  for (let year = currentYear - 1; year <= currentYear + 1; year++) {
    validYears.push(year);
  }

  const loadingMessages = {
    addCourse: [
      "Adding course to the curriculum...",
      "Registering new course in the system...",
      "Updating course catalog with new entry..."
    ],
    updateCourse: [
      "Updating course details...",
      "Saving changes to course information...",
      "Applying modifications to course record..."
    ],
    deleteCourse: [
      "Removing selected courses from the system...",
      "Deleting course records permanently...",
      "Purging selected courses from records..."
    ],
    importCourses: [
      "Processing uploaded course data...",
      "Validating and preparing course information...",
      "Integrating new courses into the system..."
    ]
  };

  const getRandomLoadingMessage = (category) => {
    const messages = loadingMessages[category];
    return messages[Math.floor(Math.random() * messages.length)];
  };

  const getScheduleGenerationMessage = (progress) => {
    if (progress < 30) {
      return "Initializing scheduling engine and gathering course data...";
    } else if (progress < 40) {
      return "Analyzing course requirements and faculty constraints...";
    } else if (progress < 50) {
      return "Generating initial schedule framework...";
    } else if (progress < 60) {
      return "Optimizing room assignments and time slots...";
    } else if (progress < 70) {
      return "Resolving scheduling conflicts and overlaps...";
    } else if (progress < 80) {
      return "Finalizing schedule and validating requirements...";
    } else if (progress < 90) {
      return "Optimizing student block schedules...";
    } else {
      return "Schedule generation complete! Preparing results...";
    }
  };

  const [startingYear, setStartingYear] = useState(currentYear);
  const [semester, setSemester] = useState('1st Sem');
  const academicYear = `${startingYear}-${startingYear + 1}`;
  const scheduleName = `${academicYear} ${semester}`;

  // --- Merged Dropdown Logic ---
  const termOptions = useMemo(() => {
    const semesters = [
      { value: '1st Sem', label: '1st Semester' },
      { value: '2nd Sem', label: '2nd Semester' },
      { value: 'Midyear', label: 'Midyear' }
    ];
    
    const options = [];
    validYears.forEach(year => {
      semesters.forEach(sem => {
        options.push({
          value: `${year}|${sem.value}`,
          label: `A.Y. ${year}-${year + 1} ${sem.label}`,
          year: year,
          semester: sem.value
        });
      });
    });
    return options;
  }, [validYears]);

  const handleTermChange = (e) => {
    const [yearStr, semStr] = e.target.value.split('|');
    setStartingYear(parseInt(yearStr, 10));
    setSemester(semStr);
  };
  // -----------------------------

  const [courses, setCourses] = useState([]);
  const [importedCourses, setImportedCourses] = useState([]);
  const [blocksConfigured, setBlocksConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [editCourse, setEditCourse] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');
  const [modalType, setModalType] = useState("success");
  const [navigateAfterModal, setNavigateAfterModal] = useState(false);

  const [filterProgram, setFilterProgram] = useState('All Programs');
  const [filterYear, setFilterYear] = useState('All Years');
  const [filterQuery, setFilterQuery] = useState('');

  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');
  const [uploadedSemester, setUploadedSemester] = useState(null);

  const navigate = useNavigate();
  const evtSourceRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("scheduleName", scheduleName);
  }, [startingYear, semester, scheduleName]);

  useEffect(() => {
    const fetchCourseList = async () => {
      try {
        const data = await getCourses();
        if (data.status === 'success') {
          setCourses(data.courses);
        } else {
          setCoursesError(data.message || "Error fetching courses");
          setSuccessModalMessage(data.message || "Error fetching courses");
          setModalType("error");
          setShowSuccessModal(true);
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
        setCoursesError("Error fetching courses");
        setSuccessModalMessage("Error fetching courses");
        setModalType("error");
        setShowSuccessModal(true);
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchCourseList();
  }, []);

  const filteredCourses = courses.filter(course => {
    // 1. Check Dropdown Filters
    const matchesProgram = filterProgram === 'All Programs' || course.program === filterProgram;
    const matchesYear = filterYear === 'All Years' || String(course.yearLevel) === filterYear;
    
    // 2. Check Search Query (Dynamic: Code, Title, Program, Year)
    const query = filterQuery.toLowerCase().trim();
    const matchesQuery =
      query === '' ||
      course.courseCode.toLowerCase().includes(query) ||
      course.title.toLowerCase().includes(query) ||
      course.program.toLowerCase().includes(query) ||
      String(course.yearLevel).includes(query);

    return matchesProgram && matchesYear && matchesQuery;
  });

  const getSemesterDisplayName = (sem) => {
    const semesterMap = {
      "1st Sem": "First Semester",
      "2nd Sem": "Second Semester",
      "Midyear": "Midyear"
    };
    return semesterMap[sem] || sem;
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    
    // --- FIX START: Reset input value to allow re-uploading the same file ---
    e.target.value = null; 
    // --- FIX END ---

    if (!file) return;
    
    // Map semester values to sheet names
    const sheetNameMap = {
      "1st Sem": "First Semester",
      "2nd Sem": "Second Semester",
      "Midyear": "Midyear"
    };
    const sheetName = sheetNameMap[semester];
    
    try {
      setLoading(true);
      setLoadingMessage("Extracting course data from Excel file...");
      const data = await uploadExcel(file, sheetName);
      if (data.courses) {
        setImportedCourses(data.courses);
        setUploadedSemester(semester);
        setBlocksConfigured(false);
        setShowBlockModal(true);
      } else {
        setSuccessModalMessage("Error uploading Excel file: " + (data.error || "Unknown error"));
        setModalType("error");
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error("Error uploading Excel file:", error);
      setSuccessModalMessage(error.response?.data?.detail || "Error uploading Excel file.");
      setModalType("error");
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleBlockConfigSubmit = (config) => {
    const updatedImported = importedCourses.map(course => {
      const key = `${course.program}_${course.yearLevel}`;
      return { ...course, blocks: config[key]?.blocks || 0 };
    });
    setImportedCourses(updatedImported);
    setShowBlockModal(false);
    setBlocksConfigured(true);
    setSuccessModalMessage("Courses extracted successfully!");
    setModalType("success");
    setShowSuccessModal(true);
  };

  const removeImportedCourse = (courseCode) => {
    setImportedCourses(importedCourses.filter(course => course.courseCode !== courseCode));
  };

  const handleSaveImportedCourses = async () => {
    setLoading(true);
    setLoadingMessage(getRandomLoadingMessage('importCourses'));
    try {
      const results = await Promise.allSettled(
        importedCourses.map(course => addCourse(course))
      );

      const successfulCourses = [];
      const failedCourses = [];
      importedCourses.forEach((course, index) => {
        const result = results[index];
        if (result.status === "fulfilled" && result.value.status === "success") {
          successfulCourses.push(result.value.course || course);
        } else {
          failedCourses.push(course);
        }
      });

      setCourses(prevCourses => [...prevCourses, ...successfulCourses]);
      setImportedCourses(failedCourses);
      if (failedCourses.length === 0) {
        setBlocksConfigured(false);
        setUploadedSemester(null);
      }

      if (failedCourses.length === 0) {
        setSuccessModalMessage("Uploaded courses saved successfully!");
        setModalType("success");
      } else {
        setSuccessModalMessage(
          `Some courses failed to save (${failedCourses.length} of ${importedCourses.length}).`
        );
        setModalType("error");
      }
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error saving uploaded courses:", error);
      setSuccessModalMessage("Error saving uploaded courses.");
      setModalType("error");
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };
  
  const handleAddCourse = () => setShowAddModal(true);

  const handleAddCourseSubmit = async (newCourse) => {
    setShowAddModal(false);
    setLoading(true);
    setLoadingMessage(getRandomLoadingMessage('addCourse'));
    try {
      const response = await addCourse(newCourse);
      if (response.status === 'success') {
        const addedCourse = response.course || newCourse;
        setCourses([...courses, addedCourse]);
        setSuccessModalMessage("Course added successfully!");
        setModalType("success");
        setShowSuccessModal(true);
      } else {
        setSuccessModalMessage("Error adding course: " + response.message);
        setModalType("error");
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('Error adding course:', error);
      setSuccessModalMessage("Error adding course.");
      setModalType("error");
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleEditCourse = (course) => setEditCourse(course);

  const handleUpdateCourse = async (updatedCourse) => {
    setEditCourse(null);
    setLoading(true);
    setLoadingMessage(getRandomLoadingMessage('updateCourse'));
    try {
      const response = await updateCourse(updatedCourse.courseCode, updatedCourse.program, updatedCourse);
      if (response.status === 'success') {
        const courseObj = response.course || updatedCourse;
        setCourses(courses.map(c => 
          c.courseCode === courseObj.courseCode && c.program === courseObj.program ? courseObj : c
        ));
        setSuccessModalMessage("Course updated successfully!");
        setModalType("success");
        setShowSuccessModal(true);
      } else {
        setSuccessModalMessage("Error updating course: " + response.message);
        setModalType("error");
        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error('Error updating course:', error);
      setSuccessModalMessage("Error updating course.");
      setModalType("error");
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleCheckboxChange = (courseCode, program, isChecked) => {
    const courseIdentifier = `${courseCode}_${program}`;
    setSelectedCourses(isChecked 
      ? [...selectedCourses, courseIdentifier] 
      : selectedCourses.filter(id => id !== courseIdentifier)
    );
  };

  const handleSelectAll = (isChecked) => {
    setSelectedCourses(isChecked 
      ? filteredCourses.map(c => `${c.courseCode}_${c.program}`) 
      : []
    );
  };

  const openDeleteConfirmation = () => setShowDeleteConfirmation(true);

  const confirmDeleteSelected = async () => {
    setShowDeleteConfirmation(false);
    setLoading(true);
    setLoadingMessage(getRandomLoadingMessage('deleteCourse'));
    try {
      const deletionResults = await Promise.allSettled(
        selectedCourses.map(id => {
          const [courseCode, program] = id.split('_');
          return deleteCourse(courseCode, program);
        })
      );

      const failedDeletions = deletionResults.filter(result => result.status === 'rejected');
      
      setCourses(prevCourses =>
        prevCourses.filter(course => {
          const courseId = `${course.courseCode}_${course.program}`;
          return !selectedCourses.includes(courseId);
        })
      );
      
      setSelectedCourses([]);

      if (failedDeletions.length === 0) {
        setSuccessModalMessage("Courses deleted successfully!");
        setModalType("success");
      } else {
        setSuccessModalMessage(
          `Some courses failed to delete. (${failedDeletions.length} out of ${selectedCourses.length})`
        );
        setModalType("error");
      }
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error deleting selected courses:", error);
      setSuccessModalMessage("Error deleting selected courses.");
      setModalType("error");
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };
  
  const cancelDeleteSelected = () => setShowDeleteConfirmation(false);

  const handleGenerateSchedule = async () => {
    setLoading(true);
    setIsGeneratingSchedule(true);
    setLoadingMessage("Initializing schedule generator...");
    setProgress(0);
    try {
      const data = await generateSchedule(true, true);
      if (data.process_id) {
        const evtSource = new EventSource(`${getBaseURL()}/progress/${data.process_id}`);
        evtSource.onmessage = (e) => {
          const val = parseInt(e.data, 10);
          if (val === -1) {
            evtSource.close();
            setLoading(false);
            setIsGeneratingSchedule(false);
            setSuccessModalMessage("No feasible schedule found. The constraints may be too restrictive.");
            setModalType("error");
            setShowSuccessModal(true);
            return;
          }
          setProgress(val);
          setLoadingMessage(getScheduleGenerationMessage(val));
          if (val >= 100) {
            evtSource.close();
            setLoading(false);
            setIsGeneratingSchedule(false);
            setProgress(100);
            setSuccessModalMessage("Schedule generated successfully!");
            setModalType("success");
            setShowSuccessModal(true);
            setNavigateAfterModal(true);
          }
        };
        evtSource.onerror = (err) => {
          console.error("EventSource error:", err);
          evtSource.close();
          setLoading(false);
          setIsGeneratingSchedule(false);
          setSuccessModalMessage("Error No Feasible Schedule found.");
          setModalType("error");
          setShowSuccessModal(true);
        };
        evtSourceRef.current = evtSource;
      } else {
        if (data.status === "success") {
          setLoading(false);
          setIsGeneratingSchedule(false);
          setSuccessModalMessage("Schedule generated successfully!");
          setModalType("success");
          setShowSuccessModal(true);
          setNavigateAfterModal(true);
        } else {
          setLoading(false);
          setIsGeneratingSchedule(false);
          setSuccessModalMessage("Failed to generate schedule: " + data.message);
          setModalType("error");
          setShowSuccessModal(true);
        }
      }
    } catch (error) {
      console.error("Error generating schedule:", error);
      setLoading(false);
      setIsGeneratingSchedule(false);
      setLoadingMessage('');
      setSuccessModalMessage("Error generating schedule. Please check your network connection and try again.");
      setModalType("error");
      setShowSuccessModal(true);
    }
  };

  return (
    <div className="create-schedule-page">
      <div className="schedule-name-card">
        <label className="section-label">Select Schedule Term</label>
        <div className="academic-year-group">
          <select
            value={`${startingYear}|${semester}`}
            onChange={handleTermChange}
            style={{ width: '100%', padding: '8px' }}
          >
            {termOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="filters-card">
        <h2>Filters</h2>
        <div className="filters-grid">
          {/* SEARCH INPUT (Moved First) */}
          <div className="filter-item" style={{ flexGrow: 2 }}>
            <label>Search</label>
            <input
              type="text"
              placeholder="Search by Code, Name, Program or Year..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>

          <div className="filter-item">
            <label>Program</label>
            <select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)}>
              <option value="All Programs">All Programs</option>
              <option value="BSIT">BS Information Technology</option>
              <option value="BSCS">BS Computer Science</option>
              <option value="BSEMC-DAT">BS Entertainment and Multimedia Computing - Major in Digital Animation Technology</option>
              <option value="BSEMC-GD">BS Entertainment and Multimedia Computing - Major in Game Development</option>
          </select>
          </div>
          <div className="filter-item">
            <label>Year</label>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
              <option value="All Years">All Years</option>
              <option value="1">First Year</option>
              <option value="2">Second Year</option>
              <option value="3">Third Year</option>
              <option value="4">Fourth Year</option>
            </select>
          </div>
        </div>
      </div>

      <div className="course-management-card">
        <h2>Course Management</h2>
        <div className="import-action">
          <button
            className="import-excel-btn"
            onClick={() => document.getElementById('excel-file-input').click()}
          >
            Upload Courses
          </button>
          <input
            id="excel-file-input"
            type="file"
            accept=".xlsx, .xls"
            style={{ display: 'none' }}
            onChange={handleImportExcel}
          />
        </div>

        {blocksConfigured && importedCourses.length > 0 && (
          <div className="import-preview-section">
            <h3>Uploaded {getSemesterDisplayName(uploadedSemester)} Courses Preview <span className="course-counter">({importedCourses.length} courses)</span></h3>
            <table className="course-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course Title</th>
                  <th>Program</th>
                  <th>Year</th>
                  <th>Lec Units</th>
                  <th>Lab Units</th>
                  <th>Block</th>
                  <th className="action-col">Remove</th>
                </tr>
              </thead>
              <tbody>
                {importedCourses.map(course => (
                  <tr key={`${course.courseCode}_${course.program}`}>
                    <td>{course.courseCode}</td>
                    <td>{course.title}</td>
                    <td>{course.program}</td>
                    <td>{course.yearLevel}</td>
                    <td>{course.unitsLecture}</td>
                    <td>{course.unitsLab}</td>
                    <td>{course.blocks}</td>
                    <td>
                      <button 
                        className="remove-btn" 
                        onClick={() => removeImportedCourse(course.courseCode)}
                        title="Remove course"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="preview-save">
              <button className="import-excel-btn" onClick={handleSaveImportedCourses}>
                Save Uploaded Courses
              </button>
            </div>
          </div>
        )}

        <div className="table-area">
          <div className="table-header">
            <h4>Course List <span className="course-counter">({filteredCourses.length} of {courses.length} courses)</span></h4>
            {selectedCourses.length > 0 && (
              <div className="table-actions">
                <button className="import-excel-btn" onClick={openDeleteConfirmation}>
                  Delete Selected <span className="course-counter">({selectedCourses.length})</span>
                </button>
              </div>
            )}
          </div>
          <table className="course-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    checked={filteredCourses.length > 0 && selectedCourses.length === filteredCourses.length}
                  />
                </th>
                <th>Code</th>
                <th>Course Title</th>
                <th>Program</th>
                <th>Year</th>
                <th>Lec Units</th>
                <th>Lab Units</th>
                <th>Block</th>
                <th className="action-col"></th>
              </tr>
            </thead>
            <tbody>
              {coursesLoading ? (
                <tr>
                  <td colSpan="9">
                    <BookShelfLoader />
                  </td>
                </tr>
              ) : filteredCourses.length > 0 ? (
                filteredCourses.map(course => {
                  const courseId = `${course.courseCode}_${course.program}`;
                  return (
                    <tr key={courseId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedCourses.includes(courseId)}
                          onChange={(e) => handleCheckboxChange(course.courseCode, course.program, e.target.checked)}
                        />
                      </td>
                      <td>{course.courseCode}</td>
                      <td>{course.title}</td>
                      <td>{course.program}</td>
                      <td>{course.yearLevel}</td>
                      <td>{course.unitsLecture}</td>
                      <td>{course.unitsLab}</td>
                      <td>{course.blocks}</td>
                      <td>
                        <button 
                          className="edit-btn" 
                          onClick={() => handleEditCourse(course)}
                          title="Edit course"
                        >
                          ✎
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="centered-msg">
                    {coursesError ? (
                      <div className="no-course-container">
                        <img src={noCourseLogo} alt="Error fetching courses" className="no-course-logo" />
                        <p>Error fetching courses.</p>
                      </div>
                    ) : (
                      <div className="no-course-container">
                        <img src={noCourseLogo} alt="No Courses Available" className="no-course-logo" />
                        <p>No courses available.</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="generate-schedule-section">
        <button className="generate-btn" onClick={handleGenerateSchedule} disabled={!(scheduleName && courses.length)}>
          Generate Schedule
        </button>
        {!(scheduleName && courses.length) && (
          <p className="error-msg">
            Please enter a valid schedule name and upload/add courses.
          </p>
        )}
      </div>

      {loading && !isGeneratingSchedule && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p className="loading-message">{loadingMessage}</p>
        </div>
      )}
      
      {loading && isGeneratingSchedule && (
        <ScheduleGeneratorLoader message={loadingMessage} progress={progress} />
      )}

      {editCourse && (
        <EditCourseModal
          course={editCourse}
          onClose={() => setEditCourse(null)}
          onSubmit={handleUpdateCourse}
        />
      )}

      {showAddModal && (
        <AddCourseModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddCourseSubmit}
        />
      )}

      {showBlockModal && (
        <BlockConfigModal
          courses={importedCourses}
          semester={uploadedSemester}
          onClose={() => setShowBlockModal(false)}
          onSubmit={handleBlockConfigSubmit}
        />
      )}

      {showSuccessModal && (
        <SuccessModal 
          message={successModalMessage} 
          type={modalType}
          onClose={() => {
            setShowSuccessModal(false);
            if (navigateAfterModal) {
              navigate("/schedule-management");
              setNavigateAfterModal(false);
            }
          }} 
        />
      )}

      {showDeleteConfirmation && (
        <ConfirmationModal
          title="Confirm Delete"
          message="Are you sure you want to delete the selected courses?"
          onConfirm={confirmDeleteSelected}
          onCancel={cancelDeleteSelected}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          type="warning"
        />
      )}
      
      <button className="floating-add-btn" onClick={handleAddCourse}>
        +
      </button>
    </div>
  );
};

export default CreateSchedulePage;
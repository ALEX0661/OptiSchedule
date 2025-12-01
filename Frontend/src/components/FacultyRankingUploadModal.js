import React, { useState } from 'react';
import { uploadFacultyRanking } from '../services/facultyService';
import '../styles/FacultyOverview.css'; 

const FacultyRankingUploadModal = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [defaultPosition, setDefaultPosition] = useState("Part Time"); // New State
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // ... [parseCSV function remains exactly the same] ...
  const parseCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (!text.trim()) {
        setError("File is empty.");
        return;
      }

      const lines = text.split('\n');
      
      const snapshot = lines.slice(0, 30).map(line => {
          const cells = [];
          let current = '';
          let inQuotes = false;
          
          for (let char of line) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cells.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          cells.push(current.trim().replace(/^"|"$/g, ''));
          
          return cells;
      });
      setPreviewData(snapshot);
      setError('');
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadResult(null);
      setShowConfirmation(false);
      parseCSV(selectedFile);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV file.');
      return;
    }

    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('default_position', defaultPosition); // Append the user choice

    try {
      const response = await uploadFacultyRanking(formData);
      if (response.status === 'success') {
        setUploadResult(response);
        setShowConfirmation(true);
        onSuccess(response.message);
      } else {
        setError(response.message || 'Upload failed.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.detail || 'Error uploading. Ensure CSV matches the Matrix format.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmation(false);
    onClose();
  };

  // ... [Confirmation Modal Code remains exactly the same] ...
  if (showConfirmation && uploadResult) {
    const hasCreatedFaculty = uploadResult.details?.created_faculty > 0;
    
    return (
      <div className="group-modal-overlay" onClick={handleConfirmClose}>
        <div 
          className="group-modal" 
          onClick={(e) => e.stopPropagation()} 
          style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}
        >
          <div className="group-modal-header" style={{ backgroundColor: '#2e7d32', color: 'white' }}>
            <h3>✓ Import Successful</h3>
            <button 
              className="group-modal-close" 
              onClick={handleConfirmClose}
              style={{ color: 'white', fontSize: '1.5rem' }}
            >
              ×
            </button>
          </div>

          <div className="group-modal-content" style={{ padding: '25px' }}>
            {/* Summary Statistics */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: hasCreatedFaculty ? 'repeat(auto-fit, minmax(180px, 1fr))' : 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '25px'
            }}>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#e8f5e9',
                borderRadius: '10px',
                textAlign: 'center',
                border: '2px solid #4caf50'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2e7d32' }}>
                  {uploadResult.details?.matched_faculty || 0}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#555', marginTop: '5px' }}>
                  Faculty Updated
                </div>
              </div>

              {hasCreatedFaculty && (
                <div style={{ 
                  padding: '20px', 
                  backgroundColor: '#e1f5fe',
                  borderRadius: '10px',
                  textAlign: 'center',
                  border: '2px solid #03a9f4'
                }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#0277bd' }}>
                    {uploadResult.details.created_faculty}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#555', marginTop: '5px' }}>
                    Faculty Created ({uploadResult.details.default_position})
                  </div>
                </div>
              )}

              <div style={{ 
                padding: '20px', 
                backgroundColor: '#e3f2fd',
                borderRadius: '10px',
                textAlign: 'center',
                border: '2px solid #2196f3'
              }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#1565c0' }}>
                  {uploadResult.details?.total_specializations || 0}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#555', marginTop: '5px' }}>
                  Specializations Added
                </div>
              </div>
            </div>

            {/* Successfully Matched Faculty */}
            {uploadResult.details?.matched_names && uploadResult.details.matched_names.length > 0 && (
              <div style={{ marginBottom: '25px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  marginBottom: '12px',
                  paddingBottom: '10px',
                  borderBottom: '2px solid #4caf50'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>✅</span>
                  <h4 style={{ margin: 0, color: '#2e7d32' }}>
                    Successfully Matched Faculty ({uploadResult.details.matched_names.length})
                  </h4>
                </div>
                
                <div style={{ 
                  maxHeight: '300px',
                  overflowY: 'auto',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  padding: '15px'
                }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem'
                  }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ textAlign: 'left', padding: '10px', color: '#555' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '10px', color: '#555' }}>CSV Name</th>
                        <th style={{ textAlign: 'center', padding: '10px', color: '#555' }}>→</th>
                        <th style={{ textAlign: 'left', padding: '10px', color: '#555' }}>Database Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResult.details.matched_names.map((match, idx) => {
                        const [csvName, dbName] = match.split(' → ');
                        return (
                          <tr key={idx} style={{ 
                            borderBottom: '1px solid #eee',
                            backgroundColor: idx % 2 === 0 ? 'white' : '#f5f5f5'
                          }}>
                            <td style={{ padding: '10px', color: '#999' }}>{idx + 1}</td>
                            <td style={{ padding: '10px', fontWeight: '500' }}>{csvName}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#4caf50' }}>→</td>
                            <td style={{ padding: '10px', color: '#2e7d32', fontWeight: 'bold' }}>
                              {dbName}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Newly Created Faculty */}
            {uploadResult.details?.created_faculty_list && uploadResult.details.created_faculty_list.length > 0 && (
              <div style={{ marginBottom: '25px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  marginBottom: '12px',
                  paddingBottom: '10px',
                  borderBottom: '2px solid #03a9f4'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>🆕</span>
                  <h4 style={{ margin: 0, color: '#0277bd' }}>
                    Newly Created Faculty ({uploadResult.details.created_faculty_list.length})
                  </h4>
                </div>
                
                <div style={{ 
                  maxHeight: '300px',
                  overflowY: 'auto',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  padding: '15px'
                }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem'
                  }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ textAlign: 'left', padding: '10px', color: '#555' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '10px', color: '#555' }}>CSV Name</th>
                        <th style={{ textAlign: 'center', padding: '10px', color: '#555' }}>→</th>
                        <th style={{ textAlign: 'left', padding: '10px', color: '#555' }}>Created As</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResult.details.created_faculty_list.map((entry, idx) => {
                        const parts = entry.split(' → ');
                        const csvName = parts[0];
                        const restParts = parts[1].split(' (ID: ');
                        const dbName = restParts[0];
                        const facultyId = restParts[1]?.replace(')', '');
                        
                        return (
                          <tr key={idx} style={{ 
                            borderBottom: '1px solid #eee',
                            backgroundColor: idx % 2 === 0 ? 'white' : '#f5f5f5'
                          }}>
                            <td style={{ padding: '10px', color: '#999' }}>{idx + 1}</td>
                            <td style={{ padding: '10px', fontWeight: '500' }}>{csvName}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: '#03a9f4' }}>→</td>
                            <td style={{ padding: '10px' }}>
                              <div style={{ color: '#0277bd', fontWeight: 'bold' }}>{dbName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#999' }}>ID: {facultyId}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Action Note */}
            <div style={{ 
              padding: '15px', 
              backgroundColor: '#e3f2fd',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #2196f3'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>ℹ️</span>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>
                  <strong style={{ color: '#1565c0' }}>Next Steps:</strong>
                  <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                    <li>Successfully matched faculty now have their specializations updated</li>
                    {hasCreatedFaculty && (
                      <li>New faculty members have been added as <strong>{uploadResult.details.default_position}</strong></li>
                    )}
                    <li>You can view all faculty profiles in the Faculty Overview page</li>
                    {hasCreatedFaculty && (
                      <li>Review newly created faculty and add additional details (email, department, etc.)</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
              <button 
                onClick={handleConfirmClose}
                style={{
                  padding: '12px 40px',
                  backgroundColor: '#2e7d32',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}
              >
                Close & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Upload Modal
  return (
    <div className="group-modal-overlay" onClick={onClose}>
      <div 
        className="group-modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '1000px', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="group-modal-header">
          <h3>Import Faculty Specialization Matrix</h3>
          <button className="group-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="group-modal-content">
          {!file ? (
            <>
              <p style={{ color: '#666', marginBottom: '15px', fontSize: '0.95rem' }}>
                Upload the <strong>Faculty Specialization Matrix</strong> CSV with course ratings.
              </p>
              
              <div style={{ 
                backgroundColor: '#e3f2fd', 
                padding: '15px', 
                borderRadius: '8px',
                marginBottom: '15px',
                border: '1px solid #2196f3'
              }}>
                <strong style={{ color: '#1565c0', fontSize: '1rem' }}>📋 Expected CSV Format:</strong>
                <ul style={{ 
                  marginTop: '10px', 
                  marginBottom: '0', 
                  paddingLeft: '20px',
                  lineHeight: '1.8'
                }}>
                  <li><strong>Row 1 (Column B onwards):</strong> Faculty <strong>Last Names</strong></li>
                  <li><strong>Row 2 (Column B onwards):</strong> Faculty <strong>First Names</strong></li>
                  <li><strong>Row 3+ (Column A):</strong> Course names (e.g., "Introduction to Computing")</li>
                  <li><strong>Row 3+ (Column B+):</strong> Rating values (0-5)</li>
                  <li><strong>Section Headers:</strong> Rows like "First Year", "Second Year" will be auto-skipped</li>
                  <li><strong>Import All Ratings:</strong> All ratings from 0-5 will be imported as specializations</li>
                </ul>
              </div>

              {/* NEW SECTION: Configuration for New Faculty */}
              <div style={{ 
                backgroundColor: '#e1f5fe', 
                padding: '12px', 
                borderRadius: '6px',
                marginBottom: '15px',
                border: '1px solid #03a9f4'
              }}>
                <strong style={{ color: '#0277bd', display: 'block', marginBottom: '8px' }}>🆕 New Faculty Configuration:</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '0.9rem', color: '#555' }}>
                    <span>If a faculty member is not found in the database, create them as:</span>
                    <select 
                        value={defaultPosition} 
                        onChange={(e) => setDefaultPosition(e.target.value)}
                        style={{
                            padding: '6px 10px',
                            borderRadius: '4px',
                            border: '1px solid #0277bd',
                            color: '#0277bd',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="Part Time">Part Time</option>
                        <option value="Full Time">Full Time</option>
                    </select>
                </div>
              </div>

              <div style={{ 
                backgroundColor: '#fff3e0', 
                padding: '12px', 
                borderRadius: '6px',
                marginBottom: '15px',
                border: '1px solid #ff9800'
              }}>
                <strong style={{ color: '#e65100' }}>⚠️ Name Matching:</strong>
                <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#555' }}>
                  Faculty names will be automatically cleaned and matched to your database. 
                  Special characters (commas, periods) and case variations are handled automatically.
                  <br /><strong>Example:</strong> "BAUTISTA, Kenneth" will match "Kenneth Bautista" in your database.
                </p>
              </div>
              
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileChange} 
                className="form-control" 
                style={{ 
                  padding: '12px',
                  fontSize: '1rem',
                  border: '2px dashed #2e7d32',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }} 
              />
            </>
          ) : (
            <>
              {/* File Preview Section - Unchanged */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '12px',
                padding: '10px',
                backgroundColor: '#f5f5f5',
                borderRadius: '6px'
              }}>
                <h4 style={{ color: '#2e7d32', margin: 0 }}>📊 Matrix Preview</h4>
                <div style={{ fontSize: '0.8rem', color: '#666', textAlign: 'right' }}>
                  <div><strong>Row 1 (Green):</strong> Last Names</div>
                  <div><strong>Row 2 (Blue):</strong> First Names</div>
                  <div><strong>Column A (Orange):</strong> Courses</div>
                </div>
              </div>
              
              <div className="preview-table-container" style={{ 
                maxHeight: '400px', 
                overflowY: 'auto',
                overflowX: 'auto',
                border: '2px solid #ddd',
                borderRadius: '6px',
                marginBottom: '12px'
              }}>
                <table className="preview-table" style={{ 
                  fontSize: '0.7rem',
                  width: '100%',
                  borderCollapse: 'collapse'
                }}>
                  <tbody>
                    {previewData.map((row, rIndex) => (
                      <tr key={rIndex}>
                        {row.slice(0, 12).map((cell, cIndex) => {
                          let bgColor = 'transparent';
                          let fontWeight = 'normal';
                          let color = 'inherit';
                          
                          if (rIndex === 0 && cIndex > 0) {
                            bgColor = '#c8e6c9';
                            fontWeight = 'bold';
                            color = '#2e7d32';
                          }
                          else if (rIndex === 1 && cIndex > 0) {
                            bgColor = '#b3e5fc';
                            fontWeight = 'bold';
                            color = '#01579b';
                          }
                          else if (cIndex === 0 && rIndex > 1) {
                            bgColor = '#ffe0b2';
                            fontWeight = 'bold';
                            color = '#e65100';
                          }
                          else if ((rIndex === 0 || rIndex === 1) && cIndex === 0) {
                            bgColor = '#f5f5f5';
                            fontWeight = 'bold';
                          }
                          
                          return (
                            <td key={cIndex} style={{ 
                              border: '1px solid #e0e0e0', 
                              padding: '6px 8px',
                              minWidth: '70px',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              backgroundColor: bgColor,
                              fontWeight: fontWeight,
                              color: color,
                              textAlign: cIndex === 0 ? 'left' : 'center'
                            }}>
                              {cell || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#e8f5e9',
                borderRadius: '6px',
                fontSize: '0.9rem',
                border: '1px solid #4caf50'
              }}>
                <strong style={{ color: '#2e7d32' }}>✓ File Preview Loaded</strong>
                <ul style={{ margin: '8px 0 0 20px', paddingLeft: 0 }}>
                  <li>Section headers (e.g., "First Year") will be automatically skipped</li>
                  <li>Only courses with numeric ratings will be processed</li>
                  <li>Faculty names will be cleaned and matched to your database</li>
                  {/* Updated Note about new faculty */}
                  <li>New faculty members will be created as <strong>{defaultPosition}</strong></li>
                  <li>All ratings (0-5) will be imported as specializations</li>
                </ul>
              </div>
            </>
          )}

          {error && (
            <div className="error-message" style={{ 
              color: '#c62828', 
              backgroundColor: '#ffebee',
              padding: '12px',
              borderRadius: '6px',
              marginTop: '12px',
              border: '1px solid #ef5350',
              fontSize: '0.9rem'
            }}>
              <strong>❌ Error:</strong> {error}
            </div>
          )}

          <div className="modal-actions" style={{ 
            marginTop: '20px', 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: '10px' 
          }}>
            <button 
              className="cancel-btn" 
              onClick={onClose}
              style={{
                padding: '10px 20px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer',
                fontSize: '0.95rem'
              }}
            >
              Cancel
            </button>
            <button 
              className="save-btn" 
              onClick={handleUpload} 
              disabled={loading || !file}
              style={{
                padding: '10px 20px',
                backgroundColor: loading || !file ? '#ccc' : '#2e7d32',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading || !file ? 'not-allowed' : 'pointer',
                fontSize: '0.95rem',
                fontWeight: 'bold'
              }}
            >
              {loading ? '⏳ Processing Matrix...' : '📤 Import Matrix'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyRankingUploadModal;
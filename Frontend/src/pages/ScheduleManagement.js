import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  generateSchedule,
  saveFinalSchedule,
  overrideEvent,
  getFinalSchedules,
  getFinalSchedule,
} from '../services/scheduleService';
import {
  getFacultyList,
  assignFacultyToEvent,
  unassignFacultyFromGroup,
} from '../services/facultyService';
import ScheduleFilters from '../components/ScheduleFilters';
import ScheduleGrid from '../components/ScheduleGrid';
import FacultyPanel from '../components/FacultyPanel';
import FacultyModal from '../components/FacultyModal';
import OverrideModal from '../components/OverrideModal';
import UnassignConfirmationModal from '../components/UnassignConfirmationModal';
import SuccessModal from '../components/SuccessModal';
import ConfirmationModal from '../components/ConfirmationModal';
import RoomView from '../components/RoomView';
import SaveScheduleModal from '../components/SaveScheduleModal';
import ScheduleGeneratorLoader from '../animations/ScheduleGeneratorLoader'; 
import { 
  computeGroupKey, 
  computeExtendedGroupKey 
} from '../utils/scheduleHelpers';
import '../styles/ScheduleManagement.css';
import '../styles/FacultyPanel.css';

const ScheduleManagement = () => {
  const [schedule, setSchedule] = useState([]);
  const [scheduleError, setScheduleError] = useState(false);
  const [faculty, setFaculty] = useState([]);
  const [facultyFetchError, setFacultyFetchError] = useState(false);
  const [filters, setFilters] = useState({
    courseQuery: '',
    showUnassignedOnly: false,
    programSelected: [],
    yearSelected: [],
    blockSelected: [],
    daySelected: [],
    roomSelected: [],
  });
  const [facultySearch, setFacultySearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [isFacultyModalOpen, setIsFacultyModalOpen] = useState(false);
  const [modalFaculty, setModalFaculty] = useState(null);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideEventData, setOverrideEventData] = useState(null);
  const [roomsData, setRoomsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [existingSchedules, setExistingSchedules] = useState([]);
  const [displayScheduleName, setDisplayScheduleName] = useState(
    localStorage.getItem('scheduleName') || 'Default Schedule'
  );
  
  // NEW STATE: For Save Confirmation Modal
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const [unassignModalData, setUnassignModalData] = useState(null);
  const [successModalData, setSuccessModalData] = useState(null);
  const [confirmationModalData, setConfirmationModalData] = useState(null);
  const [isFacultyLoading, setIsFacultyLoading] = useState(false);
  const [isRoomView, setIsRoomView] = useState(false);

  const daysOrder = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], []);

  // --- Initial Data Fetching ---
  useEffect(() => {
    const fetchCurrentSchedule = async () => {
      setLoading(true);
      setLoadingMessage('Retrieving generated schedule...');
      try {
        const data = await generateSchedule(false, true);
        if (data.status === 'success' && data.schedule) {
          setSchedule(data.schedule.map(event => ({
            ...event,
            overlapDetails: event.overlapDetails || { hasOverlap: false, reasons: [], conflictingEvents: [] }
          })));
          setScheduleError(false);
          if (data.rooms) setRoomsData(data.rooms);
        } else {
          setSchedule([]);
          setScheduleError(true);
          if (data.rooms) setRoomsData(data.rooms);
        }
      } catch (error) {
        console.error('Error fetching current schedule:', error);
        setScheduleError(true);
      } finally {
        setLoading(false);
        setLoadingMessage('');
      }
    };
    fetchCurrentSchedule();
  }, []);

  useEffect(() => {
    const fetchFacultyData = async () => {
      setIsFacultyLoading(true);
      try {
        const data = await getFacultyList();
        if (data.status === 'success') {
          setFaculty(data.faculty || []);
          setFacultyFetchError(false);
        } else {
          setFacultyFetchError(true);
        }
      } catch (error) {
        console.error('Error fetching faculty:', error);
        setFacultyFetchError(true);
      } finally {
        setIsFacultyLoading(false);
      }
    };
    fetchFacultyData();
  }, []);

  // --- Reusable function to fetch existing schedules ---
  const fetchExistingSchedulesList = useCallback(async () => {
    try {
      const data = await getFinalSchedules();
      if (data && data.schedules) {
        setExistingSchedules(data.schedules);
      }
    } catch (err) {
      console.error('Error fetching Schedules list:', err);
    }
  }, []);

  // Call the fetch function on mount
  useEffect(() => {
    fetchExistingSchedulesList();
  }, [fetchExistingSchedulesList]);

  // --- Handlers ---
  const handleFilterChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleFacultySearchChange = useCallback((e) => {
    setFacultySearch(e.target.value);
  }, []);

  // --- Memoized Data Filtering ---
  const filteredSchedule = useMemo(() => {
    return (schedule || []).filter((event) => {
      const { courseQuery, showUnassignedOnly, programSelected, yearSelected, blockSelected, daySelected, roomSelected } = filters;
      
      if (programSelected && programSelected.length > 0 && !programSelected.includes(event.program)) return false;
      if (yearSelected && yearSelected.length > 0 && !yearSelected.includes(event.year)) return false;
      if (blockSelected && blockSelected.length > 0 && !blockSelected.includes(event.block)) return false;
      if (daySelected && daySelected.length > 0 && !daySelected.includes(event.day)) return false;
      if (roomSelected && roomSelected.length > 0 && !roomSelected.includes(event.room)) return false;
      
      if (
        courseQuery &&
        !event.courseCode.toLowerCase().includes(courseQuery.toLowerCase()) &&
        !event.title.toLowerCase().includes(courseQuery.toLowerCase())
      ) {
        return false;
      }
      
      if (showUnassignedOnly && event.faculty && event.faculty.trim() !== '') return false;
      
      return true;
    });
  }, [schedule, filters]);

  const groupedSchedule = useMemo(() => {
    return filteredSchedule.reduce((acc, event) => {
      const eventDay = event.day || 'Other';
      if (!acc[eventDay]) acc[eventDay] = [];
      acc[eventDay].push(event);
      return acc;
    }, {});
  }, [filteredSchedule]);

  // --- SAVE ACTIONS ---

  // 1. Initial Click: Opens the Confirmation Modal
  const handleSaveButtonClick = () => {
    setIsSaveModalOpen(true);
  };

  // 2. Confirmed Save: Actually calls the API
  const performFinalSave = async (confirmedName) => {
    // Close modal first
    setIsSaveModalOpen(false);
    
    // Update local display name to match what user just typed
    setDisplayScheduleName(confirmedName);
    
    setLoading(true);
    setLoadingMessage('Saving Schedule...');
    
    const finalSchedule = {
      schedule_name: confirmedName,
      schedule: schedule,
    };
    
    try {
      const response = await saveFinalSchedule(finalSchedule);
      if (response.status === 'success') {
        localStorage.setItem('finalScheduleName', confirmedName);
        setSuccessModalData({ message: 'Generated schedule saved successfully.', type: 'success' });
        
        // Refresh the existing schedules dropdown list immediately
        await fetchExistingSchedulesList(); 

      } else {
        setSuccessModalData({ message: 'Error saving schedule: ' + response.message, type: 'error' });
      }
    } catch (error) {
      console.error('Error saving Schedule:', error);
      setSuccessModalData({ message: 'Error saving Schedule.', type: 'error' });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleSelectExistingSchedule = async (e) => {
    const selectedName = e.target.value;
    if (selectedName) {
      setConfirmationModalData({
        title: 'Load Schedule Confirmation',
        message: 'Loading an existing schedule will discard any unsaved changes. Do you want to continue?',
        onConfirm: async () => {
          setConfirmationModalData(null);
          setLoading(true);
          setLoadingMessage('Loading schedule...');
          try {
            const data = await getFinalSchedule(selectedName);
            if (data && data.schedule) {
              setSchedule(data.schedule.map(event => ({
                ...event,
                overlapDetails: event.overlapDetails || { hasOverlap: false, reasons: [], conflictingEvents: [] }
              })));
              setScheduleError(false);
              const newName = data.schedule_name || selectedName;
              setDisplayScheduleName(newName);
              localStorage.setItem('scheduleName', newName);
              setSuccessModalData({ message: 'Schedule loaded successfully.', type: 'success' });
            }
          } catch (err) {
            console.error('Error fetching selected schedule:', err);
            setSuccessModalData({ message: 'Error fetching selected schedule.', type: 'error' });
          } finally {
            setLoading(false);
            setLoadingMessage('');
          }
        },
        onCancel: () => {
          setConfirmationModalData(null);
          e.target.value = '';
        },
      });
    }
  };

  // --- Group Selection Logic (Preserving Online Fix) ---
  const handleToggleGroupSelection = useCallback((event) => {
    const getBaseCourseCode = (courseCode) => {
      return courseCode.replace(/[AL]$/, '');
    };
    
    // Check if the clicked event is online
    const isOnline = event.room && event.room.toLowerCase() === 'online';

    // Create a merge group identifier
    const getMergeGroupId = (e) => {
      const baseId = `${e.courseCode}-${e.program}-${e.year}-${e.session}-${e.room}-${e.period}-${e.day}`;
      if (e.room && e.room.toLowerCase() === 'online') {
          return `${baseId}-${e.block}`; 
      }
      return baseId;
    };
    
    const clickedMergeId = getMergeGroupId(event);
    const clickedBaseCourseCode = getBaseCourseCode(event.courseCode);
    
    const mergeGroupEvents = schedule.filter(e => getMergeGroupId(e) === clickedMergeId);
    const mergedBlocks = [...new Set(mergeGroupEvents.map(e => e.block))];
    const extendedGroupKey = computeExtendedGroupKey(event, schedule);
    
    setSelectedGroup(prevSelected => {
      if (prevSelected && prevSelected.groupKey === extendedGroupKey) {
        return null;
      }
      
      const groupEvents = schedule.filter(e => {
        const eBaseCourseCode = getBaseCourseCode(e.courseCode);
        return eBaseCourseCode === clickedBaseCourseCode &&
               e.program === event.program &&
               e.year === event.year &&
               mergedBlocks.includes(e.block); 
      });
      
      const isMerged = mergeGroupEvents.length > 1 && !isOnline;
      
      return { 
        groupKey: extendedGroupKey, 
        groupEvents: groupEvents,
        isMerged: isMerged,
        mergedBlocks: mergedBlocks
      };
    });
  }, [schedule]);

  const handleAssignFaculty = async (facultyObj) => {
    if (!selectedGroup) return;
    try {
      const firstEvent = selectedGroup.groupEvents[0];
      let validScheduleId = firstEvent.schedule_id;
  
      const response = await assignFacultyToEvent(
        validScheduleId, 
        facultyObj.id,
        selectedGroup.mergedBlocks 
      );
  
      if (response.status === 'success') {
        setSchedule((prevSchedule) =>
          (prevSchedule || []).map((event) => {
            const isInGroup = selectedGroup.groupEvents.some(
              ge => ge.schedule_id === event.schedule_id
            );
            return isInGroup ? { ...event, faculty: facultyObj.name } : event;
          })
        );
        setSelectedGroup(null);
        setSuccessModalData({ 
          message: `Faculty assigned successfully${selectedGroup.isMerged ? ' to merged classes' : ''}.`, 
          type: 'success' 
        });
      }
    } catch (error) {
      console.error('Error assigning faculty:', error);
      setSuccessModalData({ 
        message: 'Error assigning faculty: ' + (error.response?.data?.detail || error.message), 
        type: 'error' 
      });
    }
  };

  const handleOverride = useCallback((scheduleId) => {
    const event = (schedule || []).find((e) => e.schedule_id === scheduleId);
    if (event) {
      setOverrideEventData(event);
      setIsOverrideModalOpen(true);
    }
  }, [schedule]);

  const closeOverrideModal = () => {
    setIsOverrideModalOpen(false);
    setOverrideEventData(null);
  };

  const refreshSchedule = async () => {
    try {
      const data = await generateSchedule(false, true);
      if (data.status === 'success' && data.schedule) {
        setSchedule(data.schedule.map(event => ({
          ...event,
          overlapDetails: event.overlapDetails || { hasOverlap: false, reasons: [], conflictingEvents: [] }
        })));
        setScheduleError(false);
        if (data.rooms) setRoomsData(data.rooms);
      } else {
        setSchedule([]);
        setScheduleError(true);
      }
    } catch (error) {
      console.error('Error refreshing schedule:', error);
    }
  };

  const handleSaveOverride = async (overrideDetails) => {
    try {
      const response = await overrideEvent(overrideDetails);
      if (response.status === 'success') {
        setSuccessModalData({ message: 'Override saved successfully.', type: 'success' });
        await refreshSchedule();
      } else {
        setSuccessModalData({ message: 'Override failed: ' + (response.detail || 'Error occurred.'), type: 'error' });
      }
    } catch (error) {
      console.error('Error overriding event:', error);
      setSuccessModalData({ message: 'Error: ' + error.message, type: 'error' });
    } finally {
      closeOverrideModal();
    }
  };

  const getAssignedEventsForFaculty = useCallback((facultyName) =>
    (schedule || []).filter((event) => event.faculty === facultyName), [schedule]);

  const openFacultyModal = useCallback((facultyObj) => {
    setModalFaculty(facultyObj);
    setIsFacultyModalOpen(true);
  }, []);

  const closeFacultyModal = () => {
    setIsFacultyModalOpen(false);
    setModalFaculty(null);
  };

  const closeSuccessModal = () => {
    setSuccessModalData(null);
  };

  const toggleViewMode = () => {
    setIsRoomView(!isRoomView);
  };

  if (isRoomView) {
    return (
      <div className="schedule-management-container">
        {loading ? (
           <div className="cards schedule-card" style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <ScheduleGeneratorLoader 
               message={loadingMessage} 
               showProgress={false} 
               isOverlay={false} 
             />
           </div>
        ) : (
          <RoomView 
            schedule={schedule}
            onScheduleUpdate={refreshSchedule}
            onClose={toggleViewMode}
          />
        )}
        
        {successModalData && (
          <SuccessModal
            message={successModalData.message}
            type={successModalData.type}
            onClose={closeSuccessModal}
          />
        )}
      </div>
    );
  }

  return (
    <div className="schedule-management-container">
      <div className="content">
        <div className="left-panel">
          <ScheduleFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            rooms={roomsData}
          />
          
          {loading ? (
             <div className="cards schedule-card" style={{ minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ScheduleGeneratorLoader 
                  message={loadingMessage} 
                  showProgress={false} 
                  isOverlay={false} 
                />
             </div>
          ) : (
            <ScheduleGrid
              groupedSchedule={groupedSchedule}
              daysOrder={daysOrder}
              selectedGroup={selectedGroup}
              onToggleGroupSelection={handleToggleGroupSelection}
              onOverride={handleOverride}
              displayScheduleName={displayScheduleName}
              onSaveFinalSchedule={handleSaveButtonClick} // Use the new handler here
              onSelectExistingSchedule={handleSelectExistingSchedule}
              existingSchedules={existingSchedules}
              fetchError={scheduleError}
              onToggleViewMode={toggleViewMode}
              schedule={schedule}
            />
          )}
        </div>
        <div className="right-panel">
          <FacultyPanel
            faculty={faculty}
            facultySearch={facultySearch}
            onFacultySearchChange={handleFacultySearchChange}
            selectedGroup={selectedGroup}
            schedule={schedule}
            onAssignFaculty={handleAssignFaculty}
            onOpenFacultyModal={openFacultyModal}
            isLoadingFaculty={isFacultyLoading}
            fetchError={facultyFetchError}
          />
        </div>
      </div>

      {isFacultyModalOpen && modalFaculty && (
        <FacultyModal
          faculty={modalFaculty}
          assignedEvents={getAssignedEventsForFaculty(modalFaculty.name)}
          schedule={schedule}
          onClose={closeFacultyModal}
          onRequestUnassignGroup={(groupKey, groupEvents, facultyName) => {
            setUnassignModalData({ groupKey, groupEvents, facultyName });
          }}
          onOverride={handleOverride}
        />
      )}

      {unassignModalData && (
        <UnassignConfirmationModal
          groupEvents={unassignModalData.groupEvents}
          schedule={schedule}
          facultyName={unassignModalData.facultyName}
          onCancel={() => setUnassignModalData(null)}
          onConfirm={async () => {
            const sampleEvent = unassignModalData.groupEvents[0];
            const baseCourseCode = sampleEvent.courseCode.replace(/[AL]$/, '');
            
            const isOnline = sampleEvent.room && sampleEvent.room.toLowerCase() === 'online';
            const uniqueBlocks = [...new Set(unassignModalData.groupEvents.map(e => e.block))];
            
            const groupParams = {
              courseCode: baseCourseCode,
              program: sampleEvent.program,
              year: String(sampleEvent.year), 
              block: uniqueBlocks[0], 
              merged_blocks: (uniqueBlocks.length > 1 && !isOnline) ? uniqueBlocks : null 
            };
            
            try {
              const response = await unassignFacultyFromGroup(groupParams);
              
              if (response.status === 'success' && response.events) {
                setSchedule((prevSchedule) =>
                  (prevSchedule || []).map((event) => {
                    if (response.events.find((e) => e.schedule_id === event.schedule_id)) {
                      return { ...event, faculty: '' };
                    }
                    return event;
                  })
                );
                
                const mergedMessage = (uniqueBlocks.length > 1 && !isOnline)
                  ? ` from merged blocks: ${uniqueBlocks.join(', ')}` 
                  : '';
                
                setSuccessModalData({ 
                  message: `Faculty unassigned successfully${mergedMessage}.`, 
                  type: 'success' 
                });
              } else {
                setSuccessModalData({ 
                  message: 'Unassignment completed but no events were updated.', 
                  type: 'warning' 
                });
              }
              setUnassignModalData(null);
            } catch (err) {
              setSuccessModalData({ 
                message: 'Error unassigning faculty: ' + (err.response?.data?.detail || err.message), 
                type: 'error' 
              });
              setUnassignModalData(null);
            }
          }}
        />
      )}

      {isOverrideModalOpen && overrideEventData && (
        <OverrideModal
          event={overrideEventData}
          schedule={schedule}
          onClose={closeOverrideModal}
          onSave={handleSaveOverride}
        />
      )}

      {/* NEW: Save Schedule Confirmation Modal */}
      <SaveScheduleModal 
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onConfirm={performFinalSave}
        currentName={displayScheduleName}
        existingSchedules={existingSchedules} // PASSED HERE
      />

      {successModalData && (
        <SuccessModal
          message={successModalData.message}
          type={successModalData.type}
          onClose={closeSuccessModal}
        />
      )}

      {confirmationModalData && (
        <ConfirmationModal
          title={confirmationModalData.title}
          message={confirmationModalData.message}
          onConfirm={confirmationModalData.onConfirm}
          onCancel={confirmationModalData.onCancel}
        />
      )}
    </div>
  );
};

export default ScheduleManagement;
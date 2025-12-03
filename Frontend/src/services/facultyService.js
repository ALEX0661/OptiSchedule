import axios from 'axios';

//https://optisched.up.railway.app

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000'
});

const getAuthHeader = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getFacultyList = async () => {
  try {
    // FIX: Added trailing slash '/' after faculty
    const response = await api.get('/faculty/', { headers: { ...getAuthHeader() } });
    return response.data;
  } catch (error) {
    console.error('Error fetching faculty list:', error);
    throw error;
  }
};

// ... keep other functions, but ensure they match your router paths ...

export const assignFacultyToEvent = async (schedule_id, faculty_id, merged_blocks = null) => {
  try {
    const payload = { 
      schedule_id: String(schedule_id), 
      faculty_id: Number(faculty_id),
      merged_blocks: merged_blocks
    };
    // Ensure this path matches your python router exactly. 
    // If python is @router.post("/assign"), then '/faculty/assign' is correct (no trailing slash needed usually for named endpoints)
    const response = await api.post('/faculty/assign', payload, { headers: { ...getAuthHeader() } });
    return response.data;
  } catch (error) {
    console.error('Error in assignFacultyToEvent:', error.response?.data || error);
    throw error;
  }
};

// ... rest of the file ...
export const addFaculty = async (facultyData) => {
  try {
    const response = await api.post('/faculty/add', facultyData, { headers: { ...getAuthHeader() } });
    return response.data;
  } catch (error) {
    console.error('Error adding faculty:', error);
    throw error;
  }
};

export const updateFaculty = async (facultyId, facultyData) => {
  try {
    const response = await api.put(`/faculty/update/${facultyId}`, facultyData, { headers: { ...getAuthHeader() } });
    return response.data;
  } catch (error) {
    console.error('Error updating faculty:', error);
    throw error;
  }
};

export const updateFacultySpecialization = async (facultyId, specialization) => {
  try {
    const response = await api.put(
      `/faculty/update-specialization/${facultyId}`, 
      { specialization }, 
      { headers: { ...getAuthHeader() } }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating faculty specialization:', error);
    throw error;
  }
};

export const deleteFaculty = async (facultyId) => {
  try {
    const response = await api.delete(`/faculty/delete/${facultyId}`, { headers: { ...getAuthHeader() } });
    return response.data;
  } catch (error) {
    console.error('Error deleting faculty:', error);
    throw error;
  }
};

export const unassignFacultyFromGroup = async (groupParams) => {
  try {
    const response = await api.post('/faculty/unassign', groupParams, { headers: { ...getAuthHeader() } });
    return response.data;
  } catch (error) {
    console.error('Error in unassignFacultyFromGroup:', error);
    throw error;
  }
};

export const uploadFacultyRanking = async (formData) => {
  try {
    const response = await api.post('/faculty/upload-csv-ranking', formData, { 
      headers: { 
        ...getAuthHeader(),
        'Content-Type': 'multipart/form-data' 
      } 
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading faculty ranking CSV:', error);
    throw error;
  }
};
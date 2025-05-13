import axios from 'axios';

const api = axios.create({
  baseURL: 'https://optisched.onrender.com'
});

const getAuthHeader = () => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getFacultyList = async () => {
  try {
    const response = await api.get('/faculty', { headers: { ...getAuthHeader() } });
    return response.data;
  } catch (error) {
    console.error('Error fetching faculty list:', error);
    throw error;
  }
};

export const assignFacultyToEvent = async (schedule_id, faculty_id) => {
  try {
    const response = await api.post('/faculty/assign', { schedule_id, faculty_id }, { headers: { ...getAuthHeader() } });
    return response.data;
  } catch (error) {
    console.error('Error in assignFacultyToEvent:', error);
    throw error;
  }
};

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
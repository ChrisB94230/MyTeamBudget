import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001/api',
});

export const getResources = (year) => api.get('/resources', { params: { year } });
export const addResource = (data) => api.post('/resources', data);
export const updateResource = (id, data) => api.put(`/resources/${id}`, data);
export const deleteResource = (id) => api.delete(`/resources/${id}`);

export const getConsumption = (year) => api.get('/consumption', { params: { year } });
export const updateConsumption = (data) => api.post('/consumption', data);

export const getPrevisions = (year) => api.get('/previsions', { params: { year } });
export const addPrevision = (data) => api.post('/previsions', data);
export const updatePrevision = (id, data) => api.put(`/previsions/${id}`, data);
export const deletePrevision = (id) => api.delete(`/previsions/${id}`);

export const getDashboard = (year) => api.get('/dashboard', { params: { year } });
export const getYears = () => api.get('/years');

export const getPresence = (year) => api.get('/presence', { params: { year } });
export const updatePresence = (data) => api.post('/presence', data);
export const getPresenceDashboard = (year) => api.get('/presence/dashboard', { params: { year } });

export const getComparison = (years) => api.get('/comparison', { params: { years: years.join(',') } });

export const getSettings = (year) => api.get('/settings', { params: { year } });
export const updateSettings = (data) => api.post('/settings', data);
export const getAllSettings = () => api.get('/settings/all');

export default api;

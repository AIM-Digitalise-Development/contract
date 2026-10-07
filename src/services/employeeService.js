import api from './api';
import cache from './cache';

export const employeeService = {
  async getEmployees(params = {}) {
    const response = await api.get('/employees', { params });
    return response.data;
  },

  async getEmployee(id) {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  },

  async createEmployee(data) {
    const response = await api.post('/employees', data);
    return response.data;
  },

  async updateEmployee(id, data) {
    const response = await api.put(`/employees/${id}`, data);
    return response.data;
  },

  async deleteEmployee(id) {
    const response = await api.delete(`/employees/${id}`);
    return response.data;
  },

  async getRoles() {
    const cacheKey = 'roles_list';
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const response = await api.get('/employees/roles');
    cache.set(cacheKey, response.data, 300000); // 5 minutes
    return response.data;
  },

  async assignWorkers(supervisorId, workerIds) {
    const response = await api.post(`/employees/${supervisorId}/assign-workers`, {
      worker_ids: workerIds,
    });
    return response.data;
  },

  async getSupervisedWorkers(supervisorId, params = {}) {
    const response = await api.get(`/employees/${supervisorId}/supervised-workers`, { params });
    return response.data;
  },
};

export default employeeService;

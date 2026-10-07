import api from './api';

export const transferService = {
  async getTransfers(params = {}) {
    const response = await api.get('/transfers', { params });
    return response.data;
  },

  async getTransfer(id) {
    const response = await api.get(`/transfers/${id}`);
    return response.data;
  },

  async createTransfer(data) {
    const response = await api.post('/transfers', data);
    return response.data;
  },

  async approveTransfer(id, remarks = '') {
    const response = await api.post(`/transfers/${id}/approve`, { remarks });
    return response.data;
  },

  async rejectTransfer(id, rejectionReason) {
    const response = await api.post(`/transfers/${id}/reject`, {
      rejection_reason: rejectionReason,
    });
    return response.data;
  },
};

export default transferService;

import api from './api';

export const stockService = {
  async getStock(params = {}) {
    const response = await api.get('/stock', { params });
    return response.data;
  },

  async getStockItem(godownId, productId) {
    const response = await api.get(`/stock/${godownId}/${productId}`);
    return response.data;
  },

  async getTransactions(params = {}) {
    const response = await api.get('/stock/transactions', { params });
    return response.data;
  },

  async getStockEntries(params = {}) {
    const response = await api.get('/stock-entries', { params });
    return response.data;
  },

  async getStockEntry(id) {
    const response = await api.get(`/stock-entries/${id}`);
    return response.data;
  },

  async createStockEntry(data) {
    const response = await api.post('/stock-entries', data);
    return response.data;
  },

  async approveStockEntry(id, remarks = '') {
    const response = await api.post(`/stock-entries/${id}/approve`, { remarks });
    return response.data;
  },

  async rejectStockEntry(id, rejectionReason) {
    const response = await api.post(`/stock-entries/${id}/reject`, {
      rejection_reason: rejectionReason,
    });
    return response.data;
  },
};

export default stockService;

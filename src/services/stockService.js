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
    const isFormData = data instanceof FormData;
    const config = isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    const response = await api.post('/stock-entries', data, config);
    return response.data;
  },

  async updateStockEntry(id, data) {
    const isFormData = data instanceof FormData;
    // For PHP multipart with PUT, sending _method=PUT or POST with _method=PUT is standard
    let payload = data;
    let config = {};
    if (isFormData) {
      data.append('_method', 'PUT');
      config = { headers: { 'Content-Type': 'multipart/form-data' } };
      const response = await api.post(`/stock-entries/${id}`, data, config);
      return response.data;
    }
    const response = await api.put(`/stock-entries/${id}`, data);
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

  async getClosingStock(params = {}) {
    const response = await api.get('/stock/closing-stock', { params });
    return response.data;
  },

  async getClosingStockProductLedger(productId, params = {}) {
    const response = await api.get(`/stock/closing-stock/product-ledger/${productId}`, { params });
    return response.data;
  },

  async getAuditTransactions(params = {}) {
    const response = await api.get('/stock/audit-transactions', { params });
    return response.data;
  },

  async deleteStockEntry(id) {
    const response = await api.delete(`/stock-entries/${id}`);
    return response.data;
  },
};

export default stockService;

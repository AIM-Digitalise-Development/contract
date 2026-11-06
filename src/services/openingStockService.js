import api from './api';

export const openingStockService = {
  // Get initialization and lock status
  async getStatus() {
    const response = await api.get('/opening-stock/status');
    return response.data;
  },

  // Validate parsed rows against server rules & product catalog
  async validateRows(rows, godownId) {
    const response = await api.post('/opening-stock/validate', {
      rows,
      godown_id: godownId,
    });
    return response.data;
  },

  // Finalize and execute the one-time atomic opening stock import
  async importOpeningStock(data) {
    const response = await api.post('/opening-stock/import', data);
    return response.data;
  },

  // Get paginated history of imported opening stock items
  async getHistory(params = {}) {
    const response = await api.get('/opening-stock/history', { params });
    return response.data;
  },

  // Get date-wise inventory ledger & running balance for a specific product
  async getProductLedger(productId, godownId = null) {
    const response = await api.get(`/opening-stock/product-ledger/${productId}`, {
      params: godownId ? { godown_id: godownId } : {},
    });
    return response.data;
  },
};

export default openingStockService;

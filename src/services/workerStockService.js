import api from './api';

export const workerStockService = {
  // List all current balances held by workers
  async getWorkerStocks(params = {}) {
    const response = await api.get('/worker-stock', { params });
    return response.data;
  },

  // List worker stock requests (issue and return)
  async getRequests(params = {}) {
    const response = await api.get('/worker-stock/requests', { params });
    return response.data;
  },

  // Get a single request
  async getRequest(id) {
    const response = await api.get(`/worker-stock/requests/${id}`);
    return response.data;
  },

  // Create issue request (Godown -> Worker)
  async createIssueRequest(data) {
    const response = await api.post('/worker-stock/requests/issue', data);
    return response.data;
  },

  // Create return request (Worker -> Godown)
  async createReturnRequest(data) {
    const response = await api.post('/worker-stock/requests/return', data);
    return response.data;
  },

  // Approve a worker stock request (supports manager_signature and remarks)
  async approveRequest(id, payload = {}) {
    const data = typeof payload === 'string' ? { remarks: payload } : payload;
    const response = await api.post(`/worker-stock/requests/${id}/approve`, data);
    return response.data;
  },

  // Sign and finalize official documentation (Supervisor/Admin)
  async signDocumentation(id, signature) {
    const data = typeof signature === 'string' ? { signature } : signature;
    const response = await api.post(`/worker-stock/requests/${id}/sign-documentation`, data);
    return response.data;
  },

  // Reject a worker stock request (requires reason)
  async rejectRequest(id, rejectionReason) {
    const response = await api.post(`/worker-stock/requests/${id}/reject`, {
      rejection_reason: rejectionReason,
    });
    return response.data;
  },

  // Get current stock held by a specific worker
  async getWorkerStock(workerId, params = {}) {
    const response = await api.get(`/workers/${workerId}/stock`, { params });
    return response.data;
  },

  // Get stock transaction history for a worker
  async getWorkerTransactions(workerId, params = {}) {
    const response = await api.get(`/workers/${workerId}/stock/transactions`, { params });
    return response.data;
  },

  // Return stock directly from worker to godown
  async returnStock(data) {
    const payload = { ...data, direct: true };
    const response = await api.post('/worker-stock/requests/return', payload);
    return response.data;
  },

  // Record stock used / consumed in project (supports optional photo)
  async recordUsage(dataOrFormData) {
    const isFormData = dataOrFormData instanceof FormData;
    const response = await api.post('/worker-stock/usages', dataOrFormData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return response.data;
  },

  // Get recorded project usages for a worker
  async getWorkerUsages(workerId, params = {}) {
    const response = await api.get(`/workers/${workerId}/stock/usages`, { params });
    return response.data;
  },

  // Get lifecycle stats for a worker (Issued -> Used -> Returned -> Remaining)
  async getWorkerLifecycleStats(workerId) {
    const response = await api.get(`/workers/${workerId}/stock/lifecycle-stats`);
    return response.data;
  },
};

export default workerStockService;

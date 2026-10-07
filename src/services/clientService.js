import api from './api';

const clientService = {
  getClients(params = {}) {
    return api.get('/clients', { params }).then((res) => res.data);
  },

  getClient(id) {
    return api.get(`/clients/${id}`).then((res) => res.data);
  },

  createClient(data) {
    return api.post('/clients', data).then((res) => res.data);
  },

  updateClient(id, data) {
    return api.put(`/clients/${id}`, data).then((res) => res.data);
  },

  deleteClient(id) {
    return api.delete(`/clients/${id}`).then((res) => res.data);
  },

  getAuditLedger(params = {}) {
    return api.get('/audit-entry/ledger', { params }).then((res) => res.data);
  },

  getAuditSummary() {
    return api.get('/audit-entry/summary').then((res) => res.data);
  },
};

export default clientService;

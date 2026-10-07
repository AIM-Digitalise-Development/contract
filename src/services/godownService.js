import api from './api';
import cache from './cache';

export const godownService = {
  async getGodowns(params = {}) {
    const isCacheable = !params.search && (!params.page || params.page === 1) && params.per_page === 100;
    const cacheKey = `godowns_${JSON.stringify(params)}`;

    if (isCacheable) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }

    const response = await api.get('/godowns', { params });
    if (isCacheable) {
      cache.set(cacheKey, response.data, 45000);
    }
    return response.data;
  },

  async getGodown(id) {
    const response = await api.get(`/godowns/${id}`);
    return response.data;
  },

  async createGodown(data) {
    cache.invalidate('godowns');
    const response = await api.post('/godowns', data);
    return response.data;
  },

  async updateGodown(id, data) {
    cache.invalidate('godowns');
    const response = await api.put(`/godowns/${id}`, data);
    return response.data;
  },

  async deleteGodown(id) {
    cache.invalidate('godowns');
    const response = await api.delete(`/godowns/${id}`);
    return response.data;
  },
};

export default godownService;

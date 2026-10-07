import api from './api';
import cache from './cache';

export const productService = {
  async getProducts(params = {}) {
    const isCacheable = !params.search && (!params.page || params.page === 1) && params.per_page === 100;
    const cacheKey = `products_${JSON.stringify(params)}`;

    if (isCacheable) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }

    const response = await api.get('/products', { params });
    if (isCacheable) {
      cache.set(cacheKey, response.data, 45000);
    }
    return response.data;
  },

  async getProduct(id) {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  async createProduct(data) {
    cache.invalidate('products');
    const response = await api.post('/products', data);
    return response.data;
  },

  async updateProduct(id, data) {
    cache.invalidate('products');
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },

  async deleteProduct(id) {
    cache.invalidate('products');
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },
};

export default productService;

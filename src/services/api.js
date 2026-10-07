import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://contract-api.nexgn.in/api/v1',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('contract_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('contract_auth_token');
      localStorage.removeItem('contract_auth_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function extractItems(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data?.items)) return response.data.items;
  if (Array.isArray(response.data?.data)) return response.data.data;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.items)) return response.items;
  return [];
}

export function extractErrorMessage(error, defaultMsg = 'An unexpected error occurred.') {
  const errCode = error.response?.data?.error_code;
  if (errCode === 'SELF_APPROVAL_NOT_ALLOWED') {
    return 'You cannot approve a request that you created. Another authorized approver must process this request.';
  }
  if (errCode === 'INSUFFICIENT_STOCK' || errCode === 'TRANSFER_INSUFFICIENT_STOCK') {
    return 'Not enough stock is available in the selected godown. Refresh the inventory and try again.';
  }
  if (errCode === 'WORKER_STOCK_INSUFFICIENT') {
    return 'Worker does not have enough stock balance to complete this return request.';
  }
  if (errCode === 'WORKER_INACTIVE') {
    return 'Cannot assign stock to an inactive worker.';
  }
  if (errCode === 'WORKER_STOCK_ALREADY_PROCESSED' || errCode === 'REQUEST_ALREADY_PROCESSED') {
    return 'This request has already been processed.';
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.response?.data?.errors) {
    const errs = error.response.data.errors;
    const firstKey = Object.keys(errs)[0];
    if (firstKey && errs[firstKey]?.length) {
      return errs[firstKey][0];
    }
  }
  return error.message || defaultMsg;
}

export default api;

import api from './api';

export const authService = {
  async login(email, password, deviceName = 'browser') {
    const response = await api.post('/auth/login', {
      email,
      password,
      device_name: deviceName,
    });
    return response.data;
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('contract_auth_token');
      localStorage.removeItem('contract_auth_user');
    }
  },

  async me() {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export default authService;

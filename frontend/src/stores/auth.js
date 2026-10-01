import { defineStore } from 'pinia';
import api from '../api.js';

export const useAuth = defineStore('auth', {
  state: () => ({ user: JSON.parse(localStorage.getItem('user') || 'null') }),
  getters: { isAdmin: (s) => s.user?.role === 'admin' },
  actions: {
    async login(email, password) {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      this.user = data.user;
    },
    setUser(user) {
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
    },
    logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      this.user = null;
    },
  },
});

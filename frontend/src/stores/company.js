import { defineStore } from 'pinia';
import api from '../api.js';

// Entreprise courante : choisie dans la barre latérale, envoyée à l'API via l'en-tête X-Company-Id.
export const useCompany = defineStore('company', {
  state: () => ({
    list: [],
    currentId: Number(localStorage.getItem('companyId')) || null,
    ready: false,
  }),
  getters: {
    current: (s) => s.list.find((c) => c.id === s.currentId) || null,
    currency() { return this.current?.default_currency || 'EUR'; },
  },
  actions: {
    async load() {
      this.list = (await api.get('/companies')).data;
      if (!this.list.some((c) => c.id === this.currentId)) this.select(this.list[0]?.id ?? null);
      this.ready = true;
    },
    select(id) {
      this.currentId = id;
      if (id) localStorage.setItem('companyId', id);
      else localStorage.removeItem('companyId');
    },
    reset() { this.list = []; this.ready = false; },
  },
});

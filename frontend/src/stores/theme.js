import { defineStore } from 'pinia';

// Thème clair / sombre : mémorisé, sinon réglage du système (appliqué avant l'affichage dans index.html)
export const useTheme = defineStore('theme', {
  state: () => ({ mode: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }),
  actions: {
    set(mode) {
      this.mode = mode;
      document.documentElement.dataset.theme = mode;
      localStorage.setItem('theme', mode);
    },
    toggle() { this.set(this.mode === 'dark' ? 'light' : 'dark'); },
  },
});

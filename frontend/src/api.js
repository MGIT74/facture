import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const companyId = localStorage.getItem('companyId');
  if (companyId) config.headers['X-Company-Id'] = companyId;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login') && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

/** Message d'erreur lisible à afficher à l'utilisateur. */
export const errMsg = (e) => e.response?.data?.error || e.message || 'Une erreur est survenue';

/** Télécharge / ouvre un PDF (l'API demande le token, donc on passe par axios). */
export async function openPdf(path, filename) {
  const { data } = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Télécharge un fichier protégé (CSV…) : l'API demande le jeton, donc on passe par axios. */
export async function downloadFile(path, params, filename) {
  const { data, headers } = await api.get(path, { params, responseType: 'blob' });
  const name = /filename="?([^";]+)"?/.exec(headers['content-disposition'] || '')?.[1] || filename;
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default api;

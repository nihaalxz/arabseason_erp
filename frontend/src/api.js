import axios from 'axios';

const getBaseApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.includes('arabseason.info') && !hostname.includes('onrender.com')) {
      return `${window.location.protocol}//${hostname}:8000/api/`;
    }
  }
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/';
};

const API_URL = getBaseApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('accounts/token/')) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}accounts/token/refresh/`, {
            refresh: refreshToken
          });
          
          const newToken = response.data.access;
          localStorage.setItem('access_token', newToken);
          if (response.data.refresh) {
            localStorage.setItem('refresh_token', response.data.refresh);
          }
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          
          processQueue(null, newToken);
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:expired'));
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login?expired=1';
            }
          }
          return Promise.reject(refreshError);
        } finally {

          isRefreshing = false;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

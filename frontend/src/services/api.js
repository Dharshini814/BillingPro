import axios from "axios";
import { TOKEN_KEY } from '../utils/constants';

// Use relative URL so requests go through Vite proxy (configured in vite.config.js)
const api = axios.create({
  baseURL: "",  // Empty = same origin, will use Vite proxy
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

let unauthorizedHandler = null;

export function registerUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

export default api;

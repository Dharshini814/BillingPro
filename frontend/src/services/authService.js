import api from "./api";
import { TOKEN_KEY, USER_KEY } from "../utils/constants";

function decodePayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export const authService = {
  async signIn({ email, password }) {
    try {
      const { data } = await api.post("/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return { token: data.access_token, user: data.user };
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Network error — make sure the backend is running on http://localhost:8000";
      throw new Error(msg);
    }
  },

  async signUp({ fullName, email, password, role }) {
    try {
      const { data } = await api.post("/signup", { full_name: fullName, email, password, role });
      return data;
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Network error — make sure the backend is running on http://localhost:8000";
      throw new Error(msg);
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  getStoredUser() {
    try {
      const user = localStorage.getItem(USER_KEY);
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  isTokenExpired(token) {
    if (!token) return true;
    try {
      const decoded = decodePayload(token);
      if (!decoded) return true;
      const exp = decoded.exp;
      if (!exp) return false;
      const expMs = exp > 1e12 ? exp : exp * 1000;
      return Date.now() > expMs;
    } catch {
      return true;
    }
  },
};

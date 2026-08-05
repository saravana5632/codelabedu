import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.PROD
    ? "https://codearena-backend-khga.onrender.com/api"
    : "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
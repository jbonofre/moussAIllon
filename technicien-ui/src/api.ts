import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('moussaillon-technicien-token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('moussaillon-technicien-token');
            localStorage.removeItem('moussaillon-technicien-user');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default api;

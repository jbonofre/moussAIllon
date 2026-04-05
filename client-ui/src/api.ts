import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('moussaillon-client-token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('moussaillon-client-token');
            localStorage.removeItem('moussaillon-client-user');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default api;

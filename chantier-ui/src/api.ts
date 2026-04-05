import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('moussaillon-token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('moussaillon-token');
            localStorage.removeItem('moussaillon-user');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default api;

export function fetchWithAuth(rawUrl: string, options: RequestInit = {}): Promise<Response> {
    const url = rawUrl.startsWith('./') ? '/api/' + rawUrl.slice(2) : rawUrl.startsWith('/') ? '/api' + rawUrl : '/api/' + rawUrl;
    const token = localStorage.getItem('moussaillon-token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers }).then((response) => {
        if (response.status === 401) {
            localStorage.removeItem('moussaillon-token');
            localStorage.removeItem('moussaillon-user');
            window.location.reload();
        }
        return response;
    });
}

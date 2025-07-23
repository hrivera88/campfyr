import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true
});

// Track if we're currently refreshing to avoid multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    
    failedQueue = [];
};

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If request failed with 401 and we haven't already tried to refresh
        // Don't attempt refresh for auth endpoints (login, register, etc.)
        const isAuthEndpoint = originalRequest.url?.includes('/auth/') && 
                              !originalRequest.url?.includes('/auth/refresh') &&
                              !originalRequest.url?.includes('/auth/me');
        
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
            if (isRefreshing) {
                // If already refreshing, queue the request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Attempt to refresh the token
                const response = await axios.post('/api/auth/refresh', {}, {
                    baseURL: import.meta.env.VITE_API_URL,
                    withCredentials: true
                });

                const { token } = response.data;
                localStorage.setItem('token', token);

                // Update default authorization header
                api.defaults.headers.common.Authorization = `Bearer ${token}`;
                originalRequest.headers.Authorization = `Bearer ${token}`;

                processQueue(null, token);
                
                // Retry the original request
                return api(originalRequest);

            } catch (refreshError) {
                processQueue(refreshError, null);
                
                // If refresh fails, clear tokens and redirect to login
                localStorage.removeItem('token');
                delete api.defaults.headers.common.Authorization;
                
                // Emit a custom event for components to listen to
                window.dispatchEvent(new CustomEvent('auth:logout'));
                
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
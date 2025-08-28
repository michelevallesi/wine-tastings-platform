import axios from 'axios';
import toast from 'react-hot-toast';

// API Base URL - points to API Gateway
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add request ID for tracing
    config.headers['X-Request-ID'] = generateRequestId();
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { token } = response.data;
          localStorage.setItem('token', token);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          toast.error(data.message || 'Richiesta non valida');
          break;
        case 403:
          toast.error('Non hai i permessi per questa operazione');
          break;
        case 404:
          toast.error('Risorsa non trovata');
          break;
        case 429:
          toast.error('Troppe richieste. Riprova tra qualche minuto');
          break;
        case 500:
          toast.error('Errore interno del server');
          break;
        case 503:
          toast.error('Servizio temporaneamente non disponibile');
          break;
        default:
          toast.error(data.message || 'Si è verificato un errore');
      }
    } else if (error.request) {
      // Request made but no response received
      toast.error('Impossibile contattare il server');
    } else {
      // Something else happened
      toast.error('Si è verificato un errore imprevisto');
    }

    return Promise.reject(error);
  }
);

// Utility function to generate request ID
function generateRequestId() {
  return 'req_' + Math.random().toString(36).substr(2, 9);
}

// API Methods
export const api = {
  // Auth endpoints
  auth: {
    login: (credentials) => apiClient.post('/auth/login', credentials),
    register: (userData) => apiClient.post('/auth/register', userData),
    logout: () => apiClient.post('/auth/logout'),
    refresh: () => apiClient.post('/auth/refresh'),
    verify: () => apiClient.get('/auth/verify'),
    profile: () => apiClient.get('/auth/profile'),
    updateProfile: (data) => apiClient.put('/auth/profile', data),
  },

  // Public package endpoints
  packages: {
    search: (params) => apiClient.get('/public/packages', { params }),
    getById: (id) => apiClient.get(`/public/packages/${id}`),
    getBySlug: (slug) => apiClient.get(`/public/packages/slug/${slug}`),
    getFeatured: (limit = 6) => apiClient.get(`/public/packages/featured?limit=${limit}`),
    getCategories: () => apiClient.get('/public/packages/categories'),
  },

  // Protected package endpoints (for producers)
  producerPackages: {
    list: (params) => apiClient.get('/packages', { params }),
    create: (data) => apiClient.post('/packages', data),
    update: (id, data) => apiClient.put(`/packages/${id}`, data),
    delete: (id) => apiClient.delete(`/packages/${id}`),
    duplicate: (id, data) => apiClient.post(`/packages/${id}/duplicate`, data),
    analytics: (params) => apiClient.get('/packages/analytics', { params }),
  },

  // Booking endpoints
  bookings: {
    create: (data) => apiClient.post('/bookings', data),
    list: (params) => apiClient.get('/bookings', { params }),
    getById: (id) => apiClient.get(`/bookings/${id}`),
    update: (id, data) => apiClient.put(`/bookings/${id}`, data),
    cancel: (id, reason) => apiClient.put(`/bookings/${id}/cancel`, { reason }),
    confirm: (id) => apiClient.put(`/bookings/${id}/confirm`),
  },

  // Payment endpoints
  payments: {
    create: (data) => apiClient.post('/payments/create', data),
    getById: (id) => apiClient.get(`/payments/${id}`),
    refund: (id, data) => apiClient.post(`/payments/${id}/refund`, data),
  },

  // Producer endpoints
  producers: {
    list: (params) => apiClient.get('/producers', { params }),
    getById: (id) => apiClient.get(`/producers/${id}`),
    update: (id, data) => apiClient.put(`/producers/${id}`, data),
    updateProfile: (data) => apiClient.put('/producers/profile', data),
  },

  // Admin endpoints
  admin: {
    // Services management
    getServicesStatus: () => apiClient.get('/admin/services/status'),
    restartService: (serviceName) => apiClient.post(`/admin/services/${serviceName}/restart`),
    updateServiceConfig: (serviceName, config) => 
      apiClient.put(`/admin/services/${serviceName}/config`, config),
    
    // User management
    getUsers: (params) => apiClient.get('/admin/users', { params }),
    updateUserStatus: (id, status) => apiClient.put(`/admin/users/${id}/status`, { status }),
    deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),
    
    // Booking management
    getBookings: (params) => apiClient.get('/admin/bookings', { params }),
    
    // Producer management
    getProducers: (params) => apiClient.get('/admin/producers', { params }),
    approveProducer: (id) => apiClient.put(`/admin/producers/${id}/approve`),
    rejectProducer: (id, reason) => apiClient.put(`/admin/producers/${id}/reject`, { reason }),
    
    // Analytics
    getAnalytics: (period) => apiClient.get(`/admin/analytics?period=${period}`),
    getDashboardStats: () => apiClient.get('/admin/dashboard/stats'),
  },

  // File upload
  upload: {
    single: (file, type = 'general') => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      return apiClient.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    
    multiple: (files, type = 'general') => {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`files`, file);
      });
      formData.append('type', type);
      
      return apiClient.post('/upload/multiple', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },
  },
};

export default apiClient;
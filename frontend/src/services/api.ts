import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (unauthorized) - logout user
// But don't redirect if we're already on login/register pages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      // Don't redirect if already on auth pages
      if (currentPath !== '/login' && currentPath !== '/register') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Inventory API methods (for consumable resource ledger management)
export const inventoryApi = {
  /**
   * Create a restock transaction for a consumable resource
   */
  restock: (data: {
    resourceId: string;
    quantity: number;
    restockDate?: string;
    notes?: string;
  }) => api.post('/inventory/restock', data),

  /**
   * Get current balance for a resource
   */
  getBalance: (resourceId: string) =>
    api.get(`/inventory/balance/${resourceId}`),

  /**
   * Get projected balance at a specific date
   */
  getProjectedBalance: (resourceId: string, date: string) =>
    api.get(`/inventory/projected-balance/${resourceId}`, { params: { date } }),

  /**
   * Get transaction history for a resource
   */
  getHistory: (resourceId: string, startDate?: string, endDate?: string) =>
    api.get(`/inventory/history/${resourceId}`, {
      params: { startDate, endDate },
    }),

  /**
   * Get running balance over time (for charts/visualization)
   */
  getRunningBalance: (resourceId: string, startDate?: string, endDate?: string) =>
    api.get(`/inventory/running-balance/${resourceId}`, {
      params: { startDate, endDate },
    }),

  /**
   * Detect inventory shortages across all resources
   */
  detectShortages: (resourceId?: string) =>
    api.get('/inventory/shortages', { params: resourceId ? { resourceId } : {} }),
};

export default api;

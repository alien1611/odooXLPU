/**
 * Stockyard API Client Foundation
 * Centralized fetch wrapper with authentication token injection,
 * JSON handling, and structured error responses.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  constructor(baseUrl = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  getAuthToken() {
    return localStorage.getItem('stockyard_token');
  }

  setAuthToken(token) {
    if (token) {
      localStorage.setItem('stockyard_token', token);
    } else {
      localStorage.removeItem('stockyard_token');
    }
  }

  clearAuthToken() {
    localStorage.removeItem('stockyard_token');
    localStorage.removeItem('stockyard_user');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const message = json?.error?.message || `Request failed with status ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.code = json?.error?.code || 'API_ERROR';
        error.details = json?.error?.details || json;
        throw error;
      }

      return json;
    } catch (err) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        const networkError = new Error('Network error: Unable to communicate with the Stockyard backend server.');
        networkError.status = 0;
        networkError.code = 'NETWORK_ERROR';
        throw networkError;
      }
      throw err;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }

  // System Health
  checkHealth() {
    return this.get('/health');
  }

  // Authentication API
  async login(credentials) {
    const res = await this.post('/auth/login', credentials);
    if (res.data?.token) {
      this.setAuthToken(res.data.token);
      localStorage.setItem('stockyard_user', JSON.stringify(res.data.user));
    }
    return res.data;
  }

  async signup(payload) {
    const res = await this.post('/auth/signup', payload);
    if (res.data?.token) {
      this.setAuthToken(res.data.token);
      localStorage.setItem('stockyard_user', JSON.stringify(res.data.user));
    }
    return res.data;
  }

  requestOtp(payload) {
    return this.post('/auth/request-otp', payload).then(r => r.data);
  }

  resetPassword(payload) {
    return this.post('/auth/reset-password', payload).then(r => r.data);
  }

  getMe() {
    return this.get('/auth/me').then(r => r.data?.user);
  }

  // Master Data API
  getCategories() {
    return this.get('/categories').then(r => r.data || []);
  }

  createCategory(payload) {
    return this.post('/categories', payload).then(r => r.data);
  }

  getUom() {
    return this.get('/uom').then(r => r.data || []);
  }

  createUom(payload) {
    return this.post('/uom', payload).then(r => r.data);
  }

  getWarehouses() {
    return this.get('/warehouses').then(r => r.data || []);
  }

  createWarehouse(payload) {
    return this.post('/warehouses', payload).then(r => r.data);
  }

  getLocations(warehouseId = null) {
    const endpoint = warehouseId ? `/locations?warehouse_id=${warehouseId}` : '/locations';
    return this.get(endpoint).then(r => r.data || []);
  }

  createLocation(payload) {
    return this.post('/locations', payload).then(r => r.data);
  }

  getProducts(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.search) searchParams.append('search', params.search);
    if (params.category_id) searchParams.append('category_id', params.category_id);
    const qs = searchParams.toString();
    const endpoint = qs ? `/products?${qs}` : '/products';
    return this.get(endpoint).then(r => r.data || []);
  }

  createProduct(payload) {
    return this.post('/products', payload).then(r => r.data);
  }
}

export const api = new ApiClient();
export default api;

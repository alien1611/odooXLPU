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

  // Phase 3 — Core Stock Engine API
  getReceipts(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    const qs = searchParams.toString();
    return this.get(qs ? `/receipts?${qs}` : '/receipts').then(r => r.data || []);
  }

  getReceiptById(id) {
    return this.get(`/receipts/${id}`).then(r => r.data);
  }

  createReceipt(payload) {
    return this.post('/receipts', payload).then(r => r.data);
  }

  getDeliveries(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    const qs = searchParams.toString();
    return this.get(qs ? `/deliveries?${qs}` : '/deliveries').then(r => r.data || []);
  }

  getDeliveryById(id) {
    return this.get(`/deliveries/${id}`).then(r => r.data);
  }

  createDelivery(payload) {
    return this.post('/deliveries', payload).then(r => r.data);
  }

  getTransfers(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.product_id) searchParams.append('product_id', params.product_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/transfers?${qs}` : '/transfers').then(r => r.data || []);
  }

  createTransfer(payload) {
    return this.post('/transfers', payload).then(r => r.data);
  }

  getAdjustments(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.product_id) searchParams.append('product_id', params.product_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/adjustments?${qs}` : '/adjustments').then(r => r.data || []);
  }

  createAdjustment(payload) {
    return this.post('/adjustments', payload).then(r => r.data);
  }

  getQuants(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.product_id) searchParams.append('product_id', params.product_id);
    if (params.location_id) searchParams.append('location_id', params.location_id);
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/quants?${qs}` : '/quants').then(r => r.data || []);
  }

  getMoves(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.product_id) searchParams.append('product_id', params.product_id);
    if (params.move_type) searchParams.append('move_type', params.move_type);
    if (params.limit) searchParams.append('limit', params.limit);
    const qs = searchParams.toString();
    return this.get(qs ? `/moves?${qs}` : '/moves').then(r => r.data || []);
  }

  getLots(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.product_id) searchParams.append('product_id', params.product_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/lots?${qs}` : '/lots').then(r => r.data || []);
  }

  getAuditLogs(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.entity_type) searchParams.append('entity_type', params.entity_type);
    if (params.limit) searchParams.append('limit', params.limit);
    const qs = searchParams.toString();
    return this.get(qs ? `/audit-logs?${qs}` : '/audit-logs').then(r => r.data || []);
  }

  // Phase 4 — Reorder Intelligence, Expiry Risk & Inventory Valuation
  getReorderSuggestions(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.append('status', params.status);
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.product_id) searchParams.append('product_id', params.product_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/reorders/suggestions?${qs}` : '/reorders/suggestions').then(r => r.data || []);
  }

  getReorderAnalysis(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.product_id) searchParams.append('product_id', params.product_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/reorders/analysis?${qs}` : '/reorders/analysis').then(r => r.data || []);
  }

  generateReorderSuggestions(payload = {}) {
    return this.post('/reorders/generate', payload).then(r => r.data);
  }

  approveReorderSuggestion(id) {
    return this.post(`/reorders/${id}/approve`, {}).then(r => r.data);
  }

  dismissReorderSuggestion(id) {
    return this.post(`/reorders/${id}/dismiss`, {}).then(r => r.data);
  }

  getExpiryRisk(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.risk_window) searchParams.append('risk_window', params.risk_window);
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.location_id) searchParams.append('location_id', params.location_id);
    if (params.product_id) searchParams.append('product_id', params.product_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/expiry/risk?${qs}` : '/expiry/risk').then(r => r.data || []);
  }

  getExpirySummary(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.location_id) searchParams.append('location_id', params.location_id);
    if (params.product_id) searchParams.append('product_id', params.product_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/expiry/summary?${qs}` : '/expiry/summary').then(r => r.data || {});
  }

  getValuationSummary(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/valuation/summary?${qs}` : '/valuation/summary').then(r => r.data || {});
  }

  getProductValuation(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.category_id) searchParams.append('category_id', params.category_id);
    if (params.search) searchParams.append('search', params.search);
    const qs = searchParams.toString();
    return this.get(qs ? `/valuation/products?${qs}` : '/valuation/products').then(r => r.data || []);
  }

  getValuationLayers(productId) {
    return this.get(`/valuation/layers/${productId}`).then(r => r.data || []);
  }

  // Phase 5 — Barcode Scanning & Warehouse Operations
  lookupBarcode(code) {
    return this.get(`/barcodes/lookup?code=${encodeURIComponent(code)}`).then(r => r.data);
  }

  assignBarcode(payload) {
    return this.post('/barcodes/assign', payload).then(r => r.data);
  }

  getLocationInventory(locationId) {
    return this.get(`/barcodes/location-inventory/${locationId}`).then(r => r.data || []);
  }

  // Phase 6 — Advanced Warehouse Logistics & Wave Management
  getWaves(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.status) searchParams.append('status', params.status);
    const qs = searchParams.toString();
    return this.get(qs ? `/waves?${qs}` : '/waves').then(r => r.data || []);
  }

  getWaveById(id) {
    return this.get(`/waves/${id}`).then(r => r.data);
  }

  createWave(payload) {
    return this.post('/waves', payload).then(r => r.data);
  }

  releaseWave(id) {
    return this.post(`/waves/${id}/release`, {}).then(r => r.data);
  }

  startWave(id) {
    return this.post(`/waves/${id}/start`, {}).then(r => r.data);
  }

  completeWave(id) {
    return this.post(`/waves/${id}/complete`, {}).then(r => r.data);
  }

  cancelWave(id) {
    return this.post(`/waves/${id}/cancel`, {}).then(r => r.data);
  }

  addDeliveriesToWave(id, payload) {
    return this.post(`/waves/${id}/deliveries`, payload).then(r => r.data);
  }

  removeDeliveryFromWave(id, deliveryId) {
    return this.delete(`/waves/${id}/deliveries/${deliveryId}`);
  }

  getReplenishments(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.status) searchParams.append('status', params.status);
    const qs = searchParams.toString();
    return this.get(qs ? `/replenishment?${qs}` : '/replenishment').then(r => r.data || []);
  }

  getReplenishmentConfigs(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    const qs = searchParams.toString();
    return this.get(qs ? `/replenishment/configs?${qs}` : '/replenishment/configs').then(r => r.data || []);
  }

  setReplenishmentConfig(payload) {
    return this.post('/replenishment/configs', payload).then(r => r.data);
  }

  generateReplenishments(payload = {}) {
    return this.post('/replenishment/generate', payload).then(r => r.data);
  }

  executeReplenishment(id, payload = {}) {
    return this.post(`/replenishment/${id}/execute`, payload).then(r => r.data);
  }

  dismissReplenishment(id) {
    return this.post(`/replenishment/${id}/dismiss`, {}).then(r => r.data);
  }

  getCrossDockAlerts(params = {}) {
    const searchParams = new URLSearchParams();
    if (params.warehouse_id) searchParams.append('warehouse_id', params.warehouse_id);
    if (params.status) searchParams.append('status', params.status);
    const qs = searchParams.toString();
    return this.get(qs ? `/cross-dock?${qs}` : '/cross-dock').then(r => r.data || []);
  }

  scanCrossDock(payload = {}) {
    return this.post('/cross-dock/scan', payload).then(r => r.data);
  }

  acknowledgeCrossDock(id) {
    return this.post(`/cross-dock/${id}/acknowledge`, {}).then(r => r.data);
  }

  dismissCrossDock(id) {
    return this.post(`/cross-dock/${id}/dismiss`, {}).then(r => r.data);
  }
}

export const api = new ApiClient();
export default api;

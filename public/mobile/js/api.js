class ApiClient {
    constructor() {
        this.baseUrl = '';
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return headers;
    }

    async request(method, path, body = null) {
        const options = {
            method,
            headers: this.getHeaders()
        };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(this.baseUrl + path, options);

        if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (location.hash && !location.hash.includes('/login') && !location.hash.includes('/register')) {
                localStorage.setItem('redirect_after_login', location.hash);
            }
            location.hash = '#/login';
            throw new Error('未授權，請重新登入');
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '請求失敗' }));
            let errMsg = '請求失敗';
            if (err && err.error) {
                if (typeof err.error === 'object') {
                    errMsg = err.error.message || err.error.code || JSON.stringify(err.error);
                } else {
                    errMsg = err.error;
                }
            } else if (err && err.message) {
                errMsg = err.message;
            }
            throw new Error(errMsg);
        }

        const json = await res.json();
        return json.data;
    }

    // Auth
    login(email, password) { return this.request('POST', '/api/v1/auth/login', { email, password }); }
    register(data) { return this.request('POST', '/api/v1/auth/register', data); }

    // Stores
    getStores() { return this.request('GET', '/api/v1/stores/nearby?lat=22.6855&lng=120.3028&radius=10'); }
    getStore(id) { return this.request('GET', `/api/v1/stores/${id}`); }
    getMyStore() { return this.request('GET', '/api/v1/stores/me'); }
    createStore(data) { return this.request('POST', '/api/v1/stores', data); }

    // Products
    getProducts(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('GET', `/api/v1/products${query ? '?' + query : ''}`);
    }
    getProduct(id) { return this.request('GET', `/api/v1/products/${id}`); }
    createProduct(data) { return this.request('POST', '/api/v1/products', data); }
    getStoreProducts(storeId) { return this.request('GET', `/api/v1/products?store_id=${storeId}`); }

    // Machines
    getMachines() { return this.request('GET', '/api/v1/machines'); }
    getMachine(id) { return this.request('GET', `/api/v1/machines/${id}/status`); }
    pairMachine(token) { return this.request('POST', '/api/v1/machines/pair/confirm', { token }); }
    stockCompartment(machineId, compartmentIndex, productId) {
        return this.request('POST', `/api/v1/machines/${machineId}/compartments/${compartmentIndex}/stock`, { product_id: productId });
    }
    clearCompartment(machineId, compartmentIndex) {
        return this.request('POST', `/api/v1/machines/${machineId}/compartments/${compartmentIndex}/clear`);
    }
    getMachineStatus(machineId) { return this.request('GET', `/api/v1/machines/${machineId}/status`); }

    // Orders
    getOrders() { return this.request('GET', '/api/v1/orders/me'); }
    getOrder(id) { return this.request('GET', `/api/v1/orders/${id}`); }
    async createOrder(data) {
        const res = await this.request('POST', '/api/v1/orders/map', { product_id: data.productId });
        return res.order || res;
    }
    getStoreOrders() { return this.request('GET', '/api/v1/orders/store'); }
    completeOrder(orderId, pickupCode) {
        return this.request('POST', `/api/v1/orders/${orderId}/complete`, { pickup_code: pickupCode });
    }

    // Payment
    processPayment(orderId) { 
        return this.request('POST', '/api/v1/payment/mock/pay', { order_id: parseInt(orderId, 10) });
    }

    // Dev helper: process payment and immediately dispense (development only)
    processPaymentAndDispense(orderId) {
        return this.request('POST', '/api/v1/payment/mock/pay-and-dispense', { order_id: parseInt(orderId, 10) });
    }

    // Points
    async getPoints() {
        try {
            const res = await this.request('GET', '/api/v1/auth/me');
            return {
                points: res.user?.points ?? 0,
                history: []
            };
        } catch (e) {
            return { points: 0, history: [] };
        }
    }
}

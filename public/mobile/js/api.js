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
            location.hash = '#/login';
            throw new Error('未授權，請重新登入');
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: '請求失敗' }));
            throw new Error(err.error || '請求失敗');
        }

        return res.json();
    }

    // Auth
    login(email, password) { return this.request('POST', '/api/auth/login', { email, password }); }
    register(data) { return this.request('POST', '/api/auth/register', data); }

    // Stores
    getStores() { return this.request('GET', '/api/stores'); }
    getStore(id) { return this.request('GET', `/api/stores/${id}`); }
    getMyStore() { return this.request('GET', '/api/stores/me'); }
    createStore(data) { return this.request('POST', '/api/stores', data); }

    // Products
    getProducts(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request('GET', `/api/products${query ? '?' + query : ''}`);
    }
    getProduct(id) { return this.request('GET', `/api/products/${id}`); }
    createProduct(data) { return this.request('POST', '/api/products', data); }
    getStoreProducts(storeId) { return this.request('GET', `/api/stores/${storeId}/products`); }

    // Machines
    getMachines() { return this.request('GET', '/api/machines'); }
    getMachine(id) { return this.request('GET', `/api/machines/${id}`); }
    pairMachine(token) { return this.request('POST', '/api/machines/pair', { token }); }
    stockCompartment(machineId, compartment, productId) {
        return this.request('POST', `/api/machines/${machineId}/stock`, { compartment, productId });
    }
    getMachineStatus(machineId) { return this.request('GET', `/api/machines/${machineId}/status`); }

    // Orders
    getOrders() { return this.request('GET', '/api/orders'); }
    getOrder(id) { return this.request('GET', `/api/orders/${id}`); }
    createOrder(data) { return this.request('POST', '/api/orders', data); }
    getStoreOrders() { return this.request('GET', '/api/orders/store'); }
    completeOrder(orderId, pickupCode) {
        return this.request('POST', `/api/orders/${orderId}/complete`, { pickupCode });
    }

    // Payment
    processPayment(orderId) { return this.request('POST', `/api/payments/${orderId}/pay`); }

    // Points
    getPoints() { return this.request('GET', '/api/points'); }
}

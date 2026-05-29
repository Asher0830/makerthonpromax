class AuthManager {
    constructor() {}

    async login(email, password) {
        const data = await api.login(email, password);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }

    async register(name, email, password, role) {
        const data = await api.register({ name, email, password, role });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data;
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        location.hash = '#/login';
    }

    getUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    getToken() {
        return localStorage.getItem('token');
    }

    isLoggedIn() {
        return !!this.getToken() && !!this.getUser();
    }

    isStoreOwner() {
        const user = this.getUser();
        return user && user.role === 'store_owner';
    }

    isConsumer() {
        const user = this.getUser();
        return user && user.role === 'consumer';
    }
}

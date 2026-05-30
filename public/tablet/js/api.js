/* ═══════════════════════════════════════════════════
   FoodD Tablet — API Client
   ═══════════════════════════════════════════════════ */

class TabletAPI {
  /**
   * @param {string} [baseURL] — API base, defaults to current origin
   */
  constructor(baseURL = '') {
    this.baseURL = baseURL || window.location.origin;
  }

  /* ── Internal helper ── */
  async _request(method, path, body = null) {
    const url = `${this.baseURL}${path}`;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) {
      opts.body = JSON.stringify(body);
    }
    try {
      const res = await fetch(url, opts);
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        let errMsg = `HTTP ${res.status}`;
        if (errorBody && errorBody.error) {
          if (typeof errorBody.error === 'object') {
            errMsg = errorBody.error.message || errorBody.error.code || JSON.stringify(errorBody.error);
          } else {
            errMsg = errorBody.error;
          }
        } else if (errorBody && errorBody.message) {
          errMsg = errorBody.message;
        }
        const err = new Error(errMsg);
        err.status = res.status;
        err.body = errorBody;
        throw err;
      }
      return await res.json();
    } catch (err) {
      if (!err.status) {
        // Network-level error
        const wrapped = new Error('網路連線異常，請稍後再試');
        wrapped.originalError = err;
        throw wrapped;
      }
      throw err;
    }
  }

  /* ── Machine status ── */
  async getMachineStatus(machineId) {
    const res = await this._request('GET', `/api/v1/machines/${machineId}/status`);
    if (!res || !res.data) return null;

    const data = res.data;
    const compartments = (data.compartments || []).map(c => ({
      id: c.id,
      number: c.index_num, // 1-based index number
      status: (c.status || '').toLowerCase(), // convert 'STOCKED' -> 'stocked', 'EMPTY' -> 'empty'
      productName: c.product_name || '',
      price: c.selling_price || 0,
      category: c.category || '',
      allergens: c.allergens || [],
      productStatus: (c.product_status || '').toLowerCase(),
    }));

    // Calculate average price of stocked items
    const stocked = compartments.filter(c => c.status === 'stocked' && (!c.productStatus || c.productStatus === 'available'));
    const avgPrice = stocked.length > 0
      ? Math.round(stocked.reduce((sum, c) => sum + c.price, 0) / stocked.length)
      : 0;

    let orderStatus = null;
    let orderId = null;
    let orderType = null;
    if (data.active_order) {
      orderId = data.active_order.id;
      const s = data.active_order.status;
      orderType = data.active_order.order_type || null;
      if (s === 'PENDING' || s === 'WAITING_FOR_PAYMENT') orderStatus = 'pending';
      else if (s === 'PAID' || s === 'WAITING_FOR_TRIGGER') orderStatus = 'paid';
      else if (s === 'DISPENSING') orderStatus = 'dispensing';
      else if (s === 'COMPLETED') orderStatus = 'completed';
    }

    return {
      machineId: data.machine.id,
      machineName: data.machine.name,
      status: (data.machine.status || '').toLowerCase(),
      temperature: data.last_telemetry?.temperature ?? 18.5,
      compartments,
      totalStocked: data.pool_summary?.stocked ?? stocked.length,
      averagePrice: avgPrice,
      orderStatus,
      orderType,
      orderId,
    };
  }

  /* ── Start gacha ── */
  async startGacha(machineId, excludedAllergens = [], category = null) {
    const res = await this._request('POST', `/api/v1/machines/${machineId}/gacha/start`, {
      excluded_allergens: excludedAllergens,
      category,
    });
    return {
      orderId: res.data.order_id,
      amount: res.data.pool_avg_price,
    };
  }

  /* ── Start direct purchase ── */
  async startDirectPurchase(machineId, compartmentIndex) {
    const res = await this._request('POST', `/api/v1/machines/${machineId}/purchase/start`, {
      compartment_index: compartmentIndex,
    });
    return {
      orderId: res.data.order_id,
      amount: res.data.price,
      productName: res.data.product_name,
    };
  }

  /* ── Cancel order ── */
  cancelGachaOrder(machineId, orderId) {
    return this._request('POST', `/api/v1/machines/${machineId}/gacha/cancel`, {
      order_id: orderId,
    });
  }

  /* ── Pay for gacha order (Mock) ── */
  payGacha(machineId, orderId) {
    return this._request('POST', `/api/v1/machines/${machineId}/gacha/pay`, {
      order_id: orderId,
    });
  }

  // Dev helper: process payment and immediately dispense (development only)
  processPaymentAndDispense(orderId) {
    return this._request('POST', '/api/v1/payment/mock/pay-and-dispense', { order_id: orderId });
  }

  /* ── Simulate standard payment (Mock) ── */
  simulatePayment(orderId) {
    return this._request('POST', '/api/v1/payment/mock/pay', { order_id: orderId });
  }

  /* ── Get latest gacha result ── */
  async getLatestResult(machineId) {
    const res = await this._request('GET', `/api/v1/machines/${machineId}/latest-result`);
    if (!res || !res.data || !res.data.result) return null;
    const r = res.data.result;
    return {
      orderId: r.order_id,
      status: r.status,
      orderType: r.order_type || null,
      compartment: r.won.compartment_index, // 1~6 index_num
      productName: r.won.product_name,
      category: { bento: '便當', bread: '麵包', vegetable: '蔬菜', other: '其他' }[r.won.category] || r.won.category,
    };
  }

  /* ── Generate store pairing token ── */
  generatePairToken(machineId) {
    return this._request('POST', `/api/v1/machines/${machineId}/pair/generate`);
  }

  /* ── Complete / acknowledge machine order ── */
  completeMachineOrder(machineId) {
    return this._request('POST', `/api/v1/machines/${machineId}/complete`);
  }
}

// Expose as global singleton
window.tabletAPI = new TabletAPI();

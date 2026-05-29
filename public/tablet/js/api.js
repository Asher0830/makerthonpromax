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
        const err = new Error(errorBody.error || `HTTP ${res.status}`);
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
  getMachineStatus(machineId) {
    return this._request('GET', `/api/v1/machines/${machineId}/status`);
  }

  /* ── Start gacha ── */
  startGacha(machineId, excludedAllergens = []) {
    return this._request('POST', `/api/v1/machines/${machineId}/gacha`, {
      excludedAllergens,
    });
  }

  /* ── Pay for gacha order ── */
  payGacha(machineId, orderId) {
    return this._request('POST', `/api/v1/machines/${machineId}/gacha/${orderId}/pay`);
  }

  /* ── Get latest gacha result ── */
  getLatestResult(machineId) {
    return this._request('GET', `/api/v1/machines/${machineId}/latest-result`);
  }

  /* ── Generate store pairing token ── */
  generatePairToken(machineId) {
    return this._request('POST', `/api/v1/machines/${machineId}/pair-token`);
  }

  /* ── Complete / acknowledge machine order ── */
  completeMachineOrder(machineId) {
    return this._request('POST', `/api/v1/machines/${machineId}/complete`);
  }
}

// Expose as global singleton
window.tabletAPI = new TabletAPI();

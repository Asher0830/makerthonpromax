/* ═══════════════════════════════════════════════════
   FoodD Tablet — Polling Service
   ═══════════════════════════════════════════════════ */

class PollingService {
  /**
   * @param {string} machineId
   * @param {TabletAPI} api
   */
  constructor(machineId, api) {
    this.machineId = machineId;
    this.api = api;

    /* Adaptive intervals per app state */
    this.intervals = {
      IDLE: 5000,
      ALLERGEN_SELECT: 8000,
      WAITING_PAYMENT: 3000,
      WAITING_TRIGGER: 500,
      GACHA_ANIMATION: null,    // no polling during animation
      RESULT: 5000,
      PAIR_MODE: 10000,
      ERROR: 10000,
    };

    this._timerId = null;
    this._currentState = 'IDLE';
    this._callbacks = [];
    this._resultCallbacks = [];
    this._running = false;
    this._lastStatus = null;
  }

  /* ── Public API ── */

  /** Register a callback for machine status changes */
  onStatusChange(cb) {
    this._callbacks.push(cb);
    return () => {
      this._callbacks = this._callbacks.filter((fn) => fn !== cb);
    };
  }

  /** Register a callback for latest-result responses */
  onLatestResult(cb) {
    this._resultCallbacks.push(cb);
    return () => {
      this._resultCallbacks = this._resultCallbacks.filter((fn) => fn !== cb);
    };
  }

  /** Update the current app state (adjusts polling interval) */
  setAppState(state) {
    const changed = this._currentState !== state;
    this._currentState = state;
    if (changed && this._running) {
      this._reschedule();
    }
  }

  /** Start polling */
  start() {
    if (this._running) return;
    this._running = true;
    this._poll(); // first poll immediately
  }

  /** Stop polling */
  stop() {
    this._running = false;
    clearTimeout(this._timerId);
    this._timerId = null;
  }

  /* ── Internal ── */

  _reschedule() {
    clearTimeout(this._timerId);
    const interval = this.intervals[this._currentState];
    console.log(`[PollingService] reschedule state: ${this._currentState}, interval: ${interval}, running: ${this._running}`);
    if (interval == null || !this._running) return;
    this._timerId = setTimeout(() => this._poll(), interval);
  }

  async _poll() {
    if (!this._running) return;

    try {
      const status = await this.api.getMachineStatus(this.machineId);
      this._lastStatus = status;
      this._callbacks.forEach((cb) => {
        try { cb(status); } catch (e) { console.error('[PollingService] callback error', e); }
      });
    } catch (err) {
      console.warn('[PollingService] status poll failed', err.message);
    }

    // Also poll latest-result when in WAITING_TRIGGER
    if (this._currentState === 'WAITING_TRIGGER') {
      try {
        const result = await this.api.getLatestResult(this.machineId);
        if (result) {
          this._resultCallbacks.forEach((cb) => {
            try { cb(result); } catch (e) { console.error('[PollingService] result callback error', e); }
          });
        }
      } catch (err) {
        // Silence — no result yet is normal
      }
    }

    this._reschedule();
  }

  /** Get the last fetched status (cache) */
  get lastStatus() {
    return this._lastStatus;
  }
}

// Expose globally
window.PollingService = PollingService;

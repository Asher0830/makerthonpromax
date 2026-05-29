/**
 * 統一錯誤回應工具
 */

export class AppError extends Error {
    constructor(code, message, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}

/**
 * 成功回應
 */
export function success(c, data, status = 200) {
    return c.json({ success: true, data }, status);
}

/**
 * 錯誤回應
 */
export function error(c, code, message, status = 400) {
    return c.json({
        success: false,
        error: { code, message }
    }, status);
}

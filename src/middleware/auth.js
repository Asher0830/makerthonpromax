/**
 * JWT 認證中間件
 * 從 Authorization header 解析 Bearer Token
 */

import { verifyToken } from '../utils/jwt.js';
import { error } from '../utils/errors.js';

/**
 * 必須登入
 */
export function requireAuth() {
    return async (c, next) => {
        const authHeader = c.req.header('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return error(c, 'UNAUTHORIZED', '請先登入', 401);
        }

        const token = authHeader.slice(7);
        const payload = verifyToken(token);

        if (!payload) {
            return error(c, 'TOKEN_INVALID', 'Token 無效或已過期', 401);
        }

        // 把使用者資訊放到 context
        c.set('user', payload);
        await next();
    };
}

/**
 * 限定角色
 */
export function requireRole(...roles) {
    return async (c, next) => {
        const user = c.get('user');
        if (!user) {
            return error(c, 'UNAUTHORIZED', '請先登入', 401);
        }
        if (!roles.includes(user.role)) {
            return error(c, 'FORBIDDEN', '權限不足', 403);
        }
        await next();
    };
}

/**
 * JWT 工具模組
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'foodd-dev-secret-key-change-in-production';
const JWT_EXPIRES = '24h';

// [C7 FIX] 生產環境必須設定 JWT_SECRET
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required in production');
}

/**
 * 產生 JWT Token
 */
export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * 驗證 JWT Token
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

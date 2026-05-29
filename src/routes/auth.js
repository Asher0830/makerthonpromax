/**
 * 認證路由 — 註冊 / 登入
 */

import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { queryFirst, query } from '../db/connection.js';
import { signToken } from '../utils/jwt.js';
import { success, error } from '../utils/errors.js';

const auth = new Hono();

/**
 * POST /api/v1/auth/register — 註冊
 */
auth.post('/register', async (c) => {
    const body = await c.req.json();
    const { email, password, name, role } = body;

    // 驗證必填欄位
    if (!email || !password || !name || !role) {
        return error(c, 'MISSING_FIELDS', '請填寫所有必填欄位');
    }

    // 驗證角色
    if (!['consumer', 'store_owner'].includes(role)) {
        return error(c, 'INVALID_ROLE', '角色必須是 consumer 或 store_owner');
    }

    // 驗證 email 格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return error(c, 'INVALID_EMAIL', 'Email 格式不正確');
    }

    // 密碼長度
    if (password.length < 6) {
        return error(c, 'PASSWORD_TOO_SHORT', '密碼至少 6 個字元');
    }

    // 檢查是否已註冊
    const existing = queryFirst('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
        return error(c, 'EMAIL_EXISTS', '此 Email 已被註冊', 409);
    }

    // 建立帳號
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = query(
        'INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, role, name]
    );

    const userId = Number(result.meta.last_row_id);
    const user = { id: userId, email, name, role, points: 0 };
    const token = signToken({ id: userId, email, role });

    return success(c, { user, token }, 201);
});

/**
 * POST /api/v1/auth/login — 登入
 */
auth.post('/login', async (c) => {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
        return error(c, 'MISSING_FIELDS', '請輸入 Email 和密碼');
    }

    // 查找使用者
    const user = queryFirst('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
        return error(c, 'INVALID_CREDENTIALS', 'Email 或密碼錯誤', 401);
    }

    // 驗證密碼
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        return error(c, 'INVALID_CREDENTIALS', 'Email 或密碼錯誤', 401);
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return success(c, {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            points: user.points
        },
        token
    });
});

/**
 * GET /api/v1/auth/me — 取得自己的資訊
 */
auth.get('/me', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return error(c, 'UNAUTHORIZED', '請先登入', 401);
    }

    const { verifyToken } = await import('../utils/jwt.js');
    const payload = verifyToken(authHeader.slice(7));
    if (!payload) {
        return error(c, 'TOKEN_INVALID', 'Token 無效或已過期', 401);
    }

    const user = queryFirst('SELECT id, email, name, role, points, created_at FROM users WHERE id = ?', [payload.id]);
    if (!user) {
        return error(c, 'USER_NOT_FOUND', '使用者不存在', 404);
    }

    return success(c, { user });
});

export default auth;

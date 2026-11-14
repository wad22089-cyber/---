import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'path';
import {
  createSession,
  deleteItem,
  deleteItemsBulk,
  deleteSession,
  deleteUserById,
  disableUserBiometric,
  findUserByCredentials,
  getSettings,
  getUserBySessionToken,
  insertItems,
  listAllUsers,
  listItems,
  loginWithBiometric,
  registerUser,
  saveUserBiometric,
  setSetting,
  updateItem,
  updateUserRole,
} from './server/db.js';
import {
  parseCustomsDocumentWithGemini,
  runCustomsAiAssistant,
  suggestItemFieldsWithGemini,
} from './server/gemini.js';
import { buildAndroidApkKitBuffer } from './server/apkKit.js';
import type { CustomsItemInput, User } from './src/types.js';

interface AuthRequest extends Request {
  user?: User;
  token?: string;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً' });
    return;
  }
  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: 'انتهت جلسة العمل، يرجى إعادة تسجيل الدخول' });
    return;
  }
  req.user = user;
  req.token = token;
  next();
}

function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'owner') {
    res.status(403).json({ error: 'هذه الصلاحية مخصصة لمالك التطبيق فقط' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, status: 'ready', timestamp: new Date().toISOString() });
  });

  // Public settings (app name + custom icon)
  app.get('/api/settings', (_req, res) => {
    res.json(getSettings());
  });

  app.put('/api/settings/icon', requireAuth, requireOwner, (req: AuthRequest, res) => {
    const { iconDataUrl } = req.body as { iconDataUrl?: string };
    if (typeof iconDataUrl !== 'string') {
      res.status(400).json({ error: 'بيانات الصورة غير صالحة' });
      return;
    }
    setSetting('app_icon_url', iconDataUrl);
    res.json({ ok: true, app_icon_url: iconDataUrl });
  });

  // Direct Android APK Project Kit download URL
  app.get('/api/download/apk-kit', async (req, res) => {
    try {
      const queryUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      const envUrl =
        process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' ? process.env.APP_URL : '';
      const host = req.get('host') || 'localhost:3000';
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const fallbackUrl = envUrl || `${proto}://${host}`;
      const targetUrl = /^https?:\/\//i.test(queryUrl) ? queryUrl : fallbackUrl;

      const settings = getSettings();
      const buffer = await buildAndroidApkKitBuffer(targetUrl, settings.app_icon_url);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Walid-Customs-Android-APK-Kit.zip"'
      );
      res.send(buffer);
    } catch (err) {
      console.error('APK kit download error:', err);
      res.status(500).json({ error: 'تعذر تجهيز حزمة بناء APK' });
    }
  });

  // Authentication Routes
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
      return;
    }
    const user = findUserByCredentials(username, password);
    if (!user) {
      res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      return;
    }
    const token = createSession(user.id);
    res.json({ token, user });
  });

  app.post('/api/auth/register', (req, res) => {
    const { username, displayName, password } = req.body as {
      username?: string;
      displayName?: string;
      password?: string;
    };
    if (!username || !password || username.trim().length < 3 || password.length < 4) {
      res.status(400).json({ error: 'اسم المستخدم يجب أن لا يقل عن 3 أحرف وكلمة المرور 4 أحرف على الأقل' });
      return;
    }
    try {
      const user = registerUser(username, displayName || username, password);
      const token = createSession(user.id);
      res.status(201).json({ token, user });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : 'تعذر إنشاء الحساب' });
    }
  });

  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    res.json({ user: req.user });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthRequest, res) => {
    if (req.token) deleteSession(req.token);
    res.json({ ok: true });
  });

  app.post('/api/auth/biometric/register', requireAuth, (req: AuthRequest, res) => {
    const { biometricType, webauthnCredId, biometricSecret } = req.body as {
      biometricType: 'fingerprint' | 'face' | 'both';
      webauthnCredId?: string | null;
      biometricSecret: string;
    };
    if (!req.user || !biometricSecret) {
      res.status(400).json({ error: 'بيانات البصمة غير مكتملة' });
      return;
    }
    const updatedUser = saveUserBiometric(req.user.id, biometricType || 'both', webauthnCredId || null, biometricSecret);
    res.json({ user: updatedUser });
  });

  app.post('/api/auth/biometric/login', (req, res) => {
    const { username, biometricSecret, webauthnCredId } = req.body as {
      username?: string;
      biometricSecret?: string;
      webauthnCredId?: string;
    };
    if (!username || !biometricSecret) {
      res.status(400).json({ error: 'يرجى تحديد الحساب للتحقق البيومتري' });
      return;
    }
    const user = loginWithBiometric(username, biometricSecret, webauthnCredId);
    if (!user) {
      res.status(401).json({ error: 'فشل التحقق من البصمة أو الوجه لهذا الحساب' });
      return;
    }
    const token = createSession(user.id);
    res.json({ token, user });
  });

  app.post('/api/auth/biometric/disable', requireAuth, (req: AuthRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً' });
      return;
    }
    const updatedUser = disableUserBiometric(req.user.id);
    res.json({ user: updatedUser });
  });

  // User Management (Owner Only)
  app.get('/api/users', requireAuth, requireOwner, (_req, res) => {
    res.json({ users: listAllUsers() });
  });

  app.patch('/api/users/:id/role', requireAuth, requireOwner, (req: AuthRequest, res) => {
    const { role } = req.body as { role?: 'owner' | 'user' };
    if (role !== 'owner' && role !== 'user') {
      res.status(400).json({ error: 'صلاحية غير صالحة' });
      return;
    }
    if (req.params.id === req.user?.id && role !== 'owner') {
      res.status(400).json({ error: 'لا يمكنك إزالة صلاحية المالك عن حسابك الحالي' });
      return;
    }
    const updated = updateUserRole(req.params.id, role);
    if (!updated) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }
    res.json({ user: updated });
  });

  app.delete('/api/users/:id', requireAuth, requireOwner, (req: AuthRequest, res) => {
    if (req.params.id === req.user?.id) {
      res.status(400).json({ error: 'لا يمكن حذف حسابك الحالي' });
      return;
    }
    deleteUserById(req.params.id);
    res.json({ ok: true });
  });

  // Customs Items Routes
  app.get('/api/items', requireAuth, (_req, res) => {
    res.json({ items: listItems() });
  });

  app.post('/api/items', requireAuth, requireOwner, (req: AuthRequest, res) => {
    const { items, item } = req.body as { items?: CustomsItemInput[]; item?: CustomsItemInput };
    const payload = items ?? (item ? [item] : []);
    if (!Array.isArray(payload) || payload.length === 0) {
      res.status(400).json({ error: 'لا توجد أصناف صالحة للإضافة' });
      return;
    }
    const valid = payload.filter((row) => String(row.productName || '').trim().length > 0);
    if (valid.length === 0) {
      res.status(400).json({ error: 'اسم المنتج مطلوب لكل صنف' });
      return;
    }
    const created = insertItems(valid, req.user!.id);
    res.status(201).json({ items: created });
  });

  app.put('/api/items/:id', requireAuth, requireOwner, (req, res) => {
    const body = req.body as CustomsItemInput;
    if (!body || !String(body.productName || '').trim()) {
      res.status(400).json({ error: 'اسم المنتج مطلوب' });
      return;
    }
    const updated = updateItem(req.params.id, body);
    if (!updated) {
      res.status(404).json({ error: 'الصنف غير موجود' });
      return;
    }
    res.json({ item: updated });
  });

  app.delete('/api/items/:id', requireAuth, requireOwner, (req, res) => {
    const ok = deleteItem(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'الصنف غير موجود' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/items/bulk-delete', requireAuth, requireOwner, (req, res) => {
    const { ids } = req.body as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'لم يتم تحديد أصناف للحذف' });
      return;
    }
    const deletedCount = deleteItemsBulk(ids);
    res.json({ deletedCount });
  });

  // Gemini AI Routes
  app.post('/api/ai/parse-pdf', requireAuth, requireOwner, async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body as { base64Data?: string; mimeType?: string };
      if (!base64Data || !mimeType) {
        res.status(400).json({ error: 'يرجى إرفاق ملف PDF أو صورة صالحة' });
        return;
      }
      const rows = await parseCustomsDocumentWithGemini(base64Data, mimeType);
      res.json({ items: rows });
    } catch (err) {
      console.error('Gemini PDF parse error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'حدث خطأ أثناء تحليل الملف بالذكاء الاصطناعي',
      });
    }
  });

  app.post('/api/ai/suggest-fields', requireAuth, requireOwner, async (req, res) => {
    try {
      const { productName } = req.body as { productName?: string };
      if (!productName) {
        res.status(400).json({ error: 'يرجى كتابة اسم المنتج أولاً' });
        return;
      }
      const suggestion = await suggestItemFieldsWithGemini(productName);
      res.json({ suggestion });
    } catch (err) {
      console.error('Gemini suggest error:', err);
      res.status(500).json({ error: 'تعذر الحصول على اقتراحات الذكاء الاصطناعي' });
    }
  });

  app.post('/api/ai/assistant', requireAuth, async (req, res) => {
    try {
      const { mode, query, items } = req.body as {
        mode: 'analyze' | 'hs_lookup' | 'chat';
        query: string;
        items: any[];
      };
      const answer = await runCustomsAiAssistant(mode || 'chat', query || '', Array.isArray(items) ? items : []);
      res.json({ answer });
    } catch (err) {
      console.error('Gemini assistant error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'تعذر الاتصال بمساعد الذكاء الاصطناعي',
      });
    }
  });

  // Vite Dev Middleware or Static Production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Customs Valuation Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

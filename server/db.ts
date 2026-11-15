import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { CustomsItem, CustomsItemInput, User, UserRole } from '../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'customs.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

function runInTransaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('owner', 'user')),
    biometric_enabled INTEGER NOT NULL DEFAULT 0,
    biometric_type TEXT,
    biometric_token_hash TEXT,
    webauthn_cred_id TEXT,
    face_signature TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customs_items (
    id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    brand TEXT NOT NULL DEFAULT '',
    origin_country TEXT NOT NULL DEFAULT '',
    size_or_measure TEXT NOT NULL DEFAULT '',
    barcode TEXT NOT NULL DEFAULT '',
    hs_code TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    package_type TEXT NOT NULL DEFAULT '',
    declaration_number TEXT NOT NULL DEFAULT '',
    declaration_date TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(derived, 'hex'));
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function seedDatabase() {
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    const now = new Date().toISOString();
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, role, biometric_enabled, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);
    insertUser.run('owner-walid', 'walid', 'وليد الراشد (المالك)', hashPassword('Walid@2026'), 'owner', now);
    insertUser.run('user-searcher', 'searcher', 'مستخدم البحث', hashPassword('123456'), 'user', now);
  }

  const settingCount = (db.prepare('SELECT COUNT(*) as c FROM app_settings').get() as { c: number }).c;
  if (settingCount === 0) {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(
      'app_name',
      'نظام القيمة الجمركية - وليد الراشد'
    );
  }

  const itemCount = (db.prepare('SELECT COUNT(*) as c FROM customs_items').get() as { c: number }).c;
  if (itemCount === 0) {
    const now = new Date().toISOString();
    const seedItems: CustomsItemInput[] = [
      {
        productName: 'شاشة تلفزيون ذكية 4K UHD',
        category: 'إلكترونيات وأجهزة مرئية',
        brand: 'Samsung',
        originCountry: 'كوريا الجنوبية',
        sizeOrMeasure: '65 بوصة',
        barcode: '8806094987654',
        hsCode: '85287200',
        price: 545.0,
        currency: 'USD',
        packageType: 'كرتون مقوى',
        declarationNumber: 'DEC-2026-10482',
        declarationDate: '2026-09-12',
        notes: 'قيمة معتمدة وفق فاتورة المصنع الأصلية',
      },
      {
        productName: 'مكيف سبليت انفرتر موفر للطاقة',
        category: 'أجهزة تبريد وتكييف',
        brand: 'Gree',
        originCountry: 'الصين',
        sizeOrMeasure: '18000 وحدة BTU',
        barcode: '6954128901123',
        hsCode: '84151000',
        price: 312.5,
        currency: 'USD',
        packageType: 'قطعتان داخلية وخارجية بالكرتون',
        declarationNumber: 'DEC-2026-10519',
        declarationDate: '2026-09-18',
        notes: 'شامل شهادة مطابقة كفاءة الطاقة',
      },
      {
        productName: 'زيت زيتون بكر ممتاز معصور على البارد',
        category: 'مواد غذائية وزيوت',
        brand: 'Borges',
        originCountry: 'إسبانيا',
        sizeOrMeasure: '1 لتر × 12 عبوة',
        barcode: '8410179012345',
        hsCode: '15092000',
        price: 84.0,
        currency: 'EUR',
        packageType: 'كرتون زجاجات',
        declarationNumber: 'DEC-2026-10604',
        declarationDate: '2026-09-25',
        notes: 'سعر الكرتون بالجملة - فحص مخبري مطابق',
      },
      {
        productName: 'إطارات سيارات ركاب تيوبلس',
        category: 'قطع غيار وإطارات',
        brand: 'Michelin',
        originCountry: 'فرنسا',
        sizeOrMeasure: '225/55 R17',
        barcode: '3528704561239',
        hsCode: '40111000',
        price: 118.0,
        currency: 'USD',
        packageType: 'تغليف فردي مشدود',
        declarationNumber: 'DEC-2026-10711',
        declarationDate: '2026-10-02',
        notes: 'تاريخ الإنتاج حديث 2026',
      },
      {
        productName: 'غسالة ملابس أوتوماتيك تحميل أمامي',
        category: 'أجهزة منزلية كهربائية',
        brand: 'LG',
        originCountry: 'فيتنام',
        sizeOrMeasure: '10 كجم',
        barcode: '8806087112233',
        hsCode: '84501100',
        price: 389.0,
        currency: 'USD',
        packageType: 'كرتون محمي بالفوم',
        declarationNumber: 'DEC-2026-10790',
        declarationDate: '2026-10-08',
        notes: 'محرك دفع مباشر - شحن بحري',
      },
      {
        productName: 'حليب أطفال مجفف مدعم بالحديد المرحلة الأولى',
        category: 'أغذية أطفال وألبان',
        brand: 'Aptamil',
        originCountry: 'أيرلندا',
        sizeOrMeasure: '800 جم × 6 علب',
        barcode: '5051594001122',
        hsCode: '19011000',
        price: 92.4,
        currency: 'USD',
        packageType: 'كرتون علب معدنية',
        declarationNumber: 'DEC-2026-10833',
        declarationDate: '2026-10-14',
        notes: 'معفى وفق شهادة المنشأ الصحية',
      },
      {
        productName: 'عطر رجالي مركز أو دو بارفان',
        category: 'عطور ومستحضرات تجميل',
        brand: 'Dior',
        originCountry: 'فرنسا',
        sizeOrMeasure: '100 مل',
        barcode: '3348901486385',
        hsCode: '33030010',
        price: 76.0,
        currency: 'EUR',
        packageType: 'علبة أصلية مغلفة سيلوفان',
        declarationNumber: 'DEC-2026-10912',
        declarationDate: '2026-10-19',
        notes: 'قيمة استرشادية لمستورد معتمد',
      },
      {
        productName: 'لابتوب أعمال معالج Core i7 ذاكرة 16 جيجا',
        category: 'حواسيب وتقنية معلومات',
        brand: 'Dell',
        originCountry: 'الصين',
        sizeOrMeasure: '14 بوصة / 1.35 كجم',
        barcode: '8841164298761',
        hsCode: '84713000',
        price: 790.0,
        currency: 'USD',
        packageType: 'كرتون مصنع أصلي',
        declarationNumber: 'DEC-2026-11005',
        declarationDate: '2026-10-22',
        notes: 'يشمل شاحن أصلي وضمان دولي',
      },
      {
        productName: 'أرز بسمتي هندي حبة طويلة معتق',
        category: 'مواد غذائية وحبوب',
        brand: 'Daawat',
        originCountry: 'الهند',
        sizeOrMeasure: '10 كجم × 4 أكياس',
        barcode: '8901537010203',
        hsCode: '10063020',
        price: 46.5,
        currency: 'USD',
        packageType: 'ربطة أكياس منسوجة',
        declarationNumber: 'DEC-2026-11088',
        declarationDate: '2026-10-27',
        notes: 'حصاد الموسم الحالي - حاوية 40 قدم',
      },
      {
        productName: 'بطارية سيارة جافة خالية من الصيانة',
        category: 'قطع غيار سيارات',
        brand: 'Hankook',
        originCountry: 'كوريا الجنوبية',
        sizeOrMeasure: '70 أمبير / 12 فولت',
        barcode: '8809123456701',
        hsCode: '85071000',
        price: 58.0,
        currency: 'USD',
        packageType: 'طبلية خشبية مغلفة',
        declarationNumber: 'DEC-2026-11140',
        declarationDate: '2026-11-01',
        notes: 'بضاعة خطرة فئة 8 - مناولة خاصة',
      },
      {
        productName: 'قماش قطني 100% ساده مخصص للخياطة',
        category: 'منسوجات وأقمشة',
        brand: 'Toyobo',
        originCountry: 'اليابان',
        sizeOrMeasure: 'رول 50 ياردة عرض 58 إنش',
        barcode: '4901234981122',
        hsCode: '52081200',
        price: 215.0,
        currency: 'USD',
        packageType: 'رول ملفوف نايلون',
        declarationNumber: 'DEC-2026-11201',
        declarationDate: '2026-11-05',
        notes: 'درجة أولى - بدون عيوب نسيج',
      },
      {
        productName: 'ماكينة تحضير قهوة اسبريسو أوتوماتيكية',
        category: 'أجهزة مطبخ كهربائية',
        brand: 'DeLonghi',
        originCountry: 'إيطاليا',
        sizeOrMeasure: '15 بار / خزان 1.8 لتر',
        barcode: '8004399331234',
        hsCode: '85167100',
        price: 340.0,
        currency: 'EUR',
        packageType: 'كرتون ملون مع حماية داخلية',
        declarationNumber: 'DEC-2026-11260',
        declarationDate: '2026-11-10',
        notes: 'تطابق مرجع التسعير الأوروبي',
      },
    ];

    const insertItem = db.prepare(`
      INSERT INTO customs_items (
        id, product_name, category, brand, origin_country, size_or_measure,
        barcode, hs_code, price, currency, package_type,
        declaration_number, declaration_date, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    runInTransaction(() => {
      for (const item of seedItems) {
        insertItem.run(
          crypto.randomUUID(),
          item.productName,
          item.category,
          item.brand,
          item.originCountry,
          item.sizeOrMeasure,
          item.barcode,
          item.hsCode,
          item.price,
          item.currency,
          item.packageType,
          item.declarationNumber,
          item.declarationDate,
          item.notes,
          'owner-walid',
          now,
          now
        );
      }
    });
  }
}

seedDatabase();

interface DbUserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  biometric_enabled: number;
  biometric_type: 'fingerprint' | 'face' | 'both' | null;
  biometric_token_hash: string | null;
  webauthn_cred_id: string | null;
  face_signature: string | null;
  created_at: string;
}

function mapUser(row: DbUserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    biometricEnabled: Boolean(row.biometric_enabled),
    biometricType: row.biometric_type,
    webauthnCredId: row.webauthn_cred_id,
    createdAt: row.created_at,
  };
}

interface DbItemRow {
  id: string;
  product_name: string;
  category: string;
  brand: string;
  origin_country: string;
  size_or_measure: string;
  barcode: string;
  hs_code: string;
  price: number;
  currency: string;
  package_type: string;
  declaration_number: string;
  declaration_date: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

function mapItem(row: DbItemRow): CustomsItem {
  return {
    id: row.id,
    productName: row.product_name,
    category: row.category,
    brand: row.brand,
    originCountry: row.origin_country,
    sizeOrMeasure: row.size_or_measure,
    barcode: row.barcode,
    hsCode: row.hs_code,
    price: row.price,
    currency: row.currency,
    packageType: row.package_type,
    declarationNumber: row.declaration_number,
    declarationDate: row.declaration_date,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    hashToken(token),
    userId,
    expiresAt
  );
  return token;
}

export function getUserBySessionToken(token: string): User | null {
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(hashToken(token), new Date().toISOString()) as DbUserRow | undefined;
  return row ? mapUser(row) : null;
}

export function deleteSession(token: string) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(hashToken(token));
}

export function findUserByCredentials(username: string, password: string): User | null {
  const clean = username.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(clean) as DbUserRow | undefined;
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return mapUser(row);
}

export function registerUser(username: string, displayName: string, password: string): User {
  const clean = username.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(clean);
  if (existing) {
    throw new Error('اسم المستخدم مسجل مسبقاً');
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, role, biometric_enabled, created_at)
     VALUES (?, ?, ?, ?, 'user', 0, ?)`
  ).run(id, clean, displayName.trim() || clean, hashPassword(password), now);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as DbUserRow;
  return mapUser(row);
}

export function saveUserBiometric(
  userId: string,
  biometricType: 'fingerprint' | 'face' | 'both',
  webauthnCredId: string | null,
  biometricSecret: string
): User {
  db.prepare(
    `UPDATE users SET biometric_enabled = 1, biometric_type = ?, webauthn_cred_id = ?, biometric_token_hash = ? WHERE id = ?`
  ).run(biometricType, webauthnCredId, hashToken(biometricSecret), userId);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as DbUserRow;
  return mapUser(row);
}

export function loginWithBiometric(username: string, biometricSecret: string, webauthnCredId?: string): User | null {
  const clean = username.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE username = ? AND biometric_enabled = 1').get(clean) as
    | DbUserRow
    | undefined;
  if (!row) return null;

  const secretMatches = row.biometric_token_hash && row.biometric_token_hash === hashToken(biometricSecret);
  const credMatches = webauthnCredId && row.webauthn_cred_id && row.webauthn_cred_id === webauthnCredId;
  if (!secretMatches && !credMatches) return null;

  return mapUser(row);
}

export function disableUserBiometric(userId: string): User {
  db.prepare(
    `UPDATE users SET biometric_enabled = 0, biometric_type = NULL, webauthn_cred_id = NULL, biometric_token_hash = NULL WHERE id = ?`
  ).run(userId);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as DbUserRow;
  return mapUser(row);
}

export function listAllUsers(): User[] {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as unknown as DbUserRow[];
  return rows.map(mapUser);
}

export function updateUserRole(userId: string, role: UserRole): User | null {
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as DbUserRow | undefined;
  return row ? mapUser(row) : null;
}

export function deleteUserById(userId: string) {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

export function getSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM app_settings').all() as Array<{ key: string; value: string }>;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function setSetting(key: string, value: string) {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

export function listItems(): CustomsItem[] {
  const rows = db.prepare('SELECT * FROM customs_items ORDER BY updated_at DESC, created_at DESC').all() as unknown as DbItemRow[];
  return rows.map(mapItem);
}

export function insertItems(items: CustomsItemInput[], createdBy: string): CustomsItem[] {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO customs_items (
      id, product_name, category, brand, origin_country, size_or_measure,
      barcode, hs_code, price, currency, package_type,
      declaration_number, declaration_date, notes, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertedIds: string[] = [];
  runInTransaction(() => {
    for (const item of items) {
      const id = crypto.randomUUID();
      stmt.run(
        id,
        String(item.productName || '').trim(),
        String(item.category || '').trim(),
        String(item.brand || '').trim(),
        String(item.originCountry || '').trim(),
        String(item.sizeOrMeasure || '').trim(),
        String(item.barcode || '').trim(),
        String(item.hsCode || '').trim(),
        Number(item.price) || 0,
        String(item.currency || 'USD').trim().toUpperCase(),
        String(item.packageType || '').trim(),
        String(item.declarationNumber || '').trim(),
        String(item.declarationDate || '').trim(),
        String(item.notes || '').trim(),
        createdBy,
        now,
        now
      );
      insertedIds.push(id);
    }
  });

  return insertedIds.map((id) => mapItem(db.prepare('SELECT * FROM customs_items WHERE id = ?').get(id) as unknown as DbItemRow));
}

export function updateItem(id: string, data: CustomsItemInput): CustomsItem | null {
  const now = new Date().toISOString();
  const res = db
    .prepare(
      `UPDATE customs_items SET
        product_name = ?, category = ?, brand = ?, origin_country = ?, size_or_measure = ?,
        barcode = ?, hs_code = ?, price = ?, currency = ?, package_type = ?,
        declaration_number = ?, declaration_date = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      String(data.productName || '').trim(),
      String(data.category || '').trim(),
      String(data.brand || '').trim(),
      String(data.originCountry || '').trim(),
      String(data.sizeOrMeasure || '').trim(),
      String(data.barcode || '').trim(),
      String(data.hsCode || '').trim(),
      Number(data.price) || 0,
      String(data.currency || 'USD').trim().toUpperCase(),
      String(data.packageType || '').trim(),
      String(data.declarationNumber || '').trim(),
      String(data.declarationDate || '').trim(),
      String(data.notes || '').trim(),
      now,
      id
    );
  if (Number(res.changes) === 0) return null;
  const row = db.prepare('SELECT * FROM customs_items WHERE id = ?').get(id) as unknown as DbItemRow;
  return mapItem(row);
}

export function deleteItem(id: string): boolean {
  const res = db.prepare('DELETE FROM customs_items WHERE id = ?').run(id);
  return Number(res.changes) > 0;
}

export function deleteItemsBulk(ids: string[]): number {
  if (ids.length === 0) return 0;
  const stmt = db.prepare('DELETE FROM customs_items WHERE id = ?');
  let count = 0;
  runInTransaction(() => {
    for (const id of ids) {
      count += Number(stmt.run(id).changes);
    }
  });
  return count;
}

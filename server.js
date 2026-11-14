// server.ts
import "dotenv/config";
import express from "express";
import path2 from "path";

// server/db.ts
import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
var DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
var DB_PATH = path.join(DATA_DIR, "customs.db");
var db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
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
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(derived, "hex"));
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function seedDatabase() {
  const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  if (userCount === 0) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, role, biometric_enabled, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);
    insertUser.run("owner-walid", "walid", "\u0648\u0644\u064A\u062F \u0627\u0644\u0631\u0627\u0634\u062F (\u0627\u0644\u0645\u0627\u0644\u0643)", hashPassword("Walid@2026"), "owner", now);
    insertUser.run("user-searcher", "searcher", "\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0628\u062D\u062B", hashPassword("123456"), "user", now);
  }
  const settingCount = db.prepare("SELECT COUNT(*) as c FROM app_settings").get().c;
  if (settingCount === 0) {
    db.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run(
      "app_name",
      "\u0646\u0638\u0627\u0645 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629 - \u0648\u0644\u064A\u062F \u0627\u0644\u0631\u0627\u0634\u062F"
    );
  }
  const itemCount = db.prepare("SELECT COUNT(*) as c FROM customs_items").get().c;
  if (itemCount === 0) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const seedItems = [
      {
        productName: "\u0634\u0627\u0634\u0629 \u062A\u0644\u0641\u0632\u064A\u0648\u0646 \u0630\u0643\u064A\u0629 4K UHD",
        category: "\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u0627\u062A \u0648\u0623\u062C\u0647\u0632\u0629 \u0645\u0631\u0626\u064A\u0629",
        brand: "Samsung",
        originCountry: "\u0643\u0648\u0631\u064A\u0627 \u0627\u0644\u062C\u0646\u0648\u0628\u064A\u0629",
        sizeOrMeasure: "65 \u0628\u0648\u0635\u0629",
        barcode: "8806094987654",
        hsCode: "85287200",
        price: 545,
        currency: "USD",
        packageType: "\u0643\u0631\u062A\u0648\u0646 \u0645\u0642\u0648\u0649",
        declarationNumber: "DEC-2026-10482",
        declarationDate: "2026-09-12",
        notes: "\u0642\u064A\u0645\u0629 \u0645\u0639\u062A\u0645\u062F\u0629 \u0648\u0641\u0642 \u0641\u0627\u062A\u0648\u0631\u0629 \u0627\u0644\u0645\u0635\u0646\u0639 \u0627\u0644\u0623\u0635\u0644\u064A\u0629"
      },
      {
        productName: "\u0645\u0643\u064A\u0641 \u0633\u0628\u0644\u064A\u062A \u0627\u0646\u0641\u0631\u062A\u0631 \u0645\u0648\u0641\u0631 \u0644\u0644\u0637\u0627\u0642\u0629",
        category: "\u0623\u062C\u0647\u0632\u0629 \u062A\u0628\u0631\u064A\u062F \u0648\u062A\u0643\u064A\u064A\u0641",
        brand: "Gree",
        originCountry: "\u0627\u0644\u0635\u064A\u0646",
        sizeOrMeasure: "18000 \u0648\u062D\u062F\u0629 BTU",
        barcode: "6954128901123",
        hsCode: "84151000",
        price: 312.5,
        currency: "USD",
        packageType: "\u0642\u0637\u0639\u062A\u0627\u0646 \u062F\u0627\u062E\u0644\u064A\u0629 \u0648\u062E\u0627\u0631\u062C\u064A\u0629 \u0628\u0627\u0644\u0643\u0631\u062A\u0648\u0646",
        declarationNumber: "DEC-2026-10519",
        declarationDate: "2026-09-18",
        notes: "\u0634\u0627\u0645\u0644 \u0634\u0647\u0627\u062F\u0629 \u0645\u0637\u0627\u0628\u0642\u0629 \u0643\u0641\u0627\u0621\u0629 \u0627\u0644\u0637\u0627\u0642\u0629"
      },
      {
        productName: "\u0632\u064A\u062A \u0632\u064A\u062A\u0648\u0646 \u0628\u0643\u0631 \u0645\u0645\u062A\u0627\u0632 \u0645\u0639\u0635\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0628\u0627\u0631\u062F",
        category: "\u0645\u0648\u0627\u062F \u063A\u0630\u0627\u0626\u064A\u0629 \u0648\u0632\u064A\u0648\u062A",
        brand: "Borges",
        originCountry: "\u0625\u0633\u0628\u0627\u0646\u064A\u0627",
        sizeOrMeasure: "1 \u0644\u062A\u0631 \xD7 12 \u0639\u0628\u0648\u0629",
        barcode: "8410179012345",
        hsCode: "15092000",
        price: 84,
        currency: "EUR",
        packageType: "\u0643\u0631\u062A\u0648\u0646 \u0632\u062C\u0627\u062C\u0627\u062A",
        declarationNumber: "DEC-2026-10604",
        declarationDate: "2026-09-25",
        notes: "\u0633\u0639\u0631 \u0627\u0644\u0643\u0631\u062A\u0648\u0646 \u0628\u0627\u0644\u062C\u0645\u0644\u0629 - \u0641\u062D\u0635 \u0645\u062E\u0628\u0631\u064A \u0645\u0637\u0627\u0628\u0642"
      },
      {
        productName: "\u0625\u0637\u0627\u0631\u0627\u062A \u0633\u064A\u0627\u0631\u0627\u062A \u0631\u0643\u0627\u0628 \u062A\u064A\u0648\u0628\u0644\u0633",
        category: "\u0642\u0637\u0639 \u063A\u064A\u0627\u0631 \u0648\u0625\u0637\u0627\u0631\u0627\u062A",
        brand: "Michelin",
        originCountry: "\u0641\u0631\u0646\u0633\u0627",
        sizeOrMeasure: "225/55 R17",
        barcode: "3528704561239",
        hsCode: "40111000",
        price: 118,
        currency: "USD",
        packageType: "\u062A\u063A\u0644\u064A\u0641 \u0641\u0631\u062F\u064A \u0645\u0634\u062F\u0648\u062F",
        declarationNumber: "DEC-2026-10711",
        declarationDate: "2026-10-02",
        notes: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0625\u0646\u062A\u0627\u062C \u062D\u062F\u064A\u062B 2026"
      },
      {
        productName: "\u063A\u0633\u0627\u0644\u0629 \u0645\u0644\u0627\u0628\u0633 \u0623\u0648\u062A\u0648\u0645\u0627\u062A\u064A\u0643 \u062A\u062D\u0645\u064A\u0644 \u0623\u0645\u0627\u0645\u064A",
        category: "\u0623\u062C\u0647\u0632\u0629 \u0645\u0646\u0632\u0644\u064A\u0629 \u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629",
        brand: "LG",
        originCountry: "\u0641\u064A\u062A\u0646\u0627\u0645",
        sizeOrMeasure: "10 \u0643\u062C\u0645",
        barcode: "8806087112233",
        hsCode: "84501100",
        price: 389,
        currency: "USD",
        packageType: "\u0643\u0631\u062A\u0648\u0646 \u0645\u062D\u0645\u064A \u0628\u0627\u0644\u0641\u0648\u0645",
        declarationNumber: "DEC-2026-10790",
        declarationDate: "2026-10-08",
        notes: "\u0645\u062D\u0631\u0643 \u062F\u0641\u0639 \u0645\u0628\u0627\u0634\u0631 - \u0634\u062D\u0646 \u0628\u062D\u0631\u064A"
      },
      {
        productName: "\u062D\u0644\u064A\u0628 \u0623\u0637\u0641\u0627\u0644 \u0645\u062C\u0641\u0641 \u0645\u062F\u0639\u0645 \u0628\u0627\u0644\u062D\u062F\u064A\u062F \u0627\u0644\u0645\u0631\u062D\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649",
        category: "\u0623\u063A\u0630\u064A\u0629 \u0623\u0637\u0641\u0627\u0644 \u0648\u0623\u0644\u0628\u0627\u0646",
        brand: "Aptamil",
        originCountry: "\u0623\u064A\u0631\u0644\u0646\u062F\u0627",
        sizeOrMeasure: "800 \u062C\u0645 \xD7 6 \u0639\u0644\u0628",
        barcode: "5051594001122",
        hsCode: "19011000",
        price: 92.4,
        currency: "USD",
        packageType: "\u0643\u0631\u062A\u0648\u0646 \u0639\u0644\u0628 \u0645\u0639\u062F\u0646\u064A\u0629",
        declarationNumber: "DEC-2026-10833",
        declarationDate: "2026-10-14",
        notes: "\u0645\u0639\u0641\u0649 \u0648\u0641\u0642 \u0634\u0647\u0627\u062F\u0629 \u0627\u0644\u0645\u0646\u0634\u0623 \u0627\u0644\u0635\u062D\u064A\u0629"
      },
      {
        productName: "\u0639\u0637\u0631 \u0631\u062C\u0627\u0644\u064A \u0645\u0631\u0643\u0632 \u0623\u0648 \u062F\u0648 \u0628\u0627\u0631\u0641\u0627\u0646",
        category: "\u0639\u0637\u0648\u0631 \u0648\u0645\u0633\u062A\u062D\u0636\u0631\u0627\u062A \u062A\u062C\u0645\u064A\u0644",
        brand: "Dior",
        originCountry: "\u0641\u0631\u0646\u0633\u0627",
        sizeOrMeasure: "100 \u0645\u0644",
        barcode: "3348901486385",
        hsCode: "33030010",
        price: 76,
        currency: "EUR",
        packageType: "\u0639\u0644\u0628\u0629 \u0623\u0635\u0644\u064A\u0629 \u0645\u063A\u0644\u0641\u0629 \u0633\u064A\u0644\u0648\u0641\u0627\u0646",
        declarationNumber: "DEC-2026-10912",
        declarationDate: "2026-10-19",
        notes: "\u0642\u064A\u0645\u0629 \u0627\u0633\u062A\u0631\u0634\u0627\u062F\u064A\u0629 \u0644\u0645\u0633\u062A\u0648\u0631\u062F \u0645\u0639\u062A\u0645\u062F"
      },
      {
        productName: "\u0644\u0627\u0628\u062A\u0648\u0628 \u0623\u0639\u0645\u0627\u0644 \u0645\u0639\u0627\u0644\u062C Core i7 \u0630\u0627\u0643\u0631\u0629 16 \u062C\u064A\u062C\u0627",
        category: "\u062D\u0648\u0627\u0633\u064A\u0628 \u0648\u062A\u0642\u0646\u064A\u0629 \u0645\u0639\u0644\u0648\u0645\u0627\u062A",
        brand: "Dell",
        originCountry: "\u0627\u0644\u0635\u064A\u0646",
        sizeOrMeasure: "14 \u0628\u0648\u0635\u0629 / 1.35 \u0643\u062C\u0645",
        barcode: "8841164298761",
        hsCode: "84713000",
        price: 790,
        currency: "USD",
        packageType: "\u0643\u0631\u062A\u0648\u0646 \u0645\u0635\u0646\u0639 \u0623\u0635\u0644\u064A",
        declarationNumber: "DEC-2026-11005",
        declarationDate: "2026-10-22",
        notes: "\u064A\u0634\u0645\u0644 \u0634\u0627\u062D\u0646 \u0623\u0635\u0644\u064A \u0648\u0636\u0645\u0627\u0646 \u062F\u0648\u0644\u064A"
      },
      {
        productName: "\u0623\u0631\u0632 \u0628\u0633\u0645\u062A\u064A \u0647\u0646\u062F\u064A \u062D\u0628\u0629 \u0637\u0648\u064A\u0644\u0629 \u0645\u0639\u062A\u0642",
        category: "\u0645\u0648\u0627\u062F \u063A\u0630\u0627\u0626\u064A\u0629 \u0648\u062D\u0628\u0648\u0628",
        brand: "Daawat",
        originCountry: "\u0627\u0644\u0647\u0646\u062F",
        sizeOrMeasure: "10 \u0643\u062C\u0645 \xD7 4 \u0623\u0643\u064A\u0627\u0633",
        barcode: "8901537010203",
        hsCode: "10063020",
        price: 46.5,
        currency: "USD",
        packageType: "\u0631\u0628\u0637\u0629 \u0623\u0643\u064A\u0627\u0633 \u0645\u0646\u0633\u0648\u062C\u0629",
        declarationNumber: "DEC-2026-11088",
        declarationDate: "2026-10-27",
        notes: "\u062D\u0635\u0627\u062F \u0627\u0644\u0645\u0648\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u064A - \u062D\u0627\u0648\u064A\u0629 40 \u0642\u062F\u0645"
      },
      {
        productName: "\u0628\u0637\u0627\u0631\u064A\u0629 \u0633\u064A\u0627\u0631\u0629 \u062C\u0627\u0641\u0629 \u062E\u0627\u0644\u064A\u0629 \u0645\u0646 \u0627\u0644\u0635\u064A\u0627\u0646\u0629",
        category: "\u0642\u0637\u0639 \u063A\u064A\u0627\u0631 \u0633\u064A\u0627\u0631\u0627\u062A",
        brand: "Hankook",
        originCountry: "\u0643\u0648\u0631\u064A\u0627 \u0627\u0644\u062C\u0646\u0648\u0628\u064A\u0629",
        sizeOrMeasure: "70 \u0623\u0645\u0628\u064A\u0631 / 12 \u0641\u0648\u0644\u062A",
        barcode: "8809123456701",
        hsCode: "85071000",
        price: 58,
        currency: "USD",
        packageType: "\u0637\u0628\u0644\u064A\u0629 \u062E\u0634\u0628\u064A\u0629 \u0645\u063A\u0644\u0641\u0629",
        declarationNumber: "DEC-2026-11140",
        declarationDate: "2026-11-01",
        notes: "\u0628\u0636\u0627\u0639\u0629 \u062E\u0637\u0631\u0629 \u0641\u0626\u0629 8 - \u0645\u0646\u0627\u0648\u0644\u0629 \u062E\u0627\u0635\u0629"
      },
      {
        productName: "\u0642\u0645\u0627\u0634 \u0642\u0637\u0646\u064A 100% \u0633\u0627\u062F\u0647 \u0645\u062E\u0635\u0635 \u0644\u0644\u062E\u064A\u0627\u0637\u0629",
        category: "\u0645\u0646\u0633\u0648\u062C\u0627\u062A \u0648\u0623\u0642\u0645\u0634\u0629",
        brand: "Toyobo",
        originCountry: "\u0627\u0644\u064A\u0627\u0628\u0627\u0646",
        sizeOrMeasure: "\u0631\u0648\u0644 50 \u064A\u0627\u0631\u062F\u0629 \u0639\u0631\u0636 58 \u0625\u0646\u0634",
        barcode: "4901234981122",
        hsCode: "52081200",
        price: 215,
        currency: "USD",
        packageType: "\u0631\u0648\u0644 \u0645\u0644\u0641\u0648\u0641 \u0646\u0627\u064A\u0644\u0648\u0646",
        declarationNumber: "DEC-2026-11201",
        declarationDate: "2026-11-05",
        notes: "\u062F\u0631\u062C\u0629 \u0623\u0648\u0644\u0649 - \u0628\u062F\u0648\u0646 \u0639\u064A\u0648\u0628 \u0646\u0633\u064A\u062C"
      },
      {
        productName: "\u0645\u0627\u0643\u064A\u0646\u0629 \u062A\u062D\u0636\u064A\u0631 \u0642\u0647\u0648\u0629 \u0627\u0633\u0628\u0631\u064A\u0633\u0648 \u0623\u0648\u062A\u0648\u0645\u0627\u062A\u064A\u0643\u064A\u0629",
        category: "\u0623\u062C\u0647\u0632\u0629 \u0645\u0637\u0628\u062E \u0643\u0647\u0631\u0628\u0627\u0626\u064A\u0629",
        brand: "DeLonghi",
        originCountry: "\u0625\u064A\u0637\u0627\u0644\u064A\u0627",
        sizeOrMeasure: "15 \u0628\u0627\u0631 / \u062E\u0632\u0627\u0646 1.8 \u0644\u062A\u0631",
        barcode: "8004399331234",
        hsCode: "85167100",
        price: 340,
        currency: "EUR",
        packageType: "\u0643\u0631\u062A\u0648\u0646 \u0645\u0644\u0648\u0646 \u0645\u0639 \u062D\u0645\u0627\u064A\u0629 \u062F\u0627\u062E\u0644\u064A\u0629",
        declarationNumber: "DEC-2026-11260",
        declarationDate: "2026-11-10",
        notes: "\u062A\u0637\u0627\u0628\u0642 \u0645\u0631\u062C\u0639 \u0627\u0644\u062A\u0633\u0639\u064A\u0631 \u0627\u0644\u0623\u0648\u0631\u0648\u0628\u064A"
      }
    ];
    const insertItem = db.prepare(`
      INSERT INTO customs_items (
        id, product_name, category, brand, origin_country, size_or_measure,
        barcode, hs_code, price, currency, package_type,
        declaration_number, declaration_date, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = db.transaction((items) => {
      for (const item of items) {
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
          "owner-walid",
          now,
          now
        );
      }
    });
    tx(seedItems);
  }
}
seedDatabase();
function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    biometricEnabled: Boolean(row.biometric_enabled),
    biometricType: row.biometric_type,
    webauthnCredId: row.webauthn_cred_id,
    createdAt: row.created_at
  };
}
function mapItem(row) {
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
    updatedAt: row.updated_at
  };
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 1e3 * 60 * 60 * 24 * 30).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    expiresAt
  );
  return token;
}
function getUserBySessionToken(token) {
  const row = db.prepare(
    `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
  ).get(hashToken(token), (/* @__PURE__ */ new Date()).toISOString());
  return row ? mapUser(row) : null;
}
function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(hashToken(token));
}
function findUserByCredentials(username, password) {
  const clean = username.trim().toLowerCase();
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(clean);
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return mapUser(row);
}
function registerUser(username, displayName, password) {
  const clean = username.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(clean);
  if (existing) {
    throw new Error("\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B");
  }
  const id = crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, role, biometric_enabled, created_at)
     VALUES (?, ?, ?, ?, 'user', 0, ?)`
  ).run(id, clean, displayName.trim() || clean, hashPassword(password), now);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return mapUser(row);
}
function saveUserBiometric(userId, biometricType, webauthnCredId, biometricSecret) {
  db.prepare(
    `UPDATE users SET biometric_enabled = 1, biometric_type = ?, webauthn_cred_id = ?, biometric_token_hash = ? WHERE id = ?`
  ).run(biometricType, webauthnCredId, hashToken(biometricSecret), userId);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  return mapUser(row);
}
function loginWithBiometric(username, biometricSecret, webauthnCredId) {
  const clean = username.trim().toLowerCase();
  const row = db.prepare("SELECT * FROM users WHERE username = ? AND biometric_enabled = 1").get(clean);
  if (!row) return null;
  const secretMatches = row.biometric_token_hash && row.biometric_token_hash === hashToken(biometricSecret);
  const credMatches = webauthnCredId && row.webauthn_cred_id && row.webauthn_cred_id === webauthnCredId;
  if (!secretMatches && !credMatches) return null;
  return mapUser(row);
}
function listAllUsers() {
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at ASC").all();
  return rows.map(mapUser);
}
function updateUserRole(userId, role) {
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, userId);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  return row ? mapUser(row) : null;
}
function deleteUserById(userId) {
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
}
function getSettings() {
  const rows = db.prepare("SELECT key, value FROM app_settings").all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
function setSetting(key, value) {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}
function listItems() {
  const rows = db.prepare("SELECT * FROM customs_items ORDER BY updated_at DESC, created_at DESC").all();
  return rows.map(mapItem);
}
function insertItems(items, createdBy) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const stmt = db.prepare(`
    INSERT INTO customs_items (
      id, product_name, category, brand, origin_country, size_or_measure,
      barcode, hs_code, price, currency, package_type,
      declaration_number, declaration_date, notes, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertedIds = [];
  const tx = db.transaction((list) => {
    for (const item of list) {
      const id = crypto.randomUUID();
      stmt.run(
        id,
        String(item.productName || "").trim(),
        String(item.category || "").trim(),
        String(item.brand || "").trim(),
        String(item.originCountry || "").trim(),
        String(item.sizeOrMeasure || "").trim(),
        String(item.barcode || "").trim(),
        String(item.hsCode || "").trim(),
        Number(item.price) || 0,
        String(item.currency || "USD").trim().toUpperCase(),
        String(item.packageType || "").trim(),
        String(item.declarationNumber || "").trim(),
        String(item.declarationDate || "").trim(),
        String(item.notes || "").trim(),
        createdBy,
        now,
        now
      );
      insertedIds.push(id);
    }
  });
  tx(items);
  return insertedIds.map((id) => mapItem(db.prepare("SELECT * FROM customs_items WHERE id = ?").get(id)));
}
function updateItem(id, data) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const res = db.prepare(
    `UPDATE customs_items SET
        product_name = ?, category = ?, brand = ?, origin_country = ?, size_or_measure = ?,
        barcode = ?, hs_code = ?, price = ?, currency = ?, package_type = ?,
        declaration_number = ?, declaration_date = ?, notes = ?, updated_at = ?
       WHERE id = ?`
  ).run(
    String(data.productName || "").trim(),
    String(data.category || "").trim(),
    String(data.brand || "").trim(),
    String(data.originCountry || "").trim(),
    String(data.sizeOrMeasure || "").trim(),
    String(data.barcode || "").trim(),
    String(data.hsCode || "").trim(),
    Number(data.price) || 0,
    String(data.currency || "USD").trim().toUpperCase(),
    String(data.packageType || "").trim(),
    String(data.declarationNumber || "").trim(),
    String(data.declarationDate || "").trim(),
    String(data.notes || "").trim(),
    now,
    id
  );
  if (res.changes === 0) return null;
  const row = db.prepare("SELECT * FROM customs_items WHERE id = ?").get(id);
  return mapItem(row);
}
function deleteItem(id) {
  const res = db.prepare("DELETE FROM customs_items WHERE id = ?").run(id);
  return res.changes > 0;
}
function deleteItemsBulk(ids) {
  if (ids.length === 0) return 0;
  const stmt = db.prepare("DELETE FROM customs_items WHERE id = ?");
  let count = 0;
  const tx = db.transaction((list) => {
    for (const id of list) {
      count += stmt.run(id).changes;
    }
  });
  tx(ids);
  return count;
}

// server/gemini.ts
import { GoogleGenAI, Type } from "@google/genai";
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("\u0645\u0641\u062A\u0627\u062D GEMINI_API_KEY \u063A\u064A\u0631 \u0645\u0647\u064A\u0623 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
async function parseCustomsDocumentWithGemini(base64Data, mimeType) {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        },
        {
          text: `\u0627\u0633\u062A\u062E\u0631\u062C \u062C\u0645\u064A\u0639 \u0623\u0635\u0646\u0627\u0641 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0628\u062F\u0642\u0629 \u062A\u0627\u0645\u0629 \u0648\u062D\u0648\u0651\u0644\u0647\u0627 \u0625\u0644\u0649 \u0645\u0635\u0641\u0648\u0641\u0629 JSON.
\u0643\u0644 \u0635\u0646\u0641 \u064A\u062C\u0628 \u0623\u0646 \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0640 13 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0628\u0627\u0644\u0636\u0628\u0637:
1. productName: \u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C
2. category: \u0627\u0644\u0635\u0646\u0641 \u0623\u0648 \u0627\u0644\u0641\u0626\u0629
3. brand: \u0627\u0644\u0645\u0627\u0631\u0643\u0629 \u0623\u0648 \u0627\u0644\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u062A\u062C\u0627\u0631\u064A\u0629
4. originCountry: \u0628\u0644\u062F \u0627\u0644\u0645\u0646\u0634\u0623
5. sizeOrMeasure: \u0627\u0644\u062D\u062C\u0645 \u0623\u0648 \u0627\u0644\u0642\u064A\u0627\u0633 \u0623\u0648 \u0627\u0644\u0648\u0632\u0646
6. barcode: \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F (\u0625\u0646 \u0648\u062C\u062F \u0648\u0625\u0644\u0627 \u0646\u0635 \u0641\u0627\u0631\u063A)
7. hsCode: \u0627\u0644\u0628\u0646\u062F \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u064A \u0627\u0644\u062C\u0645\u0631\u0643\u064A (HS Code)
8. price: \u0627\u0644\u0633\u0639\u0631 \u0643\u0631\u0642\u0645 (number)
9. currency: \u0631\u0645\u0632 \u0627\u0644\u0639\u0645\u0644\u0629 \u0645\u062B\u0644 USD \u0623\u0648 SAR \u0623\u0648 EUR \u0623\u0648 AED
10. packageType: \u0646\u0648\u0639 \u0627\u0644\u0639\u0628\u0648\u0629 \u0623\u0648 \u0627\u0644\u062A\u063A\u0644\u064A\u0641
11. declarationNumber: \u0631\u0642\u0645 \u0627\u0644\u0628\u064A\u0627\u0646 \u0627\u0644\u062C\u0645\u0631\u0643\u064A
12. declarationDate: \u062A\u0627\u0631\u064A\u062E \u0645\u0631\u062C\u0639 \u0627\u0644\u0628\u064A\u0627\u0646 (\u064A\u0641\u0636\u0644 \u0628\u0635\u064A\u063A\u0629 YYYY-MM-DD)
13. notes: \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629

\u0625\u0630\u0627 \u0643\u0627\u0646 \u0623\u064A \u062D\u0642\u0644 \u0646\u0635\u064A \u063A\u064A\u0631 \u0645\u0630\u0643\u0648\u0631 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u060C \u0627\u062A\u0631\u0643\u0647 \u0646\u0635\u0627\u064B \u0641\u0627\u0631\u063A\u0627\u064B "" \u0648\u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0633\u0639\u0631 \u063A\u064A\u0631 \u0648\u0627\u0636\u062D \u0636\u0639\u0647 0.`
        }
      ]
    },
    config: {
      systemInstruction: "\u0623\u0646\u062A \u062E\u0628\u064A\u0631 \u062C\u0645\u0631\u0643\u064A \u0645\u062A\u062E\u0635\u0635 \u0641\u064A \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u062C\u062F\u0627\u0648\u0644 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0648\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0628\u062F\u0642\u0629 \u0639\u0627\u0644\u064A\u0629 \u0648\u062A\u0646\u0633\u064A\u0642\u0647\u0627 \u0641\u064A \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0640 13 \u0627\u0644\u0645\u062D\u062F\u062F\u0629.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            productName: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 1: \u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C" },
            category: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 2: \u0627\u0644\u0635\u0646\u0641" },
            brand: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 3: \u0627\u0644\u0645\u0627\u0631\u0643\u0629" },
            originCountry: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 4: \u0628\u0644\u062F \u0627\u0644\u0645\u0646\u0634\u0623" },
            sizeOrMeasure: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 5: \u0627\u0644\u062D\u062C\u0645 \u0623\u0648 \u0627\u0644\u0642\u064A\u0627\u0633" },
            barcode: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 6: \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F" },
            hsCode: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 7: \u0627\u0644\u0628\u0646\u062F \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u064A \u0627\u0644\u062C\u0645\u0631\u0643\u064A" },
            price: { type: Type.NUMBER, description: "\u0627\u0644\u0639\u0645\u0648\u062F 8: \u0627\u0644\u0633\u0639\u0631" },
            currency: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 9: \u0631\u0645\u0632 \u0627\u0644\u0639\u0645\u0644\u0629" },
            packageType: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 10: \u0646\u0648\u0639 \u0627\u0644\u0639\u0628\u0648\u0629" },
            declarationNumber: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 11: \u0631\u0642\u0645 \u0627\u0644\u0628\u064A\u0627\u0646" },
            declarationDate: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 12: \u062A\u0627\u0631\u064A\u062E \u0645\u0631\u062C\u0639 \u0627\u0644\u0628\u064A\u0627\u0646" },
            notes: { type: Type.STRING, description: "\u0627\u0644\u0639\u0645\u0648\u062F 13: \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629" }
          },
          required: ["productName", "price", "currency"]
        }
      }
    }
  });
  const rawText = (response.text ?? "[]").trim();
  const parsed = JSON.parse(rawText);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((row) => ({
    productName: String(row.productName || ""),
    category: String(row.category || ""),
    brand: String(row.brand || ""),
    originCountry: String(row.originCountry || ""),
    sizeOrMeasure: String(row.sizeOrMeasure || ""),
    barcode: String(row.barcode || ""),
    hsCode: String(row.hsCode || ""),
    price: Number(row.price) || 0,
    currency: String(row.currency || "USD").toUpperCase(),
    packageType: String(row.packageType || ""),
    declarationNumber: String(row.declarationNumber || ""),
    declarationDate: String(row.declarationDate || ""),
    notes: String(row.notes || "")
  }));
}
async function runCustomsAiAssistant(mode, query, items) {
  const ai = getAiClient();
  const compactItems = items.slice(0, 60).map((it) => ({
    productName: it.productName,
    category: it.category,
    brand: it.brand,
    originCountry: it.originCountry,
    sizeOrMeasure: it.sizeOrMeasure,
    hsCode: it.hsCode,
    price: it.price,
    currency: it.currency,
    declarationNumber: it.declarationNumber,
    declarationDate: it.declarationDate
  }));
  let userPrompt = query;
  if (mode === "analyze") {
    userPrompt = `\u062D\u0644\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0644\u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u062D\u0627\u0644\u064A\u0629 (${items.length} \u0635\u0646\u0641\u0627\u064B\u060C \u0627\u0644\u0645\u0639\u0631\u0648\u0636 \u0623\u062F\u0646\u0627\u0647 \u0639\u064A\u0646\u0629 \u0645\u0646 \u062D\u062A\u0649 60 \u0635\u0646\u0641\u0627\u064B).
\u0642\u062F\u0645 \u0645\u0644\u062E\u0635\u0627\u064B \u0639\u0645\u0644\u064A\u0627\u064B \u0645\u0646\u0638\u0645\u0627\u064B \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u064A\u0634\u0645\u0644:
- \u0646\u0637\u0627\u0642 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0648\u0627\u0644\u0645\u062A\u0648\u0633\u0637 \u0644\u0643\u0644 \u0639\u0645\u0644\u0629 \u0645\u0648\u062C\u0648\u062F\u0629
- \u062A\u0648\u0632\u064A\u0639 \u0628\u0644\u062F\u0627\u0646 \u0627\u0644\u0645\u0646\u0634\u0623 \u0648\u0627\u0644\u0645\u0627\u0631\u0643\u0627\u062A \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629
- \u0623\u064A \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0639\u0644\u0649 \u062A\u0628\u0627\u064A\u0646 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u0623\u0648 \u0627\u0644\u0628\u0646\u0648\u062F \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629 (HS Codes)
- \u062A\u0648\u0635\u064A\u0627\u062A \u0633\u0631\u064A\u0639\u0629 \u0644\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u062C\u0645\u0631\u0643\u064A.

\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A:
${JSON.stringify(compactItems)}`;
  } else if (mode === "hs_lookup") {
    userPrompt = `\u0627\u0642\u062A\u0631\u062D \u0627\u0644\u0628\u0646\u062F \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u064A \u0627\u0644\u062C\u0645\u0631\u0643\u064A (HS Code) \u0627\u0644\u0645\u0646\u0627\u0633\u0628 \u0628\u062F\u0642\u0629 \u0644\u0644\u0645\u0646\u062A\u062C \u0627\u0644\u062A\u0627\u0644\u064A: "${query}"
\u0627\u0630\u0643\u0631:
1. \u0631\u0645\u0632 \u0627\u0644\u0628\u0646\u062F \u0627\u0644\u0645\u0642\u062A\u0631\u062D (8 \u0623\u0631\u0642\u0627\u0645 \u0623\u0648 6 \u0623\u0631\u0642\u0627\u0645 \u062F\u0648\u0644\u064A\u0629 + \u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0641\u0631\u0639\u064A)
2. \u0627\u0644\u0635\u0646\u0641 \u0627\u0644\u062C\u0645\u0631\u0643\u064A \u0648\u0627\u0644\u0641\u0635\u0644 \u0627\u0644\u062A\u0627\u0628\u0639 \u0644\u0647
3. \u0627\u0644\u0645\u0639\u0627\u064A\u064A\u0631 \u0627\u0644\u062A\u064A \u0642\u062F \u062A\u0624\u062B\u0631 \u0639\u0644\u0649 \u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u062C\u0645\u0631\u0643\u064A \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062A\u062C (\u0627\u0644\u0645\u0646\u0634\u0623\u060C \u0627\u0644\u062D\u062C\u0645\u060C \u0627\u0644\u0639\u0628\u0648\u0629).`;
  } else {
    userPrompt = `\u0633\u0624\u0627\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645: ${query}

\u0633\u064A\u0627\u0642 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0628\u062D\u062B \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0645\u0646 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A (${items.length} \u0635\u0646\u0641):
${JSON.stringify(compactItems.slice(0, 30))}`;
  }
  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: userPrompt,
    config: {
      systemInstruction: '\u0623\u0646\u062A \u0645\u0633\u062A\u0634\u0627\u0631 \u062E\u0628\u064A\u0631 \u0641\u064A \u0646\u0638\u0627\u0645 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629 \u0648\u0627\u0644\u0628\u0646\u0648\u062F \u0627\u0644\u062A\u0639\u0631\u064A\u0641\u064A\u0629 (\u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u0646\u0633\u0642 HS) \u0644\u0645\u0646\u0635\u0629 "\u0646\u0638\u0627\u0645 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u062C\u0645\u0631\u0643\u064A\u0629 - \u0648\u0644\u064A\u062F \u0627\u0644\u0631\u0627\u0634\u062F". \u0623\u062C\u0628 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0628\u0623\u0633\u0644\u0648\u0628 \u0645\u0647\u0646\u064A \u0648\u0627\u0636\u062D \u0648\u0645\u0628\u0627\u0634\u0631 \u0648\u0645\u062E\u062A\u0635\u0631.'
    }
  });
  return response.text ?? "\u062A\u0639\u0630\u0631 \u062A\u0648\u0644\u064A\u062F \u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u0641\u064A \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u062D\u0627\u0644\u064A.";
}
async function suggestItemFieldsWithGemini(productDescription) {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-4-hydrogen",
    contents: `\u0627\u0642\u062A\u0631\u062D \u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u062C\u0645\u0631\u0643\u064A \u0648\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0642\u064A\u0627\u0633\u064A\u0629 \u0644\u0644\u0645\u0646\u062A\u062C \u0627\u0644\u062A\u0627\u0644\u064A: "${productDescription}"`,
    config: {
      systemInstruction: "\u0623\u0639\u062F \u0643\u0627\u0626\u0646 JSON \u064A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0627\u0642\u062A\u0631\u0627\u062D\u0627\u062A \u0639\u0645\u0644\u064A\u0629 \u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0635\u0646\u0641 \u0627\u0644\u062C\u0645\u0631\u0643\u064A.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          hsCode: { type: Type.STRING },
          packageType: { type: Type.STRING },
          notes: { type: Type.STRING }
        }
      }
    }
  });
  try {
    return JSON.parse((response.text ?? "{}").trim());
  } catch {
    return {};
  }
}

// server.ts
function extractToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return null;
}
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u0627\u064B" });
    return;
  }
  const user = getUserBySessionToken(token);
  if (!user) {
    res.status(401).json({ error: "\u0627\u0646\u062A\u0647\u062A \u062C\u0644\u0633\u0629 \u0627\u0644\u0639\u0645\u0644\u060C \u064A\u0631\u062C\u0649 \u0625\u0639\u0627\u062F\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644" });
    return;
  }
  req.user = user;
  req.token = token;
  next();
}
function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== "owner") {
    res.status(403).json({ error: "\u0647\u0630\u0647 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0645\u062E\u0635\u0635\u0629 \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0641\u0642\u0637" });
    return;
  }
  next();
}
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3e3;
  app.use(express.json({ limit: "25mb" }));
  app.get("/api/settings", (_req, res) => {
    res.json(getSettings());
  });
  app.put("/api/settings/icon", requireAuth, requireOwner, (req, res) => {
    const { iconDataUrl } = req.body;
    if (typeof iconDataUrl !== "string") {
      res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
      return;
    }
    setSetting("app_icon_url", iconDataUrl);
    res.json({ ok: true, app_icon_url: iconDataUrl });
  });
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" });
      return;
    }
    const user = findUserByCredentials(username, password);
    if (!user) {
      res.status(401).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      return;
    }
    const token = createSession(user.id);
    res.json({ token, user });
  });
  app.post("/api/auth/register", (req, res) => {
    const { username, displayName, password } = req.body;
    if (!username || !password || username.trim().length < 3 || password.length < 4) {
      res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u064A\u062C\u0628 \u0623\u0646 \u0644\u0627 \u064A\u0642\u0644 \u0639\u0646 3 \u0623\u062D\u0631\u0641 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 4 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
      return;
    }
    try {
      const user = registerUser(username, displayName || username, password);
      const token = createSession(user.id);
      res.status(201).json({ token, user });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : "\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062D\u0633\u0627\u0628" });
    }
  });
  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });
  app.post("/api/auth/logout", requireAuth, (req, res) => {
    if (req.token) deleteSession(req.token);
    res.json({ ok: true });
  });
  app.post("/api/auth/biometric/register", requireAuth, (req, res) => {
    const { biometricType, webauthnCredId, biometricSecret } = req.body;
    if (!req.user || !biometricSecret) {
      res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0628\u0635\u0645\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629" });
      return;
    }
    const updatedUser = saveUserBiometric(req.user.id, biometricType || "both", webauthnCredId || null, biometricSecret);
    res.json({ user: updatedUser });
  });
  app.post("/api/auth/biometric/login", (req, res) => {
    const { username, biometricSecret, webauthnCredId } = req.body;
    if (!username || !biometricSecret) {
      res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u062D\u0633\u0627\u0628 \u0644\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0628\u064A\u0648\u0645\u062A\u0631\u064A" });
      return;
    }
    const user = loginWithBiometric(username, biometricSecret, webauthnCredId);
    if (!user) {
      res.status(401).json({ error: "\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0628\u0635\u0645\u0629 \u0623\u0648 \u0627\u0644\u0648\u062C\u0647 \u0644\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628" });
      return;
    }
    const token = createSession(user.id);
    res.json({ token, user });
  });
  app.get("/api/users", requireAuth, requireOwner, (_req, res) => {
    res.json({ users: listAllUsers() });
  });
  app.patch("/api/users/:id/role", requireAuth, requireOwner, (req, res) => {
    const { role } = req.body;
    if (role !== "owner" && role !== "user") {
      res.status(400).json({ error: "\u0635\u0644\u0627\u062D\u064A\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
      return;
    }
    if (req.params.id === req.user?.id && role !== "owner") {
      res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0625\u0632\u0627\u0644\u0629 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u0627\u0644\u0643 \u0639\u0646 \u062D\u0633\u0627\u0628\u0643 \u0627\u0644\u062D\u0627\u0644\u064A" });
      return;
    }
    const updated = updateUserRole(req.params.id, role);
    if (!updated) {
      res.status(404).json({ error: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return;
    }
    res.json({ user: updated });
  });
  app.delete("/api/users/:id", requireAuth, requireOwner, (req, res) => {
    if (req.params.id === req.user?.id) {
      res.status(400).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628\u0643 \u0627\u0644\u062D\u0627\u0644\u064A" });
      return;
    }
    deleteUserById(req.params.id);
    res.json({ ok: true });
  });
  app.get("/api/items", requireAuth, (_req, res) => {
    res.json({ items: listItems() });
  });
  app.post("/api/items", requireAuth, requireOwner, (req, res) => {
    const { items, item } = req.body;
    const payload = items ?? (item ? [item] : []);
    if (!Array.isArray(payload) || payload.length === 0) {
      res.status(400).json({ error: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0635\u0646\u0627\u0641 \u0635\u0627\u0644\u062D\u0629 \u0644\u0644\u0625\u0636\u0627\u0641\u0629" });
      return;
    }
    const valid = payload.filter((row) => String(row.productName || "").trim().length > 0);
    if (valid.length === 0) {
      res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0645\u0637\u0644\u0648\u0628 \u0644\u0643\u0644 \u0635\u0646\u0641" });
      return;
    }
    const created = insertItems(valid, req.user.id);
    res.status(201).json({ items: created });
  });
  app.put("/api/items/:id", requireAuth, requireOwner, (req, res) => {
    const body = req.body;
    if (!body || !String(body.productName || "").trim()) {
      res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0645\u0637\u0644\u0648\u0628" });
      return;
    }
    const updated = updateItem(req.params.id, body);
    if (!updated) {
      res.status(404).json({ error: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return;
    }
    res.json({ item: updated });
  });
  app.delete("/api/items/:id", requireAuth, requireOwner, (req, res) => {
    const ok = deleteItem(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
      return;
    }
    res.json({ ok: true });
  });
  app.post("/api/items/bulk-delete", requireAuth, requireOwner, (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0623\u0635\u0646\u0627\u0641 \u0644\u0644\u062D\u0630\u0641" });
      return;
    }
    const deletedCount = deleteItemsBulk(ids);
    res.json({ deletedCount });
  });
  app.post("/api/ai/parse-pdf", requireAuth, requireOwner, async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      if (!base64Data || !mimeType) {
        res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u0631\u0641\u0627\u0642 \u0645\u0644\u0641 PDF \u0623\u0648 \u0635\u0648\u0631\u0629 \u0635\u0627\u0644\u062D\u0629" });
        return;
      }
      const rows = await parseCustomsDocumentWithGemini(base64Data, mimeType);
      res.json({ items: rows });
    } catch (err) {
      console.error("Gemini PDF parse error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0645\u0644\u0641 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A"
      });
    }
  });
  app.post("/api/ai/suggest-fields", requireAuth, requireOwner, async (req, res) => {
    try {
      const { productName } = req.body;
      if (!productName) {
        res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0643\u062A\u0627\u0628\u0629 \u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0623\u0648\u0644\u0627\u064B" });
        return;
      }
      const suggestion = await suggestItemFieldsWithGemini(productName);
      res.json({ suggestion });
    } catch (err) {
      console.error("Gemini suggest error:", err);
      res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0627\u0642\u062A\u0631\u0627\u062D\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A" });
    }
  });
  app.post("/api/ai/assistant", requireAuth, async (req, res) => {
    try {
      const { mode, query, items } = req.body;
      const answer = await runCustomsAiAssistant(mode || "chat", query || "", Array.isArray(items) ? items : []);
      res.json({ answer });
    } catch (err) {
      console.error("Gemini assistant error:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A"
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path2.join(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path2.join(distDir, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Customs Valuation Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();

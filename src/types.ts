export type UserRole = 'owner' | 'user';

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  biometricEnabled: boolean;
  biometricType: 'fingerprint' | 'face' | 'both' | null;
  webauthnCredId?: string | null;
  createdAt: string;
}

export interface CustomsItem {
  id: string;
  productName: string;       // العمود 1: اسم المنتج
  category: string;          // العمود 2: الصنف
  brand: string;             // العمود 3: الماركة
  originCountry: string;     // العمود 4: بلد المنشأ
  sizeOrMeasure: string;     // العمود 5: الحجم أو القياس
  barcode: string;           // العمود 6: الباركود
  hsCode: string;            // العمود 7: البند التعريفي الجمركي
  price: number;             // العمود 8: السعر
  currency: string;          // العمود 9: رمز العملة
  packageType: string;       // العمود 10: نوع العبوة
  declarationNumber: string; // العمود 11: رقم البيان
  declarationDate: string;   // العمود 12: تاريخ مرجع البيان
  notes: string;             // العمود 13: ملاحظات إضافية
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CustomsItemInput = Omit<CustomsItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

export const CUSTOMS_COLUMNS: Array<{
  key: keyof CustomsItemInput;
  index: number;
  label: string;
  shortLabel: string;
  placeholder: string;
  isNumeric?: boolean;
}> = [
  { key: 'productName', index: 1, label: 'اسم المنتج', shortLabel: 'اسم المنتج', placeholder: 'مثال: شاشة تلفزيون ذكية 65 بوصة LED' },
  { key: 'category', index: 2, label: 'الصنف', shortLabel: 'الصنف', placeholder: 'مثال: إلكترونيات وأجهزة مرئية' },
  { key: 'brand', index: 3, label: 'الماركة', shortLabel: 'الماركة', placeholder: 'مثال: Samsung' },
  { key: 'originCountry', index: 4, label: 'بلد المنشأ', shortLabel: 'المنشأ', placeholder: 'مثال: كوريا الجنوبية' },
  { key: 'sizeOrMeasure', index: 5, label: 'الحجم أو القياس', shortLabel: 'الحجم/القياس', placeholder: 'مثال: 65 بوصة / 22 كجم' },
  { key: 'barcode', index: 6, label: 'الباركود', shortLabel: 'الباركود', placeholder: 'مثال: 8806094123456', isNumeric: true },
  { key: 'hsCode', index: 7, label: 'البند التعريفي الجمركي', shortLabel: 'البند الجمركي', placeholder: 'مثال: 85287200', isNumeric: true },
  { key: 'price', index: 8, label: 'السعر', shortLabel: 'السعر', placeholder: 'مثال: 540.00', isNumeric: true },
  { key: 'currency', index: 9, label: 'رمز العملة', shortLabel: 'العملة', placeholder: 'مثال: USD' },
  { key: 'packageType', index: 10, label: 'نوع العبوة', shortLabel: 'العبوة', placeholder: 'مثال: كرتون مقوى' },
  { key: 'declarationNumber', index: 11, label: 'رقم البيان', shortLabel: 'رقم البيان', placeholder: 'مثال: DEC-2026-88412', isNumeric: true },
  { key: 'declarationDate', index: 12, label: 'تاريخ مرجع البيان', shortLabel: 'تاريخ البيان', placeholder: 'مثال: 2026-09-14', isNumeric: true },
  { key: 'notes', index: 13, label: 'ملاحظات إضافية', shortLabel: 'ملاحظات', placeholder: 'مثال: قيمة معتمدة وفق فاتورة المصنع' },
];

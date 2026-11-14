import defaultAppIcon from '../assets/images/customs_app_icon_1794670518884.jpg';

const CUSTOM_ICON_STORAGE_KEY = 'walid_customs_custom_icon_v1';

export function getDefaultAppIcon(): string {
  return defaultAppIcon;
}

export function getSavedLocalIcon(): string | null {
  try {
    return localStorage.getItem(CUSTOM_ICON_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLocalIcon(dataUrl: string | null) {
  try {
    if (dataUrl) {
      localStorage.setItem(CUSTOM_ICON_STORAGE_KEY, dataUrl);
    } else {
      localStorage.removeItem(CUSTOM_ICON_STORAGE_KEY);
    }
  } catch {
    // ignore storage quota errors
  }
}

async function resizeImageToDataUrl(src: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(src);
        return;
      }
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, size, size);
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('تعذر معالجة صورة الأيقونة'));
    img.src = src;
  });
}

export async function processUploadedIconFile(file: File): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.readAsDataURL(file);
  });
  return await resizeImageToDataUrl(rawUrl, 256);
}

export async function applyAppIconToDocument(iconUrl: string) {
  try {
    const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');

    // When using the built-in default icon, keep the lightweight static /pwa-192x192.png & /manifest.webmanifest
    if (!iconUrl || iconUrl === defaultAppIcon) {
      if (faviconLink) faviconLink.href = '/pwa-192x192.png';
      if (appleLink) appleLink.href = '/apple-touch-icon.png';
      return;
    }

    const compactIcon = await resizeImageToDataUrl(iconUrl, 192);
    if (faviconLink) faviconLink.href = compactIcon;
    if (appleLink) appleLink.href = compactIcon;
  } catch {
    // fallback quietly
  }
}

import fs from 'fs';
import JSZip from 'jszip';
import path from 'path';

export async function buildAndroidApkKitBuffer(appUrl: string, customIconDataUrl?: string): Promise<Buffer> {
  const cleanUrl = appUrl.trim().replace(/\/+$/, '');
  const zip = new JSZip();

  const packageJson = {
    name: 'walid-customs-valuation-app',
    version: '1.0.0',
    description: 'نظام القيمة الجمركية - وليد الراشد (Android Capacitor APK)',
    scripts: {
      'cap:sync': 'npx cap sync android',
      'apk:debug': 'cd android && ./gradlew assembleDebug',
    },
    dependencies: {
      '@capacitor/android': '^6.0.0',
      '@capacitor/app': '^6.0.0',
      '@capacitor/core': '^6.0.0',
    },
    devDependencies: {
      '@capacitor/cli': '^6.0.0',
    },
  };

  const capacitorConfig = {
    appId: 'com.walid.alrashid.customs',
    appName: 'نظام القيمة الجمركية - وليد الراشد',
    webDir: 'www',
    server: {
      url: cleanUrl,
      cleartext: false,
      allowNavigation: ['*'],
    },
    android: {
      allowMixedContent: true,
    },
  };

  const wwwIndex = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>نظام القيمة الجمركية - وليد الراشد</title>
</head>
<body style="background:#0f172a;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;">
  <div>
    <h2>نظام القيمة الجمركية - وليد الراشد</h2>
    <p>جاري تحميل النظام...</p>
    <script>window.location.href = ${JSON.stringify(cleanUrl)};</script>
  </div>
</body>
</html>`;

  const githubAction = `name: Build Android APK
on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
      - name: Install & Add Android
        run: |
          npm install
          npx cap add android
          for dir in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
            mkdir -p "android/app/src/main/res/$dir"
            cp icon-512.png "android/app/src/main/res/$dir/ic_launcher.png" || true
            cp icon-512.png "android/app/src/main/res/$dir/ic_launcher_round.png" || true
          done
          npx cap sync android
      - name: Build Debug APK
        run: |
          cd android
          chmod +x gradlew
          ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: Customs-Valuation-Walid-APK
          path: android/app/build/outputs/apk/debug/app-debug.apk
`;

  const readmeAr = `# دليل بناء ملف APK لتطبيق: نظام القيمة الجمركية - وليد الراشد

تحتوي هذه الحزمة على مشروع Android Capacitor الجاهز والمتصل مباشرة بتطبيقك، بالإضافة إلى أيقونة التطبيق الرسمية المعتمدة.

## الطريقة الأسرع (بدون برامج على جهازك - عبر GitHub Actions):
1. ارفع محتويات هذا المجلد إلى مستودع جديد في GitHub.
2. افتح تبويب **Actions** ثم اختر **Build Android APK** واضغط **Run workflow**.
3. خلال دقيقتين سيظهر ملف **Customs-Valuation-Walid-APK** جاهزاً للتحميل بصيغة \`.apk\` وتثبيته على أي هاتف أندرويد.

## الطريقة المباشرة من المتصفح (PWABuilder):
1. تأكد من مشاركة/نشر التطبيق أولاً ليعمل الرابط: \`${cleanUrl}\`
2. افتح الرابط المباشر التالي: \`https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(cleanUrl)}\`
3. اختر **Package For Stores -> Android -> Generate Package** لتحميل ملف APK موقّع وجاهز فوراً.

## البناء المحلي (Android Studio):
\`\`\`bash
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
\`\`\`
ستجد الملف النهائي في: \`android/app/build/outputs/apk/debug/app-debug.apk\`
`;

  zip.file('package.json', JSON.stringify(packageJson, null, 2));
  zip.file('capacitor.config.json', JSON.stringify(capacitorConfig, null, 2));
  zip.file('www/index.html', wwwIndex);
  zip.file('.github/workflows/build-android-apk.yml', githubAction);
  zip.file('README-APK-AR.md', readmeAr);

  // Attach custom data URL icon if provided, otherwise use official public/pwa-512x512.png
  let iconAdded = false;
  if (customIconDataUrl && customIconDataUrl.startsWith('data:image/')) {
    const base64Part = customIconDataUrl.split(',')[1];
    if (base64Part) {
      zip.file('icon-512.png', Buffer.from(base64Part, 'base64'));
      iconAdded = true;
    }
  }
  if (!iconAdded) {
    const candidates = [
      path.join(process.cwd(), 'public', 'pwa-512x512.png'),
      path.join(process.cwd(), 'dist', 'pwa-512x512.png'),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        zip.file('icon-512.png', fs.readFileSync(candidate));
        break;
      }
    }
  }

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

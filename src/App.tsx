import { useEffect, useState } from 'react';
import { AiToolsDrawer } from './components/AiToolsDrawer';
import { ApkDownloadModal } from './components/ApkDownloadModal';
import { AuthScreen } from './components/AuthScreen';
import { BiometricSetupModal } from './components/BiometricSetupModal';
import { IconCustomizerModal } from './components/IconCustomizerModal';
import { ImportModal } from './components/ImportModal';
import { ItemFormModal } from './components/ItemFormModal';
import { SearchWorkspace } from './components/SearchWorkspace';
import { UsersModal } from './components/UsersModal';
import type { CustomsItem, User } from './types';
import { apiFetch, getAuthToken, setAuthToken } from './utils/api';
import {
  applyAppIconToDocument,
  getDefaultAppIcon,
  getSavedLocalIcon,
} from './utils/iconManager';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [items, setItems] = useState<CustomsItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [appIcon, setAppIcon] = useState<string>(() => getSavedLocalIcon() || getDefaultAppIcon());
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('walid_customs_dark_v1') === 'true';
    } catch {
      return false;
    }
  });

  // Modals & Drawers
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomsItem | null>(null);
  const [showAiDrawer, setShowAiDrawer] = useState(false);
  const [aiContextItems, setAiContextItems] = useState<CustomsItem[]>([]);
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [showIconModal, setShowIconModal] = useState(false);
  const [showApkModal, setShowApkModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('walid_customs_dark_v1', String(darkMode));
    } catch {
      // ignore
    }
  }, [darkMode]);

  useEffect(() => {
    (async () => {
      const localIcon = getSavedLocalIcon();
      let resolvedIcon = localIcon || getDefaultAppIcon();
      try {
        const settings = await apiFetch<Record<string, string>>('/api/settings');
        if (!localIcon && settings.app_icon_url) {
          resolvedIcon = settings.app_icon_url;
        }
      } catch {
        // ignore if offline
      }
      setAppIcon(resolvedIcon);
      if (resolvedIcon !== getDefaultAppIcon()) {
        applyAppIconToDocument(resolvedIcon);
      }
    })();
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    apiFetch<{ user: User }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        setAuthToken(null);
      })
      .finally(() => {
        setCheckingSession(false);
      });
  }, []);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoadingItems(true);
    apiFetch<{ items: CustomsItem[] }>('/api/items')
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false));
  }, [user]);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <img
            src={appIcon}
            alt="شعار النظام"
            className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-800"
          />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            جاري تحميل نظام القيمة الجمركية...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {!user ? (
        <AuthScreen
          appIcon={appIcon}
          onAuthenticated={(loggedInUser) => setUser(loggedInUser)}
          onOpenIconCustomizer={() => setShowIconModal(true)}
          onOpenApkModal={() => setShowApkModal(true)}
        />
      ) : (
        <SearchWorkspace
          user={user}
          items={items}
          loadingItems={loadingItems}
          appIcon={appIcon}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onLogout={handleLogout}
          onOpenImportModal={() => setShowImportModal(true)}
          onEditItem={(it) => setEditingItem(it)}
          onItemsDeleted={(ids) =>
            setItems((prev) => prev.filter((item) => !ids.includes(item.id)))
          }
          onOpenAiTools={(activeItems) => {
            setAiContextItems(activeItems);
            setShowAiDrawer(true);
          }}
          onOpenBiometricModal={() => setShowBiometricModal(true)}
          onOpenIconCustomizer={() => setShowIconModal(true)}
          onOpenApkModal={() => setShowApkModal(true)}
          onOpenUsersModal={() => setShowUsersModal(true)}
        />
      )}

      {showImportModal && user?.role === 'owner' && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onItemsAdded={(added) => setItems((prev) => [...added, ...prev])}
        />
      )}

      {editingItem && user?.role === 'owner' && (
        <ItemFormModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
            setEditingItem(null);
          }}
        />
      )}

      {showAiDrawer && user && (
        <AiToolsDrawer items={aiContextItems} onClose={() => setShowAiDrawer(false)} />
      )}

      {showBiometricModal && user && (
        <BiometricSetupModal
          user={user}
          onClose={() => setShowBiometricModal(false)}
          onUpdated={(updatedUser) => setUser(updatedUser)}
        />
      )}

      {showIconModal && (
        <IconCustomizerModal
          currentIcon={appIcon}
          user={user}
          onIconChanged={(newIcon) => setAppIcon(newIcon)}
          onClose={() => setShowIconModal(false)}
        />
      )}

      {showApkModal && (
        <ApkDownloadModal appIcon={appIcon} onClose={() => setShowApkModal(false)} />
      )}

      {showUsersModal && user?.role === 'owner' && (
        <UsersModal currentUser={user} onClose={() => setShowUsersModal(false)} />
      )}
    </>
  );
}

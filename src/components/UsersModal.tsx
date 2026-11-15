import React, { useEffect, useState } from 'react';
import { ShieldCheck, Trash2, UserCheck, Users, X } from 'lucide-react';
import type { User, UserRole } from '../types';
import { apiFetch } from '../utils/api';

interface UsersModalProps {
  currentUser: User;
  onClose: () => void;
}

export const UsersModal: React.FC<UsersModalProps> = ({ currentUser, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ users: User[] }>('/api/users');
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر جلب المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      const res = await apiFetch<{ user: User }>(`/api/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? res.user : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تعديل الصلاحية');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف المستخدم');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[88dvh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              إدارة المستخدمين والصلاحيات
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            يملك أصحاب صلاحية <strong>المالك</strong> حق الإضافة والتعديل والحذف، بينما يقتصر <strong>مستخدمو البحث</strong> على البحث والتصدير والطباعة فقط.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">جاري التحميل...</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-4 p-3.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {u.role === 'owner' ? (
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                        {u.displayName}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono-nums mt-0.5">
                      @{u.username} · {u.biometricEnabled ? 'بصمة مفعلة' : 'كلمة مرور فقط'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      disabled={u.id === currentUser.id}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 disabled:opacity-60"
                    >
                      <option value="user">مستخدم بحث فقط</option>
                      <option value="owner">مالك (إدارة كاملة)</option>
                    </select>

                    {u.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                        title="حذف المستخدم"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

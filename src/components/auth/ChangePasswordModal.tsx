import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { validatePassword } from '../../lib/security';
import { Button } from '../ui/Button';
import {
  Lock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertCircle,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

export const ChangePasswordModal: React.FC = () => {
  const { mustChangePassword, changePassword, profile } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Validate password rules in real-time
  const passwordCheck = useMemo(() => {
    if (!newPassword) return null;
    return validatePassword(newPassword);
  }, [newPassword]);

  const passwordsMatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  if (!mustChangePassword) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const check = validatePassword(newPassword);
    if (!check.isValid) {
      setErrorMessage('New password does not fulfill enterprise complexity requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await changePassword(newPassword, confirmPassword);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Failed to update password.');
    } else {
      setSuccessMessage('Password successfully updated! You can now proceed to the system.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Banner */}
        <div className="px-6 py-5 bg-amber-500 text-white flex items-center gap-3">
          <KeyRound className="w-6 h-6 shrink-0" />
          <div>
            <h3 className="text-base font-bold">Mandatory Password Change Required</h3>
            <p className="text-xs text-amber-100">
              Temporary password issued by IT Administration must be replaced on first login.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4 text-left">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Welcome, <strong>{profile?.displayName}</strong> (@{profile?.username}). For your security, you must establish a permanent corporate password meeting all 5 security standards before proceeding.
            </span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className={`w-full pl-9 pr-8 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border rounded-xl focus:outline-none focus:ring-2 text-slate-800 dark:text-slate-100 ${
                    confirmPassword
                      ? passwordsMatch
                        ? 'border-emerald-500 focus:ring-emerald-500'
                        : 'border-rose-400 focus:ring-rose-500'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                  }`}
                />
                {confirmPassword && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {passwordsMatch ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500" />
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Checklist */}
            {newPassword && passwordCheck && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Password Requirements:
                </p>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <span className={`flex items-center gap-1.5 ${passwordCheck.rules.minLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {passwordCheck.rules.minLength ? '✓' : '○'} Min 8 characters
                  </span>
                  <span className={`flex items-center gap-1.5 ${passwordCheck.rules.hasUppercase ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {passwordCheck.rules.hasUppercase ? '✓' : '○'} Uppercase letter (A-Z)
                  </span>
                  <span className={`flex items-center gap-1.5 ${passwordCheck.rules.hasLowercase ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {passwordCheck.rules.hasLowercase ? '✓' : '○'} Lowercase letter (a-z)
                  </span>
                  <span className={`flex items-center gap-1.5 ${passwordCheck.rules.hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {passwordCheck.rules.hasNumber ? '✓' : '○'} Number (0-9)
                  </span>
                  <span className={`flex items-center gap-1.5 ${passwordCheck.rules.hasSpecial ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                    {passwordCheck.rules.hasSpecial ? '✓' : '○'} Special character (!@#$)
                  </span>
                  <span className="text-slate-400 flex items-center gap-1.5">
                    ✓ Previous passwords may be reused
                  </span>
                </div>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="w-full justify-center py-2.5 font-semibold text-xs rounded-xl"
            >
              Update Password & Enter System
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import {
  AtSign,
  Lock,
  AlertTriangle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Info,
} from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onSwitchToRegister }) => {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Security and lockout response state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [lockoutUntil, setLockoutUntil] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [warnAfter3rdAttempt, setWarnAfter3rdAttempt] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);

  // Live countdown timer when locked
  useEffect(() => {
    if (!isLocked || !lockoutUntil) return;

    const tick = () => {
      const diff = Math.max(0, Math.ceil((new Date(lockoutUntil).getTime() - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff <= 0) {
        setIsLocked(false);
        setErrorMessage(null);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isLocked, lockoutUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setRejectionReason(null);
    setIsPending(false);

    const result = await login(username.trim(), password);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Login failed.');
      if (result.isLocked) {
        setIsLocked(true);
        setLockoutUntil(result.lockoutUntil || null);
        setRemainingSeconds(result.remainingSeconds || 15 * 60);
      } else {
        setIsLocked(false);
      }

      setFailedAttempts(result.failedAttempts ?? null);
      setRemainingAttempts(result.remainingAttempts ?? null);
      setWarnAfter3rdAttempt(!!result.warnAfter3rdAttempt);

      if (result.status === 'REJECTED') {
        setRejectionReason(result.rejectionReason || 'Identity verification failed.');
      }
      if (result.status === 'PENDING_APPROVAL') {
        setIsPending(true);
      }
    } else {
      if (onSuccess) onSuccess();
    }
  };

  const fillQuickAccount = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMessage(null);
    setRejectionReason(null);
    setIsPending(false);
    setIsLocked(false);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 text-left">
      {/* 15-Minute Lockout Screen */}
      {isLocked && remainingSeconds !== null && remainingSeconds > 0 && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
              Account Locked &bull; Security Policy Enforced
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">
              5 incorrect password attempts detected. System has locked access for 15 minutes.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/80 rounded-xl py-3 px-4 inline-block">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
              Remaining Lockout Time
            </p>
            <p className="text-2xl font-mono font-extrabold text-rose-600 dark:text-rose-400">
              {formatCountdown(remainingSeconds)}
            </p>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            After 15 minutes you may try logging in again. Only an IT Administrator or Super Admin can manually reset the counter earlier.
          </p>
        </div>
      )}

      {/* Rejection Alert */}
      {rejectionReason && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-1.5 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2 font-bold text-rose-900 dark:text-rose-100">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Registration Rejected by IT Administration</span>
          </div>
          <p className="text-[11px] pl-6">
            <strong>Mandatory Reason Provided:</strong> &ldquo;{rejectionReason}&rdquo;
          </p>
          <p className="text-[10px] text-rose-600 dark:text-rose-400 pl-6">
            Please contact your IT department or submit a new registration with accurate credentials.
          </p>
        </div>
      )}

      {/* Pending Approval Notice */}
      {isPending && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Registration Pending IT Admin Review</span>
          </div>
          <p className="text-[11px] pl-6 text-amber-700 dark:text-amber-300">
            Your registration is currently awaiting review and approval by an IT Administrator. Once approved, you will be able to log in with your credentials.
          </p>
        </div>
      )}

      {/* Failed Attempt Warning (Warn after 3rd attempt) */}
      {!isLocked && warnAfter3rdAttempt && remainingAttempts !== null && remainingAttempts > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="space-y-0.5">
            <p className="font-bold">Security Warning: Multiple Failed Attempts</p>
            <p className="text-[11px]">
              You have {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining before your account is locked for 15 minutes.
            </p>
          </div>
        </div>
      )}

      {/* General Error */}
      {!isLocked && errorMessage && !rejectionReason && !isPending && !warnAfter3rdAttempt && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Login Form Fields */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Username or Email
          </label>
          <div className="relative">
            <AtSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              required
              disabled={isLocked}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. rahul or itadmin"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 disabled:opacity-50"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Case-insensitive (rahul = Rahul = RAHUL)</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              disabled={isLocked}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Failed attempt tracker indicator */}
        {failedAttempts !== null && failedAttempts > 0 && !isLocked && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            <span>Cumulative failed attempts: <strong className="text-slate-700 dark:text-slate-200">{failedAttempts}</strong></span>
            {remainingAttempts !== null && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} to 15-min lockout
              </span>
            )}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isLocked}
          className="w-full justify-center py-2.5 font-semibold text-xs rounded-xl"
        >
          {isLocked ? 'Account Temporarily Locked' : 'Sign In'}
        </Button>
      </form>

      {/* Super Administrator Quick Fill */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Super Admin Quick Sign-In:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => fillQuickAccount('Sameer Tupe', 'Acculate@')}
            className="text-left px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/40 rounded-lg text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <span className="font-bold block text-indigo-600 dark:text-indigo-400">Sameer Tupe</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Super Admin (Acculate@)</span>
          </button>
          <button
            type="button"
            onClick={() => fillQuickAccount('Rahul Prasad', 'Accurate@')}
            className="text-left px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/40 rounded-lg text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <span className="font-bold block text-indigo-600 dark:text-indigo-400">Rahul Prasad</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Super Admin (Accurate@)</span>
          </button>
        </div>
      </div>

      {onSwitchToRegister && (
        <div className="text-center pt-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            New employee?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              Register your account
            </button>
          </p>
        </div>
      )}
    </div>
  );
};

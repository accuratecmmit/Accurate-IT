import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Clock, ShieldAlert, CheckCircle2, LogOut } from 'lucide-react';

export const InactivityWarningModal: React.FC = () => {
  const {
    inactivityWarning,
    remainingInactivitySeconds,
    resetInactivityTimer,
    logoutCurrentSession,
  } = useAuth();

  if (!inactivityWarning) return null;

  const minutes = Math.floor(remainingInactivitySeconds / 60);
  const seconds = remainingInactivitySeconds % 60;
  const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-amber-400 dark:border-amber-600 overflow-hidden text-center p-6 space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-sm">
          <Clock className="w-7 h-7 animate-pulse" />
        </div>

        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Inactivity Timeout Warning
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Due to 30-minute enterprise session security policy, you will be signed out automatically if no activity is detected.
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl py-3 px-4 inline-block">
          <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300">
            Session Auto-Terminates In
          </p>
          <p className="text-3xl font-mono font-black text-amber-600 dark:text-amber-400">
            {formatted}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutCurrentSession()}
            icon={LogOut}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Log Out Now
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={resetInactivityTimer}
            icon={CheckCircle2}
            className="text-xs font-bold px-6 py-2.5 shadow-md"
          >
            Stay Signed In (Continue Session)
          </Button>
        </div>
      </div>
    </div>
  );
};

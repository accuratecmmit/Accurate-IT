import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  Laptop,
  Smartphone,
  ShieldCheck,
  X,
  LogOut,
  Clock,
  Globe,
  Radio,
  AlertTriangle,
} from 'lucide-react';

export const SessionManagerModal: React.FC = () => {
  const {
    sessionManagerOpen,
    closeSessionManager,
    activeSessions,
    sessionId,
    logoutCurrentSession,
    logoutAllDevices,
    profile,
  } = useAuth();

  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [showConfirmLogoutAll, setShowConfirmLogoutAll] = useState(false);

  if (!sessionManagerOpen) return null;

  const handleLogoutAllConfirm = async () => {
    setIsLoggingOutAll(true);
    await logoutAllDevices();
    setIsLoggingOutAll(false);
    setShowConfirmLogoutAll(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Active Device Sessions
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Logged in as @{profile?.username} &bull; Concurrent Sessions Supported
              </p>
            </div>
          </div>

          <button
            onClick={closeSessionManager}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-left">
          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50 rounded-xl text-xs text-indigo-800 dark:text-indigo-300 flex items-start gap-2">
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse shrink-0 mt-0.5" />
            <span>
              <strong>Enterprise Session Policy:</strong> 30-minute inactivity timeout is active. You may sign in from multiple workstations simultaneously.
            </span>
          </div>

          {/* Session List */}
          <div className="space-y-2.5 max-h-60 overflow-y-auto">
            {activeSessions && activeSessions.length > 0 ? (
              activeSessions.map((sess: any) => {
                const isCurrent = sess.isCurrent || sess.id === sessionId;
                return (
                  <div
                    key={sess.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                      isCurrent
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-2xs">
                        {sess.deviceLabel?.includes('Mobile') ? (
                          <Smartphone className="w-4 h-4 text-indigo-500" />
                        ) : (
                          <Laptop className="w-4 h-4 text-indigo-500" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {sess.deviceLabel || 'Workstation Browser'}
                          </p>
                          {isCurrent && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                              This Device
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-400" />
                            {sess.ipAddress || '127.0.0.1'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Active: {new Date(sess.lastActiveAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isCurrent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => logoutCurrentSession()}
                        className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 shrink-0"
                      >
                        Sign Out
                      </Button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                Current active workstation session ID: <span className="font-mono text-slate-700 dark:text-slate-300">{sessionId || 'active'}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              onClick={closeSessionManager}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowConfirmLogoutAll(true)}
              isLoading={isLoggingOutAll}
              icon={LogOut}
              className="text-xs font-semibold"
            >
              Log Out From All Devices
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirmLogoutAll}
        title="Terminate All Device Sessions"
        message="Are you sure you want to terminate all active sessions across all devices? You will be signed out of this workstation and all other devices immediately."
        confirmText="Log Out Everywhere"
        cancelText="Keep Sessions"
        variant="danger"
        loading={isLoggingOutAll}
        onConfirm={handleLogoutAllConfirm}
        onCancel={() => setShowConfirmLogoutAll(false)}
      />
    </div>
  );
};

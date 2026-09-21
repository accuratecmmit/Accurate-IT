import React from 'react';
import { AlertTriangle, Trash2, HelpCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  requiredInputText?: string;
  inputPlaceholder?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  loading = false,
  requiredInputText,
  inputPlaceholder,
}) => {
  const [typedVerification, setTypedVerification] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setTypedVerification('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmationDisabled =
    loading || (requiredInputText ? typedVerification.trim() !== requiredInputText : false);

  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />;
      case 'info':
        return <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />;
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <ShieldAlert className="w-6 h-6 text-slate-600 dark:text-slate-400" />;
    }
  };

  const getIconBg = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-100 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900/60';
      case 'warning':
        return 'bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60';
      case 'info':
        return 'bg-blue-100 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/60';
      case 'success':
        return 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/60';
      default:
        return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={!loading ? onCancel : undefined}
          aria-hidden="true"
        />

        {/* Modal Content */}
        <div className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 p-6 text-left align-middle shadow-2xl border border-slate-200 dark:border-slate-800 transition-all z-10">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl border shrink-0 ${getIconBg()}`}>
              {getIcon()}
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {message}
              </p>

              {requiredInputText && (
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    To confirm, please type <span className="font-mono text-rose-600 font-bold">{requiredInputText}</span>:
                  </label>
                  <input
                    type="text"
                    value={typedVerification}
                    onChange={(e) => setTypedVerification(e.target.value)}
                    placeholder={inputPlaceholder || `Type "${requiredInputText}"`}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant={variant === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              disabled={isConfirmationDisabled}
              isLoading={loading}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

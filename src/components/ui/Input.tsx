import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: LucideIcon;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      icon: Icon,
      leftIcon,
      rightIcon,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const hasLeftIcon = Boolean(Icon || leftIcon);
    const hasRightIcon = Boolean(rightIcon);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label}
            {props.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {hasLeftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon ? leftIcon : Icon && <Icon className="w-4 h-4" />}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full text-sm rounded-xl border transition-all focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed shadow-2xs ${
              hasLeftIcon ? 'pl-9.5 pr-3' : 'px-3.5'
            } ${hasRightIcon ? 'pr-9.5' : ''} py-2.5 ${
              error
                ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-600'
                : 'border-slate-300 focus:border-indigo-600 focus:ring-indigo-500/20 dark:border-slate-700 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/30'
            } bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${className}`}
            {...props}
          />
          {hasRightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole, RolePermissions } from '../../types';
import { ShieldAlert } from 'lucide-react';

export interface RoleGateProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: keyof RolePermissions;
  fallback?: React.ReactNode;
  showForbiddenMessage?: boolean;
}

export const RoleGate: React.FC<RoleGateProps> = ({
  children,
  allowedRoles,
  requiredPermission,
  fallback = null,
  showForbiddenMessage = false,
}) => {
  const { effectiveRole, permissions } = useAuth();

  let isAuthorized = true;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(effectiveRole)) {
      isAuthorized = false;
    }
  }

  if (requiredPermission && isAuthorized) {
    if (!permissions[requiredPermission]) {
      isAuthorized = false;
    }
  }

  if (!isAuthorized) {
    if (showForbiddenMessage) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-6 text-center">
          <ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Access Restricted
          </h4>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 max-w-md mx-auto">
            Your current effective role (<span className="font-semibold">{effectiveRole}</span>)
            does not have permission to view or manage this component.
          </p>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

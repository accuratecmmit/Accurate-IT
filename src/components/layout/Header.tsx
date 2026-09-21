import React from 'react';
import {
  Building2,
  MapPin,
  LogIn,
  LogOut,
  UserCheck,
  RotateCcw,
  UserPlus,
  Laptop,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMasterData } from '../../context/MasterDataContext';
import { Button } from '../ui/Button';
import { UserRole } from '../../types';
import { NotificationBell } from '../notifications/NotificationBell';

export const Header: React.FC = () => {
  const {
    user,
    profile,
    role: actualRole,
    effectiveRole,
    permissions,
    simulatedRole,
    setSimulatedRole,
    isSuperAdmin,
    logoutCurrentSession,
    isLoading,
    openAuthModal,
    openSessionManager,
    activeSessions,
  } = useAuth();

  const {
    companies,
    locations,
    selectedCompanyId,
    selectedLocationId,
    setSelectedCompanyId,
    setSelectedLocationId,
  } = useMasterData();

  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'SUPER_ADMIN', label: 'Super Admin' },
    { value: 'IT_ADMIN', label: 'IT Admin' },
    { value: 'IT_TECHNICIAN', label: 'IT Technician' },
    { value: 'EMPLOYEE', label: 'Employee' },
  ];

  const currentAuthUser = profile || user;

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Product Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm ring-2 ring-indigo-500/20">
              AG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-none tracking-tight">
                  Accurate <span className="text-indigo-600">Group</span>
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-700">
                  ITMS Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 hidden sm:block font-medium">
                Authentication &bull; User Management &bull; Multi-Company Master Data
              </p>
            </div>
          </div>

          {/* Master DB Status Pill */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>Accurate ITMS Auth Core Active</span>
          </div>

          {/* Master Data Global Selectors (Independent Company & Location) */}
          {currentAuthUser && (
            <div className="hidden md:flex items-center gap-2">
              {/* Company Selector */}
              <div className="flex items-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 gap-1.5 shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Company:</span>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="text-xs bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">All Companies ({companies.length})</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location Selector */}
              <div className="flex items-center bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 gap-1.5 shadow-2xs">
                <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Location:</span>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="text-xs bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="ALL">All Locations ({locations.length})</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code} ({l.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Auth & Role Status */}
          <div className="flex items-center gap-2.5">
            {currentAuthUser ? (
              <>
                {/* Super Admin RBAC Role Simulation Switcher */}
                {isSuperAdmin && (
                  <div className="hidden lg:flex items-center gap-1.5 bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 rounded-full px-3 py-1 shadow-2xs">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                      RBAC Simulator:
                    </span>
                    <select
                      value={simulatedRole || actualRole}
                      onChange={(e) => {
                        const val = e.target.value as UserRole;
                        setSimulatedRole(val === actualRole ? null : val);
                      }}
                      className="text-xs bg-transparent font-semibold text-indigo-900 dark:text-indigo-200 focus:outline-none cursor-pointer"
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} {opt.value === actualRole ? '(Actual)' : ''}
                        </option>
                      ))}
                    </select>
                    {simulatedRole && (
                      <button
                        onClick={() => setSimulatedRole(null)}
                        title="Reset simulation to actual role"
                        className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 p-0.5 rounded-full"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {/* Role Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${permissions.badgeBg}`}
                  >
                    {simulatedRole ? `[Simulated] ${permissions.label}` : permissions.label}
                  </span>

                  {/* Notifications */}
                  <NotificationBell />

                  {/* Active Sessions Control Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openSessionManager}
                    icon={Laptop}
                    title="Manage Active Device Sessions"
                    className="text-xs hidden sm:flex items-center gap-1.5 text-slate-600 dark:text-slate-300"
                  >
                    <span>Sessions</span>
                    {activeSessions.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    )}
                  </Button>

                  {/* User Profile Avatar / Details */}
                  <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                      {(profile?.displayName || user?.displayName || profile?.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden sm:block text-left">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                        {profile?.displayName || user?.displayName || profile?.username}
                      </p>
                      <p className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 truncate max-w-[120px]">
                        @{profile?.username || user?.email?.split('@')[0]}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => logoutCurrentSession()}
                      icon={LogOut}
                      title="Sign Out Current Session"
                      className="p-1.5 text-slate-500 hover:text-rose-600"
                    >
                      <span className="sr-only">Sign out</span>
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAuthModal('REGISTER')}
                  icon={UserPlus}
                  className="text-xs font-semibold rounded-xl"
                >
                  Register (9 Fields)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => openAuthModal('LOGIN')}
                  isLoading={isLoading}
                  icon={LogIn}
                  className="text-xs font-semibold rounded-xl shadow-xs"
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

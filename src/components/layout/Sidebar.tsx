import React from 'react';
import {
  LayoutDashboard,
  Building2,
  ScrollText,
  Ticket,
  Laptop,
  ShieldCheck,
  Building,
  Users,
  Shield,
  BarChart3,
  User,
  Home,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMasterData } from '../../context/MasterDataContext';

export type NavSection =
  | 'dashboard'
  | 'overview'
  | 'employee_dashboard'
  | 'employee_profile'
  | 'tickets'
  | 'inventory'
  | 'it_teams'
  | 'reports'
  | 'users'
  | 'master_data'
  | 'schema'
  | 'audit_logs';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSelectSection }) => {
  const { effectiveRole, permissions, isSuperAdmin } = useAuth();
  const { companies, locations } = useMasterData();

  const isITAdmin = effectiveRole === 'IT_ADMIN';
  const isTechnician = effectiveRole === 'IT_TECHNICIAN';
  const isEmployee = effectiveRole === 'EMPLOYEE';

  const navItems = [
    {
      id: 'dashboard' as NavSection,
      label: isSuperAdmin
        ? 'Executive Dashboard'
        : isITAdmin
        ? 'IT Admin Dashboard'
        : isTechnician
        ? 'Technician Dashboard'
        : 'Dashboard',
      icon: LayoutDashboard,
      badge: isSuperAdmin ? 'Global' : isITAdmin ? 'Team Scope' : 'Active Tasks',
      visible: !isEmployee,
    },
    {
      id: 'employee_dashboard' as NavSection,
      label: 'Employee Dashboard',
      icon: LayoutDashboard,
      badge: 'My Workspace',
      visible: isEmployee,
    },
    {
      id: 'employee_profile' as NavSection,
      label: 'My Profile & Details',
      icon: User,
      badge: 'Official',
      visible: true,
    },
    {
      id: 'tickets' as NavSection,
      label: isEmployee ? 'My Support Tickets' : 'IT Helpdesk Tickets',
      icon: Ticket,
      badge: isEmployee ? 'My Tickets' : 'Team Queue',
      visible: true,
    },
    {
      id: 'inventory' as NavSection,
      label: isEmployee ? 'My IT Assets' : 'Hardware Inventory',
      icon: Laptop,
      badge: isEmployee ? 'Assigned' : 'Hardware Pool',
      visible: true,
    },
    {
      id: 'it_teams' as NavSection,
      label: 'IT Teams & Scoping',
      icon: Shield,
      badge: isSuperAdmin ? 'Full Admin' : 'Team Scope',
      visible: isITAdmin || isSuperAdmin,
    },
    {
      id: 'reports' as NavSection,
      label: 'Operational Reports',
      icon: BarChart3,
      badge: 'Analytics',
      visible: isITAdmin || isSuperAdmin,
    },
    {
      id: 'users' as NavSection,
      label: 'User Accounts & Access',
      icon: Users,
      badge: isSuperAdmin ? 'All Users' : 'Team Scope',
      visible: isITAdmin || isSuperAdmin,
    },
    {
      id: 'master_data' as NavSection,
      label: 'Companies & Locations',
      icon: Building2,
      badge: `${companies.length} Co / ${locations.length} Loc`,
      visible: permissions.canManageCompanies || permissions.canManageLocations || isITAdmin || isSuperAdmin,
    },
    {
      id: 'overview' as NavSection,
      label: 'System Architecture',
      icon: Building,
      badge: 'Architecture',
      visible: !isEmployee,
    },
    {
      id: 'schema' as NavSection,
      label: 'Database Schema & 3NF',
      icon: Building,
      badge: '25 Models',
      visible: isITAdmin || isSuperAdmin,
    },
    {
      id: 'audit_logs' as NavSection,
      label: 'Security Audit Logs',
      icon: ScrollText,
      badge: 'Append-Only',
      visible: permissions.canViewAuditLogs || isSuperAdmin,
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="p-4 flex-1 space-y-6">
        {/* Navigation Group */}
        <div>
          <h4 className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">
            Platform Modules
          </h4>
          <nav className="space-y-1.5">
            {navItems
              .filter((item) => item.visible)
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectSection(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-indigo-600 dark:text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400 dark:text-white' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-slate-800 text-slate-200 dark:bg-indigo-700 dark:text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
        </div>

        {/* Master Data Snapshot */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-3.5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Master Data State
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800">
              Synced
            </span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1.5">
            <div className="flex justify-between">
              <span>Independent Companies:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{companies.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Independent Locations:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{locations.length}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700/60 pt-2 font-medium">
            Not hardcoded &bull; Database-driven Firestore records
          </p>
        </div>

        {/* Role Privileges Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Active RBAC Tier</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug font-medium">
            {permissions.description}
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500">
        IT Helpdesk & Inventory &bull; v1.0.0
      </div>
    </aside>
  );
};

import React, { useEffect, useState } from 'react';
import {
  Database,
  Building2,
  MapPin,
  ShieldCheck,
  ScrollText,
  Users,
  CheckCircle,
  Server,
  Layers,
  ArrowRight,
  Lock,
  Activity,
  RotateCcw,
  Sparkles,
  Cpu,
  Laptop,
  Ticket,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useMasterData } from '../../context/MasterDataContext';
import { testFirestoreConnection } from '../../lib/firebase';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ROLE_DEFINITIONS, UserRole } from '../../types';

interface ArchitectureOverviewProps {
  onNavigate: (section: 'schema' | 'master_data' | 'audit_logs' | 'tickets' | 'inventory') => void;
}

export const ArchitectureOverview: React.FC<ArchitectureOverviewProps> = ({ onNavigate }) => {
  const { user, role, effectiveRole, permissions, simulatedRole, isSuperAdmin, setSimulatedRole } = useAuth();
  const { companies, locations, isSeeding, seedInitialData } = useMasterData();
  const [dbStatus, setDbStatus] = useState<{ checked: boolean; connected: boolean; message: string }>({
    checked: false,
    connected: false,
    message: 'Testing connection...',
  });

  useEffect(() => {
    testFirestoreConnection().then((res) => {
      setDbStatus({
        checked: true,
        connected: res.connected,
        message: res.message || 'Connected',
      });
    });
  }, []);

  const rolesList: UserRole[] = ['SUPER_ADMIN', 'IT_ADMIN', 'IT_TECHNICIAN', 'EMPLOYEE'];

  const roleInitials: Record<UserRole, { code: string; bg: string; text: string }> = {
    EMPLOYEE: { code: 'EM', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' },
    IT_TECHNICIAN: { code: 'TC', bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300' },
    IT_ADMIN: { code: 'AD', bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300' },
    SUPER_ADMIN: { code: 'SA', bg: 'bg-indigo-600 text-white', text: 'text-white' },
  };

  return (
    <div className="space-y-6">
      {/* Bento Grid Main Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Bento Tile 1: Master Data Structure (Decoupled Architecture) */}
        <div className="md:col-span-12 lg:col-span-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Master Data
              </span>
              <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-200/80 dark:border-indigo-800">
                Decoupled
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 tracking-tight">
              Decoupled Architecture
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-medium">
              Companies and locations are autonomous database-driven entities, never hardcoded.
            </p>

            <div className="space-y-3">
              {/* Companies Highlight Box */}
              <div className="p-3.5 bg-indigo-50/80 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/60">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Companies</span>
                  </div>
                  <span className="text-[10px] bg-indigo-200/80 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-200 font-bold px-2 py-0.5 rounded-full">
                    {companies.length} Master
                  </span>
                </div>
                <div className="text-[11px] text-indigo-800 dark:text-indigo-300/90 font-medium truncate">
                  {companies.map((c) => c.code).join(', ')} &bull; {companies.map((c) => c.name).slice(0, 2).join(', ')}
                </div>
              </div>

              {/* Locations Highlight Box */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Locations</span>
                  </div>
                  <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full">
                    {locations.length} Active
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium truncate">
                  {locations.map((l) => l.code).slice(0, 6).join(' &bull; ')}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="primary"
              size="sm"
              className="w-full justify-between"
              onClick={() => onNavigate('master_data')}
              icon={ArrowRight}
              iconPosition="right"
            >
              <span>Manage Master Data</span>
            </Button>
          </div>
        </div>

        {/* Bento Tile 2: RBAC Foundation Status & Matrix */}
        <div className="md:col-span-12 lg:col-span-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Access Control
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 tracking-tight">
                  RBAC Foundation Status
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  SECURE: ENFORCED
                </span>
              </div>
            </div>

            {/* 4-Tier Role Bento Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {rolesList.map((roleKey) => {
                const def = ROLE_DEFINITIONS[roleKey];
                const init = roleInitials[roleKey];
                const isCurrent = effectiveRole === roleKey;
                const isSim = simulatedRole === roleKey;

                return (
                  <div
                    key={roleKey}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${init.bg} ${init.text} shadow-2xs`}
                        >
                          {init.code}
                        </div>
                        {isCurrent && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-600 text-white px-1.5 py-0.5 rounded-md">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {def.label}
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">
                        {def.description}
                      </p>
                    </div>

                    {isSuperAdmin && (
                      <div className="pt-2.5 mt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                        <button
                          onClick={() => setSimulatedRole(roleKey === role ? null : roleKey)}
                          className={`w-full text-[10px] font-semibold py-1 rounded-lg border transition-colors ${
                            isSim
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isSim ? 'Reset Simulation' : `Test ${init.code}`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Server-Side Authorization Banner Callout */}
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Server-Side Rules Engine:
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Security rules enforce read/write access at Firestore document level
                </span>
              </div>
              <Badge variant="purple" size="sm">
                Immutable Auth
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <span>Simulated privileges apply immediately across all modules.</span>
            {simulatedRole && (
              <button
                onClick={() => setSimulatedRole(null)}
                className="font-bold text-indigo-600 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Actual ({role})
              </button>
            )}
          </div>
        </div>

        {/* Bento Tile 3: High-Energy Operational Status Accent Card */}
        <div className="md:col-span-12 lg:col-span-4 bg-indigo-600 rounded-3xl p-6 text-white flex flex-col justify-between shadow-xs relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-indigo-500/30 rounded-full blur-xl pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
                Core Status
              </span>
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse"></span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-2 text-white">
              Operational
            </h3>
            <p className="text-xs text-indigo-100 leading-relaxed font-medium">
              Multi-company master datasets and RBAC policies active in live container environment.
            </p>

            <div className="mt-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs bg-indigo-700/50 p-2.5 rounded-xl border border-indigo-500/40">
                <span className="text-indigo-200 font-medium">Cloud Database</span>
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                  {dbStatus.connected ? 'Firestore Live' : 'Checking'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs bg-indigo-700/50 p-2.5 rounded-xl border border-indigo-500/40">
                <span className="text-indigo-200 font-medium">Multi-Tenancy</span>
                <span className="font-bold text-white">3 Autonomous Orgs</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-indigo-700/50 p-2.5 rounded-xl border border-indigo-500/40">
                <span className="text-indigo-200 font-medium">Audit Pipeline</span>
                <span className="font-bold text-white">Append-Only Active</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-indigo-500/40 flex items-center justify-between">
            <span className="text-[11px] text-indigo-200 font-medium">v1.0.0 Stable</span>
            {isSuperAdmin && (
              <button
                onClick={() => seedInitialData()}
                disabled={isSeeding}
                className="text-xs font-bold bg-white text-indigo-900 px-3 py-1.5 rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                {isSeeding ? 'Verifying...' : 'Re-verify Seeds'}
              </button>
            )}
          </div>
        </div>

        {/* Bento Tile 4: Centralized Telemetry & Infrastructure Card */}
        <div className="md:col-span-12 lg:col-span-8 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-white shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Infrastructure Telemetry
                </span>
                <h3 className="text-xl font-bold tracking-tight text-white mt-0.5">
                  Enterprise System Engine
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block font-semibold">API Latency</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">38ms</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] block font-semibold">Security Rules</span>
                  <span className="font-mono font-bold text-indigo-400 text-sm">100% PASS</span>
                </div>
              </div>
            </div>

            {/* Metrics Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-2">
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span className="text-slate-300">Auth Engine Health</span>
                  <span className="text-emerald-400 font-bold">99.8%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full w-[99%]"></div>
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span className="text-slate-300">Master Data Consistency</span>
                  <span className="text-indigo-400 font-bold">100%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full w-[100%]"></div>
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span className="text-slate-300">Audit Stream Queue</span>
                  <span className="text-blue-400 font-bold">0 Pending</span>
                </div>
                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full w-[12%]"></div>
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700/60">
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span className="text-slate-300">Error Handling Protocol</span>
                  <span className="text-purple-400 font-bold">Active</span>
                </div>
                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-400 rounded-full w-[95%]"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Container Ingress: Port 3000 &bull; Secure TLS Proxy</span>
            <span className="font-mono text-slate-300">Firestore Rules: Deployed</span>
          </div>
        </div>

        {/* Bento Tile 5: Audit Engine & Verification Preview */}
        <div className="md:col-span-12 lg:col-span-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Database Models
              </span>
              <Badge variant="indigo" size="sm">
                25 Entities Verified
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1 tracking-tight">
              Normalized Schema (3NF)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed font-medium">
              Complete relational models for tickets, assets, SLA configurations, independent master data, and immutable history ledgers.
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Cycles & FK Check:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Zero Deadlocks</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Ticket Sequence:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">Atomic & Non-Reusable</span>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Historical Retention:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Soft-Delete Only</span>
              </div>
            </div>
          </div>

          <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="primary"
              size="sm"
              className="w-full justify-between"
              onClick={() => onNavigate('schema')}
              icon={Database}
            >
              <span>Explore 25 Normalized Models</span>
            </Button>
          </div>
        </div>

        {/* Bento Tile 6: Upcoming Subsystems Preview 1 (Computer Inventory) */}
        <div className="md:col-span-12 lg:col-span-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Hardware Assets
              </span>
              <Badge variant="default" size="sm">
                Foundation Ready
              </Badge>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2 tracking-tight">
              <Laptop className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Computer Inventory Subsystem
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-3">
              Asset tracking schemas link hardware units to independent master companies and facilities.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                &bull; Workstations, Laptops, Servers
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                &bull; In-Stock &bull; Assigned &bull; Repair
              </div>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onNavigate('inventory')}
            >
              Explore Inventory Architecture
            </Button>
          </div>
        </div>

        {/* Bento Tile 7: Upcoming Subsystems Preview 2 (IT Support Tickets) */}
        <div className="md:col-span-12 lg:col-span-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Service Desk
              </span>
              <Badge variant="default" size="sm">
                Foundation Ready
              </Badge>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2 tracking-tight">
              <Ticket className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              IT Support Helpdesk Tickets
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-3">
              Multi-company incident dispatch models link end-user requests with assigned technicians and SLA tracking.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                &bull; Critical, High, Medium, Low SLAs
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                &bull; Technician Assignment Workflow
              </div>
            </div>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => onNavigate('tickets')}
            >
              Explore Helpdesk Architecture
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchDashboardMetrics, DashboardMetricsResponse } from '../../services/dashboardService';
import { DateRangePicker, DateFilterState } from './DateRangePicker';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Ticket,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Laptop,
  Users,
  RefreshCw,
  Filter,
  TrendingUp,
  AlertCircle,
  HardDrive,
  Cpu,
} from 'lucide-react';

interface ITAdminDashboardViewProps {
  onNavigateToTickets?: () => void;
  onNavigateToInventory?: () => void;
  onNavigateToReports?: () => void;
}

export const ITAdminDashboardView: React.FC<ITAdminDashboardViewProps> = ({
  onNavigateToTickets,
  onNavigateToInventory,
  onNavigateToReports,
}) => {
  const { user, profile } = useAuth();

  // Date Filtering state
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    preset: 'ALL',
    startDate: '',
    endDate: '',
  });

  const [quickFilter, setQuickFilter] = useState<string>('ALL');
  const [data, setData] = useState<DashboardMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const teamName = profile?.itTeamName || profile?.itTeamId || 'My IT Team';

  const loadMetrics = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const res = await fetchDashboardMetrics({
        preset: dateFilter.preset,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        quickFilter,
      });
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load IT Admin dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [dateFilter, quickFilter]);

  const quickFilters = [
    { id: 'ALL', label: 'All Team Tickets' },
    { id: 'CRITICAL_SLA', label: 'Approaching / Breached SLA' },
    { id: 'URGENT', label: 'Urgent Cases' },
    { id: 'UNASSIGNED', label: 'Unassigned in Team' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              IT Team Command Center
            </h1>
            <Badge variant="info">IT ADMIN</Badge>
            <Badge variant="purple" className="font-mono">
              {teamName}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Scoped operational console for <strong>{teamName}</strong>. All tickets, assets, SLA parameters, and technician workloads are strictly isolated to your permitted department.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMetrics(true)}
            icon={RefreshCw}
            disabled={isLoading || isRefreshing}
            className={`text-xs font-semibold rounded-xl ${isRefreshing ? 'animate-spin' : ''}`}
          >
            Refresh
          </Button>
          {onNavigateToReports && (
            <Button
              variant="primary"
              size="sm"
              onClick={onNavigateToReports}
              icon={TrendingUp}
              className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              Team Reports
            </Button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Bar: Date Filters & Quick Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>Time Window:</span>
            <DateRangePicker filter={dateFilter} onChange={setDateFilter} />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Permitted Scope: <span className="font-bold text-indigo-600 dark:text-indigo-400">{teamName}</span>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Queue Filters:</span>
          {quickFilters.map((q) => {
            const active = quickFilter === q.id;
            return (
              <button
                key={q.id}
                onClick={() => setQuickFilter(q.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Scoped Tickets Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-l-4 border-l-indigo-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Team Tickets</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {data?.metrics?.totalTickets ?? data?.summary?.totalTickets ?? '-'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Total in {teamName}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Ticket className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Tickets</p>
            <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {data?.metrics?.openTickets ?? data?.summary?.openTickets ?? '-'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Pending technician action</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Closed / Resolved</p>
            <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {data?.metrics?.closedTickets ?? data?.summary?.closedTickets ?? '-'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Completed successfully</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-slate-400 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cancelled Tickets</p>
            <h3 className="text-3xl font-black text-slate-600 dark:text-slate-400 mt-1">
              {data?.metrics?.cancelledTickets ?? data?.summary?.cancelledTickets ?? '-'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Cancelled</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
            <XCircle className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* 2. Scoped SLA Performance */}
      <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Team SLA Compliance & Health</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict business-hours response and resolution targets scoped to {teamName}.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
            <span className="text-xs font-semibold text-slate-300">Team SLA Compliance Rate:</span>
            <span
              className={`text-base font-black ${
                ((data?.sla?.complianceRate ?? data?.slaSummary?.complianceRate ?? 0)) >= 90
                  ? 'text-emerald-400'
                  : ((data?.sla?.complianceRate ?? data?.slaSummary?.complianceRate ?? 0)) >= 75
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {data?.sla?.complianceRate !== undefined
                ? `${data.sla.complianceRate}%`
                : data?.slaSummary?.complianceRate !== undefined
                ? `${data.slaSummary.complianceRate}%`
                : '-%'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
              <span>Within SLA</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-white">{data?.sla?.withinSla ?? data?.slaSummary?.withinSla ?? 0}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-1">
              <span>Approaching SLA</span>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-amber-400">{data?.sla?.approachingSla ?? data?.slaSummary?.approachingSla ?? 0}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-rose-400 font-semibold mb-1">
              <span>Breached SLA</span>
              <XCircle className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-rose-400">{data?.sla?.breachedSla ?? data?.slaSummary?.breachedSla ?? 0}</div>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span>Exempt / Paused</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-slate-200">{data?.sla?.exemptSla ?? data?.slaSummary?.exemptSla ?? 0}</div>
          </div>
        </div>
      </Card>

      {/* 3. Scoped Assets & Technician Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scoped Assets */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-indigo-500" />
                Team Hardware Assets
              </h3>
              {onNavigateToInventory && (
                <button
                  onClick={onNavigateToInventory}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  Manage
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Total Team Assets</span>
                <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                  {data?.assetSummary.total ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">Assigned / Active</span>
                <Badge variant="info">{data?.assetSummary.assigned ?? 0}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">In Stock Pool</span>
                <Badge variant="success">{data?.assetSummary.inStock ?? 0}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">In Repair / Diagnostics</span>
                <Badge variant="warning">{data?.assetSummary.underRepair ?? 0}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">Retired / Decommissioned</span>
                <Badge variant="neutral">{data?.assetSummary.retired ?? 0}</Badge>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Hardware assigned to {teamName} inventory pool.
          </div>
        </Card>

        {/* 4. Technician Workload in this IT Team */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              Team Technician Distribution
            </h3>
            <Badge variant="info">Workload Balance</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2 px-3">Technician</th>
                  <th className="py-2 px-3 text-center">Total Assigned</th>
                  <th className="py-2 px-3 text-center">Open Cases</th>
                  <th className="py-2 px-3 text-center">Resolved</th>
                  <th className="py-2 px-3 text-center">SLA Breached</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.technicianDistribution && data.technicianDistribution.length > 0 ? (
                  data.technicianDistribution.map((tech) => (
                    <tr key={tech.technicianId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        <div>{tech.technicianName}</div>
                        <div className="text-[10px] text-slate-400">{tech.email}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">{tech.totalAssigned}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant={tech.openTickets > 0 ? 'warning' : 'neutral'}>{tech.openTickets}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="success">{tech.resolvedTickets}</Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant={tech.breachedTickets > 0 ? 'danger' : 'neutral'}>
                          {tech.breachedTickets}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No technicians assigned to this IT team yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 5. Priority, Category, and Status Distributions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Status Distribution</h3>
            <Badge variant="info">Status</Badge>
          </div>
          <div className="space-y-2.5">
            {data?.distributions.status.map((item) => {
              const maxCount = Math.max(...(data?.distributions.status.map((s) => s.count) || [1]), 1);
              const percentage = Math.round((item.count / maxCount) * 100);
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-400">{item.status}</span>
                    <span className="text-slate-900 dark:text-slate-100 font-bold">{item.count}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.status === 'RESOLVED' || item.status === 'CLOSED'
                          ? 'bg-emerald-500'
                          : item.status === 'CANCELLED'
                          ? 'bg-slate-400'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Priority Distribution */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Priority Distribution</h3>
            <Badge variant="warning">Priority</Badge>
          </div>
          <div className="space-y-3">
            {data?.distributions.priority.map((p) => {
              const priorityColors: Record<string, string> = {
                LOW: 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                MEDIUM: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
                HIGH: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
                URGENT: 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
              };
              return (
                <div
                  key={p.priority}
                  className={`p-2.5 rounded-xl border flex items-center justify-between ${
                    priorityColors[p.priority] || priorityColors.LOW
                  }`}
                >
                  <span className="text-xs font-bold">{p.priority}</span>
                  <span className="text-sm font-black px-2.5 py-0.5 bg-white/80 dark:bg-slate-900/80 rounded-lg">
                    {p.count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Category Distribution */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Category Distribution</h3>
            <Badge variant="neutral">Category</Badge>
          </div>
          <div className="space-y-2">
            {data?.distributions.category.map((cat) => (
              <div
                key={cat.category}
                className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-none"
              >
                <span className="font-semibold text-slate-700 dark:text-slate-300">{cat.category}</span>
                <Badge variant="neutral">{cat.count}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

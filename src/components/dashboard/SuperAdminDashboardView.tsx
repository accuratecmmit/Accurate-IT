import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMasterData } from '../../context/MasterDataContext';
import { fetchDashboardMetrics, DashboardMetricsResponse } from '../../services/dashboardService';
import { adminApproveUser, adminRejectUser } from '../../services/authService';
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
  UserCheck,
  UserX,
  Activity,
  Filter,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  HardDrive,
  Cpu,
  Layers,
  Building,
} from 'lucide-react';

interface SuperAdminDashboardViewProps {
  onNavigateToTickets?: () => void;
  onNavigateToUsers?: () => void;
  onNavigateToInventory?: () => void;
  onNavigateToTeams?: () => void;
  onNavigateToReports?: () => void;
}

export const SuperAdminDashboardView: React.FC<SuperAdminDashboardViewProps> = ({
  onNavigateToTickets,
  onNavigateToUsers,
  onNavigateToInventory,
  onNavigateToTeams,
  onNavigateToReports,
}) => {
  const { user } = useAuth();
  const { itTeams } = useMasterData();

  // Filter States
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    preset: 'ALL',
    startDate: '',
    endDate: '',
  });
  const [quickFilter, setQuickFilter] = useState<string>('ALL');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');

  // Data States
  const [data, setData] = useState<DashboardMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load metrics from API
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
        itTeamId: selectedTeamId,
      });
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load Super Admin dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [dateFilter, quickFilter, selectedTeamId]);

  const handleApproveRegistration = async (userId: string, name: string) => {
    try {
      await adminApproveUser(userId);
      setActionSuccess(`Approved user account for ${name}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      loadMetrics(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve registration.');
    }
  };

  const handleRejectRegistration = async (userId: string, name: string) => {
    const reason = window.prompt(`Please enter rejection reason for ${name}:`);
    if (!reason) return;
    try {
      await adminRejectUser(userId, reason);
      setActionSuccess(`Rejected registration for ${name}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      loadMetrics(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject registration.');
    }
  };

  const quickFilters = [
    { id: 'ALL', label: 'All Tickets' },
    { id: 'CRITICAL_SLA', label: 'Approaching / Breached SLA' },
    { id: 'URGENT', label: 'Urgent / Critical' },
    { id: 'UNASSIGNED', label: 'Unassigned Queue' },
    { id: 'MY_TICKETS', label: 'My Tickets' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Enterprise Executive Dashboard
            </h1>
            <Badge variant="purple">SUPER ADMIN</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time organizational telemetry across IT teams, ticket queues, SLA compliance, and asset pools.
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
              Export Reports
            </Button>
          )}
        </div>
      </div>

      {/* Action Messages */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Global Filter Bar: Date Filters & Quick Filters & IT Team Scoping */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4 text-indigo-500" />
            <span>Time Window:</span>
            <DateRangePicker filter={dateFilter} onChange={setDateFilter} />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 shrink-0">IT Team Scope:</label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All IT Teams (Global)</option>
              {(itTeams || [])
                .filter((t) => !t.isDeleted)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.code})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Filters:</span>
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

      {/* 4 Primary Ticket Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tickets */}
        <Card className="p-5 border-l-4 border-l-indigo-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Tickets</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {data?.metrics?.totalTickets ?? data?.summary?.totalTickets ?? '-'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Evaluated in date window</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Ticket className="w-6 h-6" />
          </div>
        </Card>

        {/* Open Tickets */}
        <Card className="p-5 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Tickets</p>
            <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {data?.metrics?.openTickets ?? data?.summary?.openTickets ?? '-'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Active in queue / assigned</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </Card>

        {/* Closed / Resolved Tickets */}
        <Card className="p-5 border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Closed Tickets</p>
            <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {data?.metrics?.closedTickets ?? data?.summary?.closedTickets ?? '-'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Resolved or closed</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </Card>

        {/* Cancelled Tickets */}
        <Card className="p-5 border-l-4 border-l-slate-400 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cancelled Tickets</p>
            <h3 className="text-3xl font-black text-slate-600 dark:text-slate-400 mt-1">
              {data?.metrics?.cancelledTickets ?? data?.summary?.cancelledTickets ?? '-'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Cancelled by user/admin</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
            <XCircle className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* SLA & Compliance Panel */}
      <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">SLA Performance & Service Target Health</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Working-hours SLA tracking: Business hours (09:00 - 18:00), excluding weekly holidays & public holidays.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-xl border border-slate-700">
            <span className="text-xs font-semibold text-slate-300">Overall SLA Compliance:</span>
            <span
              className={`text-base font-black ${
                (data?.sla.complianceRate || 0) >= 90
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
          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
              <span>Within SLA</span>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-white">{data?.sla?.withinSla ?? data?.slaSummary?.withinSla ?? 0}</div>
            <div className="text-[10px] text-slate-400 mt-1">Healthy tickets on target</div>
          </div>

          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-amber-400 font-semibold mb-1">
              <span>Approaching SLA</span>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-amber-400">{data?.sla?.approachingSla ?? data?.slaSummary?.approachingSla ?? 0}</div>
            <div className="text-[10px] text-slate-400 mt-1">&lt; 20% remaining window</div>
          </div>

          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-rose-400 font-semibold mb-1">
              <span>Breached SLA</span>
              <XCircle className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-rose-400">{data?.sla?.breachedSla ?? data?.slaSummary?.breachedSla ?? 0}</div>
            <div className="text-[10px] text-slate-400 mt-1">Escalated or breached</div>
          </div>

          <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
              <span>Exempt / Paused</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-black text-slate-200">{data?.sla?.exemptSla ?? data?.slaSummary?.exemptSla ?? 0}</div>
            <div className="text-[10px] text-slate-400 mt-1">Cancelled or user pending</div>
          </div>
        </div>
      </Card>

      {/* Distributions Grid: Status, Priority, Category */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Status Distribution</h3>
            <Badge variant="info">Workflow</Badge>
          </div>
          <div className="space-y-2.5">
            {(data?.distributions?.status || data?.statusDistribution || []).map((item) => {
              const maxCount = Math.max(...((data?.distributions?.status || data?.statusDistribution || []).map((s) => s.count) || [1]), 1);
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
            <Badge variant="warning">Impact</Badge>
          </div>
          <div className="space-y-3">
            {(data?.distributions?.priority || data?.priorityDistribution || []).map((p) => {
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
            <Badge variant="neutral">Domains</Badge>
          </div>
          <div className="space-y-2">
            {(data?.distributions?.category || data?.categoryDistribution || []).map((cat) => (
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

      {/* IT Team Distribution & Performance */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" />
              IT Team Distribution & Queue Ownership
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Workload and SLA performance across all decoupled master data IT teams.
            </p>
          </div>
          {onNavigateToTeams && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNavigateToTeams}
              icon={ExternalLink}
              className="text-xs font-semibold rounded-xl"
            >
              Manage IT Teams
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Team Code</th>
                <th className="py-2.5 px-3">Team Name</th>
                <th className="py-2.5 px-3 text-center">Total Tickets</th>
                <th className="py-2.5 px-3 text-center">Open Tickets</th>
                <th className="py-2.5 px-3 text-center">SLA Breached</th>
                <th className="py-2.5 px-3 text-right">Queue Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.itTeamDistribution && data.itTeamDistribution.length > 0 ? (
                data.itTeamDistribution.map((t, idx) => (
                  <tr key={t?.teamId || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {t?.teamCode || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{t?.teamName || '-'}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                      {t?.totalTickets ?? 0}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={(t?.openTickets ?? 0) > 0 ? 'warning' : 'neutral'}>{t?.openTickets ?? 0}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={(t?.breachedTickets ?? 0) > 0 ? 'danger' : 'success'}>{t?.breachedTickets ?? 0}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-semibold ${
                          (t?.breachedTickets ?? 0) === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {(t?.breachedTickets ?? 0) === 0 ? '100% On-Target' : `${t?.breachedTickets ?? 0} At Risk`}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No IT teams configured or active.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Technician Distribution & Workload */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              Technician Distribution & Individual Workload
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Assigned tickets, open cases, and resolution throughput by technician.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Technician</th>
                <th className="py-2.5 px-3">IT Team</th>
                <th className="py-2.5 px-3 text-center">Total Assigned</th>
                <th className="py-2.5 px-3 text-center">Open Tickets</th>
                <th className="py-2.5 px-3 text-center">Resolved</th>
                <th className="py-2.5 px-3 text-center">SLA Breached</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.technicianDistribution && data.technicianDistribution.length > 0 ? (
                data.technicianDistribution.map((tech) => (
                  <tr key={tech.technicianId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      <div>{tech.technicianName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{tech.email}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {tech.itTeamName || 'Unassigned'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">{tech.totalAssigned}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={tech.openTickets > 0 ? 'warning' : 'neutral'}>{tech.openTickets}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="success">{tech.resolvedTickets}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={tech.breachedTickets > 0 ? 'danger' : 'neutral'}>{tech.breachedTickets}</Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No active technicians registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bottom Grid: Asset Summary & Registration Approvals & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Summary */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-indigo-500" />
                Asset & Inventory Summary
              </h3>
              {onNavigateToInventory && (
                <button
                  onClick={onNavigateToInventory}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  View All
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="font-semibold text-slate-600 dark:text-slate-400">Total Tracked Assets</span>
                <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                  {data?.assetSummary.total ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">Assigned to Staff</span>
                <Badge variant="info">{data?.assetSummary.assigned ?? 0}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">In Stock / Available</span>
                <Badge variant="success">{data?.assetSummary.inStock ?? 0}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">Under Repair / Maintenance</span>
                <Badge variant="warning">{data?.assetSummary.underRepair ?? 0}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">Retired / Decommissioned</span>
                <Badge variant="neutral">{data?.assetSummary.retired ?? 0}</Badge>
              </div>
              <div className="flex justify-between items-center text-xs py-1">
                <span className="text-slate-500">Lost / Inactive</span>
                <Badge variant="danger">{data?.assetSummary.lostStolen ?? 0}</Badge>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Hardware lifecycle fully audited and tied to employee department allocations.
          </div>
        </Card>

        {/* Registration Approvals */}
        <Card className="p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-500" />
                Registration Approvals
              </h3>
              <Badge variant={data?.registrationApprovals.length ? 'warning' : 'neutral'}>
                {data?.registrationApprovals.length || 0} Pending
              </Badge>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {data?.registrationApprovals && data.registrationApprovals.length > 0 ? (
                data.registrationApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">{req.displayName}</div>
                        <div className="text-[11px] text-slate-500">{req.email}</div>
                      </div>
                      <Badge variant="purple">{req.requestedRole}</Badge>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {req.companyName} • {req.locationName} • {req.departmentName || req.departmentId || 'General'}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApproveRegistration(req.id, req.displayName)}
                        className="text-[11px] py-1 px-2.5 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleRejectRegistration(req.id, req.displayName)}
                        className="text-[11px] py-1 px-2.5 h-7 rounded-lg text-rose-600 dark:text-rose-400 font-semibold"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                  No pending registration approvals.
                </div>
              )}
            </div>
          </div>

          {onNavigateToUsers && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToUsers}
                icon={Users}
                className="w-full text-xs font-semibold rounded-xl"
              >
                Open User Management
              </Button>
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" />
              Recent Audit Activity
            </h3>
            <Badge variant="neutral">Append-Only</Badge>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              data.recentActivity.map((log) => (
                <div key={log.id} className="text-xs pb-2 border-b border-slate-100 dark:border-slate-800 last:border-none">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{log.actorName}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-1">{log.action}</span>
                    <span className="text-slate-500 dark:text-slate-400">({log.entityType})</span>
                  </div>
                  {log.details && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{log.details}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">No recent activity logs recorded.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

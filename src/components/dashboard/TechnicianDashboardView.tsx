import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchDashboardMetrics, DashboardMetricsResponse } from '../../services/dashboardService';
import { assignTicket, updateTicketStatus, StoredTicket } from '../../services/ticketService';
import { markNotificationAsRead, markAllNotificationsAsRead } from '../../services/notificationService';
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
  Bell,
  RefreshCw,
  Filter,
  UserCheck,
  CheckCheck,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  HardDrive,
  ArrowRight,
} from 'lucide-react';

interface TechnicianDashboardViewProps {
  onNavigateToTickets?: () => void;
  onNavigateToInventory?: () => void;
}

export const TechnicianDashboardView: React.FC<TechnicianDashboardViewProps> = ({
  onNavigateToTickets,
  onNavigateToInventory,
}) => {
  const { user, profile } = useAuth();

  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    preset: 'ALL',
    startDate: '',
    endDate: '',
  });

  const [data, setData] = useState<DashboardMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ASSIGNED' | 'UNASSIGNED'>('ASSIGNED');

  const loadMetrics = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const res = await fetchDashboardMetrics({
        preset: dateFilter.preset,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
      });
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load technician dashboard');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [dateFilter]);

  // Claim unassigned ticket
  const handleTakeTicket = async (ticketId: string, ticketNumber: string) => {
    if (!user) return;
    try {
      await assignTicket(ticketId, user.id);
      setActionSuccess(`Successfully claimed ticket #${ticketNumber}!`);
      setTimeout(() => setActionSuccess(null), 4000);
      loadMetrics(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to claim ticket');
    }
  };

  // Quick status update for assigned ticket
  const handleQuickStatus = async (ticketId: string, newStatus: any) => {
    try {
      await updateTicketStatus(ticketId, newStatus);
      setActionSuccess(`Ticket status updated to ${newStatus}`);
      setTimeout(() => setActionSuccess(null), 4000);
      loadMetrics(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update ticket status');
    }
  };

  // Mark notification read
  const handleMarkNotification = async (notifId: string) => {
    try {
      await markNotificationAsRead(notifId);
      loadMetrics(true);
    } catch (err) {
      // silent
    }
  };

  const handleMarkAllNotifications = async () => {
    try {
      await markAllNotificationsAsRead();
      loadMetrics(true);
    } catch (err) {
      // silent
    }
  };

  const assignedTickets = data?.technicianData?.assignedTickets || [];
  const unassignedTickets = data?.technicianData?.unassignedTickets || [];
  const assignedAssets = data?.technicianData?.assignedAssets || [];
  const notifications = data?.technicianData?.notifications || [];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Technician Workspace
            </h1>
            <Badge variant="info">IT TECHNICIAN</Badge>
            <Badge variant="neutral">{profile?.itTeamName || 'Service Team'}</Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your assigned incident tickets, claim unassigned team requests, monitor SLA targets, and inspect linked hardware assets.
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
          {onNavigateToTickets && (
            <Button
              variant="primary"
              size="sm"
              onClick={onNavigateToTickets}
              icon={Ticket}
              className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              Full Ticket Desk
            </Button>
          )}
        </div>
      </div>

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

      {/* Date Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
          <Filter className="w-4 h-4 text-indigo-500" />
          <span>Time Window:</span>
          <DateRangePicker filter={dateFilter} onChange={setDateFilter} />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Assigned to: <strong className="text-slate-800 dark:text-slate-200">{user?.displayName || user?.email}</strong>
        </div>
      </div>

      {/* 4 SLA & Workload Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Assigned Count */}
        <Card className="p-5 border-l-4 border-l-indigo-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Assigned Tickets</p>
            <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {assignedTickets.length}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Active workload</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Ticket className="w-6 h-6" />
          </div>
        </Card>

        {/* Unassigned Can Take */}
        <Card className="p-5 border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unassigned Queue</p>
            <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {unassignedTickets.length}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Available to claim in team</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <UserCheck className="w-6 h-6" />
          </div>
        </Card>

        {/* SLA Status: Breached or Approaching */}
        <Card className="p-5 border-l-4 border-l-rose-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">SLA Breached</p>
            <h3 className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {assignedTickets.filter((t) => t.slaStatus === 'BREACHED' || t.isSlaBreached).length}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">Requires urgent resolution</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </Card>

        {/* SLA Approaching */}
        <Card className="p-5 border-l-4 border-l-amber-400 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approaching SLA</p>
            <h3 className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {assignedTickets.filter((t) => t.slaStatus === 'APPROACHING_SLA').length}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">&lt; 20% SLA remaining</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-500">
            <Clock className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Main Split: Ticket Workload (Assigned & Unassigned) + Sidebar (Assets & Notifications) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Ticket Queues */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            {/* Tabs for Assigned vs Unassigned */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('ASSIGNED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'ASSIGNED'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  My Assigned Tickets ({assignedTickets.length})
                </button>
                <button
                  onClick={() => setActiveTab('UNASSIGNED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'UNASSIGNED'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  Unassigned Tickets to Claim ({unassignedTickets.length})
                </button>
              </div>

              <span className="text-xs text-slate-400">
                {activeTab === 'ASSIGNED' ? 'Sorted by urgency & SLA' : 'Available in your team'}
              </span>
            </div>

            {/* List */}
            {activeTab === 'ASSIGNED' ? (
              <div className="space-y-3">
                {assignedTickets.length > 0 ? (
                  assignedTickets.map((ticket) => {
                    const isBreached = ticket.slaStatus === 'BREACHED' || ticket.isSlaBreached;
                    const isApproaching = ticket.slaStatus === 'APPROACHING_SLA';

                    return (
                      <div
                        key={ticket.id}
                        className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 transition-colors space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              #{ticket.ticketNumber}
                            </span>
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                              {ticket.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* SLA Badge */}
                            <Badge variant={isBreached ? 'danger' : isApproaching ? 'warning' : 'success'}>
                              {isBreached ? 'SLA BREACHED' : isApproaching ? 'APPROACHING SLA' : 'WITHIN SLA'}
                            </Badge>
                            <Badge variant={ticket.priority === 'URGENT' ? 'danger' : 'info'}>
                              {ticket.priority}
                            </Badge>
                            <Badge variant="neutral">{ticket.status}</Badge>
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {ticket.description}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-400">
                          <div>
                            Requester: <strong className="text-slate-700 dark:text-slate-300">{ticket.requesterName}</strong>{' '}
                            • {ticket.category}
                            {ticket.relatedAssetTag && (
                              <span className="ml-2 font-mono text-indigo-500">
                                💻 Asset: {ticket.relatedAssetTag}
                              </span>
                            )}
                          </div>

                          {/* Quick Status Change */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Set Status:</span>
                            {ticket.status !== 'IN_PROGRESS' && (
                              <button
                                onClick={() => handleQuickStatus(ticket.id, 'IN_PROGRESS')}
                                className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded font-semibold text-[10px] hover:bg-blue-100"
                              >
                                In Progress
                              </button>
                            )}
                            {ticket.status !== 'WAITING_FOR_USER' && (
                              <button
                                onClick={() => handleQuickStatus(ticket.id, 'WAITING_FOR_USER')}
                                className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded font-semibold text-[10px] hover:bg-amber-100"
                              >
                                Wait User
                              </button>
                            )}
                            {ticket.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleQuickStatus(ticket.id, 'RESOLVED')}
                                className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded font-semibold text-[10px] hover:bg-emerald-100"
                              >
                                Resolve
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
                    <p className="text-xs font-semibold">No assigned tickets in this time window.</p>
                    <p className="text-[11px] text-slate-400">
                      Check the &quot;Unassigned Tickets&quot; tab to take on active requests.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {unassignedTickets.length > 0 ? (
                  unassignedTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:border-amber-400 transition-colors space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                            #{ticket.ticketNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {ticket.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant={ticket.priority === 'URGENT' ? 'danger' : 'warning'}>
                            {ticket.priority}
                          </Badge>
                          <Badge variant="neutral">{ticket.category}</Badge>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {ticket.description}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-400">
                        <div>
                          From: <strong className="text-slate-700 dark:text-slate-300">{ticket.requesterName}</strong> •{' '}
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleTakeTicket(ticket.id, ticket.ticketNumber)}
                          icon={UserCheck}
                          className="text-xs py-1 px-3 h-7 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                        >
                          Assign to Me
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
                    <p className="text-xs font-semibold">Queue clean! No unassigned tickets in your IT team.</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right 1 Col: Relevant Assets & Notifications */}
        <div className="space-y-6">
          {/* Relevant Assets (Assets linked to technician's assigned tickets) */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Laptop className="w-4 h-4 text-indigo-500" />
                Relevant Assets
              </h3>
              <Badge variant="neutral">{assignedAssets.length}</Badge>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {assignedAssets.length > 0 ? (
                assignedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {asset.assetTag}
                      </span>
                      <Badge variant="info">{asset.status}</Badge>
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{asset.name}</div>
                    <div className="text-[10px] text-slate-400">
                      {asset.manufacturer} {asset.model} • SN: {asset.serialNumber || 'N/A'}
                    </div>
                    {asset.assignedUserName && (
                      <div className="text-[10px] text-slate-500 font-medium">
                        User: {asset.assignedUserName} ({asset.assignedUserEmail})
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No assets currently tied to your assigned tickets.
                </div>
              )}
            </div>
          </Card>

          {/* Notifications */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Notifications</h3>
              </div>
              {notifications.some((n) => !n.isRead) && (
                <button
                  onClick={handleMarkAllNotifications}
                  className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Mark All Read
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => !notif.isRead && handleMarkNotification(notif.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      notif.isRead
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-75'
                        : 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{notif.title}</div>
                      {!notif.isRead && <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {notif.message}
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1.5">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">No notifications.</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

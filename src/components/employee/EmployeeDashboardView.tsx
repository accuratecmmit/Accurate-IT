import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchTickets,
  fetchTicketById,
  createTicket,
  addTicketComment,
  StoredTicket,
  TicketComment,
} from '../../services/ticketService';
import { fetchAssets, StoredAsset } from '../../services/assetService';
import {
  fetchMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  UserNotification,
} from '../../services/notificationService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DateRangePicker, DateFilterState } from '../dashboard/DateRangePicker';
import {
  Ticket,
  Laptop,
  Bell,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Send,
  X,
  ExternalLink,
  ChevronRight,
  User,
  ShieldCheck,
  HardDrive,
  Cpu,
  Monitor,
  CheckCheck,
  Calendar,
  Building,
  MapPin,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

interface EmployeeDashboardViewProps {
  onNavigateToProfile?: () => void;
  onNavigateToTickets?: () => void;
  onNavigateToInventory?: () => void;
}

export const EmployeeDashboardView: React.FC<EmployeeDashboardViewProps> = ({
  onNavigateToProfile,
  onNavigateToTickets,
  onNavigateToInventory,
}) => {
  const { user, profile, effectiveRole } = useAuth();

  // Data states
  const [tickets, setTickets] = useState<StoredTicket[]>([]);
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters for My Tickets
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');
  const [ticketSearchTerm, setTicketSearchTerm] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    preset: 'ALL',
    startDate: '',
    endDate: '',
  });

  // Notifications Filter Tab
  const [notifTab, setNotifTab] = useState<'UNREAD' | 'ALL'>('UNREAD');

  // Ticket Detail Drawer
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<StoredTicket | null>(null);
  const [ticketComments, setTicketComments] = useState<TicketComment[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Create Ticket Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('HARDWARE');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [newRelatedAssetId, setNewRelatedAssetId] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Load employee data
  const loadDashboardData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorMsg(null);

    try {
      const [ticketRes, assetRes, notifRes] = await Promise.all([
        fetchTickets(),
        fetchAssets(),
        fetchMyNotifications(),
      ]);

      if (ticketRes.tickets) {
        setTickets(ticketRes.tickets);
      }
      if (assetRes.assets) {
        setAssets(assetRes.assets);
      }
      if (notifRes.notifications) {
        setNotifications(notifRes.notifications);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load employee dashboard.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?.id, effectiveRole]);

  // Load ticket detail when drawer opens
  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicket(null);
      setTicketComments([]);
      return;
    }

    const loadDetail = async () => {
      setIsDetailLoading(true);
      const res = await fetchTicketById(selectedTicketId);
      if (res.ticket) {
        setSelectedTicket(res.ticket);
        setTicketComments(res.comments || []);
      }
      setIsDetailLoading(false);
    };

    loadDetail();
  }, [selectedTicketId]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Ticket Summary Counts
  const totalMyTickets = (tickets || []).length;
  const newCount = (tickets || []).filter((t) => t.status === 'NEW').length;
  const inProgressCount = (tickets || []).filter((t) => t.status === 'IN_PROGRESS' || t.status === 'OPEN').length;
  const waitingForUserCount = (tickets || []).filter((t) => t.status === 'PENDING_USER').length;
  const resolvedCount = (tickets || []).filter((t) => t.status === 'RESOLVED').length;
  const closedCount = (tickets || []).filter((t) => t.status === 'CLOSED').length;

  // Filtered Tickets
  const filteredTickets = (tickets || []).filter((t) => {
    // Date Filtering
    if (dateFilter.preset !== 'ALL') {
      const ticketDate = new Date(t.createdAt).getTime();
      const now = new Date();
      if (dateFilter.preset === 'TODAY') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        if (ticketDate < start || ticketDate > end) return false;
      } else if (dateFilter.preset === 'THIS_WEEK') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        if (ticketDate < start.getTime()) return false;
      } else if (dateFilter.preset === 'THIS_MONTH') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        if (ticketDate < start) return false;
      } else if (dateFilter.preset === 'LAST_MONTH') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
        if (ticketDate < start || ticketDate > end) return false;
      } else if (dateFilter.preset === 'CUSTOM') {
        if (dateFilter.startDate) {
          const start = new Date(dateFilter.startDate).getTime();
          if (ticketDate < start) return false;
        }
        if (dateFilter.endDate) {
          const end = new Date(`${dateFilter.endDate}T23:59:59.999Z`).getTime();
          if (ticketDate > end) return false;
        }
      }
    }

    const matchesSearch =
      t.ticketNumber.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
      t.title.toLowerCase().includes(ticketSearchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(ticketSearchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (ticketStatusFilter === 'ALL') return true;
    if (ticketStatusFilter === 'NEW') return t.status === 'NEW';
    if (ticketStatusFilter === 'IN_PROGRESS') return t.status === 'IN_PROGRESS' || t.status === 'OPEN';
    if (ticketStatusFilter === 'PENDING_USER') return t.status === 'PENDING_USER';
    if (ticketStatusFilter === 'RESOLVED') return t.status === 'RESOLVED';
    if (ticketStatusFilter === 'CLOSED') return t.status === 'CLOSED';

    return t.status === ticketStatusFilter;
  });

  // Filtered Notifications
  const unreadNotifications = (notifications || []).filter((n) => !n.isRead);
  const displayedNotifications = notifTab === 'UNREAD' ? unreadNotifications : (notifications || []);

  // Mark single notification read
  const handleMarkNotifRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  // Mark all notifications read
  const handleMarkAllNotifsRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    showNotification('All notifications marked as read.');
  };

  // Notification click handling
  const handleNotificationClick = async (notif: UserNotification) => {
    if (!notif.isRead) {
      await markNotificationAsRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
    }

    // 1. If relates to ticket
    if (notif.referenceEntityType === 'TICKET' && notif.referenceEntityId) {
      setSelectedTicketId(notif.referenceEntityId);
      return;
    }

    // Try finding ticket number mentioned in title or message (e.g. TCK-10001)
    const match = `${notif.title} ${notif.message}`.match(/TCK-\d+/i);
    if (match) {
      const found = tickets.find((t) => t.ticketNumber.toUpperCase() === match[0].toUpperCase());
      if (found) {
        setSelectedTicketId(found.id);
        return;
      }
    }

    // 2. If relates to profile change
    if (notif.referenceEntityType === 'PROFILE_CHANGE' || notif.title.toLowerCase().includes('profile')) {
      if (onNavigateToProfile) {
        onNavigateToProfile();
      }
      return;
    }

    // 3. If relates to hardware asset
    if (notif.referenceEntityType === 'ASSET') {
      const el = document.getElementById('my-it-assets-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Submit comment on ticket
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await addTicketComment(selectedTicket.id, newComment.trim(), false);
      if (res.comment) {
        setTicketComments((prev) => [...prev, res.comment!]);
        setNewComment('');
        showNotification('Reply sent to IT Technician.');
        // Refresh ticket to update last updated date
        loadDashboardData(true);
      } else {
        setErrorMsg(res.error || 'Failed to post reply.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Create new ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) {
      setErrorMsg('Ticket title and description are required.');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const res = await createTicket({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
        priority: newPriority,
        relatedAssetId: newRelatedAssetId || undefined,
      });

      if (res.ticket) {
        setTickets((prev) => [res.ticket!, ...prev]);
        setIsCreateModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setNewCategory('HARDWARE');
        setNewPriority('MEDIUM');
        setNewRelatedAssetId('');
        showNotification(`Ticket ${res.ticket.ticketNumber} submitted successfully.`);
      } else {
        setErrorMsg(res.error || 'Failed to create ticket.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create ticket.');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // Pre-fill asset issue ticket
  const handleReportAssetIssue = (asset: StoredAsset) => {
    setNewRelatedAssetId(asset.id);
    setNewCategory('HARDWARE');
    setNewTitle(`Hardware Issue: ${asset.name} (${asset.assetTag})`);
    setNewDescription(`Reporting technical issue with assigned ${asset.assetType.toLowerCase()} ${asset.manufacturer} ${asset.model} (Tag: ${asset.assetTag}, S/N: ${asset.serialNumber}).\n\nSymptoms: `);
    setIsCreateModalOpen(true);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <Badge variant="danger">URGENT</Badge>;
      case 'HIGH':
        return <Badge variant="warning">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge variant="info">MEDIUM</Badge>;
      default:
        return <Badge variant="neutral">LOW</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return <Badge variant="success">RESOLVED</Badge>;
      case 'CLOSED':
        return <Badge variant="neutral">CLOSED</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="purple">IN PROGRESS</Badge>;
      case 'OPEN':
        return <Badge variant="info">OPEN</Badge>;
      case 'PENDING_USER':
        return <Badge variant="warning">WAITING FOR USER</Badge>;
      case 'NEW':
        return <Badge variant="warning">NEW</Badge>;
      default:
        return <Badge variant="neutral">{status.replace('_', ' ')}</Badge>;
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Welcome Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-lg">
                {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'E'}
              </span>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Welcome back, {user?.displayName || 'Employee'}
                </h1>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{user?.designation || 'Staff Member'}</span>
                  <span>•</span>
                  <span>{user?.departmentName || 'General Department'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Secure Isolated Workspace
                  </span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              disabled={isRefreshing}
              onClick={() => loadDashboardData(true)}
              className="text-xs rounded-xl"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>

            {onNavigateToProfile && (
              <Button
                variant="outline"
                size="sm"
                icon={User}
                onClick={onNavigateToProfile}
                className="text-xs rounded-xl"
              >
                My Profile
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setIsCreateModalOpen(true)}
              className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-xs"
            >
              Create IT Ticket
            </Button>
          </div>
        </div>

        {/* Floating subtle badge */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              Company: <strong className="text-slate-700 dark:text-slate-300 font-medium">{user?.companyName || 'Accurate Group'}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Location: <strong className="text-slate-700 dark:text-slate-300 font-medium">{user?.locationName || 'Corporate HQ'}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              Computer Tag: <strong className="text-slate-700 dark:text-slate-300 font-medium">{user?.assetTag || 'Pending IT Assignment'}</strong>
            </span>
          </div>

          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Strict Data Isolation Enforced
          </div>
        </div>
      </div>

      {/* Success / Error Banners */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: TICKET SUMMARY (Exact user prompt requirements) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Ticket Summary
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Click any metric to filter tickets below
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {/* Total My Tickets */}
          <button
            onClick={() => setTicketStatusFilter('ALL')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              ticketStatusFilter === 'ALL'
                ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">Total My Tickets</span>
              <Ticket className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {totalMyTickets}
            </div>
            <span className="text-3xs text-slate-400 mt-1 block">All support requests</span>
          </button>

          {/* New */}
          <button
            onClick={() => setTicketStatusFilter('NEW')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              ticketStatusFilter === 'NEW'
                ? 'bg-amber-50/80 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">New</span>
              <AlertCircle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {newCount}
            </div>
            <span className="text-3xs text-slate-400 mt-1 block">Awaiting IT review</span>
          </button>

          {/* In Progress */}
          <button
            onClick={() => setTicketStatusFilter('IN_PROGRESS')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              ticketStatusFilter === 'IN_PROGRESS'
                ? 'bg-purple-50/80 dark:bg-purple-950/50 border-purple-300 dark:border-purple-700 ring-2 ring-purple-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">In Progress</span>
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {inProgressCount}
            </div>
            <span className="text-3xs text-slate-400 mt-1 block">Under technical investigation</span>
          </button>

          {/* Waiting for User */}
          <button
            onClick={() => setTicketStatusFilter('PENDING_USER')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              ticketStatusFilter === 'PENDING_USER'
                ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">Waiting for User</span>
              <HelpCircle className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {waitingForUserCount}
            </div>
            <span className="text-3xs text-slate-400 mt-1 block">Needs your response</span>
          </button>

          {/* Resolved */}
          <button
            onClick={() => setTicketStatusFilter('RESOLVED')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              ticketStatusFilter === 'RESOLVED'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20'
                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">Resolved</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {resolvedCount}
            </div>
            <span className="text-3xs text-slate-400 mt-1 block">Solution provided</span>
          </button>

          {/* Closed */}
          <button
            onClick={() => setTicketStatusFilter('CLOSED')}
            className={`p-4 rounded-2xl border text-left transition-all ${
              ticketStatusFilter === 'CLOSED'
                ? 'bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 ring-2 ring-slate-400/20'
                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-medium">Closed</span>
              <CheckCheck className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
              {closedCount}
            </div>
            <span className="text-3xs text-slate-400 mt-1 block">Finalized & archived</span>
          </button>
        </div>
      </div>

      {/* Main Grid: My Tickets (Left 2/3) + Notifications (Right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* SECTION 2: MY TICKETS (Exact required columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
            <div className="flex flex-col gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-indigo-600" />
                    My Tickets
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Track and manage your submitted IT helpdesk requests
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search my tickets..."
                      value={ticketSearchTerm}
                      onChange={(e) => setTicketSearchTerm(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-40 sm:w-52"
                    />
                  </div>

                  {ticketStatusFilter !== 'ALL' && (
                    <button
                      onClick={() => setTicketStatusFilter('ALL')}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40"
                    >
                      Clear Status
                    </button>
                  )}
                </div>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="font-bold text-slate-400 uppercase text-[10px]">Filter Date:</span>
                <DateRangePicker filter={dateFilter} onChange={setDateFilter} />
              </div>
            </div>

            {/* Table of Tickets */}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="text-3xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                  <tr>
                    <th className="py-3 px-3">Ticket Number</th>
                    <th className="py-3 px-3">Subject</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Assigned Technician</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Created Date</th>
                    <th className="py-3 px-3">Last Updated</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <Ticket className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            No tickets found
                          </p>
                          <p className="text-xs text-slate-400 max-w-sm text-center">
                            {ticketStatusFilter !== 'ALL'
                              ? `You have no tickets with status "${ticketStatusFilter}".`
                              : 'Need technical assistance with hardware or software? Submit your first request.'}
                          </p>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="mt-2 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700"
                          >
                            Submit Support Ticket
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        onClick={() => setSelectedTicketId(ticket.id)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-3 font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {ticket.ticketNumber}
                        </td>
                        <td className="py-3.5 px-3 max-w-[200px]">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {ticket.title}
                          </div>
                          {ticket.relatedAssetTag && (
                            <span className="text-3xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <Laptop className="w-3 h-3 text-slate-400" />
                              {ticket.relatedAssetTag}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-3xs font-medium">
                            {ticket.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {getPriorityBadge(ticket.priority)}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {ticket.assignedTechnicianName ? (
                            <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                              <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 text-3xs flex items-center justify-center font-bold">
                                {ticket.assignedTechnicianName.charAt(0).toUpperCase()}
                              </span>
                              <span>{ticket.assignedTechnicianName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-3xs">
                              Awaiting Assignment
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {getStatusBadge(ticket.status)}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-500">
                          {formatDateTime(ticket.createdAt)}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-500">
                          {formatDateTime(ticket.updatedAt)}
                        </td>
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-indigo-600 hover:text-indigo-800 p-1"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* SECTION 3: NOTIFICATIONS (Exact prompt requirements) */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Notifications
                </h2>
                {unreadNotifications.length > 0 && (
                  <span className="px-2 py-0.5 text-3xs font-bold bg-rose-500 text-white rounded-full">
                    {unreadNotifications.length}
                  </span>
                )}
              </div>

              {unreadNotifications.length > 0 && (
                <button
                  onClick={handleMarkAllNotifsRead}
                  className="text-3xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all as read
                </button>
              )}
            </div>

            {/* Filter Tabs: Unread vs All */}
            <div className="flex items-center gap-2 mt-4 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
              <button
                onClick={() => setNotifTab('UNREAD')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  notifTab === 'UNREAD'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Unread ({unreadNotifications.length})
              </button>
              <button
                onClick={() => setNotifTab('ALL')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  notifTab === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All ({notifications.length})
              </button>
            </div>

            {/* Notifications List */}
            <div className="mt-4 space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {displayedNotifications.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {notifTab === 'UNREAD' ? 'No unread notifications' : 'No notifications yet'}
                  </p>
                  <p className="text-3xs text-slate-400 mt-1">
                    You're fully caught up on all IT updates.
                  </p>
                </div>
              ) : (
                displayedNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                      !notif.isRead
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-800/60'
                        : 'bg-white dark:bg-slate-900/60 border-slate-100 dark:border-slate-800 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                          )}
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {notif.title}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-1 text-3xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDateTime(notif.createdAt)}
                          </span>

                          <span className="text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                            Open <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>

                      {!notif.isRead && (
                        <button
                          onClick={(e) => handleMarkNotifRead(notif.id, e)}
                          title="Mark as read"
                          className="text-slate-400 hover:text-indigo-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: MY IT ASSETS (Exact prompt requirements) */}
      <div id="my-it-assets-section" className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Laptop className="w-5 h-5 text-indigo-600" />
                My IT Assets
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Hardware systems and computer equipment currently assigned to you
              </p>
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Assigned hardware inventory is strictly private to your account</span>
            </div>
          </div>

          {/* Asset Cards Grid */}
          <div className="mt-6">
            {assets.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <Laptop className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No Hardware Assets Currently Assigned
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  You do not currently have any IT computers or peripherals checked out under your user profile. Contact your IT administrator or raise a ticket to request equipment provisioning.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewCategory('HARDWARE');
                    setNewTitle('Hardware Request: Equipment Allocation');
                    setNewDescription('Requesting assignment of workstation laptop/desktop hardware for daily corporate operations.');
                    setIsCreateModalOpen(true);
                  }}
                  className="mt-4 text-xs rounded-xl"
                >
                  Request Equipment Allocation
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all shadow-xs space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
                          {asset.assetType === 'LAPTOP' ? (
                            <Laptop className="w-5 h-5" />
                          ) : (
                            <Monitor className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                            {asset.assetTag}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {asset.name}
                          </h3>
                        </div>
                      </div>

                      <Badge variant="success">ASSIGNED</Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-b border-slate-100 dark:border-slate-800 py-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Model:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {asset.manufacturer} {asset.model}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Serial Number:</span>
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                          {asset.serialNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Category:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {asset.assetType}
                        </span>
                      </div>
                    </div>

                    {/* Specifications */}
                    {asset.specifications && (
                      <div className="grid grid-cols-2 gap-2 text-3xs text-slate-500">
                        {asset.specifications.processor && (
                          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <Cpu className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{asset.specifications.processor}</span>
                          </div>
                        )}
                        {asset.specifications.ramGb && (
                          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                            <span>{asset.specifications.ramGb} GB RAM</span>
                          </div>
                        )}
                        {asset.specifications.storageGb && (
                          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                            <span>{asset.specifications.storageGb} GB Storage</span>
                          </div>
                        )}
                        {asset.specifications.operatingSystem && (
                          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                            <Monitor className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{asset.specifications.operatingSystem}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action */}
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReportAssetIssue(asset)}
                        className="w-full text-xs rounded-xl font-medium text-slate-700 hover:text-indigo-600"
                      >
                        Report Issue With This Device
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DRAWER / MODAL: TICKET DETAIL & REPLY */}
      {selectedTicketId && selectedTicket && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedTicket.ticketNumber}
                  </span>
                  {getStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {selectedTicket.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Submitted {formatDateTime(selectedTicket.createdAt)}
                </p>
              </div>

              <button
                onClick={() => setSelectedTicketId(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body: Description + Technician Comments */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Ticket Details Panel */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Assigned Technician:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedTicket.assignedTechnicianName || 'Pending Assignment'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Category:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {selectedTicket.category}
                  </span>
                </div>
                {selectedTicket.relatedAssetTag && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Related Asset:</span>
                    <span className="font-medium text-indigo-600 dark:text-indigo-400 font-mono">
                      {selectedTicket.relatedAssetTag}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 block mb-1">Issue Description:</span>
                  <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {selectedTicket.description}
                  </p>
                </div>
              </div>

              {/* Conversation Log */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Conversation & Technical Updates
                </h4>

                {ticketComments.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
                    No comments yet. Post an update below to communicate with IT support.
                  </div>
                ) : (
                  ticketComments.map((c) => (
                    <div
                      key={c.id}
                      className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                        c.authorRole === 'EMPLOYEE'
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200/80 dark:border-indigo-800/60 ml-4'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between text-3xs text-slate-500">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          {c.authorName}
                          <Badge variant={c.authorRole === 'EMPLOYEE' ? 'neutral' : 'purple'}>
                            {c.authorRole}
                          </Badge>
                        </span>
                        <span>{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {c.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Comment Composer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
              <form onSubmit={handlePostComment} className="space-y-3">
                <textarea
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Type your message or answer to IT technician..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <div className="flex justify-between items-center">
                  <span className="text-3xs text-slate-400">
                    Visible to assigned IT Technician
                  </span>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmittingComment || !newComment.trim()}
                    icon={Send}
                    className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isSubmittingComment ? 'Sending...' : 'Send Reply'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TICKET MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Submit IT Support Ticket
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject / Issue Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Brief summary of the issue (e.g., VPN disconnects frequently)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="HARDWARE">Hardware (Computer, Screen, Cables)</option>
                    <option value="SOFTWARE">Software & Corporate Apps</option>
                    <option value="NETWORK">Network & Wi-Fi / VPN</option>
                    <option value="ACCESS">Account Access & Credentials</option>
                    <option value="EMAIL">Email & Collaboration</option>
                    <option value="OTHER">Other Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="LOW">Low (Minor inquiry)</option>
                    <option value="MEDIUM">Medium (Normal workflow)</option>
                    <option value="HIGH">High (Impacts work)</option>
                    <option value="URGENT">Urgent (System totally down)</option>
                  </select>
                </div>
              </div>

              {/* Related Asset */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Related Hardware Asset (Optional)
                </label>
                <select
                  value={newRelatedAssetId}
                  onChange={(e) => setNewRelatedAssetId(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- None / General Software --</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetTag} - {a.name} ({a.manufacturer} {a.model})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Detailed Description *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide step-by-step details of the problem, error messages, and what you've tried..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingTicket}
                  className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700"
                >
                  {isSubmittingTicket ? 'Submitting...' : 'Submit Ticket'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

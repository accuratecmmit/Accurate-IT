import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserProfile, UserRole } from '../../types';
import {
  fetchAdminUsers,
  adminApproveUser,
  adminRejectUser,
  adminResetPassword,
  adminResetFailedAttempts,
  adminTerminateSessions,
  adminToggleUserStatus,
} from '../../services/authService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Alert } from '../ui/Alert';
import {
  Users,
  UserCheck,
  UserX,
  ShieldAlert,
  KeyRound,
  RotateCcw,
  Laptop,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Search,
  Filter,
  Eye,
  Copy,
  Radio,
  PowerOff,
  Building,
  MapPin,
  Phone,
  Briefcase,
  AtSign,
  User,
  History,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { ProfileChangeRequestsTab } from './ProfileChangeRequestsTab';

export const UserManagementView: React.FC = () => {
  const { effectiveRole, isSuperAdmin } = useAuth();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'PENDING' | 'USERS' | 'PROFILE_REQUESTS' | 'SESSIONS' | 'AUDIT'>('PENDING');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Rejection modal state (mandatory reason requirement)
  const [rejectingUser, setRejectingUser] = useState<UserProfile | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Password reset modal state (identity verification checklist requirement)
  const [resettingUser, setResettingUser] = useState<UserProfile | null>(null);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null);
  const [isResettingPass, setIsResettingPass] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Destructive Confirmation Dialog State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    requiredInputText?: string;
    loading?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadData = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const data = await fetchAdminUsers();
      setUsers(data.users || []);
      setActiveSessions(data.activeSessions || []);
      setAuditLogs(data.auditLogs || []);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load user management data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  // 1. Approve Employee Registration
  const handleApprove = async (userId: string, role: UserRole = 'EMPLOYEE') => {
    try {
      const res = await adminApproveUser(userId, role);
      showSuccess(res.message || 'Registration approved successfully.');
      await loadData();
    } catch (e: any) {
      setActionError(e.message || 'Approval failed.');
    }
  };

  // 2. Reject Employee Registration with Mandatory Reason
  const handleConfirmReject = async () => {
    if (!rejectingUser) return;
    if (!rejectionReason.trim()) {
      setActionError('A rejection reason is mandatory by corporate security policy.');
      return;
    }
    setIsRejecting(true);
    try {
      const res = await adminRejectUser(rejectingUser.id, rejectionReason.trim());
      showSuccess(res.message || 'Registration rejected.');
      setRejectingUser(null);
      setRejectionReason('');
      await loadData();
    } catch (e: any) {
      setActionError(e.message || 'Rejection failed.');
    } finally {
      setIsRejecting(false);
    }
  };

  // 3. Reset Failed Attempts Counter (cumulative lockout rule)
  const handleResetCounter = async (userId: string) => {
    try {
      const res = await adminResetFailedAttempts(userId);
      showSuccess(res.message || 'Failed attempts counter reset to 0.');
      await loadData();
    } catch (e: any) {
      setActionError(e.message || 'Reset failed.');
    }
  };

  // 4. Generate Temporary Password with Identity Verification
  const handleGenerateTemporaryPassword = async () => {
    if (!resettingUser) return;
    if (!identityConfirmed) {
      setActionError('You must verify the employee identity checklist before issuing a temporary password.');
      return;
    }
    setIsResettingPass(true);
    try {
      const res = await adminResetPassword(resettingUser.id);
      setGeneratedTempPassword(res.temporaryPassword || null);
      showSuccess('Temporary password issued and audited.');
      await loadData();
    } catch (e: any) {
      setActionError(e.message || 'Failed to issue temporary password.');
    } finally {
      setIsResettingPass(false);
    }
  };

  // 5. Terminate Sessions
  const executeTerminateSession = async (options: { userId?: string; sessionId?: string; all?: boolean }) => {
    try {
      const res = await adminTerminateSessions(options);
      showSuccess(res.message || 'Session(s) terminated.');
      await loadData();
    } catch (e: any) {
      setActionError(e.message || 'Termination failed.');
    }
  };

  const handleTerminateSession = (options: { userId?: string; sessionId?: string; all?: boolean }) => {
    if (options.all) {
      setConfirmConfig({
        isOpen: true,
        title: 'Emergency: Terminate All Global Sessions',
        message: 'WARNING: Are you sure you want to terminate ALL active sessions across the entire system? All currently connected users and technicians will be signed out immediately.',
        confirmText: 'Terminate All Sessions',
        cancelText: 'Cancel',
        variant: 'danger',
        requiredInputText: 'TERMINATE',
        onConfirm: async () => {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          await executeTerminateSession(options);
        },
      });
      return;
    }
    executeTerminateSession(options);
  };

  // 6. Toggle User Account Status (Disabled accounts invalidate all sessions)
  const handleToggleStatus = (user: UserProfile) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const isSuspending = nextStatus === 'SUSPENDED';

    setConfirmConfig({
      isOpen: true,
      title: isSuspending ? `Suspend Account @${user.username}` : `Activate Account @${user.username}`,
      message: isSuspending
        ? `Are you sure you want to suspend @${user.username}? All active sessions will be terminated immediately and they will be barred from signing in.`
        : `Re-activate access for employee @${user.username}? They will be permitted to log in again.`,
      confirmText: isSuspending ? 'Suspend Account' : 'Reactivate Account',
      cancelText: 'Cancel',
      variant: isSuspending ? 'danger' : 'info',
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await adminToggleUserStatus(user.id, nextStatus as any);
          showSuccess(res.message || 'User status updated.');
          await loadData();
        } catch (e: any) {
          setActionError(e.message || 'Status toggle failed.');
        }
      },
    });
  };

  // Filtered users
  const pendingUsers = (users || []).filter((u) => u.status === 'PENDING_APPROVAL');
  const nonPendingUsers = (users || []).filter((u) => u.status !== 'PENDING_APPROVAL');

  const filteredUsers = (users || []).filter((u) => {
    const matchesSearch =
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.assetTag && u.assetTag.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.designation && u.designation.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                User Management & Access Control
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
                  {isSuperAdmin ? 'Super Admin Authority' : 'IT Admin Authority'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Registration reviews &bull; Identity-verified password resets &bull; Cumulative failed attempts &bull; Concurrent session control
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            icon={RotateCcw}
            className="text-xs"
          >
            Refresh Data
          </Button>
          {isSuperAdmin && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleTerminateSession({ all: true })}
              icon={PowerOff}
              className="text-xs font-semibold"
            >
              Terminate All System Sessions
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-200 shadow-xs animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PENDING'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Approvals</span>
          {pendingUsers.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${activeTab === 'PENDING' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-700'}`}>
              {pendingUsers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('USERS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'USERS'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>All Accounts & Security Policy</span>
          <span className="text-[10px] opacity-75">({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SESSIONS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'SESSIONS'
              ? 'bg-slate-900 text-white dark:bg-indigo-600 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>Active Device Sessions</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[10px]">
            {activeSessions.length} live
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PROFILE_REQUESTS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PROFILE_REQUESTS'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Profile Change Requests</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'AUDIT'
              ? 'bg-slate-800 text-white dark:bg-slate-700 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Security Audit Trail</span>
        </button>
      </div>

      {/* ========================================== */}
      {/* TAB 1: PENDING APPROVALS */}
      {/* ========================================== */}
      {activeTab === 'PENDING' && (
        <div className="space-y-4">
          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Registration Approval Workflow</p>
              <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                Newly registered employees enter <em>Pending</em> state and cannot sign in until an IT Administrator reviews their 9 credentials and grants approval. If rejecting, a mandatory reason is required by security policy.
              </p>
            </div>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Pending Registrations
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                All employee registration submissions have been reviewed and approved or rejected.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pendingUsers.map((pUser) => (
                <div
                  key={pUser.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-200 dark:border-amber-900/60 p-5 shadow-xs space-y-4 text-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-sm border border-amber-300 dark:border-amber-800">
                        {pUser.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {pUser.displayName}
                        </h4>
                        <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                          @{pUser.username}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      Pending IT Review
                    </span>
                  </div>

                  {/* 9 Field Breakdown Grid */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">1. Name:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{pUser.displayName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">2. Username:</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">@{pUser.username}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">5. Department:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{pUser.departmentName || pUser.departmentId}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">6. Designation:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{pUser.designation || 'Staff'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">7. Computer/Asset Tag:</span>
                      <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{pUser.assetTag || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">8. Location:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{pUser.locationName || pUser.locationId}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px]">9. Mobile Number:</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">{pUser.mobileNumber || 'N/A'}</strong>
                    </div>
                  </div>

                  {/* Approval Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(pUser.id, 'EMPLOYEE')}
                      icon={UserCheck}
                      className="flex-1 justify-center text-xs font-bold"
                    >
                      Approve Employee
                    </Button>
                    {isSuperAdmin && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleApprove(pUser.id, 'IT_TECHNICIAN')}
                        className="text-xs"
                      >
                        Approve as Tech
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setRejectingUser(pUser);
                        setRejectionReason('');
                      }}
                      icon={UserX}
                      className="text-xs"
                    >
                      Reject...
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: ALL ACCOUNTS & SECURITY POLICY */}
      {/* ========================================== */}
      {activeTab === 'USERS' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, @username, asset tag..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Statuses ({users.length})</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="REJECTED">Rejected</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 font-semibold">User & Username</th>
                    <th className="py-3 px-3 font-semibold">Role</th>
                    <th className="py-3 px-3 font-semibold">Asset Tag & Designation</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold">
                      Failed Attempts (Cumulative)
                    </th>
                    <th className="py-3 px-4 font-semibold text-right">Security Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isLocked = u.lockoutUntil && new Date(u.lockoutUntil).getTime() > Date.now();
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0">
                              {u.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100">
                                {u.displayName}
                              </p>
                              <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                                @{u.username || u.email.split('@')[0]}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            u.role === 'SUPER_ADMIN'
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                              : u.role === 'IT_ADMIN'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                              : u.role === 'IT_TECHNICIAN'
                              ? 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800'
                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}>
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <p className="font-mono text-slate-800 dark:text-slate-200 font-medium">
                            {u.assetTag || 'AST-NONE'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {u.designation || u.departmentName || 'Operations'}
                          </p>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : u.status === 'PENDING_APPROVAL'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : u.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {u.status}
                          </span>
                          {u.mustChangePassword && (
                            <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                              Must Change PW
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                              (u.failedLoginAttempts || 0) >= 5
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : (u.failedLoginAttempts || 0) >= 3
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {u.failedLoginAttempts || 0} failed
                            </span>
                            {isLocked && (
                              <span className="px-2 py-0.5 bg-rose-600 text-white font-bold text-[10px] rounded-full animate-pulse">
                                LOCKED 15m
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Reset Failed Counter Button */}
                            {(u.failedLoginAttempts > 0 || isLocked) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResetCounter(u.id)}
                                title="Manually reset cumulative failed attempt counter to 0 and unlock"
                                className="text-[10px] py-1 px-2 text-indigo-600 hover:text-indigo-700"
                              >
                                Reset Counter
                              </Button>
                            )}

                            {/* Issue Temporary Password */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setResettingUser(u);
                                setIdentityConfirmed(false);
                                setGeneratedTempPassword(null);
                                setCopiedPassword(false);
                              }}
                              title="Verify employee identity and issue temporary password"
                              icon={KeyRound}
                              className="text-[10px] py-1 px-2 text-amber-600 hover:text-amber-700"
                            >
                              Reset PW
                            </Button>

                            {/* Account Status Toggle (Active/Suspended) */}
                            {u.id !== 'usr_super_admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(u)}
                                title={u.status === 'ACTIVE' ? 'Suspend user & invalidate all sessions' : 'Activate user'}
                                className={`text-[10px] py-1 px-2 ${u.status === 'ACTIVE' ? 'text-rose-600 hover:text-rose-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                              >
                                {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 3: ACTIVE DEVICE SESSIONS */}
      {/* ========================================== */}
      {activeTab === 'SESSIONS' && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-sm">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-emerald-400 animate-pulse shrink-0" />
              <div>
                <p className="font-bold text-sm">Concurrent Session Control</p>
                <p className="text-slate-400 mt-0.5">
                  Employees may maintain multiple simultaneous sessions. 30-minute inactivity timeout applies to all devices.
                </p>
              </div>
            </div>
            {isSuperAdmin && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleTerminateSession({ all: true })}
                icon={PowerOff}
                className="text-xs font-semibold shrink-0"
              >
                Terminate All System Sessions
              </Button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500">
                  <th className="py-3 px-4 font-semibold">User</th>
                  <th className="py-3 px-3 font-semibold">Device & Workstation</th>
                  <th className="py-3 px-3 font-semibold">IP Address</th>
                  <th className="py-3 px-3 font-semibold">Session Started</th>
                  <th className="py-3 px-3 font-semibold">Last Active (30m Timeout)</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeSessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No active device sessions currently registered.
                    </td>
                  </tr>
                ) : (
                  activeSessions.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200">{s.displayName}</p>
                        <p className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">@{s.username}</p>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-700 dark:text-slate-300">
                        {s.deviceLabel || 'Workstation'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {s.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {new Date(s.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono">
                        {new Date(s.lastActiveAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTerminateSession({ sessionId: s.id })}
                            className="text-[10px] py-1 px-2 text-rose-600 hover:text-rose-700"
                          >
                            Terminate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTerminateSession({ userId: s.userId })}
                            className="text-[10px] py-1 px-2 text-slate-600"
                          >
                            End All for User
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 4: AUDIT TRAIL */}
      {/* ========================================== */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>
              <strong>Immutable Audit Log:</strong> Every registration, login attempt, password reset, lockout trigger, and session revocation is cryptographically recorded.
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                  <th className="py-2.5 px-3 font-semibold">Actor</th>
                  <th className="py-2.5 px-3 font-semibold">Details</th>
                  <th className="py-2.5 px-4 font-semibold">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {auditLogs.slice(0, 50).map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        log.action.includes('FAILED') || log.action.includes('REJECT')
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : log.action.includes('RESET')
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {log.actorEmail || log.actorRole}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                      {log.details || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[10px]">
                      {log.ipAddress || '127.0.0.1'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB: OFFICIAL PROFILE CHANGE REQUESTS */}
      {/* ========================================== */}
      {activeTab === 'PROFILE_REQUESTS' && (
        <ProfileChangeRequestsTab />
      )}

      {/* ========================================== */}
      {/* MODAL: MANDATORY REJECTION REASON DIALOG */}
      {/* ========================================== */}
      {rejectingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-rose-300 dark:border-rose-800 overflow-hidden">
            <div className="p-5 bg-rose-600 text-white flex items-center gap-3">
              <UserX className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="text-base font-bold">Reject Registration Submission</h4>
                <p className="text-xs text-rose-100">
                  A mandatory reason is required by enterprise security policy.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
                <p><strong>Employee:</strong> {rejectingUser.displayName} (@{rejectingUser.username})</p>
                <p><strong>Asset Tag:</strong> {rejectingUser.assetTag}</p>
                <p><strong>Department:</strong> {rejectingUser.departmentName || rejectingUser.departmentId}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mandatory Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Asset tag AST-0921 does not match HR allocation records; employee identity could not be verified."
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectingUser(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleConfirmReject}
                  isLoading={isRejecting}
                  disabled={!rejectionReason.trim()}
                  className="text-xs font-bold"
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: IDENTITY-VERIFIED PASSWORD RESET */}
      {/* ========================================== */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border-2 border-amber-300 dark:border-amber-800 overflow-hidden">
            <div className="p-5 bg-amber-500 text-white flex items-center gap-3">
              <KeyRound className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="text-base font-bold">Admin-Initiated Password Reset</h4>
                <p className="text-xs text-amber-100">
                  Verify employee identity &bull; Generate temporary password &bull; Audited
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Identity Verification Checklist */}
              <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  Mandatory Identity Verification Checklist:
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/60">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Name:</span>
                    <strong>{resettingUser.displayName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Username:</span>
                    <strong className="font-mono">@{resettingUser.username}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Asset Tag:</span>
                    <strong className="font-mono text-indigo-600">{resettingUser.assetTag || 'AST-N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Mobile:</span>
                    <strong className="font-mono">{resettingUser.mobileNumber || 'N/A'}</strong>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={identityConfirmed}
                    onChange={(e) => setIdentityConfirmed(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span>I confirm I have verified the employee&apos;s identity via phone or official ID.</span>
                </label>
              </div>

              {/* Notice */}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                <strong>Policy Guarantee:</strong> The IT Administrator never sees the employee&apos;s existing password. Generating a temporary password invalidates all current sessions and forces the employee to change it at their next login.
              </p>

              {/* Generated Password Result */}
              {generatedTempPassword && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    Temporary Password Successfully Generated:
                  </p>
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-emerald-200 rounded-xl font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    <span>{generatedTempPassword}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedTempPassword);
                        setCopiedPassword(true);
                        setTimeout(() => setCopiedPassword(false), 3000);
                      }}
                      className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/60 rounded-lg text-xs font-semibold flex items-center gap-1 text-emerald-800 dark:text-emerald-200"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedPassword ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Provide this temporary password securely to the employee. They will be forced to change it immediately upon signing in.
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResettingUser(null)}
                  className="text-xs"
                >
                  {generatedTempPassword ? 'Done' : 'Cancel'}
                </Button>
                {!generatedTempPassword && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!identityConfirmed || isResettingPass}
                    isLoading={isResettingPass}
                    onClick={handleGenerateTemporaryPassword}
                    icon={KeyRound}
                    className="text-xs font-bold"
                  >
                    Generate Temporary Password
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Corporate Confirmation Dialog for Destructive Actions */}
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        variant={confirmConfig.variant}
        requiredInputText={confirmConfig.requiredInputText}
        loading={confirmConfig.loading}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

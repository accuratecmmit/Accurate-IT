import React, { useState, useEffect } from 'react';
import {
  fetchProfileChangeRequests,
  reviewProfileChangeRequest,
} from '../../services/profileService';
import { UserProfileChangeRequest } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  AlertCircle,
  ShieldCheck,
  User,
  ArrowRight,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';

export const ProfileChangeRequestsTab: React.FC = () => {
  const [requests, setRequests] = useState<UserProfileChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Review modal state
  const [reviewingRequest, setReviewingRequest] = useState<UserProfileChangeRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetchProfileChangeRequests();
      setRequests(res.changeRequests || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const filteredRequests = (requests || []).filter((r) => {
    const matchesSearch =
      r.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.userEmail && r.userEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.requestedChanges.username && r.requestedChanges.username.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    return r.status === statusFilter;
  });

  const pendingCount = (requests || []).filter((r) => r.status === 'PENDING').length;

  const handleOpenReviewModal = (req: UserProfileChangeRequest, action: 'APPROVE' | 'REJECT') => {
    setReviewingRequest(req);
    setReviewAction(action);
    setReviewNotes(action === 'APPROVE' ? 'Approved by IT Administration.' : 'Official profile changes cannot be approved at this time.');
    setReviewError(null);
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRequest) return;

    setIsSubmittingReview(true);
    setReviewError(null);

    try {
      const res = await reviewProfileChangeRequest(
        reviewingRequest.id,
        reviewAction,
        reviewNotes.trim()
      );

      if (res.success && res.changeRequest) {
        setRequests((prev) =>
          prev.map((r) => (r.id === res.changeRequest!.id ? res.changeRequest! : r))
        );
        setReviewingRequest(null);
        showSuccess(res.message || `Request ${res.changeRequest.requestNumber} processed successfully.`);
      } else {
        setReviewError(res.error || `Failed to ${reviewAction.toLowerCase()} request.`);
      }
    } catch (err: any) {
      setReviewError(err.message || 'Error communicating with server.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">APPROVED</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">REJECTED</Badge>;
      case 'PENDING':
      default:
        return <Badge variant="warning">PENDING REVIEW</Badge>;
    }
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
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
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Official Profile Change Requests
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                {pendingCount} Pending
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review and govern official employee credentials (Name, Username, Department, Designation, Hardware Tag, Location)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={RotateCcw}
            onClick={loadRequests}
            isLoading={isLoading}
            className="text-xs rounded-xl"
          >
            Refresh
          </Button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {s === 'ALL' ? 'All Requests' : s}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search request #, employee..."
            className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48 sm:w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
        <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
          <thead className="text-3xs uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <tr>
              <th className="py-3 px-3">Request Number</th>
              <th className="py-3 px-3">Employee</th>
              <th className="py-3 px-3">Requested Modifications</th>
              <th className="py-3 px-3">Employee Reason</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Submitted</th>
              <th className="py-3 px-3">Review Details</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-slate-400">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    No Profile Change Requests Found
                  </p>
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => (
                <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                    {req.requestNumber}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {req.userName}
                    </div>
                    <div className="text-3xs text-slate-400 font-mono">
                      {req.userEmail}
                    </div>
                  </td>
                  <td className="py-3 px-3 max-w-[280px]">
                    <div className="space-y-1 text-3xs">
                      {req.requestedChanges.username && (
                        <div className="flex items-center gap-1.5 p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
                          <span className="font-bold text-indigo-800 dark:text-indigo-300">Username:</span>
                          <span className="line-through text-slate-400 font-mono">@{req.previousValues?.username}</span>
                          <ArrowRight className="w-3 h-3 text-indigo-600" />
                          <span className="font-bold text-indigo-700 dark:text-indigo-400 font-mono">@{req.requestedChanges.username}</span>
                        </div>
                      )}
                      {req.requestedChanges.employeeName && (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400">Name:</span>
                          <span className="line-through">{req.previousValues?.employeeName}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <strong className="text-slate-900 dark:text-slate-100">{req.requestedChanges.employeeName}</strong>
                        </div>
                      )}
                      {req.requestedChanges.departmentName && (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400">Dept:</span>
                          <strong className="text-slate-900 dark:text-slate-100">{req.requestedChanges.departmentName}</strong>
                        </div>
                      )}
                      {req.requestedChanges.designation && (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400">Title:</span>
                          <strong className="text-slate-900 dark:text-slate-100">{req.requestedChanges.designation}</strong>
                        </div>
                      )}
                      {req.requestedChanges.assetTag && (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-mono">
                          <span className="text-slate-400 font-sans">Tag:</span>
                          <strong>{req.requestedChanges.assetTag}</strong>
                        </div>
                      )}
                      {req.requestedChanges.locationName && (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <span className="text-slate-400">Location:</span>
                          <strong>{req.requestedChanges.locationName}</strong>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-[200px] truncate" title={req.reason}>
                    {req.reason}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getStatusBadge(req.status)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                    {formatDateTime(req.createdAt)}
                  </td>
                  <td className="py-3 px-3 text-3xs text-slate-500 max-w-[180px]">
                    {req.status !== 'PENDING' ? (
                      <div>
                        <div>By: <strong className="text-slate-700 dark:text-slate-300">{req.reviewerName}</strong></div>
                        <div className="italic truncate">{req.reviewNotes}</div>
                      </div>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 italic">Awaiting decision</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    {req.status === 'PENDING' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReviewModal(req, 'REJECT')}
                          className="text-3xs py-1 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenReviewModal(req, 'APPROVE')}
                          className="text-3xs py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                        >
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <span className="text-3xs text-slate-400 italic">Resolved</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* IT Admin Review Modal */}
      {reviewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {reviewAction === 'APPROVE' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {reviewAction === 'APPROVE' ? 'Approve Profile Changes' : 'Reject Profile Changes'}
                </h3>
              </div>
              <button
                onClick={() => setReviewingRequest(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {reviewError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-700">
                {reviewError}
              </div>
            )}

            <div className="space-y-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex justify-between">
                <span className="text-slate-400">Request Number:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {reviewingRequest.requestNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Employee:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {reviewingRequest.userName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Employee Justification:</span>
                <span className="text-slate-700 dark:text-slate-300 italic">
                  "{reviewingRequest.reason}"
                </span>
              </div>

              {/* Username audit notice */}
              {reviewingRequest.requestedChanges.username && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-3xs text-amber-800 dark:text-amber-300 space-y-1">
                  <span className="font-bold block flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    Audited Username Policy Enforcement
                  </span>
                  <p>
                    Changing username from <strong className="font-mono">@{reviewingRequest.previousValues?.username}</strong> to <strong className="font-mono">@{reviewingRequest.requestedChanges.username}</strong>. Old and new usernames will be permanently audited in the security logs.
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={handleConfirmReview} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reviewer Notes / Feedback for Employee
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter approval conditions or reasons for rejection..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewingRequest(null)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={reviewAction === 'APPROVE' ? 'primary' : 'danger'}
                  size="sm"
                  disabled={isSubmittingReview}
                  className={`text-xs font-semibold rounded-xl ${
                    reviewAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                  }`}
                >
                  {isSubmittingReview
                    ? 'Processing...'
                    : reviewAction === 'APPROVE'
                    ? 'Confirm Approval & Apply'
                    : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

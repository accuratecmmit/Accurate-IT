import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchITTeams,
  createITTeam,
  assignUserToTeam,
  ITTeam,
} from '../../services/itTeamService';
import { fetchAdminUsers } from '../../services/authService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Shield,
  Users,
  Plus,
  RefreshCw,
  Lock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Building,
  Info,
} from 'lucide-react';

export const ITTeamManagementView: React.FC = () => {
  const { user, profile, effectiveRole, isSuperAdmin } = useAuth();

  const [teams, setTeams] = useState<ITTeam[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Super Admin Create Team Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // Super Admin Assign Staff Modal
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<any | null>(null);
  const [selectedTargetTeamId, setSelectedTargetTeamId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  const isITAdmin = effectiveRole === 'IT_ADMIN';

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [teamRes, userRes] = await Promise.all([
        fetchITTeams(),
        fetchAdminUsers(),
      ]);

      if (teamRes.error) {
        setErrorMsg(teamRes.error);
      } else {
        setTeams(teamRes.teams || []);
      }

      setStaffUsers(userRes.users || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load IT team data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveRole]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Create team (Super Admin only)
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) {
      setErrorMsg('Team code and name are required.');
      return;
    }

    setIsCreatingTeam(true);
    try {
      const res = await createITTeam({
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });

      if (res.success && res.team) {
        showSuccess(`IT Team "${res.team.name}" created successfully.`);
        setIsCreateModalOpen(false);
        setNewCode('');
        setNewName('');
        setNewDesc('');
        await loadData();
      } else {
        setErrorMsg(res.error || 'Failed to create team.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating IT team');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  // Assign user to IT team (Super Admin only)
  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToAssign) return;

    setIsAssigning(true);
    try {
      const res = await assignUserToTeam(
        selectedUserToAssign.id,
        selectedTargetTeamId ? selectedTargetTeamId : null
      );

      if (res.success) {
        showSuccess(res.message || 'Team assignment updated successfully.');
        setSelectedUserToAssign(null);
        await loadData();
      } else {
        setErrorMsg(res.error || 'Failed to assign team.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Assignment error');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              IT Teams & Scope Architecture
            </h2>
            <Badge variant={isSuperAdmin ? 'purple' : 'info'}>
              {isSuperAdmin ? 'SUPER ADMIN AUTHORITY' : 'IT ADMIN (SCOPED)'}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isSuperAdmin
              ? 'Define IT teams, assign lead admins and technicians, and govern organizational routing.'
              : `You are assigned to ${profile?.itTeamName || profile?.itTeamId}. IT Admins cannot modify IT team structures or assign users across teams.`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            icon={RefreshCw}
            disabled={isLoading}
            className="text-xs font-semibold rounded-xl"
          >
            Refresh
          </Button>

          {isSuperAdmin ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              icon={Plus}
              className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 shadow-xs"
            >
              Create IT Team
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800">
              <Lock className="w-3.5 h-3.5" />
              <span>Structure Managed by Super Admin</span>
            </div>
          )}
        </div>
      </div>

      {/* Strict RBAC Rule Explanation Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-300">
          <Shield className="w-4 h-4 text-amber-400" />
          <span>RBAC Governance Policy Enforced</span>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300 text-[11px] list-disc list-inside">
          <li>
            <strong>IT Admin & Technician Constraint:</strong> Must belong to exactly one IT Team.
          </li>
          <li>
            <strong>Employee Constraint:</strong> Employees must not belong to an IT Team.
          </li>
          <li>
            <strong>IT Admin Permission Limit:</strong> Cannot modify IT Team structure or assign users across teams.
          </li>
          <li>
            <strong>Super Admin Privilege:</strong> Exclusive authority over IT Team provisioning and member assignment.
          </li>
        </ul>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-2 text-xs text-rose-800 dark:text-rose-200 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* IT Teams Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {(teams || []).map((team) => {
          const members = (staffUsers || []).filter((u) => u.itTeamId === team.id);
          const isMyTeam = profile?.itTeamId === team.id;

          return (
            <div
              key={team.id}
              className={`p-5 rounded-3xl border transition-all space-y-4 ${
                isMyTeam
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {team.code}
                    </span>
                    {isMyTeam && <Badge variant="purple">Your Team</Badge>}
                    <Badge variant={team.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {team.status}
                    </Badge>
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mt-1">
                    {team.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {team.description || 'General IT operations team.'}
                  </p>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    Assigned Personnel ({members.length})
                  </span>
                </div>

                {members.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    No administrators or technicians currently assigned to this team.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {members.map((mem) => (
                      <div
                        key={mem.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-[10px]">
                            {mem.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {mem.displayName}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              @{mem.username || mem.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              mem.role === 'IT_ADMIN'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                : 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                            }`}
                          >
                            {mem.role}
                          </span>

                          {isSuperAdmin && (
                            <button
                              onClick={() => {
                                setSelectedUserToAssign(mem);
                                setSelectedTargetTeamId(mem.itTeamId || '');
                              }}
                              className="text-[10px] text-indigo-600 hover:underline font-semibold ml-1"
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE TEAM MODAL (SUPER ADMIN ONLY) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-500" />
                Create New IT Team
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Team Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SEC-OPS"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Information Security Operations"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Function, coverage scope, and responsibilities..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isCreatingTeam}
                  className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700"
                >
                  {isCreatingTeam ? 'Creating...' : 'Create Team'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASSIGN STAFF MODAL (SUPER ADMIN ONLY) */}
      {selectedUserToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-500" />
                Assign IT Team: {selectedUserToAssign.displayName}
              </h3>
              <button
                onClick={() => setSelectedUserToAssign(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignUser} className="space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p>
                  <strong>Role:</strong> {selectedUserToAssign.role}
                </p>
                <p>
                  <strong>Email:</strong> {selectedUserToAssign.email}
                </p>
                <p>
                  <strong>Current Team:</strong> {selectedUserToAssign.itTeamName || 'None'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Designate Target IT Team *
                </label>
                <select
                  value={selectedTargetTeamId}
                  onChange={(e) => setSelectedTargetTeamId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                >
                  <option value="">-- No Team (Unassigned) --</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Constraint rule: IT Admin and IT Technician accounts must belong to exactly one IT Team.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUserToAssign(null)}
                  className="rounded-xl text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isAssigning}
                  className="rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700"
                >
                  {isAssigning ? 'Assigning...' : 'Save Assignment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

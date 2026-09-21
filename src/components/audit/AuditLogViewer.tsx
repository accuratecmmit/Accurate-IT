import React, { useEffect, useState } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  ShieldCheck,
  Calendar,
  User,
  Activity,
} from 'lucide-react';
import { AuditLog } from '../../types';
import { subscribeToAuditLogs } from '../../services/auditService';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Table, Column } from '../ui/Table';
import { Card } from '../ui/Card';
import { RoleGate } from '../auth/RoleGate';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAuditLogs(
      100,
      (fetchedLogs) => {
        setLogs(fetchedLogs);
        setIsLoading(false);
      },
      () => {
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredLogs = (logs || []).filter((log) => {
    const matchesFilter = filterType === 'ALL' || log.entityType === filterType;
    const matchesSearch =
      searchTerm === '' ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const columns: Column<AuditLog>[] = [
    {
      header: 'Timestamp',
      cell: (log) => (
        <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {new Date(log.timestamp).toLocaleString()}
        </div>
      ),
    },
    {
      header: 'Actor',
      cell: (log) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span className="truncate max-w-[150px]">{log.actorEmail}</span>
          </div>
          <span className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
            {log.actorRole}
          </span>
        </div>
      ),
    },
    {
      header: 'Action',
      cell: (log) => (
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 font-mono">
            {log.action}
          </span>
        </div>
      ),
    },
    {
      header: 'Entity Type',
      cell: (log) => (
        <Badge
          variant={
            log.entityType === 'COMPANY'
              ? 'purple'
              : log.entityType === 'LOCATION'
              ? 'info'
              : log.entityType === 'AUTH'
              ? 'success'
              : 'default'
          }
          size="sm"
        >
          {log.entityType}
        </Badge>
      ),
    },
    {
      header: 'Entity ID',
      cell: (log) => (
        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
          {log.entityId}
        </span>
      ),
    },
    {
      header: 'Details',
      cell: (log) => (
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[240px]">
          {log.details || '-'}
        </div>
      ),
    },
  ];

  return (
    <RoleGate
      requiredPermission="canViewAuditLogs"
      showForbiddenMessage={true}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Security & Operational Audit Trail
              </h2>
              <Badge variant="success">Immutable Append-Only</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Tamper-evident logs recording all administrative master data changes, authentication events, and role updates.
            </p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by action, email, or entity ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs rounded-2xl border border-slate-200 dark:border-slate-700 pl-10 pr-3.5 py-2.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-1.5 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs bg-transparent text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Entity Types</option>
              <option value="COMPANY">COMPANY</option>
              <option value="LOCATION">LOCATION</option>
              <option value="USER">USER</option>
              <option value="AUTH">AUTH</option>
              <option value="CONFIG">CONFIG</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table Bento Container */}
        <Card noPadding className="border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
          <Table
            data={filteredLogs}
            columns={columns}
            keyExtractor={(log) => log.id}
            emptyMessage="No audit log entries recorded yet."
            isLoading={isLoading}
          />
        </Card>
      </div>
    </RoleGate>
  );
};

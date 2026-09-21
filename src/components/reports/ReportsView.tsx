import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useMasterData } from '../../context/MasterDataContext';
import { generateReport, GeneratedReportResponse } from '../../services/dashboardService';
import { DateRangePicker, DateFilterState } from '../dashboard/DateRangePicker';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileText,
  Download,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  FileType,
  CheckCircle2,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Ticket,
  Clock,
  Laptop,
  Users,
  Building,
  Activity,
  Calendar,
  Layers,
} from 'lucide-react';

type ReportType = 'TICKET' | 'SLA' | 'ASSET' | 'TECHNICIAN' | 'IT_TEAM' | 'USER' | 'AUDIT';

export const ReportsView: React.FC = () => {
  const { user, profile, effectiveRole, isSuperAdmin } = useAuth();
  const { itTeams, categories } = useMasterData();

  // Report Form Configuration
  const [reportType, setReportType] = useState<ReportType>('TICKET');
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    preset: 'ALL',
    startDate: '',
    endDate: '',
  });

  const [selectedTeamId, setSelectedTeamId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSlaStatus, setSelectedSlaStatus] = useState<string>('ALL');

  // Generated Report Result State
  const [reportData, setReportData] = useState<GeneratedReportResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Table Search & Pagination
  const [tableSearch, setTableSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  const isITAdmin = effectiveRole === 'IT_ADMIN';
  const permittedTeamName = profile?.itTeamName || profile?.itTeamId || 'IT Team';

  // Available Report Types with metadata
  const reportOptions: { id: ReportType; label: string; icon: any; description: string }[] = [
    {
      id: 'TICKET',
      label: 'Ticket Volume & Lifecycle',
      icon: Ticket,
      description: 'Granular ticket records with status, priority, category, and requester details.',
    },
    {
      id: 'SLA',
      label: 'SLA Compliance & Breaches',
      icon: Shield,
      description: 'Resolution target adherence, response times, and breach records.',
    },
    {
      id: 'ASSET',
      label: 'Asset & Hardware Inventory',
      icon: Laptop,
      description: 'Hardware pool allocations, asset tags, serial numbers, and maintenance status.',
    },
    {
      id: 'TECHNICIAN',
      label: 'Technician Performance',
      icon: Users,
      description: 'Workload distribution, open tickets, resolution velocity, and breach rate per technician.',
    },
    {
      id: 'IT_TEAM',
      label: 'IT Team Distribution',
      icon: Building,
      description: 'Departmental queue distribution and cross-team SLA compliance health.',
    },
    {
      id: 'USER',
      label: 'User Directory & Activity',
      icon: Users,
      description: 'Staff directory, department assignments, locations, and authentication status.',
    },
    {
      id: 'AUDIT',
      label: 'Security & Audit Log',
      icon: Activity,
      description: 'Append-only chronological audit log of all system changes and actions.',
    },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setCurrentPage(1);

    try {
      const res = await generateReport({
        reportType,
        datePreset: dateFilter.preset,
        startDate: dateFilter.startDate || undefined,
        endDate: dateFilter.endDate || undefined,
        itTeamId: isITAdmin ? profile?.itTeamId : selectedTeamId !== 'ALL' ? selectedTeamId : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        priority: selectedPriority !== 'ALL' ? selectedPriority : undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        slaStatus: selectedSlaStatus !== 'ALL' ? selectedSlaStatus : undefined,
      });

      setReportData(res);
      setSuccessMsg(`Generated ${res.meta.recordCount} records.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  // Initial load on mount
  useEffect(() => {
    handleGenerate();
  }, [reportType]);

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    if (!reportData || reportData.records.length === 0) return;

    const formattedData = reportData.records.map((r) => {
      const row: Record<string, any> = {};
      reportData.columns.forEach((c) => {
        row[c.label] = r[c.key] !== undefined && r[c.key] !== null ? r[c.key] : '';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, reportType);
    const filename = `${reportType.toLowerCase()}_report_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Export to CSV (.csv)
  const handleExportCSV = () => {
    if (!reportData || reportData.records.length === 0) return;

    const header = reportData.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
    const rows = reportData.records.map((r) =>
      reportData.columns
        .map((c) => {
          const val = r[c.key] !== undefined && r[c.key] !== null ? String(r[c.key]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType.toLowerCase()}_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to PDF (.pdf)
  const handleExportPDF = () => {
    if (!reportData || reportData.records.length === 0) return;

    const doc = new jsPDF({
      orientation: reportData.columns.length > 5 ? 'landscape' : 'portrait',
    });

    // Title
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    const selectedOpt = reportOptions.find((o) => o.id === reportType);
    doc.text(selectedOpt?.label || 'Enterprise Operational Report', 14, 18);

    // Meta subtext
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const metaLine = `Scope: ${reportData.meta.scope} | Generated: ${new Date(
      reportData.meta.generatedAt
    ).toLocaleString()} | Records: ${reportData.meta.recordCount}`;
    doc.text(metaLine, 14, 25);

    const headers = reportData.columns.map((c) => c.label);
    const bodyRows = reportData.records.map((r) =>
      reportData.columns.map((c) => {
        const val = r[c.key];
        if (val === undefined || val === null) return '';
        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
        return String(val);
      })
    );

    autoTable(doc, {
      head: [headers],
      body: bodyRows,
      startY: 30,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229], // Indigo 600
        textColor: 255,
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [51, 65, 85],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      margin: { top: 30, left: 14, right: 14, bottom: 14 },
    });

    doc.save(`${reportType.toLowerCase()}_report_${Date.now()}.pdf`);
  };

  // Filter preview records by local search
  const filteredRecords = (reportData?.records || []).filter((record) => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return Object.values(record).some((v) => String(v).toLowerCase().includes(q));
  });

  // Pagination calculation
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!isSuperAdmin && !isITAdmin) {
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Access Restricted</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Comprehensive reporting and data export are reserved for IT Administrators and Super Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Enterprise Reporting Engine
            </h1>
            <Badge variant={isSuperAdmin ? 'purple' : 'info'}>
              {isSuperAdmin ? 'SUPER ADMIN (GLOBAL)' : `IT ADMIN (${permittedTeamName})`}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manual on-demand report generation across tickets, SLA metrics, hardware inventory, technicians, and audit logs with instant Excel, PDF, and CSV exports.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!reportData || reportData.records.length === 0}
            icon={FileText}
            className="text-xs font-semibold rounded-xl"
          >
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!reportData || reportData.records.length === 0}
            icon={FileSpreadsheet}
            className="text-xs font-semibold rounded-xl text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            Export Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={!reportData || reportData.records.length === 0}
            icon={FileType}
            className="text-xs font-semibold rounded-xl text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            Export PDF
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Report Types Selector Carousel/Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {reportOptions.map((opt) => {
          const Icon = opt.icon;
          const isActive = reportType === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setReportType(opt.id)}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {isActive && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
              </div>
              <div>
                <div className={`text-xs font-bold ${isActive ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-200'}`}>
                  {opt.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter Builder Panel */}
      <Card className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Granular Report Filters</h3>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Active Scope:{' '}
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {isSuperAdmin ? (selectedTeamId === 'ALL' ? 'All IT Teams' : 'Scoped Team') : permittedTeamName}
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Date Filter */}
          <div className="lg:col-span-2 space-y-1.5">
            <label className="font-bold text-slate-500 uppercase text-[10px]">Date Preset & Window</label>
            <DateRangePicker filter={dateFilter} onChange={setDateFilter} />
          </div>

          {/* IT Team Filter (Super Admin only) */}
          {isSuperAdmin ? (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px]">IT Team Filter</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All IT Teams (Global)</option>
                {(itTeams || [])
                  .filter((t) => !t.isDeleted)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px]">IT Team Scope</label>
              <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold">
                {permittedTeamName} (Strict Isolated)
              </div>
            </div>
          )}

          {/* Ticket/SLA specific filters */}
          {(reportType === 'TICKET' || reportType === 'SLA') && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px]">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="NEW">NEW</option>
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="WAITING_FOR_USER">WAITING_FOR_USER</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
          )}

          {(reportType === 'TICKET' || reportType === 'SLA') && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px]">Priority</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          )}

          {reportType === 'TICKET' && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px]">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Categories</option>
                <option value="HARDWARE">HARDWARE</option>
                <option value="SOFTWARE">SOFTWARE</option>
                <option value="NETWORK">NETWORK</option>
                <option value="ACCESS">ACCESS</option>
                <option value="EMAIL">EMAIL</option>
                <option value="TELEPHONY">TELEPHONY</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
          )}

          {reportType === 'SLA' && (
            <div className="space-y-1.5">
              <label className="font-bold text-slate-500 uppercase text-[10px]">SLA Target Status</label>
              <select
                value={selectedSlaStatus}
                onChange={(e) => setSelectedSlaStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All SLA States</option>
                <option value="WITHIN_SLA">WITHIN SLA</option>
                <option value="APPROACHING_SLA">APPROACHING SLA (&lt; 20%)</option>
                <option value="BREACHED">BREACHED SLA</option>
              </select>
            </div>
          )}
        </div>

        {/* Generate Report Action */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-400">
            Reports are computed on demand in real-time. No background scheduling needed.
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            icon={RefreshCw}
            disabled={isGenerating}
            className="text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700"
          >
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </Card>

      {/* Summary Metrics Ribbon if Available */}
      {reportData && reportData.summary && Object.keys(reportData.summary).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(reportData.summary).map(([k, v]) => (
            <Card key={k} className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {k.replace(/([A-Z])/g, ' $1')}
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 block">
                {typeof v === 'number' ? v : String(v)}
              </span>
            </Card>
          ))}
        </div>
      )}

      {/* Instantaneous Interactive Preview Table */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Report Preview ({filteredRecords.length} records)
            </h3>
            <Badge variant="neutral">
              Page {currentPage} of {totalPages}
            </Badge>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search table..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 pr-3 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none w-44 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto min-h-[300px]">
          {isGenerating ? (
            <div className="py-20 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
              <p className="text-xs font-semibold">Running database query and preparing report...</p>
            </div>
          ) : reportData && reportData.columns.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] font-bold bg-slate-50/50 dark:bg-slate-800/30">
                  {reportData.columns.map((c) => (
                    <th key={c.key} className="py-2.5 px-3 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedRecords.length > 0 ? (
                  paginatedRecords.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {reportData.columns.map((c) => {
                        const cellVal = row[c.key];
                        return (
                          <td key={c.key} className="py-2.5 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {c.key === 'ticketNumber' || c.key === 'assetTag' || c.key === 'teamCode' ? (
                              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                {cellVal}
                              </span>
                            ) : c.key === 'status' || c.key === 'slaStatus' ? (
                              <Badge
                                variant={
                                  cellVal === 'BREACHED'
                                    ? 'danger'
                                    : cellVal === 'APPROACHING_SLA'
                                    ? 'warning'
                                    : cellVal === 'WITHIN_SLA' || cellVal === 'RESOLVED' || cellVal === 'CLOSED'
                                    ? 'success'
                                    : 'neutral'
                                }
                              >
                                {cellVal}
                              </Badge>
                            ) : c.key === 'priority' ? (
                              <Badge variant={cellVal === 'URGENT' ? 'danger' : cellVal === 'HIGH' ? 'warning' : 'info'}>
                                {cellVal}
                              </Badge>
                            ) : (
                              <span>{cellVal !== undefined && cellVal !== null ? String(cellVal) : '-'}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={reportData.columns.length} className="py-12 text-center text-slate-400">
                      No records matched the selected report filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="py-16 text-center text-slate-400">No report generated yet.</div>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredRecords.length > itemsPerPage && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            <div>
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} records
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

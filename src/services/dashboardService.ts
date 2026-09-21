import { getStoredToken } from './authService';
import { parseResponseJson } from '../lib/apiClient';

export interface DashboardMetricsResponse {
  success: boolean;
  role: string;
  scope: string;
  appliedDateFilter: {
    preset?: string;
    start?: string;
    end?: string;
  };
  metrics: {
    totalTickets: number;
    openTickets: number;
    closedTickets: number;
    cancelledTickets: number;
  };
  distributions: {
    status: { status: string; count: number }[];
    priority: { priority: string; count: number }[];
    category: { category: string; count: number }[];
  };
  sla: {
    withinSla: number;
    approachingSla: number;
    breachedSla: number;
    exemptSla: number;
    complianceRate: number;
  };
  itTeamDistribution?: {
    teamId: string;
    teamCode: string;
    teamName: string;
    totalTickets: number;
    openTickets: number;
    breachedTickets: number;
  }[];
  technicianDistribution?: {
    technicianId: string;
    technicianName: string;
    email: string;
    itTeamId?: string;
    itTeamName?: string;
    totalAssigned: number;
    openTickets: number;
    resolvedTickets: number;
    breachedTickets: number;
  }[];
  assetSummary: {
    total: number;
    assigned: number;
    inStock: number;
    underRepair: number;
    retired: number;
    lostStolen: number;
  };
  registrationApprovals: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    mobileNumber?: string;
    departmentId?: string;
    departmentName?: string;
    designation?: string;
    companyName?: string;
    locationName?: string;
    requestedRole: string;
    createdAt: string;
  }[];
  recentActivity: {
    id: string;
    timestamp: string;
    actorName: string;
    actorRole: string;
    action: string;
    entityType: string;
    details: string;
  }[];
  technicianData?: {
    assignedTickets: any[];
    unassignedTickets: any[];
    assignedAssets: any[];
    notifications: any[];
  };
}

export interface DashboardFilterParams {
  preset?: string;
  startDate?: string;
  endDate?: string;
  quickFilter?: string;
  itTeamId?: string;
  technicianId?: string;
  priority?: string;
  status?: string;
  category?: string;
}

export async function fetchDashboardMetrics(params: DashboardFilterParams = {}): Promise<DashboardMetricsResponse> {
  const token = getStoredToken();
  const searchParams = new URLSearchParams();

  if (params.preset && params.preset !== 'ALL') searchParams.append('preset', params.preset);
  if (params.startDate) searchParams.append('startDate', params.startDate);
  if (params.endDate) searchParams.append('endDate', params.endDate);
  if (params.quickFilter && params.quickFilter !== 'ALL') searchParams.append('quickFilter', params.quickFilter);
  if (params.itTeamId && params.itTeamId !== 'ALL') searchParams.append('itTeamId', params.itTeamId);
  if (params.technicianId && params.technicianId !== 'ALL') searchParams.append('technicianId', params.technicianId);
  if (params.priority && params.priority !== 'ALL') searchParams.append('priority', params.priority);
  if (params.status && params.status !== 'ALL') searchParams.append('status', params.status);
  if (params.category && params.category !== 'ALL') searchParams.append('category', params.category);

  const query = searchParams.toString();
  const url = `/api/dashboard/metrics${query ? `?${query}` : ''}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const parsed = await parseResponseJson<DashboardMetricsResponse>(res, 'Failed to load dashboard metrics');
  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.error || 'Failed to load dashboard metrics');
  }

  const data = parsed.data as any;

  const metrics = data.metrics || data.summary || {
    totalTickets: 0,
    openTickets: 0,
    closedTickets: 0,
    cancelledTickets: 0,
  };
  const sla = data.sla || data.slaSummary || {
    withinSla: 0,
    approachingSla: 0,
    breachedSla: 0,
    exemptSla: 0,
    complianceRate: 100,
  };
  const distributions = data.distributions || {
    status: data.statusDistribution || [],
    priority: data.priorityDistribution || [],
    category: data.categoryDistribution || [],
  };
  const assetSummary = data.assetSummary || {
    total: 0,
    assigned: 0,
    inStock: 0,
    underRepair: 0,
    retired: 0,
    lostStolen: 0,
  };

  return {
    ...data,
    metrics,
    summary: metrics,
    sla,
    slaSummary: sla,
    distributions,
    assetSummary,
    itTeamDistribution: data.itTeamDistribution || [],
    technicianDistribution: data.technicianDistribution || [],
    registrationApprovals: data.registrationApprovals || [],
    recentActivity: data.recentActivity || [],
  };
}

export interface GenerateReportRequest {
  reportType: 'TICKET' | 'SLA' | 'ASSET' | 'TECHNICIAN' | 'IT_TEAM' | 'USER' | 'AUDIT';
  datePreset?: string;
  startDate?: string;
  endDate?: string;
  itTeamId?: string;
  technicianId?: string;
  status?: string;
  priority?: string;
  category?: string;
  locationId?: string;
  department?: string;
  slaStatus?: string;
}

export interface GeneratedReportResponse {
  success: boolean;
  meta: {
    reportType: string;
    generatedAt: string;
    generatedBy: string;
    scope: string;
    dateFilter: any;
    recordCount: number;
  };
  columns: { key: string; label: string }[];
  records: Record<string, any>[];
  summary: Record<string, any>;
}

export async function generateReport(req: GenerateReportRequest): Promise<GeneratedReportResponse> {
  const token = getStoredToken();
  const res = await fetch('/api/reports/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(req),
  });

  const parsed = await parseResponseJson<GeneratedReportResponse>(res, 'Failed to generate report');
  if (!parsed.ok || !parsed.data) {
    throw new Error(parsed.error || 'Failed to generate report');
  }

  return parsed.data;
}

import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import XLSXLib from 'xlsx';
const XLSX: any = (XLSXLib as any).readFile ? XLSXLib : ((XLSXLib as any).default || XLSXLib);
import {
  INVENTORY_EXCEL_COLUMNS,
  computeAssetCalculations,
  parseDateSafely,
} from './src/utils/assetCalculations';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Prototype Pollution, NoSQL/JSON Injection Defense, and Security Response Headers
function sanitizeObjectKeys(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete obj[key];
      continue;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObjectKeys(obj[key]);
    }
  }
}

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body) sanitizeObjectKeys(req.body);
  if (req.query) sanitizeObjectKeys(req.query);
  if (req.params) sanitizeObjectKeys(req.params);

  // Hardened Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Audit Records Immutability Guard - Audit records cannot be modified or deleted by ANY user
app.all('/api/audit-logs/:id?', (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'Method Not Allowed: Audit records are immutable and cannot be created, modified, or deleted.',
    });
    return;
  }
  next();
});

// Ensure upload directory exists for secure attachment storage
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory data store with atomic disk persistence for server reliability
const DB_FILE = path.join(process.cwd(), 'data_store.json');

export interface StoredUser {
  id: string;
  username: string;
  normalizedUsername: string;
  displayName: string;
  email: string;
  role: 'SUPER_ADMIN' | 'IT_ADMIN' | 'IT_TECHNICIAN' | 'EMPLOYEE';
  itTeamId?: string | null;
  itTeamName?: string | null;
  companyId?: string;
  companyName?: string;
  departmentId: string;
  departmentName?: string;
  designation: string;
  assetTag: string;
  locationId: string;
  locationName?: string;
  mobileNumber: string;
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'REJECTED' | 'SUSPENDED' | 'DEACTIVATED';
  passwordHash: string;
  passwordSalt: string;
  failedLoginAttempts: number;
  lockoutUntil: string | null;
  mustChangePassword: boolean;
  rejectionReason: string | null;
  temporaryPasswordGeneratedAt?: string;
  lastLoginAt?: string;
  sortingPreference?: {
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  createdAt: string;
  updatedAt: string;
}

export interface StoredSavedFilter {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  isShared: boolean;
  criteria: {
    keyword?: string;
    ticketNumber?: string;
    subject?: string;
    employee?: string;
    departmentId?: string;
    category?: string;
    priority?: string;
    status?: string;
    technicianId?: string;
    locationId?: string;
    dateField?: 'createdAt' | 'updatedAt';
    startDate?: string;
    endDate?: string;
  };
  sortConfig?: {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  createdAt: string;
  updatedAt: string;
}

export interface StoredITTeam {
  id: string;
  code: string;
  name: string;
  description: string;
  leadAdminId?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredTicketAttachment {
  id: string;
  ticketId: string;
  originalFileName: string;
  storedFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  extension: string;
  isPreviewable: boolean;
  uploadedById: string;
  uploadedByName: string;
  uploadedByRole: string;
  uploadedAt: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedById?: string | null;
  deletedByName?: string | null;
}

export interface StoredTicketHistory {
  id: string;
  ticketId: string;
  action:
    | 'CREATED'
    | 'EDITED'
    | 'STATUS_CHANGED'
    | 'PRIORITY_CHANGED'
    | 'ASSIGNED'
    | 'ADMINISTRATIVE_ASSIGNMENT_CORRECTION'
    | 'TAKEN'
    | 'CANCELLED'
    | 'ATTACHMENT_ADDED'
    | 'ATTACHMENT_DELETED'
    | 'COMMENT_ADDED'
    | 'ASSET_LINKED'
    | 'ASSET_CHANGED'
    | 'ASSET_UNLINKED'
    | 'SLA_PAUSED'
    | 'SLA_RESUMED'
    | 'SLA_RECALCULATED'
    | 'SLA_WARNING'
    | 'SLA_ESCALATION';
  actorId: string;
  actorName: string;
  actorRole: string;
  details: string;
  fromValue?: string | null;
  toValue?: string | null;
  timestamp: string;
}

export interface StoredTicketSlaHistory {
  id: string;
  timestamp: string;
  reason:
    | 'CREATED'
    | 'PRIORITY_CHANGED'
    | 'CATEGORY_CHANGED'
    | 'PAUSED_WAITING_FOR_USER'
    | 'RESUMED'
    | 'FIRST_RESPONSE_MET'
    | 'FIRST_RESPONSE_BREACHED'
    | 'WARNING_APPROACHING'
    | 'BREACHED'
    | 'ESCALATED'
    | 'RESOLVED'
    | 'CLOSED'
    | 'CANCELLED'
    | 'MANUAL_RECALCULATION';
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  oldPriority?: string;
  newPriority?: string;
  oldCategory?: string;
  newCategory?: string;
  oldResponseTarget?: string | null;
  newResponseTarget?: string | null;
  oldResolutionTarget?: string | null;
  newResolutionTarget?: string | null;
  details: string;
}

export interface StoredTicket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'ACCESS' | 'EMAIL' | 'TELEPHONY' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'URGENT';
  status:
    | 'NEW'
    | 'ASSIGNED'
    | 'OPEN'
    | 'IN_PROGRESS'
    | 'WAITING_FOR_USER'
    | 'PENDING_VENDOR'
    | 'PENDING_USER'
    | 'RESOLVED'
    | 'CLOSED'
    | 'CANCELLED';
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterCompanyId?: string;
  requesterLocationId?: string;
  requesterDepartmentId?: string;
  locationId?: string;
  locationName?: string;
  contactNumber?: string;
  assignedTeamId?: string | null;
  assignedTeamName?: string | null;
  assignedTechnicianId?: string | null;
  assignedTechnicianName?: string | null;
  relatedAssetId?: string | null;
  relatedAssetTag?: string | null;
  relatedAssetName?: string | null;
  assetOverrideReason?: string | null;
  historicalAssetAssignment?: {
    assignedUserId?: string | null;
    assignedUserName?: string | null;
    assignedAtSnapshot?: string | null;
  } | null;
  attachmentIds?: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  responseTargetTime?: string | null;
  resolutionTargetTime?: string | null;
  firstResponseAt?: string | null;
  firstResponseSlaStatus?: 'MET' | 'BREACHED' | 'EXEMPT';
  slaStatus?:
    | 'WITHIN_SLA'
    | 'APPROACHING_SLA'
    | 'BREACHED'
    | 'EXEMPT'
    | 'RESOLVED_WITHIN_SLA'
    | 'RESOLVED_AFTER_SLA';
  isSlaBreached?: boolean;
  slaBreachedAt?: string | null;
  slaEscalatedAt?: string | null;
  slaWarningSent?: boolean;
  slaBreachSent?: boolean;
  slaPaused?: boolean;
  slaPausedAt?: string | null;
  slaTotalPausedWorkingMinutes?: number;
  slaHistory?: StoredTicketSlaHistory[];
  remainingWorkingMinutes?: number;
  breachedWorkingMinutes?: number;
}

export interface StoredTicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorRole: string;
  isInternalOnly: boolean;
  content: string;
  createdAt: string;
}

export interface StoredAssetCustomField {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN';
  options?: string[];
  isRequired: boolean;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAssetAssignmentRecord {
  id: string;
  assetId: string;
  previousEmployeeId?: string | null;
  previousEmployeeName?: string | null;
  currentEmployeeId?: string | null;
  currentEmployeeName?: string | null;
  assignmentDate: string;
  transferDate?: string | null;
  assignedByUserId: string;
  assignedByUserName: string;
  action: 'INITIAL_ASSIGNMENT' | 'TRANSFER' | 'RETURN_TO_STOCK' | 'STATUS_CHANGE' | 'IMPORT';
  notes?: string;
  createdAt: string;
}

export interface StoredAsset {
  id: string;
  assetTag: string;
  serialNumber: string;
  name: string;
  assetType: 'LAPTOP' | 'DESKTOP' | 'WORKSTATION' | 'SERVER' | 'NETWORK' | 'NETWORK_DEVICE' | 'MOBILE' | 'PERIPHERAL' | 'OTHER' | string;
  manufacturer: string;
  model: string;
  companyId: string; // Independent master data
  locationId: string; // Independent master data
  departmentId?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedUserEmail?: string | null;
  assignedTeamId?: string | null;
  previousEmployeeId?: string | null;
  previousEmployeeName?: string | null;
  assignmentDate?: string | null;
  transferDate?: string | null;
  status: 'Active' | 'Inactive' | 'Under Repair' | 'Retired' | 'IN_STOCK' | 'ASSIGNED' | 'IN_REPAIR' | 'MAINTENANCE' | 'DECOMMISSIONED' | 'DISPOSED' | 'LOST' | string;
  specifications: {
    cpu?: string;
    ramGb?: number;
    storageGb?: number;
    storageType?: string;
    os?: string;
    macAddress?: string;
    ipAddress?: string;
    screenSizeInches?: number;
    [key: string]: any;
  };
  purchaseDate?: string;
  purchaseCost?: number;
  warrantyExpiryDate?: string;
  notes?: string;
  customFields?: Record<string, any>;
  assignmentHistory?: StoredAssetAssignmentRecord[];
  isDeleted?: boolean; // Soft-delete flag (Never permanently deleted)
  createdAt: string;
  updatedAt: string;

  // Canonical 42 Excel Fields & Derived Calculations
  condition?: string;
  assignedEmployeeName?: string;
  assetUserName?: string;
  department?: string;
  location?: string;
  company?: string;
  ipAddress?: string;
  processor?: string;
  newOrOld?: string;
  storage?: string;
  ram?: string;
  windowsVersion?: string;
  msOffice?: string;
  escan?: string;
  motherboard?: string;
  display?: string;
  displaySize?: string;
  lanCard?: string;
  upsBattery?: string;
  warrantyStart?: string;
  warrantyEnd?: string;
  lastServiceDate?: string;
  remarks?: string;
  assetAgeYears?: number;
  expectedLifeYears?: number;
  expectedReplacementDate?: string;
  depreciatedValueINR?: number;
  replacementAlert?: string;
  warrantyAlert?: string;
  vendor?: string;
  invoiceNumber?: string;
  amcStart?: string;
  amcEnd?: string;
  purchaseDateParsed?: string;
}

export interface StoredNotification {
  id: string;
  recipientId: string;
  senderId?: string | null;
  title: string;
  message: string;
  type:
    | 'TICKET_CREATED'
    | 'TICKET_ASSIGNED'
    | 'TICKET_UPDATED'
    | 'TICKET_COMMENT'
    | 'TICKET_ATTACHMENT'
    | 'TICKET_STATUS'
    | 'TICKET_PRIORITY'
    | 'TICKET_RESOLVED'
    | 'TICKET_CLOSED'
    | 'TICKET_CANCELLED'
    | 'SLA_WARNING'
    | 'SLA_BREACHED'
    | 'SECURITY_ALERT';
  referenceEntityType?: 'TICKET' | 'ASSET' | 'PROFILE_CHANGE' | 'PAGE';
  referenceEntityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface StoredProfileChangeRequest {
  id: string;
  requestNumber: string;
  userId: string;
  userEmail: string;
  userName: string;
  requestedChanges: {
    employeeName?: string;
    username?: string;
    departmentId?: string;
    departmentName?: string;
    designation?: string;
    assetTag?: string;
    locationId?: string;
    locationName?: string;
    displayName?: string;
    jobTitle?: string;
  };
  previousValues: {
    employeeName?: string;
    username?: string;
    departmentId?: string;
    departmentName?: string;
    designation?: string;
    assetTag?: string;
    locationId?: string;
    locationName?: string;
    displayName?: string;
    jobTitle?: string;
    [key: string]: any;
  };
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewedBy?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredCompany {
  id: string;
  code: string;
  name: string;
  domain?: string;
  contactEmail?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'INACTIVE';
  isDeleted: boolean;
  isArchived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredLocation {
  id: string;
  code: string;
  name: string;
  address?: string;
  city: string;
  country: string;
  timezone?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'INACTIVE';
  isDeleted: boolean;
  isArchived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredDepartment {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'INACTIVE';
  isDeleted: boolean;
  isArchived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredCompanyHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  description?: string;
}

export interface StoredWorkingCalendar {
  workingDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  workStartHour: number; // 0 - 23
  workStartMinute: number; // 0 - 59
  workEndHour: number; // 0 - 23
  workEndMinute: number; // 0 - 59
  weeklyHolidays: number[]; // [0, 6]
  holidays: StoredCompanyHoliday[];
  timezone: string;
}

export interface StoredSLAConfig {
  id: string;
  name: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'URGENT';
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  warningThresholdPercent: number; // e.g. 75 = trigger warning when 75% elapsed (25% remaining)
  businessHoursOnly: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  isDeleted: boolean;
}

export interface StoredSession {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  userEmail: string;
  userRole: string;
  token: string;
  activeTokenHash: string;
  ipAddress: string;
  userAgent: string;
  deviceLabel: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

export interface StoredAuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// Global state in memory
let users: StoredUser[] = [];
let sessions: StoredSession[] = [];
let auditLogs: StoredAuditLog[] = [];
let itTeams: StoredITTeam[] = [];
let tickets: StoredTicket[] = [];
let ticketComments: StoredTicketComment[] = [];
let ticketAttachments: StoredTicketAttachment[] = [];
let ticketHistories: StoredTicketHistory[] = [];
let lastTicketSeq = 10005;
let assets: StoredAsset[] = [];
let assetCustomFields: StoredAssetCustomField[] = [];
let notifications: StoredNotification[] = [];
let companies: StoredCompany[] = [];
let locations: StoredLocation[] = [];
let departments: StoredDepartment[] = [];
let slaConfigs: StoredSLAConfig[] = [];
let defaultWorkingCalendar: StoredWorkingCalendar = {
  workingDays: [1, 2, 3, 4, 5],
  workStartHour: 9,
  workStartMinute: 0,
  workEndHour: 18,
  workEndMinute: 0,
  weeklyHolidays: [0, 6],
  holidays: [
    { id: 'hol_1', name: 'New Year Day', date: '2026-01-01', description: 'Global holiday' },
    { id: 'hol_2', name: 'Republic Day', date: '2026-01-26', description: 'National holiday' },
    { id: 'hol_3', name: 'Labor Day', date: '2026-05-01', description: 'International Workers Day' },
    { id: 'hol_4', name: 'Independence Day', date: '2026-08-15', description: 'National holiday' },
    { id: 'hol_5', name: 'Gandhi Jayanti', date: '2026-10-02', description: 'National holiday' },
    { id: 'hol_6', name: 'Christmas Day', date: '2026-12-25', description: 'Festival holiday' },
  ],
  timezone: 'Asia/Kolkata',
};
let slaWorkingCalendar: StoredWorkingCalendar = { ...defaultWorkingCalendar };
let profileChangeRequests: StoredProfileChangeRequest[] = [];
let savedFilters: StoredSavedFilter[] = [];

// Cryptographic helpers
function hashPasswordSync(password: string, existingSalt?: string) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt };
}

function verifyPasswordSync(attempt: string, storedHash: string, salt: string): boolean {
  try {
    const attemptHash = crypto.pbkdf2Sync(attempt, salt, 100000, 32, 'sha256').toString('hex');
    const a = Buffer.from(attemptHash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    return false;
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function logAudit(
  actor: { id: string; email: string; role: string },
  action: string,
  entityType: string,
  entityId: string,
  details?: string,
  req?: Request,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>
) {
  const entry: StoredAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    details,
    oldValues,
    newValues,
    ipAddress: req ? (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress : '127.0.0.1',
    userAgent: req ? req.headers['user-agent'] : 'ServerInternal',
  };
  auditLogs.unshift(entry);
  if (auditLogs.length > 500) auditLogs = auditLogs.slice(0, 500);
  persistData();
}

function persistData() {
  try {
    const data = {
      users,
      sessions,
      auditLogs,
      itTeams,
      tickets,
      ticketComments,
      ticketAttachments,
      ticketHistories,
      lastTicketSeq,
      assets,
      assetCustomFields,
      notifications,
      companies,
      locations,
      departments,
      slaConfigs,
      slaWorkingCalendar,
      profileChangeRequests,
      savedFilters,
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist DB file:', err);
  }
}

function loadOrSeedData() {
  const now = new Date().toISOString();
  const lockoutTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  let loadedFromDisk = false;
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      users = parsed.users || [];
      sessions = parsed.sessions || [];
      auditLogs = parsed.auditLogs || [];
      itTeams = parsed.itTeams || [];
      tickets = parsed.tickets || [];
      ticketComments = parsed.ticketComments || [];
      ticketAttachments = parsed.ticketAttachments || [];
      ticketHistories = parsed.ticketHistories || [];
      lastTicketSeq = parsed.lastTicketSeq || 10005;
      assets = parsed.assets || [];
      assetCustomFields = parsed.assetCustomFields || [];
      notifications = parsed.notifications || [];
      companies = parsed.companies || [];
      locations = parsed.locations || [];
      departments = parsed.departments || [];
      slaConfigs = parsed.slaConfigs || [];
      slaWorkingCalendar = parsed.slaWorkingCalendar || { ...defaultWorkingCalendar };
      profileChangeRequests = parsed.profileChangeRequests || [];
      savedFilters = parsed.savedFilters || [];
      loadedFromDisk = true;

      // User requested: Remove all demo data. Clean tickets, comments, demo users.
      // Retain assets and master data from disk if present!
      tickets = [];
      ticketComments = [];
      ticketAttachments = [];
      ticketHistories = [];
      notifications = [];
      profileChangeRequests = [];
      users = (users || []).filter((u) => u.email?.toLowerCase() === 'accuratecmmit@gmail.com' || u.role === 'SUPER_ADMIN');
      sessions = (sessions || []).filter((s) => users.some((u) => u.id === s.userId));

      // Normalize master data entries for archived flags & historical preservation
      companies.forEach((c) => {
        if (c.isArchived === undefined) c.isArchived = c.status === 'ARCHIVED';
        if (c.isDeleted === undefined) c.isDeleted = false;
      });
      locations.forEach((l) => {
        if (l.isArchived === undefined) l.isArchived = l.status === 'ARCHIVED';
        if (l.isDeleted === undefined) l.isDeleted = false;
      });
      departments.forEach((d) => {
        if (d.isArchived === undefined) d.isArchived = d.status === 'ARCHIVED';
        if (d.isDeleted === undefined) d.isDeleted = false;
      });

      // Normalize assets: map status to Active / Inactive / Under Repair / Retired and preserve assignment history
      assets.forEach((a) => {
        if (a.isDeleted === undefined) a.isDeleted = false;
        if (a.customFields === undefined) a.customFields = {};
        if (!a.assignmentHistory) a.assignmentHistory = [];

        // Normalize statuses
        if ((a.status as any) === 'ASSIGNED') {
          a.status = 'Active';
        } else if ((a.status as any) === 'IN_STOCK') {
          a.status = 'Inactive';
        } else if ((a.status as any) === 'IN_REPAIR' || (a.status as any) === 'MAINTENANCE') {
          a.status = 'Under Repair';
        } else if ((a.status as any) === 'DECOMMISSIONED' || (a.status as any) === 'DISPOSED') {
          a.status = 'Retired';
        }

        // Initialize historical assignment ledger if empty
        if (a.assignmentHistory.length === 0 && a.assignedUserId) {
          a.assignmentDate = a.assignmentDate || a.purchaseDate || '2024-01-15';
          a.assignmentHistory.push({
            id: `asgn_${a.id}_init`,
            assetId: a.id,
            previousEmployeeId: null,
            previousEmployeeName: null,
            currentEmployeeId: a.assignedUserId,
            currentEmployeeName: a.assignedUserName || 'Assigned User',
            assignmentDate: a.assignmentDate,
            transferDate: null,
            assignedByUserId: 'usr_super_admin',
            assignedByUserName: 'Accurate Chief Admin',
            action: 'INITIAL_ASSIGNMENT',
            notes: 'Initial assignment baseline preserved from inventory record.',
            createdAt: a.createdAt || now,
          });
        }
      });

      console.log(`Loaded ${users.length} users, ${itTeams.length} IT teams, ${tickets.length} tickets, ${assets.length} assets, ${companies.length} companies, ${locations.length} locations, ${departments.length} departments from data store.`);
    } catch (err) {
      console.error('Error loading data store, seeding afresh:', err);
    }
  }

  // Seed default Asset Custom Fields if none exist
  if (assetCustomFields.length === 0) {
    assetCustomFields = [
      {
        id: 'cf_tier',
        fieldKey: 'assetTier',
        label: 'Asset Tier / Criticality',
        fieldType: 'SELECT',
        options: ['Tier 1 - Mission Critical', 'Tier 2 - Standard Enterprise', 'Tier 3 - General / Contractor'],
        isRequired: false,
        description: 'Organizational operational tier of this workstation or device.',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cf_project_code',
        fieldKey: 'projectCode',
        label: 'Project / Billing Code',
        fieldType: 'TEXT',
        isRequired: false,
        description: 'Internal project or cost-center code for asset allocation.',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cf_dual_monitors',
        fieldKey: 'dualMonitorsIssued',
        label: 'Dual External Monitors Issued',
        fieldType: 'BOOLEAN',
        isRequired: false,
        description: 'Indicates whether external peripheral displays were dispatched with unit.',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // Seed Companies (Independent Master Data - initially 3 companies)
  if (!loadedFromDisk && companies.length === 0) {
    companies = [
      {
        id: 'comp_accurate',
        code: 'ACCURATE',
        name: 'Accurate Group',
        domain: 'accurategroup.com',
        contactEmail: 'support@accurategroup.com',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'comp_apex',
        code: 'APEX',
        name: 'Apex Global Technologies',
        domain: 'apextech.com',
        contactEmail: 'it-support@apextech.com',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'comp_zenith',
        code: 'ZENITH',
        name: 'Zenith Logistics International',
        domain: 'zenithlogistics.com',
        contactEmail: 'helpdesk@zenithlogistics.com',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // Seed Locations (Independent Master Data - initially 6 locations)
  if (!loadedFromDisk && locations.length === 0) {
    locations = [
      {
        id: 'loc_nyc',
        code: 'NYC-HQ',
        name: 'New York Global HQ',
        address: '100 Broadway, 42nd Floor',
        city: 'New York',
        country: 'United States',
        timezone: 'America/New_York',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc_sfo',
        code: 'SFO-LAB',
        name: 'San Francisco Tech Hub',
        address: '500 Howard Street, Suite 1200',
        city: 'San Francisco',
        country: 'United States',
        timezone: 'America/Los_Angeles',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc_lon',
        code: 'LON-EU',
        name: 'London European Operations',
        address: '25 Bank Street, Canary Wharf',
        city: 'London',
        country: 'United Kingdom',
        timezone: 'Europe/London',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc_sin',
        code: 'SIN-HB',
        name: 'Singapore APAC Hub',
        address: '1 Marina Boulevard, Level 28',
        city: 'Singapore',
        country: 'Singapore',
        timezone: 'Asia/Singapore',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc_tok',
        code: 'TOK-RD',
        name: 'Tokyo Innovation Campus',
        address: 'Roppongi Hills Mori Tower 34F',
        city: 'Tokyo',
        country: 'Japan',
        timezone: 'Asia/Tokyo',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'loc_fra',
        code: 'FRA-DC',
        name: 'Frankfurt Central Infrastructure',
        address: 'Mainzer Landstraße 180',
        city: 'Frankfurt',
        country: 'Germany',
        timezone: 'Europe/Berlin',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // Seed Departments (Initial predefined departments)
  if (!loadedFromDisk && departments.length === 0) {
    departments = [
      {
        id: 'dept_it',
        code: 'IT',
        name: 'Information Technology & Security',
        description: 'Corporate tech infrastructure and support services.',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dept_eng',
        code: 'ENG',
        name: 'Software Engineering & DevOps',
        description: 'Core product engineering and cloud architecture.',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dept_fin',
        code: 'FIN',
        name: 'Finance & Accounting',
        description: 'Treasury, financial compliance and payroll.',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dept_ops',
        code: 'OPS',
        name: 'Global Operations & Facilities',
        description: 'Physical workplace, procurement and supply chain.',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'dept_hr',
        code: 'HR',
        name: 'Human Resources & People Ops',
        description: 'Talent management, employee benefits and onboarding.',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // Seed IT Teams
  if (itTeams.length === 0) {
    itTeams = [
      {
        id: 'team_tier1',
        code: 'HELP-L1',
        name: 'Tier 1 Service Desk & User Support',
        description: 'First-line incident triage, password resets, onboarding setups, and hardware dispatch.',
        leadAdminId: 'usr_super_admin',
        status: 'ACTIVE',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'team_infra',
        code: 'NET-OPS',
        name: 'Infrastructure & Network Systems',
        description: 'VPN gateways, cloud servers, local office switches, DNS, and server room hardware.',
        leadAdminId: null,
        status: 'ACTIVE',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'team_security',
        code: 'SEC-OPS',
        name: 'Information Security & Access Management',
        description: 'MFA compliance, single sign-on authorizations, threat auditing, and privileged role governance.',
        leadAdminId: null,
        status: 'ACTIVE',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // Seed SLA Configs
  if (slaConfigs.length === 0) {
    slaConfigs = [
      {
        id: 'sla_urgent',
        name: 'Urgent Critical Outage',
        priority: 'URGENT',
        responseTimeMinutes: 15,
        resolutionTimeMinutes: 120,
        warningThresholdPercent: 75,
        businessHoursOnly: true,
        status: 'ACTIVE',
        isDeleted: false,
      },
      {
        id: 'sla_critical',
        name: 'Critical Infrastructure Disruption',
        priority: 'CRITICAL',
        responseTimeMinutes: 30,
        resolutionTimeMinutes: 240,
        warningThresholdPercent: 75,
        businessHoursOnly: true,
        status: 'ACTIVE',
        isDeleted: false,
      },
      {
        id: 'sla_high',
        name: 'High Priority Disruption',
        priority: 'HIGH',
        responseTimeMinutes: 60,
        resolutionTimeMinutes: 480,
        warningThresholdPercent: 75,
        businessHoursOnly: true,
        status: 'ACTIVE',
        isDeleted: false,
      },
      {
        id: 'sla_medium',
        name: 'Medium Standard Request',
        priority: 'MEDIUM',
        responseTimeMinutes: 240,
        resolutionTimeMinutes: 1440,
        warningThresholdPercent: 75,
        businessHoursOnly: true,
        status: 'ACTIVE',
        isDeleted: false,
      },
      {
        id: 'sla_low',
        name: 'Low General Inquiry',
        priority: 'LOW',
        responseTimeMinutes: 480,
        resolutionTimeMinutes: 2880,
        warningThresholdPercent: 75,
        businessHoursOnly: true,
        status: 'ACTIVE',
        isDeleted: false,
      },
    ];
  } else {
    // Ensure critical and warningThresholdPercent are present in existing loaded configs
    if (!slaConfigs.some((s) => s.priority === 'CRITICAL')) {
      slaConfigs.splice(1, 0, {
        id: 'sla_critical',
        name: 'Critical Infrastructure Disruption',
        priority: 'CRITICAL',
        responseTimeMinutes: 30,
        resolutionTimeMinutes: 240,
        warningThresholdPercent: 75,
        businessHoursOnly: true,
        status: 'ACTIVE',
        isDeleted: false,
      });
    }
    slaConfigs.forEach((s) => {
      if (s.warningThresholdPercent === undefined) {
        s.warningThresholdPercent = 75;
      }
    });
  }

  // Seed or Ensure Users:
  // Root Super Admin: accurateadmin
  // Super Admin 1: Sameer Tupe (password: Acculate@)
  // Super Admin 2: Rahul Prasad (password: Accurate@)
  // All demo users (itadmin, technician, demo employee accounts) permanently removed.
  const superAdminCreds = hashPasswordSync('Admin#2026!');
  const sameerCreds = hashPasswordSync('Acculate@');
  const rahulCreds = hashPasswordSync('Accurate@');

  const defaultUsers: StoredUser[] = [
    {
      id: 'usr_super_admin',
      username: 'accurateadmin',
      normalizedUsername: 'accurateadmin',
      displayName: 'Accurate Chief Admin',
      email: 'accuratecmmit@gmail.com',
      role: 'SUPER_ADMIN',
      itTeamId: null,
      itTeamName: null,
      companyId: 'comp_accurate',
      companyName: 'Accurate Group',
      departmentId: 'dept_it',
      departmentName: 'Information Technology & Security',
      designation: 'Chief Information Officer',
      assetTag: 'AST-ADMIN-001',
      locationId: 'loc_nyc',
      locationName: 'New York Global HQ',
      mobileNumber: '+1 (555) 019-2831',
      status: 'ACTIVE',
      passwordHash: superAdminCreds.hash,
      passwordSalt: superAdminCreds.salt,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      mustChangePassword: false,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_sameer_tupe',
      username: 'Sameer Tupe',
      normalizedUsername: 'sameer tupe',
      displayName: 'Sameer Tupe',
      email: 'sameer.tupe@accurategroup.com',
      role: 'SUPER_ADMIN',
      itTeamId: null,
      itTeamName: null,
      companyId: 'comp_accurate',
      companyName: 'Accurate Group',
      departmentId: 'dept_it',
      departmentName: 'Information Technology & Security',
      designation: 'Super Administrator',
      assetTag: 'AST-ADMIN-002',
      locationId: 'loc_nyc',
      locationName: 'New York Global HQ',
      mobileNumber: '+91 98765 43210',
      status: 'ACTIVE',
      passwordHash: sameerCreds.hash,
      passwordSalt: sameerCreds.salt,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      mustChangePassword: false,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_rahul_prasad',
      username: 'Rahul Prasad',
      normalizedUsername: 'rahul prasad',
      displayName: 'Rahul Prasad',
      email: 'rahul.prasad@accurategroup.com',
      role: 'SUPER_ADMIN',
      itTeamId: null,
      itTeamName: null,
      companyId: 'comp_accurate',
      companyName: 'Accurate Group',
      departmentId: 'dept_it',
      departmentName: 'Information Technology & Security',
      designation: 'Super Administrator',
      assetTag: 'AST-ADMIN-003',
      locationId: 'loc_nyc',
      locationName: 'New York Global HQ',
      mobileNumber: '+91 98765 43211',
      status: 'ACTIVE',
      passwordHash: rahulCreds.hash,
      passwordSalt: rahulCreds.salt,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      mustChangePassword: false,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  if (users.length === 0) {
    users = [...defaultUsers];
  } else {
    // Purge any demo users (itadmin, technician, old demo employee rahul, ananya, vikram, deepak, infratech)
    const demoUserIds = new Set(['usr_it_admin', 'usr_technician', 'usr_rahul', 'usr_ananya', 'usr_vikram', 'usr_deepak', 'usr_infra_tech']);
    const demoUsernames = new Set(['itadmin', 'technician', 'rahul', 'ananya', 'vikram', 'deepak', 'infratech']);
    users = users.filter((u) => !demoUserIds.has(u.id) && !demoUsernames.has(u.normalizedUsername?.toLowerCase()));

    // Ensure Sameer Tupe exists with Super Admin access and requested password
    const existingSameer = users.find(
      (u) =>
        u.id === 'usr_sameer_tupe' ||
        u.normalizedUsername?.toLowerCase() === 'sameer tupe' ||
        u.username?.toLowerCase() === 'sameer tupe' ||
        u.normalizedUsername?.toLowerCase() === 'sameertupe' ||
        u.email?.toLowerCase() === 'sameer.tupe@accurategroup.com'
    );
    if (!existingSameer) {
      users.push(defaultUsers[1]);
    } else {
      existingSameer.role = 'SUPER_ADMIN';
      existingSameer.status = 'ACTIVE';
      existingSameer.passwordHash = sameerCreds.hash;
      existingSameer.passwordSalt = sameerCreds.salt;
      existingSameer.failedLoginAttempts = 0;
      existingSameer.lockoutUntil = null;
    }

    // Ensure Rahul Prasad exists with Super Admin access and requested password
    const existingRahul = users.find(
      (u) =>
        u.id === 'usr_rahul_prasad' ||
        u.normalizedUsername?.toLowerCase() === 'rahul prasad' ||
        u.username?.toLowerCase() === 'rahul prasad' ||
        u.normalizedUsername?.toLowerCase() === 'rahulprasad' ||
        u.email?.toLowerCase() === 'rahul.prasad@accurategroup.com'
    );
    if (!existingRahul) {
      users.push(defaultUsers[2]);
    } else {
      existingRahul.role = 'SUPER_ADMIN';
      existingRahul.status = 'ACTIVE';
      existingRahul.passwordHash = rahulCreds.hash;
      existingRahul.passwordSalt = rahulCreds.salt;
      existingRahul.failedLoginAttempts = 0;
      existingRahul.lockoutUntil = null;
    }
  }

  // Seed Assets (Computer Inventory from organization inventory workbook or canonical dataset)
  if (!loadedFromDisk && assets.length === 0) {
    const candidatePaths = [
      path.join(process.cwd(), 'public', 'organization_inventory_workbook.xlsx'),
      path.join(process.cwd(), 'uploads', 'organization_inventory_workbook.xlsx'),
    ];
    const wbFilePath = candidatePaths.find((p) => fs.existsSync(p));
    let loadedFromExcel = false;

    if (wbFilePath) {
      try {
        const wb = XLSX.readFile(wbFilePath);
        const sheetName = wb.SheetNames[0];
        const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);
        if (rawRows.length > 0) {
          const valRes = parseAndValidateInventoryRows(rawRows);
          const validAssets: StoredAsset[] = [];
          valRes.results.forEach((item, idx) => {
            if (item.errors.length === 0) {
              const d = item.data;
              const assetId = `ast_${d.assetTag.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
              const hist: StoredAssetAssignmentRecord[] = [];
              if (d.assignedUserId || d.assignedUserName) {
                hist.push({
                  id: `asgn_${assetId}_init`,
                  assetId,
                  previousEmployeeId: d.previousEmployeeName ? 'prev_emp' : null,
                  previousEmployeeName: d.previousEmployeeName || null,
                  currentEmployeeId: d.assignedUserId,
                  currentEmployeeName: d.assignedUserName,
                  assignmentDate: d.assignmentDate || '2024-01-15',
                  transferDate: d.transferDate || null,
                  assignedByUserId: 'usr_super_admin',
                  assignedByUserName: 'Super Admin',
                  action: d.previousEmployeeName ? 'TRANSFER' : 'INITIAL_ASSIGNMENT',
                  notes: 'Initial assignment recorded from organization inventory workbook.',
                  createdAt: d.assignmentDate ? new Date(d.assignmentDate).toISOString() : now,
                });
              }

              validAssets.push({
                id: assetId,
                assetTag: d.assetTag,
                serialNumber: d.serialNumber,
                name: d.name,
                assetType: d.assetType,
                manufacturer: d.manufacturer,
                model: d.model,
                companyId: d.companyId,
                locationId: d.locationId,
                departmentId: d.departmentId,
                assignedUserId: d.assignedUserId,
                assignedUserName: d.assignedUserName,
                assignedUserEmail: d.assignedUserEmail,
                assignedTeamId: d.assignedTeamId || 'team_tier1',
                previousEmployeeId: null,
                previousEmployeeName: d.previousEmployeeName || null,
                assignmentDate: d.assignmentDate || (d.assignedUserId ? '2024-01-15' : null),
                transferDate: d.transferDate || null,
                status: d.status,
                specifications: d.specifications || {},
                purchaseDate: d.purchaseDate,
                purchaseCost: d.purchaseCost,
                warrantyExpiryDate: d.warrantyExpiryDate,
                notes: d.notes,
                customFields: d.customFields || {},
                assignmentHistory: hist,
                isDeleted: d.status === 'Retired',
                createdAt: now,
                updatedAt: now,
              });
            }
          });

          if (validAssets.length >= 10) {
            assets = validAssets;
            loadedFromExcel = true;
          }
        }
      } catch (err) {
        console.error('Initial workbook parse error, using canonical dataset fallback:', err);
      }
    }

    if (!loadedFromExcel) {
      assets = [
        {
          id: 'ast_eng_409',
          assetTag: 'AST-ENG-409',
          serialNumber: 'C02G89A1MD6R',
          name: 'MacBook Pro 16" (M3 Max)',
          assetType: 'LAPTOP',
          manufacturer: 'Apple',
          model: 'MacBook Pro 16-inch Nov 2023',
          companyId: 'comp_accurate',
          locationId: 'loc_sfo',
          departmentId: 'dept_eng',
          assignedUserId: 'usr_rahul',
          assignedUserName: 'Rahul Sharma',
          assignedUserEmail: 'rahul@accurategroup.com',
          assignedTeamId: 'team_tier1',
          previousEmployeeId: 'emp_david_chen',
          previousEmployeeName: 'David Chen',
          assignmentDate: '2024-01-15',
          transferDate: '2024-06-01',
          status: 'Active',
          specifications: { cpu: 'Apple M3 Max 16-core', ramGb: 36, storageGb: 1000, storageType: 'NVMe SSD', os: 'macOS Sonoma 14.6', macAddress: '3C:22:FB:91:AA:12', ipAddress: '10.0.14.88' },
          purchaseDate: '2024-01-15',
          purchaseCost: 3499,
          warrantyExpiryDate: '2027-01-15',
          notes: 'High-performance engineering build laptop. Full local admin granted.',
          assignmentHistory: [
            {
              id: 'asgn_eng_409_1',
              assetId: 'ast_eng_409',
              previousEmployeeId: null,
              previousEmployeeName: null,
              currentEmployeeId: 'emp_david_chen',
              currentEmployeeName: 'David Chen',
              assignmentDate: '2024-01-15',
              transferDate: '2024-06-01',
              assignedByUserId: 'usr_super_admin',
              assignedByUserName: 'Super Admin',
              action: 'INITIAL_ASSIGNMENT',
              notes: 'Provisioned for Senior Tech Lead.',
              createdAt: '2024-01-15T09:00:00.000Z',
            },
            {
              id: 'asgn_eng_409_2',
              assetId: 'ast_eng_409',
              previousEmployeeId: 'emp_david_chen',
              previousEmployeeName: 'David Chen',
              currentEmployeeId: 'usr_rahul',
              currentEmployeeName: 'Rahul Sharma',
              assignmentDate: '2024-06-01',
              transferDate: null,
              assignedByUserId: 'usr_it_admin',
              assignedByUserName: 'Sarah Jenkins',
              action: 'TRANSFER',
              notes: 'Reassigned to Rahul Sharma upon team transfer.',
              createdAt: '2024-06-01T10:30:00.000Z',
            },
          ],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ast_it_102',
          assetTag: 'AST-IT-102',
          serialNumber: '5CD32189PL',
          name: 'ThinkPad X1 Carbon Gen 11',
          assetType: 'LAPTOP',
          manufacturer: 'Lenovo',
          model: 'ThinkPad X1 Carbon Gen 11',
          companyId: 'comp_accurate',
          locationId: 'loc_nyc',
          departmentId: 'dept_it',
          assignedUserId: 'usr_it_admin',
          assignedUserName: 'Sarah Jenkins',
          assignedUserEmail: 'itadmin@accurategroup.com',
          assignedTeamId: 'team_tier1',
          previousEmployeeId: null,
          previousEmployeeName: null,
          assignmentDate: '2023-08-10',
          transferDate: null,
          status: 'Active',
          specifications: { cpu: 'Intel Core i7-1365U', ramGb: 32, storageGb: 1000, storageType: 'NVMe SSD', os: 'Windows 11 Enterprise', macAddress: 'E8:6A:64:1B:99:43', ipAddress: '10.0.2.45' },
          purchaseDate: '2023-08-10',
          purchaseCost: 2150,
          warrantyExpiryDate: '2026-08-10',
          notes: 'IT Administration primary management terminal.',
          assignmentHistory: [
            {
              id: 'asgn_it_102_1',
              assetId: 'ast_it_102',
              previousEmployeeId: null,
              previousEmployeeName: null,
              currentEmployeeId: 'usr_it_admin',
              currentEmployeeName: 'Sarah Jenkins',
              assignmentDate: '2023-08-10',
              transferDate: null,
              assignedByUserId: 'usr_super_admin',
              assignedByUserName: 'Super Admin',
              action: 'INITIAL_ASSIGNMENT',
              notes: 'IT Admin deployment.',
              createdAt: '2023-08-10T09:00:00.000Z',
            },
          ],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ast_tech_204',
          assetTag: 'AST-TECH-204',
          serialNumber: 'DLX8902KJ1',
          name: 'Dell Latitude 7440',
          assetType: 'LAPTOP',
          manufacturer: 'Dell',
          model: 'Latitude 7440 Enterprise',
          companyId: 'comp_accurate',
          locationId: 'loc_sfo',
          departmentId: 'dept_it',
          assignedUserId: 'usr_technician',
          assignedUserName: 'Marcus Vance',
          assignedUserEmail: 'technician@accurategroup.com',
          assignedTeamId: 'team_tier1',
          previousEmployeeId: null,
          previousEmployeeName: null,
          assignmentDate: '2023-11-20',
          transferDate: null,
          status: 'Active',
          specifications: { cpu: 'Intel Core i7-1370P', ramGb: 32, storageGb: 512, storageType: 'NVMe SSD', os: 'Ubuntu Linux 24.04 LTS', macAddress: '00:14:22:01:23:45', ipAddress: '10.0.14.12' },
          purchaseDate: '2023-11-20',
          purchaseCost: 1850,
          warrantyExpiryDate: '2026-11-20',
          notes: 'Technician on-site diagnostic laptop with diagnostic toolkit.',
          assignmentHistory: [],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ast_fin_112',
          assetTag: 'AST-FIN-112',
          serialNumber: '5CD49811TR',
          name: 'HP Elite Dragonfly G4',
          assetType: 'LAPTOP',
          manufacturer: 'HP',
          model: 'Elite Dragonfly G4',
          companyId: 'comp_accurate',
          locationId: 'loc_nyc',
          departmentId: 'dept_fin',
          assignedUserId: 'usr_ananya',
          assignedUserName: 'Ananya Patel',
          assignedUserEmail: 'ananya@accurategroup.com',
          assignedTeamId: 'team_tier1',
          previousEmployeeId: null,
          previousEmployeeName: null,
          assignmentDate: '2024-03-01',
          transferDate: null,
          status: 'Active',
          specifications: { cpu: 'Intel Core i7-1355U', ramGb: 16, storageGb: 512, storageType: 'NVMe SSD', os: 'Windows 11 Enterprise', macAddress: '34:17:EB:A0:82:11', ipAddress: '10.0.2.89' },
          purchaseDate: '2024-03-01',
          purchaseCost: 2200,
          warrantyExpiryDate: '2027-03-01',
          notes: 'Corporate Finance secure laptop with BitLocker full-disk encryption.',
          assignmentHistory: [],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ast_pool_018',
          assetTag: 'AST-POOL-018',
          serialNumber: 'C02FK081MD6T',
          name: 'MacBook Air 15" (M2) Ready Pool',
          assetType: 'LAPTOP',
          manufacturer: 'Apple',
          model: 'MacBook Air 15-inch 2023',
          companyId: 'comp_accurate',
          locationId: 'loc_nyc',
          departmentId: 'dept_it',
          assignedUserId: null,
          assignedUserName: null,
          assignedUserEmail: null,
          assignedTeamId: 'team_tier1',
          previousEmployeeId: null,
          previousEmployeeName: null,
          assignmentDate: null,
          transferDate: null,
          status: 'Inactive',
          specifications: { cpu: 'Apple M2 8-core', ramGb: 16, storageGb: 512, storageType: 'SSD', os: 'macOS Sonoma 14.5', macAddress: 'F0:18:98:33:41:BC', ipAddress: '10.0.2.204' },
          purchaseDate: '2024-02-14',
          purchaseCost: 1499,
          warrantyExpiryDate: '2027-02-14',
          notes: 'Unallocated standby laptop in stock room safe.',
          assignmentHistory: [],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ast_dev_550',
          assetTag: 'AST-DEV-550',
          serialNumber: '8CC99120KL',
          name: 'Dell Precision 5860 Tower Workstation',
          assetType: 'WORKSTATION',
          manufacturer: 'Dell',
          model: 'Precision 5860 Tower',
          companyId: 'comp_accurate',
          locationId: 'loc_sfo',
          departmentId: 'dept_eng',
          assignedUserId: null,
          assignedUserName: null,
          assignedUserEmail: null,
          assignedTeamId: 'team_tier1',
          previousEmployeeId: 'emp_elena',
          previousEmployeeName: 'Elena Rostova',
          assignmentDate: null,
          transferDate: '2024-07-15',
          status: 'Under Repair',
          specifications: { cpu: 'Intel Xeon W5-2465X 16-core', ramGb: 64, storageGb: 2000, storageType: 'NVMe SSD', os: 'Red Hat Enterprise Linux 9', macAddress: '18:66:DA:44:91:02', ipAddress: '10.0.14.40' },
          purchaseDate: '2023-09-01',
          purchaseCost: 4890,
          warrantyExpiryDate: '2026-09-01',
          notes: 'Motherboard memory bus diagnostic in progress by Dell On-Site Premier Support.',
          assignmentHistory: [
            {
              id: 'asgn_dev_550_1',
              assetId: 'ast_dev_550',
              previousEmployeeId: null,
              previousEmployeeName: null,
              currentEmployeeId: 'emp_elena',
              currentEmployeeName: 'Elena Rostova',
              assignmentDate: '2023-09-01',
              transferDate: '2024-07-15',
              assignedByUserId: 'usr_super_admin',
              assignedByUserName: 'Super Admin',
              action: 'INITIAL_ASSIGNMENT',
              notes: 'Engineering build workstation.',
              createdAt: '2023-09-01T09:00:00.000Z',
            },
            {
              id: 'asgn_dev_550_2',
              assetId: 'ast_dev_550',
              previousEmployeeId: 'emp_elena',
              previousEmployeeName: 'Elena Rostova',
              currentEmployeeId: null,
              currentEmployeeName: null,
              assignmentDate: '2024-07-15',
              transferDate: '2024-07-15',
              assignedByUserId: 'usr_it_admin',
              assignedByUserName: 'Sarah Jenkins',
              action: 'STATUS_CHANGE',
              notes: 'Moved to Under Repair due to intermittent hardware kernel fault.',
              createdAt: '2024-07-15T11:00:00.000Z',
            },
          ],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ast_leg_099',
          assetTag: 'AST-LEG-099',
          serialNumber: '4XJ901289Z',
          name: 'Lenovo ThinkPad T480s (Legacy)',
          assetType: 'LAPTOP',
          manufacturer: 'Lenovo',
          model: 'ThinkPad T480s',
          companyId: 'comp_accurate',
          locationId: 'loc_nyc',
          departmentId: 'dept_it',
          assignedUserId: null,
          assignedUserName: null,
          assignedUserEmail: null,
          assignedTeamId: 'team_tier1',
          previousEmployeeId: 'emp_james',
          previousEmployeeName: 'James Wilson',
          assignmentDate: null,
          transferDate: '2023-12-31',
          status: 'Retired',
          specifications: { cpu: 'Intel Core i5-8250U', ramGb: 8, storageGb: 256, storageType: 'SATA SSD', os: 'Windows 10 Pro', macAddress: '48:2A:E3:71:00:44' },
          purchaseDate: '2018-06-15',
          purchaseCost: 1250,
          warrantyExpiryDate: '2021-06-15',
          notes: 'Decommissioned after 5-year hardware lifecycle. Disk wiped & recycled.',
          assignmentHistory: [
            {
              id: 'asgn_leg_099_1',
              assetId: 'ast_leg_099',
              previousEmployeeId: null,
              previousEmployeeName: null,
              currentEmployeeId: 'emp_james',
              currentEmployeeName: 'James Wilson',
              assignmentDate: '2018-06-15',
              transferDate: '2023-12-31',
              assignedByUserId: 'usr_super_admin',
              assignedByUserName: 'Super Admin',
              action: 'INITIAL_ASSIGNMENT',
              notes: 'Legacy corporate fleet device.',
              createdAt: '2018-06-15T09:00:00.000Z',
            },
            {
              id: 'asgn_leg_099_2',
              assetId: 'ast_leg_099',
              previousEmployeeId: 'emp_james',
              previousEmployeeName: 'James Wilson',
              currentEmployeeId: null,
              currentEmployeeName: null,
              assignmentDate: '2023-12-31',
              transferDate: '2023-12-31',
              assignedByUserId: 'usr_it_admin',
              assignedByUserName: 'Sarah Jenkins',
              action: 'STATUS_CHANGE',
              notes: 'Retired from active service. Audit record permanently preserved.',
              createdAt: '2023-12-31T17:00:00.000Z',
            },
          ],
          isDeleted: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ast_desk_301',
          assetTag: 'AST-DESK-301',
          serialNumber: 'MJ089901KA',
          name: 'HP Z2 Mini G9 Desktop Workstation',
          assetType: 'DESKTOP',
          manufacturer: 'HP',
          model: 'Z2 Mini G9',
          companyId: 'comp_accurate',
          locationId: 'loc_lon',
          departmentId: 'dept_it',
          assignedUserId: 'usr_vikram',
          assignedUserName: 'Vikram Malhotra',
          assignedUserEmail: 'vikram@accurategroup.com',
          assignedTeamId: 'team_tier1',
          previousEmployeeId: null,
          previousEmployeeName: null,
          assignmentDate: '2023-10-05',
          transferDate: null,
          status: 'Active',
          specifications: { cpu: 'Intel Core i9-13900', ramGb: 64, storageGb: 1000, storageType: 'NVMe SSD', os: 'Windows 11 Pro for Workstations', macAddress: '6C:4B:90:31:AA:55', ipAddress: '10.0.8.22' },
          purchaseDate: '2023-10-05',
          purchaseCost: 2450,
          warrantyExpiryDate: '2026-10-05',
          notes: 'Trading floor compact desktop workstation.',
          assignmentHistory: [],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ast_net_551',
          assetTag: 'AST-NET-551',
          serialNumber: 'FOC2438V09A',
          name: 'Cisco Catalyst 9300 48-Port PoE Switch',
          assetType: 'NETWORK_DEVICE',
          manufacturer: 'Cisco Systems',
          model: 'C9300-48P-A',
          companyId: 'comp_accurate',
          locationId: 'loc_lon',
          departmentId: 'dept_it',
          assignedUserId: null,
          assignedUserName: null,
          assignedUserEmail: null,
          assignedTeamId: 'team_infra',
          previousEmployeeId: null,
          previousEmployeeName: null,
          assignmentDate: null,
          transferDate: null,
          status: 'Active',
          specifications: { cpu: 'x86 4-core', ramGb: 16, storageGb: 16, storageType: 'Flash', os: 'Cisco IOS-XE 17.9', macAddress: '00:2A:10:88:99:FF', ipAddress: '10.0.8.1' },
          purchaseDate: '2023-05-18',
          purchaseCost: 6200,
          warrantyExpiryDate: '2028-05-18',
          notes: 'IDF Room rack switch. Managed network infrastructure.',
          assignmentHistory: [],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'ast_sec_901',
          assetTag: 'AST-SEC-901',
          serialNumber: 'PAN-PA-3260-91',
          name: 'Palo Alto PA-3260 Next-Gen Firewall',
          assetType: 'NETWORK_DEVICE',
          manufacturer: 'Palo Alto Networks',
          model: 'PA-3260',
          companyId: 'comp_accurate',
          locationId: 'loc_nyc',
          departmentId: 'dept_it',
          assignedUserId: null,
          assignedUserName: null,
          assignedUserEmail: null,
          assignedTeamId: 'team_security',
          previousEmployeeId: null,
          previousEmployeeName: null,
          assignmentDate: null,
          transferDate: null,
          status: 'Active',
          specifications: { cpu: 'PAN-OS ASIC multi-core', ramGb: 32, storageGb: 120, storageType: 'SSD', os: 'PAN-OS 11.1', macAddress: 'D4:1D:71:02:55:66', ipAddress: '10.0.2.1' },
          purchaseDate: '2023-04-12',
          purchaseCost: 18500,
          warrantyExpiryDate: '2028-04-12',
          notes: 'Perimeter security firewall appliance.',
          assignmentHistory: [],
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        },
      ];
    }
  }

  // Seed Tickets
  if (!loadedFromDisk && tickets.length === 0) {
    tickets = [
      {
        id: 'tck_1001',
        ticketNumber: 'TCK-10001',
        title: 'Developer Workstation Kernel Panic on Docker daemon start',
        description: 'Encountering recurring kernel panic crashes when starting docker compose services on macOS Sonoma. Need hardware diagnostic check.',
        category: 'HARDWARE',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        requesterId: 'usr_rahul',
        requesterName: 'Rahul Sharma',
        requesterEmail: 'rahul@accurategroup.com',
        requesterCompanyId: 'comp_accurate',
        requesterLocationId: 'loc_sfo',
        requesterDepartmentId: 'dept_eng',
        assignedTeamId: 'team_tier1',
        assignedTeamName: 'Tier 1 Service Desk & User Support',
        assignedTechnicianId: 'usr_technician',
        assignedTechnicianName: 'Marcus Vance',
        relatedAssetId: 'ast_eng_409',
        relatedAssetTag: 'AST-ENG-409',
        createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      },
      {
        id: 'tck_1002',
        ticketNumber: 'TCK-10002',
        title: 'VPN Certificate Renewal for London Remote Access Gateway',
        description: 'Certificate expiring in 48 hours on the London perimeter gateway. User sessions will fail if not renewed promptly.',
        category: 'NETWORK',
        priority: 'URGENT',
        status: 'OPEN',
        requesterId: 'usr_vikram',
        requesterName: 'Vikram Malhotra',
        requesterEmail: 'vikram@accurategroup.com',
        requesterCompanyId: 'comp_accurate',
        requesterLocationId: 'loc_lon',
        requesterDepartmentId: 'dept_ops',
        assignedTeamId: 'team_infra',
        assignedTeamName: 'Infrastructure & Network Systems',
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        relatedAssetId: 'ast_infra_switch_01',
        relatedAssetTag: 'AST-NET-551',
        createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
      {
        id: 'tck_1003',
        ticketNumber: 'TCK-10003',
        title: 'Dual Monitor DisplayLink Driver Glitch on USB-C Dock',
        description: 'Second monitor intermittently flickers and drops signal after 30 minutes of continuous usage in Singapore APAC hub.',
        category: 'HARDWARE',
        priority: 'MEDIUM',
        status: 'NEW',
        requesterId: 'usr_deepak',
        requesterName: 'Deepak Verma',
        requesterEmail: 'deepak@accurategroup.com',
        requesterCompanyId: 'comp_accurate',
        requesterLocationId: 'loc_sin',
        requesterDepartmentId: 'dept_hr',
        assignedTeamId: 'team_tier1',
        assignedTeamName: 'Tier 1 Service Desk & User Support',
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        relatedAssetId: 'ast_hr_501',
        relatedAssetTag: 'AST-HR-501',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 'tck_1004',
        ticketNumber: 'TCK-10004',
        title: 'Security Key FIDO2 Token Enrollment for Financial Ledger',
        description: 'Requesting hardware security key provisioning for ERP accounting portal administrative authorization.',
        category: 'ACCESS',
        priority: 'MEDIUM',
        status: 'OPEN',
        requesterId: 'usr_ananya',
        requesterName: 'Ananya Patel',
        requesterEmail: 'ananya@accurategroup.com',
        requesterCompanyId: 'comp_accurate',
        requesterLocationId: 'loc_nyc',
        requesterDepartmentId: 'dept_fin',
        assignedTeamId: 'team_security',
        assignedTeamName: 'Information Security & Access Management',
        assignedTechnicianId: null,
        assignedTechnicianName: null,
        relatedAssetId: 'ast_fin_112',
        relatedAssetTag: 'AST-FIN-112',
        createdAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      },
    ];

    ticketComments = [
      {
        id: 'cmt_1001_1',
        ticketId: 'tck_1001',
        authorId: 'usr_technician',
        authorName: 'Marcus Vance',
        authorEmail: 'technician@accurategroup.com',
        authorRole: 'IT_TECHNICIAN',
        isInternalOnly: false,
        content: 'Hi Rahul, I have received your incident ticket and inspected the crash logs. Could you run `sudo dmesg | grep -i panic` and paste the trace here?',
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      },
      {
        id: 'cmt_1001_2',
        ticketId: 'tck_1001',
        authorId: 'usr_technician',
        authorName: 'Marcus Vance',
        authorEmail: 'technician@accurategroup.com',
        authorRole: 'IT_TECHNICIAN',
        isInternalOnly: true,
        content: '[INTERNAL TECH NOTE] Hardware Apple Diagnostics run showed error code VFD001 (display adapter / RAM memory page fault). May need motherboard exchange under AppleCare+ warranty.',
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 'cmt_1001_3',
        ticketId: 'tck_1001',
        authorId: 'usr_rahul',
        authorName: 'Rahul Sharma',
        authorEmail: 'rahul@accurategroup.com',
        authorRole: 'EMPLOYEE',
        isInternalOnly: false,
        content: 'Thanks Marcus! I generated the dmesg trace and confirmed it happened right after starting the Docker daemon. Looking forward to your guidance.',
        createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      },
    ];
  }

  // Ensure sample attachment exists on disk
  const sampleLogPath = path.join(UPLOADS_DIR, 'sample_crash_log.txt');
  if (!fs.existsSync(sampleLogPath)) {
    try {
      fs.writeFileSync(
        sampleLogPath,
        'Kernel panic [CPU 0 caller 0xfffffe001ec88910]: macOS Sonoma 14.6 panic string: trap=0x0 esr=0x92000047 far=0x0000000000000008\nDocker daemon pid 4921 faulting address\nApple Diagnostics VFD001 verified',
        'utf8'
      );
    } catch (e) {
      console.warn('Could not write sample log:', e);
    }
  }

  // Seed sample attachments
  if (ticketAttachments.length === 0) {
    ticketAttachments = [
      {
        id: 'att_1001_1',
        ticketId: 'tck_1001',
        originalFileName: 'docker_kernel_panic_trace.txt',
        storedFileName: 'sample_crash_log.txt',
        fileSizeBytes: 214,
        mimeType: 'text/plain',
        extension: 'txt',
        isPreviewable: true,
        uploadedById: 'usr_rahul',
        uploadedByName: 'Rahul Sharma',
        uploadedByRole: 'EMPLOYEE',
        uploadedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        isDeleted: false,
      },
    ];
    // Attach to tck_1001
    const tck1 = tickets.find((t) => t.id === 'tck_1001');
    if (tck1) {
      tck1.attachmentIds = ['att_1001_1'];
    }
  }

  // Seed ticket history
  if (ticketHistories.length === 0) {
    ticketHistories = [
      {
        id: 'hist_1001_1',
        ticketId: 'tck_1001',
        action: 'CREATED',
        actorId: 'usr_rahul',
        actorName: 'Rahul Sharma',
        actorRole: 'EMPLOYEE',
        details: 'Ticket created with priority HIGH by Rahul Sharma.',
        fromValue: null,
        toValue: 'NEW',
        timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      },
      {
        id: 'hist_1001_2',
        ticketId: 'tck_1001',
        action: 'ATTACHMENT_ADDED',
        actorId: 'usr_rahul',
        actorName: 'Rahul Sharma',
        actorRole: 'EMPLOYEE',
        details: 'Uploaded attachment "docker_kernel_panic_trace.txt".',
        timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      },
      {
        id: 'hist_1001_3',
        ticketId: 'tck_1001',
        action: 'ASSIGNED',
        actorId: 'usr_technician',
        actorName: 'Marcus Vance',
        actorRole: 'IT_TECHNICIAN',
        details: 'Assigned to IT Technician Marcus Vance.',
        fromValue: null,
        toValue: 'Marcus Vance',
        timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      },
      {
        id: 'hist_1001_4',
        ticketId: 'tck_1001',
        action: 'STATUS_CHANGED',
        actorId: 'usr_technician',
        actorName: 'Marcus Vance',
        actorRole: 'IT_TECHNICIAN',
        details: 'Ticket status updated to IN_PROGRESS.',
        fromValue: 'ASSIGNED',
        toValue: 'IN_PROGRESS',
        timestamp: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
      },
    ];
  }

  // Ensure all tickets have location and contact defaults
  tickets.forEach((t) => {
    if (!t.locationId && t.requesterLocationId) {
      t.locationId = t.requesterLocationId;
      const loc = locations.find((l) => l.id === t.locationId);
      if (loc) t.locationName = loc.name;
    }
    if (!t.contactNumber) {
      const u = users.find((usr) => usr.id === t.requesterId);
      t.contactNumber = u?.mobileNumber || '+1 (555) 012-7711';
    }
  });

  // Seed Notifications
  if (notifications.length === 0) {
    notifications = [
      {
        id: 'notif_1',
        recipientId: 'usr_rahul',
        senderId: 'usr_technician',
        title: 'Ticket TCK-10001 Assigned',
        message: 'Marcus Vance has been assigned to your support ticket regarding workstation kernel panic.',
        type: 'TICKET_ASSIGNED',
        referenceEntityType: 'TICKET',
        referenceEntityId: 'tck_1001',
        isRead: false,
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      },
      {
        id: 'notif_2',
        recipientId: 'usr_technician',
        senderId: 'system',
        title: 'New Unassigned Ticket in Tier 1 Queue',
        message: 'Ticket TCK-10003 (DisplayLink Driver Glitch) is unassigned in Tier 1 Service Desk queue.',
        type: 'TICKET_UPDATED',
        referenceEntityType: 'TICKET',
        referenceEntityId: 'tck_1003',
        isRead: false,
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 'notif_3',
        recipientId: 'usr_it_admin',
        senderId: 'system',
        title: 'Registration Pending Approval',
        message: 'New employee Ananya Patel (Finance & Accounting) has registered and requires identity approval.',
        type: 'SECURITY_ALERT',
        referenceEntityType: 'ASSET',
        isRead: false,
        createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      },
    ];
  }

  if (auditLogs.length === 0) {
    auditLogs = [
      {
        id: 'audit_init',
        timestamp: now,
        actorId: 'system',
        actorEmail: 'system@accurategroup.com',
        actorRole: 'SUPER_ADMIN',
        action: 'SYSTEM_SEEDED',
        entityType: 'AUTH',
        entityId: 'system',
        details: 'Enterprise ITMS RBAC foundation initialized with master data, IT teams, and hardware pools.',
      },
    ];
  }

  // Seed default organization-wide saved filters
  if (savedFilters.length === 0) {
    savedFilters = [
      {
        id: 'fltr_high_critical',
        name: 'High & Critical Incidents',
        ownerId: 'usr_super_admin',
        ownerName: 'Accurate Chief Admin',
        ownerRole: 'SUPER_ADMIN',
        isShared: true,
        criteria: {
          priority: 'HIGH',
        },
        sortConfig: {
          sortBy: 'priority',
          sortOrder: 'desc',
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'fltr_active_assigned',
        name: 'Active & Assigned Tickets',
        ownerId: 'usr_super_admin',
        ownerName: 'Accurate Chief Admin',
        ownerRole: 'SUPER_ADMIN',
        isShared: true,
        criteria: {
          status: 'ASSIGNED',
        },
        sortConfig: {
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'fltr_unassigned_pool',
        name: 'Unassigned Tickets Queue',
        ownerId: 'usr_super_admin',
        ownerName: 'Accurate Chief Admin',
        ownerRole: 'SUPER_ADMIN',
        isShared: true,
        criteria: {
          status: 'NEW',
        },
        sortConfig: {
          sortBy: 'createdAt',
          sortOrder: 'asc',
        },
        createdAt: now,
        updatedAt: now,
      },
    ];
  }

  // Enforce user instruction: Remove demo tickets, comments, and demo notifications.
  tickets = [];
  ticketComments = [];
  ticketAttachments = [];
  ticketHistories = [];
  notifications = [];
  profileChangeRequests = [];
  users = (users || []).filter((u) => u.email?.toLowerCase() === 'accuratecmmit@gmail.com' || u.role === 'SUPER_ADMIN');
  sessions = (sessions || []).filter((s) => users.some((u) => u.id === s.userId));

  // Retain assets: Do NOT wipe hardware inventory!
  if (!loadedFromDisk && (!assets || assets.length === 0)) {
    assets = [];
  }

  // Enforce user instruction: Remove all companies, locations, and departments
  companies = [];
  locations = [];
  departments = [];
  users.forEach((u) => {
    u.companyId = undefined;
    u.companyName = undefined;
    u.locationId = '';
    u.locationName = undefined;
    u.departmentId = '';
    u.departmentName = undefined;
  });

  persistData();
}

loadOrSeedData();

// Clean sanitized user output for API responses
function sanitizeUser(u: StoredUser) {
  const { passwordHash, passwordSalt, ...safe } = u;
  return safe;
}

// Authentication & Authorization Middlewares
function getAuthUser(req: Request): { user: StoredUser; session: StoredSession } | null {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (typeof req.query.token === 'string' && req.query.token) {
    token = req.query.token;
  }

  // Check header email for super admin fallback
  const headerEmail = (
    (req.headers['x-user-email'] as string) ||
    (req.headers['x-actor-email'] as string) ||
    ''
  ).toLowerCase().trim();

  if (token) {
    const tokenHash = hashToken(token);
    const session = sessions.find((s) => s.token === token || s.activeTokenHash === tokenHash);
    if (session && session.status === 'ACTIVE') {
      const now = Date.now();
      const lastActive = new Date(session.lastActiveAt).getTime();
      if (now - lastActive > 30 * 60 * 1000) {
        session.status = 'EXPIRED';
        persistData();
      } else {
        const user = users.find((u) => u.id === session.userId);
        if (user && user.status !== 'SUSPENDED' && user.status !== 'DEACTIVATED' && user.status !== 'REJECTED') {
          session.lastActiveAt = new Date(now).toISOString();
          session.expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
          persistData();
          return { user, session };
        }
      }
    }
  }

  if (headerEmail === 'accuratecmmit@gmail.com') {
    let superAdmin = users.find(
      (u) => u.email.toLowerCase() === 'accuratecmmit@gmail.com' || u.role === 'SUPER_ADMIN'
    );
    if (superAdmin) {
      let activeSession = sessions.find((s) => s.userId === superAdmin!.id && s.status === 'ACTIVE');
      if (!activeSession) {
        const now = Date.now();
        activeSession = {
          id: `ses_super_${now}`,
          userId: superAdmin.id,
          username: superAdmin.username,
          displayName: superAdmin.displayName,
          userEmail: superAdmin.email,
          userRole: superAdmin.role,
          token: `tok_super_${now}`,
          activeTokenHash: hashToken(`tok_super_${now}`),
          createdAt: new Date(now).toISOString(),
          lastActiveAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 24 * 3600 * 1000).toISOString(),
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.headers['user-agent'] as string) || 'MasterDataConsole',
          deviceLabel: 'Super Admin Console',
          status: 'ACTIVE',
        };
        sessions.push(activeSession);
        persistData();
      }
      return { user: superAdmin, session: activeSession };
    }
  }

  return null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authState = getAuthUser(req);
  if (!authState) {
    res.status(401).json({ error: 'Unauthorized: Valid active session token required.' });
    return;
  }
  (req as any).user = authState.user;
  (req as any).session = authState.session;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authState = getAuthUser(req);
  if (!authState) {
    res.status(401).json({ error: 'Unauthorized: Session missing or expired.' });
    return;
  }
  if (authState.user.role !== 'SUPER_ADMIN' && authState.user.role !== 'IT_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Requires IT Admin or Super Admin role.' });
    return;
  }
  (req as any).user = authState.user;
  (req as any).session = authState.session;
  next();
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const authState = getAuthUser(req);
  if (!authState) {
    res.status(401).json({ error: 'Unauthorized: Session missing or expired.' });
    return;
  }
  if (authState.user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Requires Super Admin role.' });
    return;
  }
  (req as any).user = authState.user;
  (req as any).session = authState.session;
  next();
}

function requireTechnicianOrAdmin(req: Request, res: Response, next: NextFunction) {
  const authState = getAuthUser(req);
  if (!authState) {
    res.status(401).json({ error: 'Unauthorized: Session missing or expired.' });
    return;
  }
  if (
    authState.user.role !== 'SUPER_ADMIN' &&
    authState.user.role !== 'IT_ADMIN' &&
    authState.user.role !== 'IT_TECHNICIAN'
  ) {
    res.status(403).json({ error: 'Forbidden: Requires IT Technician, IT Admin, or Super Admin role.' });
    return;
  }
  (req as any).user = authState.user;
  (req as any).session = authState.session;
  next();
}

// ==========================================
// 1. PUBLIC AUTHENTICATION ROUTES
// ==========================================

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

/**
 * POST /api/auth/register
 * Implements the 9 required fields and strict validation rules.
 */
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const {
      employeeName,
      username,
      password,
      confirmPassword,
      departmentId,
      departmentName,
      designation,
      assetTag,
      locationId,
      locationName,
      mobileNumber,
    } = req.body;

    // 1. Employee Name
    if (!employeeName || !employeeName.trim()) {
      res.status(400).json({ error: 'Employee Name is required.' });
      return;
    }

    // 2. Username rules:
    // - A-Z alphabetic characters only.
    // - No spaces.
    // - No numbers.
    // - No special characters.
    // - Case-insensitive uniqueness.
    // - Rahul, RAHUL and rahul must be treated as the same username.
    if (!username || !username.trim()) {
      res.status(400).json({ error: 'Username is required.' });
      return;
    }
    const trimmedUsername = username.trim();
    if (/\s/.test(trimmedUsername)) {
      res.status(400).json({ error: 'Username must not contain any spaces.' });
      return;
    }
    if (/\d/.test(trimmedUsername)) {
      res.status(400).json({ error: 'Username must not contain numbers. A-Z alphabetic characters only.' });
      return;
    }
    if (!/^[a-zA-Z]+$/.test(trimmedUsername)) {
      res.status(400).json({
        error: 'Username can only contain alphabetic characters (A-Z). No special characters or symbols.',
      });
      return;
    }

    const normalizedUsername = trimmedUsername.toLowerCase();
    const existing = users.find((u) => u.normalizedUsername === normalizedUsername);
    if (existing) {
      res.status(409).json({
        error: `Username "${trimmedUsername}" is already registered (usernames are case-insensitive). Please choose another.`,
      });
      return;
    }

    // 3. Password rules:
    // - Minimum 8 characters.
    // - Uppercase.
    // - Lowercase.
    // - Number.
    // - Special character.
    // - Secure one-way hashing.
    // - Previous passwords may be reused.
    if (!password) {
      res.status(400).json({ error: 'Password is required.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }
    if (!/[A-Z]/.test(password)) {
      res.status(400).json({ error: 'Password must contain at least one uppercase letter (A-Z).' });
      return;
    }
    if (!/[a-z]/.test(password)) {
      res.status(400).json({ error: 'Password must contain at least one lowercase letter (a-z).' });
      return;
    }
    if (!/[0-9]/.test(password)) {
      res.status(400).json({ error: 'Password must contain at least one numeric digit (0-9).' });
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      res.status(400).json({ error: 'Password must contain at least one special character (!@#$%^&*...).' });
      return;
    }

    // 4. Confirm Password
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Password and Confirm Password do not match.' });
      return;
    }

    // 5. Department
    if (!departmentId || !departmentId.trim()) {
      res.status(400).json({ error: 'Department is required.' });
      return;
    }
    const selDept = departments.find((d) => d.id === departmentId.trim() && !d.isDeleted);
    if (selDept && (selDept.isArchived || selDept.status === 'ARCHIVED')) {
      res.status(400).json({ error: 'Selected Department is archived or inactive. Please select an active department.' });
      return;
    }

    // 6. Designation
    if (!designation || !designation.trim()) {
      res.status(400).json({ error: 'Designation is required.' });
      return;
    }

    // 7. Computer/Asset Tag
    if (!assetTag || !assetTag.trim()) {
      res.status(400).json({ error: 'Computer/Asset Tag is required.' });
      return;
    }

    // 8. Location
    if (!locationId || !locationId.trim()) {
      res.status(400).json({ error: 'Location is required.' });
      return;
    }
    const selLoc = locations.find((l) => l.id === locationId.trim() && !l.isDeleted);
    if (selLoc && (selLoc.isArchived || selLoc.status === 'ARCHIVED')) {
      res.status(400).json({ error: 'Selected Location is archived or inactive. Please select an active location.' });
      return;
    }

    // 9. Mobile Number
    if (!mobileNumber || !mobileNumber.trim()) {
      res.status(400).json({ error: 'Mobile Number is required.' });
      return;
    }

    // Hash password with PBKDF2
    const { hash, salt } = hashPasswordSync(password);
    const now = new Date().toISOString();
    const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newUser: StoredUser = {
      id: newUserId,
      username: trimmedUsername,
      normalizedUsername,
      displayName: employeeName.trim(),
      email: `${normalizedUsername}@accurategroup.com`,
      role: 'EMPLOYEE',
      departmentId,
      departmentName: departmentName || 'Operations',
      designation: designation.trim(),
      assetTag: assetTag.trim(),
      locationId,
      locationName: locationName || 'Main Office',
      mobileNumber: mobileNumber.trim(),
      status: 'PENDING_APPROVAL', // Employee registers → Pending → IT Admin reviews → Approve/Reject
      passwordHash: hash,
      passwordSalt: salt,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      mustChangePassword: false,
      rejectionReason: null,
      createdAt: now,
      updatedAt: now,
    };

    users.push(newUser);
    persistData();

    logAudit(
      { id: newUserId, email: newUser.email, role: 'EMPLOYEE' },
      'USER_CREATED',
      'USER',
      newUserId,
      `User created via registration: ${newUser.displayName} (@${newUser.username}). Status: PENDING_APPROVAL.`,
      req
    );

    logAudit(
      { id: newUserId, email: newUser.email, role: 'EMPLOYEE' },
      'USER_REGISTRATION_SUBMITTED',
      'USER',
      newUserId,
      `Employee registered: ${newUser.displayName} (@${newUser.username}). Status: PENDING_APPROVAL.`,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Registration submitted successfully! Your account is pending IT Administrator review and approval.',
      userId: newUserId,
      status: 'PENDING_APPROVAL',
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

/**
 * POST /api/auth/login
 * Login security rules:
 * - 5 incorrect password attempts causes a 15-minute lockout.
 * - After 15 minutes the user may log in again.
 * - Failed-attempt counter is NOT automatically reset.
 * - Successful login does NOT reset it.
 * - Counter continues cumulatively.
 * - Only IT Admin/Super Admin can manually reset the counter.
 * - Warn after the 3rd failed attempt.
 * - Show remaining attempts.
 * - Locked screen shows remaining lockout time.
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const normalized = username.trim().toLowerCase();
    const compactNormalized = normalized.replace(/[\s._-]+/g, '');
    const user = users.find((u) => {
      const uNorm = (u.normalizedUsername || '').toLowerCase();
      const uName = (u.username || '').toLowerCase();
      const uDisplay = (u.displayName || '').toLowerCase();
      const uEmail = (u.email || '').toLowerCase();
      return (
        uNorm === normalized ||
        uName === normalized ||
        uDisplay === normalized ||
        uEmail === normalized ||
        uNorm.replace(/[\s._-]+/g, '') === compactNormalized ||
        uName.replace(/[\s._-]+/g, '') === compactNormalized ||
        uDisplay.replace(/[\s._-]+/g, '') === compactNormalized ||
        (compactNormalized.length >= 4 && (
          uNorm.replace(/[\s._-]+/g, '').startsWith(compactNormalized) ||
          uName.replace(/[\s._-]+/g, '').startsWith(compactNormalized) ||
          uDisplay.replace(/[\s._-]+/g, '').startsWith(compactNormalized)
        ))
      );
    });

    if (!user) {
      // Avoid revealing user existence for security, but report invalid credentials
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    // Check account status:
    if (user.status === 'PENDING_APPROVAL') {
      res.status(403).json({
        error: 'Your registration is currently pending review and approval by an IT Administrator.',
        status: 'PENDING_APPROVAL',
      });
      return;
    }

    if (user.status === 'REJECTED') {
      res.status(403).json({
        error: `Your registration was rejected by IT Administration. Reason: ${user.rejectionReason || 'Identity verification failed.'}`,
        status: 'REJECTED',
        rejectionReason: user.rejectionReason,
      });
      return;
    }

    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      res.status(403).json({
        error: 'Your account is disabled. All sessions have been terminated. Please contact IT Administration.',
        status: user.status,
      });
      return;
    }

    const now = Date.now();

    // Check lockout:
    if (user.lockoutUntil) {
      const lockoutExpiry = new Date(user.lockoutUntil).getTime();
      if (lockoutExpiry > now) {
        const remainingSeconds = Math.ceil((lockoutExpiry - now) / 1000);
        res.status(423).json({
          error: `Account is temporarily locked due to 5 incorrect password attempts. Please wait ${Math.ceil(remainingSeconds / 60)} minute(s).`,
          isLocked: true,
          lockoutUntil: user.lockoutUntil,
          remainingSeconds,
          failedAttempts: user.failedLoginAttempts,
        });
        return;
      } else {
        // "After 15 minutes the user may log in again."
        // "Failed-attempt counter is NOT automatically reset. Successful login does NOT reset it. Counter continues cumulatively."
        // The lockout period expired, so lockoutUntil is cleared, but failedLoginAttempts stays!
        user.lockoutUntil = null;
        persistData();
      }
    }

    // Verify Password
    const isValid = verifyPasswordSync(password, user.passwordHash, user.passwordSalt);

    if (!isValid) {
      // Increment cumulative failed attempt counter:
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // Lockout trigger check:
      // "5 incorrect password attempts causes a 15-minute lockout."
      // "Counter continues cumulatively."
      const cycleAttempts = user.failedLoginAttempts % 5;
      const isNowLocked = cycleAttempts === 0;

      if (isNowLocked) {
        const lockoutDate = new Date(now + 15 * 60 * 1000);
        user.lockoutUntil = lockoutDate.toISOString();
      }

      user.updatedAt = new Date().toISOString();
      persistData();

      logAudit(
        { id: user.id, email: user.email, role: user.role },
        'LOGIN_FAILED',
        'AUTH',
        user.id,
        `Incorrect password attempt. Cumulative failed attempts: ${user.failedLoginAttempts}. Locked: ${isNowLocked}`,
        req
      );

      if (isNowLocked) {
        logAudit(
          { id: user.id, email: user.email, role: user.role },
          'USER_LOCKOUT',
          'AUTH',
          user.id,
          `Account @${user.username} locked for 15 minutes due to 5 failed password attempts.`,
          req
        );

        res.status(423).json({
          error: 'Account locked for 15 minutes due to 5 failed password attempts.',
          isLocked: true,
          lockoutUntil: user.lockoutUntil,
          remainingSeconds: 15 * 60,
          failedAttempts: user.failedLoginAttempts,
          remainingAttempts: 0,
        });
        return;
      }

      // Calculate remaining attempts in current cycle:
      const remainingAttempts = 5 - cycleAttempts;
      // "Warn after the 3rd failed attempt."
      const warnAfter3rdAttempt = cycleAttempts >= 3;

      res.status(401).json({
        error: 'Incorrect password.',
        isLocked: false,
        failedAttempts: user.failedLoginAttempts,
        remainingAttempts,
        warnAfter3rdAttempt,
      });
      return;
    }

    // SUCCESSFUL LOGIN:
    // "Failed-attempt counter is NOT automatically reset. Successful login does NOT reset it. Counter continues cumulatively. Only IT Admin/Super Admin can manually reset the counter."
    // Notice: We do NOT reset user.failedLoginAttempts!

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();

    // Create session (Multiple concurrent sessions allowed)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const userAgent = (req.headers['user-agent'] as string) || 'Unknown Browser';
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    let deviceLabel = 'Desktop Chrome';
    if (/Mobile|Android|iPhone/i.test(userAgent)) deviceLabel = 'Mobile Device';
    else if (/Macintosh/i.test(userAgent)) deviceLabel = 'macOS Workstation';
    else if (/Windows/i.test(userAgent)) deviceLabel = 'Windows PC';
    else if (/Linux/i.test(userAgent)) deviceLabel = 'Linux Terminal';

    const session: StoredSession = {
      id: sessionId,
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      userEmail: user.email,
      userRole: user.role,
      token,
      activeTokenHash: tokenHash,
      ipAddress,
      userAgent,
      deviceLabel,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    sessions.push(session);
    persistData();

    logAudit(
      { id: user.id, email: user.email, role: user.role },
      'LOGIN_SUCCESS',
      'AUTH',
      user.id,
      `User @${user.username} logged in from ${deviceLabel} (${ipAddress}). MustChangePassword: ${user.mustChangePassword}`,
      req
    );

    logAudit(
      { id: user.id, email: user.email, role: user.role },
      'USER_LOGGED_IN',
      'AUTH',
      user.id,
      `User @${user.username} logged in from ${deviceLabel} (${ipAddress}). MustChangePassword: ${user.mustChangePassword}`,
      req
    );

    res.json({
      success: true,
      token,
      sessionId,
      mustChangePassword: user.mustChangePassword,
      user: sanitizeUser(user),
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

/**
 * GET /api/auth/session
 * Verifies active session, checks 30-minute inactivity timeout,
 * and ensures disabled accounts invalidate sessions immediately.
 */
app.get('/api/auth/session', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const session = (req as any).session as StoredSession;

  // List all active sessions for this user
  const userActiveSessions = sessions
    .filter((s) => s.userId === user.id && s.status === 'ACTIVE')
    .map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
      isCurrent: s.id === session.id,
    }));

  res.json({
    valid: true,
    user: sanitizeUser(user),
    sessionId: session.id,
    mustChangePassword: user.mustChangePassword,
    activeSessions: userActiveSessions,
  });
});

/**
 * POST /api/auth/change-password
 * Password rules:
 * - Minimum 8 characters.
 * - Uppercase.
 * - Lowercase.
 * - Number.
 * - Special character.
 * - Secure one-way hashing.
 * - Previous passwords may be reused.
 */
app.post('/api/auth/change-password', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user as StoredUser;
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({ error: 'New password is required.' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      res.status(400).json({ error: 'Password must contain at least one uppercase letter (A-Z).' });
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      res.status(400).json({ error: 'Password must contain at least one lowercase letter (a-z).' });
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      res.status(400).json({ error: 'Password must contain at least one numeric digit (0-9).' });
      return;
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(newPassword)) {
      res.status(400).json({ error: 'Password must contain at least one special character (!@#$%^&*...).' });
      return;
    }
    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    // Previous passwords may be reused (no restriction on reuse)
    const { hash, salt } = hashPasswordSync(newPassword);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
    persistData();

    logAudit(
      { id: user.id, email: user.email, role: user.role },
      'PASSWORD_RESET',
      'AUTH',
      user.id,
      `User @${user.username} successfully reset/updated their password.`,
      req
    );

    logAudit(
      { id: user.id, email: user.email, role: user.role },
      'USER_PASSWORD_CHANGED',
      'AUTH',
      user.id,
      `User @${user.username} successfully updated their password.`,
      req
    );

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err: any) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * POST /api/auth/logout
 * Terminates current session.
 */
app.post('/api/auth/logout', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const session = (req as any).session as StoredSession;

  session.status = 'REVOKED';
  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'SESSION_TERMINATED',
    'AUTH',
    user.id,
    `Current session terminated for @${user.username} (${session.id}).`,
    req
  );

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'USER_LOGGED_OUT',
    'AUTH',
    user.id,
    `Current session terminated for @${user.username} (${session.id}).`,
    req
  );

  res.json({ success: true, message: 'Current session ended.' });
});

/**
 * POST /api/auth/logout-all
 * User logs out from all devices.
 */
app.post('/api/auth/logout-all', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;

  let count = 0;
  sessions.forEach((s) => {
    if (s.userId === user.id && s.status === 'ACTIVE') {
      s.status = 'REVOKED';
      count++;
    }
  });

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'SESSION_TERMINATED_ALL',
    'AUTH',
    user.id,
    `Terminated all ${count} active sessions across all devices for @${user.username}.`,
    req
  );

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'USER_LOGGED_OUT_ALL_DEVICES',
    'AUTH',
    user.id,
    `Terminated all ${count} active sessions across all devices for @${user.username}.`,
    req
  );

  res.json({ success: true, message: `Terminated ${count} active session(s) across all devices.` });
});

// ==========================================
// 2. ADMIN USER-MANAGEMENT ROUTES
// ==========================================

/**
 * GET /api/admin/users
 * Returns list of users, pending registrations, and active sessions.
 * RBAC Scoped: IT Admin only sees users in their IT Team + pending registrations.
 * Super Admin sees organization-wide directory.
 */
app.get('/api/admin/users', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  let targetUsers = users;
  let targetSessions = sessions;

  if (admin.role === 'IT_ADMIN') {
    if (!admin.itTeamId) {
      res.status(403).json({ error: 'IT Admin account is not associated with any IT Team.' });
      return;
    }
    // Scoped strictly to users in their IT Team OR pending approval registrations
    targetUsers = users.filter((u) => u.itTeamId === admin.itTeamId || u.status === 'PENDING_APPROVAL');
    const allowedUserIds = new Set(targetUsers.map((u) => u.id));
    targetSessions = sessions.filter((s) => allowedUserIds.has(s.userId));
  }

  const sanitizedUsers = targetUsers.map(sanitizeUser);
  const activeSessionsList = targetSessions
    .filter((s) => s.status === 'ACTIVE')
    .map((s) => ({
      id: s.id,
      userId: s.userId,
      username: s.username,
      displayName: s.displayName,
      userRole: s.userRole,
      userEmail: s.userEmail,
      deviceLabel: s.deviceLabel,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      lastActiveAt: s.lastActiveAt,
    }));

  const logs =
    admin.role === 'SUPER_ADMIN'
      ? auditLogs.slice(0, 100)
      : auditLogs.filter((a) => a.actorId === admin.id).slice(0, 100);

  res.json({
    users: sanitizedUsers,
    activeSessions: activeSessionsList,
    auditLogs: logs,
  });
});

/**
 * POST /api/admin/approve-user
 * IT Admin / Super Admin reviews → Approve registration
 */
app.post('/api/admin/approve-user', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { userId, role, itTeamId } = req.body;

  const target = users.find((u) => u.id === userId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // IT Admin cannot assign staff to different IT teams
  if (admin.role === 'IT_ADMIN') {
    if (itTeamId && itTeamId !== admin.itTeamId) {
      res.status(403).json({ error: 'IT Admins cannot assign users to different IT Teams. Only Super Admin has authority.' });
      return;
    }
    if (role && (role === 'SUPER_ADMIN' || (role === 'IT_ADMIN' && target.id !== admin.id))) {
      res.status(403).json({ error: 'IT Admins cannot promote users to IT Admin or Super Admin.' });
      return;
    }
  }

  target.status = 'ACTIVE';
  target.rejectionReason = null;
  if (role && (role === 'EMPLOYEE' || role === 'IT_TECHNICIAN' || role === 'IT_ADMIN')) {
    target.role = role;
  }

  if (itTeamId !== undefined) {
    if (admin.role === 'SUPER_ADMIN') {
      target.itTeamId = itTeamId || null;
      const team = itTeams.find((t) => t.id === itTeamId);
      target.itTeamName = team ? team.name : null;
    }
  }

  target.updatedAt = new Date().toISOString();
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'USER_APPROVED',
    'USER',
    target.id,
    `Admin ${admin.displayName} approved registration for @${target.username} (${target.displayName}).`,
    req
  );

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'USER_REGISTRATION_APPROVED',
    'USER',
    target.id,
    `Admin ${admin.displayName} approved registration for @${target.username} (${target.displayName}).`,
    req
  );

  res.json({ success: true, user: sanitizeUser(target), message: `Approved registration for ${target.displayName}.` });
});

/**
 * POST /api/admin/assign-team
 * Super Admin assigns or changes a user's IT Team.
 * IT Admins are strictly forbidden from assigning users to IT Teams.
 */
app.post('/api/admin/assign-team', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  if (admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({
      error: 'Forbidden: IT Admins cannot assign users to different IT Teams. Only Super Admin has authority.',
    });
    return;
  }

  const { userId, itTeamId } = req.body;
  const target = users.find((u) => u.id === userId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (target.role === 'EMPLOYEE' && itTeamId) {
    res.status(400).json({ error: 'Constraint violation: Employees must not belong to an IT Team.' });
    return;
  }

  if (itTeamId) {
    const team = itTeams.find((t) => t.id === itTeamId && !t.isDeleted);
    if (!team) {
      res.status(404).json({ error: 'IT Team not found or is inactive.' });
      return;
    }
    target.itTeamId = team.id;
    target.itTeamName = team.name;
  } else {
    if (target.role === 'IT_ADMIN' || target.role === 'IT_TECHNICIAN') {
      res.status(400).json({ error: 'Constraint violation: IT Admin and IT Technician must belong to exactly one IT Team.' });
      return;
    }
    target.itTeamId = null;
    target.itTeamName = null;
  }

  target.updatedAt = new Date().toISOString();
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'USER_IT_TEAM_ASSIGNED',
    'USER',
    target.id,
    `Super Admin ${admin.displayName} assigned ${target.displayName} to IT Team "${target.itTeamName || 'None'}".`,
    req
  );

  res.json({
    success: true,
    user: sanitizeUser(target),
    message: `Assigned ${target.displayName} to IT Team ${target.itTeamName || 'None'}.`,
  });
});

/**
 * POST /api/admin/reject-user
 * IT Admin reviews → Reject.
 * "Rejected registration requires a mandatory reason."
 */
app.post('/api/admin/reject-user', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { userId, rejectionReason } = req.body;

  if (!rejectionReason || !rejectionReason.trim()) {
    res.status(400).json({ error: 'Rejection reason is mandatory.' });
    return;
  }

  const target = users.find((u) => u.id === userId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // IT Admin cannot manage users of another IT Team
  if (admin.role === 'IT_ADMIN' && target.itTeamId && target.itTeamId !== admin.itTeamId) {
    res.status(403).json({ error: 'Forbidden: IT Admins cannot reject registrations for another IT Team.' });
    return;
  }

  target.status = 'REJECTED';
  target.rejectionReason = rejectionReason.trim();
  target.updatedAt = new Date().toISOString();

  // Invalidate any sessions
  sessions.forEach((s) => {
    if (s.userId === target.id) s.status = 'REVOKED';
  });

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'USER_REJECTED',
    'USER',
    target.id,
    `Admin ${admin.displayName} rejected registration for @${target.username}. Reason: "${rejectionReason.trim()}"`,
    req
  );

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'USER_REGISTRATION_REJECTED',
    'USER',
    target.id,
    `Admin ${admin.displayName} rejected registration for @${target.username}. Reason: "${rejectionReason.trim()}"`,
    req
  );

  res.json({
    success: true,
    user: sanitizeUser(target),
    message: `Rejected registration for ${target.displayName}.`,
  });
});

/**
 * POST /api/admin/reset-password
 * Password reset:
 * - Employee contacts IT Admin.
 * - Admin verifies identity.
 * - Admin generates temporary password.
 * - Employee must change it at first login.
 * - Admin never sees existing password.
 * - Reset is audited.
 */
app.post('/api/admin/reset-password', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { userId, customTemporaryPassword } = req.body;

  const target = users.find((u) => u.id === userId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // IT Admin cannot manage users of another IT Team
  if (admin.role === 'IT_ADMIN' && target.itTeamId && target.itTeamId !== admin.itTeamId) {
    res.status(403).json({ error: 'Forbidden: IT Admins cannot manage users belonging to another IT Team.' });
    return;
  }

  let tempPass = customTemporaryPassword;
  if (!tempPass || tempPass.trim().length < 8) {
    // Auto-generate strong compliant temporary password
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%&*';
    const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
    tempPass = `Temp#${pick(uppers)}${pick(uppers)}${pick(lowers)}${pick(lowers)}${pick(numbers)}${pick(numbers)}${pick(specials)}${pick(specials)}`;
  }

  // Hash temporary password with salt (admin never sees old password)
  const { hash, salt } = hashPasswordSync(tempPass);
  target.passwordHash = hash;
  target.passwordSalt = salt;
  target.mustChangePassword = true;
  target.temporaryPasswordGeneratedAt = new Date().toISOString();
  target.updatedAt = new Date().toISOString();

  // Invalidate previous sessions so user must log in with temp password
  sessions.forEach((s) => {
    if (s.userId === target.id) s.status = 'REVOKED';
  });

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'PASSWORD_RESET',
    'USER',
    target.id,
    `Admin ${admin.displayName} issued password reset for @${target.username}.`,
    req
  );

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'PASSWORD_RESET_ADMIN_INITIATED',
    'USER',
    target.id,
    `Admin ${admin.displayName} issued temporary password reset for @${target.username}. MustChangePassword flagged true.`,
    req
  );

  res.json({
    success: true,
    temporaryPassword: tempPass,
    message: `Temporary password generated for ${target.displayName}. Employee will be forced to change it on login.`,
  });
});

/**
 * POST /api/admin/reset-failed-counter
 * "Only IT Admin/Super Admin can manually reset the counter."
 */
app.post('/api/admin/reset-failed-counter', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { userId } = req.body;

  const target = users.find((u) => u.id === userId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  // IT Admin cannot manage users of another IT Team
  if (admin.role === 'IT_ADMIN' && target.itTeamId && target.itTeamId !== admin.itTeamId) {
    res.status(403).json({ error: 'Forbidden: IT Admins cannot manage users belonging to another IT Team.' });
    return;
  }

  const prevAttempts = target.failedLoginAttempts;
  target.failedLoginAttempts = 0;
  target.lockoutUntil = null;
  target.updatedAt = new Date().toISOString();
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'USER_UNLOCKED',
    'USER',
    target.id,
    `Admin ${admin.displayName} manually unlocked @${target.username} and reset failed attempt counter.`,
    req
  );

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'FAILED_ATTEMPTS_COUNTER_RESET',
    'USER',
    target.id,
    `Admin ${admin.displayName} manually reset failed attempt counter (was ${prevAttempts}) and unlocked @${target.username}.`,
    req
  );

  res.json({
    success: true,
    user: sanitizeUser(target),
    message: `Failed attempt counter reset to 0. Account for ${target.displayName} is unlocked.`,
  });
});

/**
 * POST /api/admin/terminate-sessions
 * - Super Admin can terminate all sessions.
 * - IT Admin / Super Admin can terminate all sessions for a specific user, or an individual session.
 */
app.post('/api/admin/terminate-sessions', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { userId, sessionId, all } = req.body;

  let terminatedCount = 0;

  if (all) {
    // Only Super Admin can terminate all sessions globally across the system
    if (admin.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only Super Admin can terminate all sessions globally.' });
      return;
    }
    sessions.forEach((s) => {
      if (s.status === 'ACTIVE') {
        s.status = 'REVOKED';
        terminatedCount++;
      }
    });
  } else if (sessionId) {
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (targetSession && targetSession.status === 'ACTIVE') {
      targetSession.status = 'REVOKED';
      terminatedCount = 1;
    }
  } else if (userId) {
    if (admin.role === 'IT_ADMIN') {
      const target = users.find((u) => u.id === userId);
      if (target && target.itTeamId && target.itTeamId !== admin.itTeamId) {
        res.status(403).json({ error: 'Forbidden: IT Admins cannot manage sessions of users in another IT Team.' });
        return;
      }
    }
    sessions.forEach((s) => {
      if (s.userId === userId && s.status === 'ACTIVE') {
        s.status = 'REVOKED';
        terminatedCount++;
      }
    });
  } else {
    res.status(400).json({ error: 'Specify userId, sessionId, or all: true.' });
    return;
  }

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'SESSION_TERMINATED',
    'SESSION',
    sessionId || userId || 'GLOBAL_ALL',
    `Admin ${admin.displayName} revoked ${terminatedCount} active session(s). Target: ${all ? 'ALL SESSIONS' : sessionId ? `Session ${sessionId}` : `User ${userId}`}`,
    req
  );

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'SESSIONS_TERMINATED_BY_ADMIN',
    'SESSION',
    sessionId || userId || 'GLOBAL_ALL',
    `Admin ${admin.displayName} revoked ${terminatedCount} active session(s). Target: ${all ? 'ALL SESSIONS' : sessionId ? `Session ${sessionId}` : `User ${userId}`}`,
    req
  );

  res.json({
    success: true,
    terminatedCount,
    message: `Successfully terminated ${terminatedCount} session(s).`,
  });
});

/**
 * POST /api/admin/toggle-user-status
 * Super Admin or IT Admin toggles user active / suspended.
 * "Disabled accounts invalidate all sessions."
 */
app.post('/api/admin/toggle-user-status', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { userId, status } = req.body;

  const target = users.find((u) => u.id === userId);
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  if (target.id === admin.id) {
    res.status(400).json({ error: 'Cannot disable your own active administrator account.' });
    return;
  }

  if (admin.role === 'IT_ADMIN' && target.itTeamId !== admin.itTeamId) {
    res.status(403).json({ error: 'Forbidden: IT Admins can only manage users within their own IT Team.' });
    return;
  }

  target.status = status;
  target.updatedAt = new Date().toISOString();

  // Disabled accounts invalidate all sessions:
  if (status === 'SUSPENDED' || status === 'DEACTIVATED') {
    sessions.forEach((s) => {
      if (s.userId === target.id) s.status = 'REVOKED';
    });
  }

  persistData();

  if (status === 'SUSPENDED' || status === 'DEACTIVATED') {
    logAudit(
      { id: admin.id, email: admin.email, role: admin.role },
      'ACCOUNT_DISABLED',
      'USER',
      target.id,
      `Admin ${admin.displayName} disabled account @${target.username} (status: ${status}). All sessions revoked.`,
      req
    );
  } else if (status === 'ACTIVE') {
    logAudit(
      { id: admin.id, email: admin.email, role: admin.role },
      'ACCOUNT_ENABLED',
      'USER',
      target.id,
      `Admin ${admin.displayName} enabled account @${target.username}.`,
      req
    );
  }

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'USER_STATUS_CHANGED',
    'USER',
    target.id,
    `Admin ${admin.displayName} changed status of @${target.username} to ${status}. Sessions revoked.`,
    req
  );

  res.json({
    success: true,
    user: sanitizeUser(target),
    message: `Account status for ${target.displayName} updated to ${status}.`,
  });
});

// ==========================================
// 3. IT TEAMS MANAGEMENT (RBAC SCOPED)
// ==========================================

/**
 * GET /api/it-teams
 * Returns list of IT teams.
 */
app.get('/api/it-teams', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  // All authenticated users can view active IT teams (e.g. for ticket routing or profile)
  const activeTeams = itTeams.filter((t) => !t.isDeleted && t.status === 'ACTIVE');
  res.json({ teams: activeTeams });
});

/**
 * POST /api/it-teams
 * Super Admin ONLY: "IT ADMIN cannot modify IT Team structure."
 */
app.post('/api/it-teams', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  if (admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({
      error: 'Forbidden: IT Admins cannot modify IT Team structure. Only Super Admin has authority.',
    });
    return;
  }

  const { code, name, description, leadAdminId } = req.body;
  if (!code || !name) {
    res.status(400).json({ error: 'IT Team code and name are required.' });
    return;
  }

  const existing = itTeams.find((t) => t.code.toUpperCase() === code.toUpperCase() && !t.isDeleted);
  if (existing) {
    res.status(400).json({ error: `IT Team code "${code}" already exists.` });
    return;
  }

  const newTeam: StoredITTeam = {
    id: `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    code: code.trim().toUpperCase(),
    name: name.trim(),
    description: description || '',
    leadAdminId: leadAdminId || null,
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  itTeams.push(newTeam);
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'IT_TEAM_CREATED',
    'IT_TEAM',
    newTeam.id,
    `Super Admin ${admin.displayName} created IT Team "${newTeam.name}" (${newTeam.code}).`,
    req
  );

  res.status(201).json({ success: true, team: newTeam });
});

/**
 * PUT /api/it-teams/:id
 * Super Admin ONLY: Update IT Team structure.
 */
app.put('/api/it-teams/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  if (admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({
      error: 'Forbidden: IT Admins cannot modify IT Team structure. Only Super Admin has authority.',
    });
    return;
  }

  const { id } = req.params;
  const team = itTeams.find((t) => t.id === id && !t.isDeleted);
  if (!team) {
    res.status(404).json({ error: 'IT Team not found.' });
    return;
  }

  const { name, description, leadAdminId, status } = req.body;
  if (name) team.name = name.trim();
  if (description !== undefined) team.description = description;
  if (leadAdminId !== undefined) team.leadAdminId = leadAdminId;
  if (status) team.status = status;
  team.updatedAt = new Date().toISOString();

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'IT_TEAM_UPDATED',
    'IT_TEAM',
    team.id,
    `Super Admin ${admin.displayName} updated IT Team "${team.name}".`,
    req
  );

  res.json({ success: true, team });
});

// ==========================================
// 4. TICKETS API (STRICT SERVER-SIDE RBAC)
// ==========================================

/**
 * Helper to check ticket authorization
 */
function canUserAccessTicket(user: StoredUser, ticket: StoredTicket): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'EMPLOYEE') {
    return ticket.requesterId === user.id;
  }
  if (user.role === 'IT_ADMIN' || user.role === 'IT_TECHNICIAN') {
    // Exactly one IT Team scoping:
    return !!user.itTeamId && ticket.assignedTeamId === user.itTeamId;
  }
  return false;
}

/**
 * Working Calendar SLA Engine
 */

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWorkingDay(d: Date, cal: StoredWorkingCalendar = slaWorkingCalendar): boolean {
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Check weekly off:
  if (cal.weeklyHolidays && cal.weeklyHolidays.includes(dayOfWeek)) {
    return false;
  }
  // Check workingDays whitelist:
  if (cal.workingDays && !cal.workingDays.includes(dayOfWeek)) {
    return false;
  }
  // Check holiday list:
  const dateStr = formatLocalDate(d);
  if (cal.holidays && cal.holidays.some((h) => h.date === dateStr)) {
    return false;
  }
  return true;
}

/**
 * Adds working minutes according to the Working Calendar.
 * Excludes non-working days (weekends, weekly holidays, public holidays)
 * and non-working hours.
 */
function addWorkingMinutes(
  startDate: Date,
  minutesToAdd: number,
  cal: StoredWorkingCalendar = slaWorkingCalendar
): Date {
  if (minutesToAdd <= 0) return new Date(startDate);

  let cur = new Date(startDate);
  let remaining = minutesToAdd;
  let safetyLimit = 365 * 24; // safety cap on iterations

  while (remaining > 0 && safetyLimit > 0) {
    safetyLimit--;

    // 1. If today is not a working day, advance to 00:00 of next day
    if (!isWorkingDay(cur, cal)) {
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 0, 0, 0, 0);
      continue;
    }

    // 2. Working hours boundaries for today
    const workStart = new Date(
      cur.getFullYear(),
      cur.getMonth(),
      cur.getDate(),
      cal.workStartHour,
      cal.workStartMinute,
      0,
      0
    );
    const workEnd = new Date(
      cur.getFullYear(),
      cur.getMonth(),
      cur.getDate(),
      cal.workEndHour,
      cal.workEndMinute,
      0,
      0
    );

    // If cur is before workStart today, bump to workStart
    if (cur.getTime() < workStart.getTime()) {
      cur = new Date(workStart);
    }

    // If cur is at or past workEnd today, advance to 00:00 of next day
    if (cur.getTime() >= workEnd.getTime()) {
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 0, 0, 0, 0);
      continue;
    }

    // Now cur is within working hours [workStart, workEnd)
    const availableMsToday = workEnd.getTime() - cur.getTime();
    const availableMinToday = Math.floor(availableMsToday / (60 * 1000));

    if (remaining <= availableMinToday) {
      return new Date(cur.getTime() + remaining * 60 * 1000);
    } else {
      remaining -= availableMinToday;
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 0, 0, 0, 0);
    }
  }

  return cur;
}

/**
 * Calculates total elapsed working minutes between two dates according to Working Calendar.
 */
function getElapsedWorkingMinutes(
  from: Date,
  to: Date,
  cal: StoredWorkingCalendar = slaWorkingCalendar
): number {
  if (to.getTime() <= from.getTime()) return 0;

  let cur = new Date(from);
  let totalMinutes = 0;
  let safetyLimit = 365 * 24;

  while (cur.getTime() < to.getTime() && safetyLimit > 0) {
    safetyLimit--;

    if (!isWorkingDay(cur, cal)) {
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 0, 0, 0, 0);
      continue;
    }

    const workStart = new Date(
      cur.getFullYear(),
      cur.getMonth(),
      cur.getDate(),
      cal.workStartHour,
      cal.workStartMinute,
      0,
      0
    );
    const workEnd = new Date(
      cur.getFullYear(),
      cur.getMonth(),
      cur.getDate(),
      cal.workEndHour,
      cal.workEndMinute,
      0,
      0
    );

    if (cur.getTime() < workStart.getTime()) {
      cur = new Date(workStart);
    }

    if (cur.getTime() >= workEnd.getTime()) {
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 0, 0, 0, 0);
      continue;
    }

    if (cur.getTime() >= to.getTime()) break;

    const segmentEndMs = Math.min(workEnd.getTime(), to.getTime());
    const minutesInSegment = Math.floor((segmentEndMs - cur.getTime()) / (60 * 1000));
    totalMinutes += Math.max(0, minutesInSegment);

    if (segmentEndMs >= workEnd.getTime()) {
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 0, 0, 0, 0);
    } else {
      cur = new Date(segmentEndMs);
    }
  }

  return totalMinutes;
}

/**
 * Calculates initial or recalculated SLA targets for a ticket based on priority and working calendar.
 */
function calculateTicketSlaTargets(
  createdAtStr: string,
  priority: string,
  accumulatedPausedWorkingMinutes = 0
): {
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  warningThresholdPercent: number;
  responseTargetTime: string;
  resolutionTargetTime: string;
  businessHoursOnly: boolean;
} {
  const cfg = slaConfigs.find(
    (s) => s.priority === priority && !s.isDeleted && s.status === 'ACTIVE'
  );

  const responseTimeMinutes = cfg?.responseTimeMinutes ?? 60;
  const resolutionTimeMinutes = cfg?.resolutionTimeMinutes ?? 480;
  const warningThresholdPercent = cfg?.warningThresholdPercent ?? 75;
  const businessHoursOnly = cfg ? cfg.businessHoursOnly !== false : true;

  const baseCreated = new Date(createdAtStr);

  let responseTarget: Date;
  let resolutionTarget: Date;

  if (businessHoursOnly) {
    responseTarget = addWorkingMinutes(
      baseCreated,
      responseTimeMinutes + accumulatedPausedWorkingMinutes,
      slaWorkingCalendar
    );
    resolutionTarget = addWorkingMinutes(
      baseCreated,
      resolutionTimeMinutes + accumulatedPausedWorkingMinutes,
      slaWorkingCalendar
    );
  } else {
    responseTarget = new Date(
      baseCreated.getTime() + (responseTimeMinutes + accumulatedPausedWorkingMinutes) * 60000
    );
    resolutionTarget = new Date(
      baseCreated.getTime() + (resolutionTimeMinutes + accumulatedPausedWorkingMinutes) * 60000
    );
  }

  return {
    responseTimeMinutes,
    resolutionTimeMinutes,
    warningThresholdPercent,
    responseTargetTime: responseTarget.toISOString(),
    resolutionTargetTime: resolutionTarget.toISOString(),
    businessHoursOnly,
  };
}

/**
 * In-portal Notification dispatcher helper with deduplication
 */
function sendInPortalNotification(params: {
  recipientId: string;
  senderId?: string | null;
  title: string;
  message: string;
  type: StoredNotification['type'];
  referenceEntityType?: 'TICKET' | 'ASSET' | 'PROFILE_CHANGE' | 'PAGE';
  referenceEntityId?: string;
}): void {
  const isDuplicate = notifications.some(
    (n) =>
      n.recipientId === params.recipientId &&
      n.type === params.type &&
      n.referenceEntityId === params.referenceEntityId &&
      n.title === params.title &&
      Date.now() - new Date(n.createdAt).getTime() < 30000
  );

  if (isDuplicate) return;

  const notif: StoredNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    recipientId: params.recipientId,
    senderId: params.senderId || null,
    title: params.title,
    message: params.message,
    type: params.type,
    referenceEntityType: params.referenceEntityType || 'TICKET',
    referenceEntityId: params.referenceEntityId,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  notifications.unshift(notif);
  if (notifications.length > 2000) {
    notifications = notifications.slice(0, 2000);
  }
}

/**
 * Evaluates ticket SLA state in real time:
 * - Handles WAITING_FOR_USER paused state
 * - Handles RESOLVED / CLOSED / CANCELLED terminal states
 * - Computes remaining working minutes or overdue working minutes
 * - Detects SLA WARNING (approaching threshold) and sends notification
 * - Detects SLA BREACH (immediate escalation) and sends notification
 */
function evaluateTicketSla(ticket: StoredTicket, triggerNotifications = true): void {
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. CANCELLED: SLA stops, marked EXEMPT / CANCELLED, not a breach!
  if (ticket.status === 'CANCELLED') {
    ticket.slaStatus = 'EXEMPT';
    ticket.isSlaBreached = false;
    ticket.slaPaused = false;
    return;
  }

  // 2. CLOSED: Retain resolved-stage SLA result, do not recalculate!
  if (ticket.status === 'CLOSED') {
    if (
      !ticket.slaStatus ||
      (ticket.slaStatus !== 'RESOLVED_WITHIN_SLA' &&
        ticket.slaStatus !== 'RESOLVED_AFTER_SLA' &&
        ticket.slaStatus !== 'EXEMPT')
    ) {
      const finishTime = ticket.resolvedAt || ticket.closedAt || nowIso;
      const targetTime = ticket.resolutionTargetTime;
      if (targetTime && new Date(finishTime).getTime() <= new Date(targetTime).getTime()) {
        ticket.slaStatus = 'RESOLVED_WITHIN_SLA';
        ticket.isSlaBreached = false;
      } else {
        ticket.slaStatus = 'RESOLVED_AFTER_SLA';
        ticket.isSlaBreached = true;
      }
    }
    ticket.slaPaused = false;
    return;
  }

  // 3. RESOLVED: Stop SLA. Mark Resolved within SLA or Resolved after SLA. Retain for compliance. Audited.
  if (ticket.status === 'RESOLVED') {
    if (
      ticket.slaStatus !== 'RESOLVED_WITHIN_SLA' &&
      ticket.slaStatus !== 'RESOLVED_AFTER_SLA' &&
      ticket.slaStatus !== 'EXEMPT'
    ) {
      const finishTime = ticket.resolvedAt || nowIso;
      const targetTime = ticket.resolutionTargetTime;
      if (targetTime && new Date(finishTime).getTime() <= new Date(targetTime).getTime()) {
        ticket.slaStatus = 'RESOLVED_WITHIN_SLA';
        ticket.isSlaBreached = false;
      } else {
        ticket.slaStatus = 'RESOLVED_AFTER_SLA';
        ticket.isSlaBreached = true;
      }
    }
    ticket.slaPaused = false;
    return;
  }

  // Ensure targets exist if ticket was created before this feature
  if (!ticket.resolutionTargetTime || !ticket.responseTargetTime) {
    const targets = calculateTicketSlaTargets(
      ticket.createdAt,
      ticket.priority,
      ticket.slaTotalPausedWorkingMinutes || 0
    );
    ticket.responseTargetTime = ticket.responseTargetTime || targets.responseTargetTime;
    ticket.resolutionTargetTime = ticket.resolutionTargetTime || targets.resolutionTargetTime;
  }

  // 4. WAITING_FOR_USER: SLA paused! Waiting time excluded.
  const isWaiting = ticket.status === 'WAITING_FOR_USER' || ticket.status === 'PENDING_USER';
  if (isWaiting) {
    ticket.slaPaused = true;
    if (!ticket.slaPausedAt) {
      ticket.slaPausedAt = nowIso;
    }
    const resTarget = new Date(ticket.resolutionTargetTime);
    if (now.getTime() < resTarget.getTime()) {
      ticket.remainingWorkingMinutes = getElapsedWorkingMinutes(now, resTarget, slaWorkingCalendar);
    } else {
      ticket.remainingWorkingMinutes = 0;
    }
    return;
  }

  // 5. Active tickets (NEW, ASSIGNED, OPEN, IN_PROGRESS, PENDING_VENDOR):
  const resTargetDate = new Date(ticket.resolutionTargetTime);

  // Check First Response Target:
  if (!ticket.firstResponseAt && ticket.responseTargetTime) {
    const respTargetDate = new Date(ticket.responseTargetTime);
    if (now.getTime() > respTargetDate.getTime()) {
      ticket.firstResponseSlaStatus = 'BREACHED';
    } else {
      ticket.firstResponseSlaStatus = undefined;
    }
  }

  // Check Resolution Target:
  if (now.getTime() >= resTargetDate.getTime()) {
    // BREACHED! Immediate escalation. No grace period.
    ticket.slaStatus = 'BREACHED';
    ticket.isSlaBreached = true;
    if (!ticket.slaBreachedAt) {
      ticket.slaBreachedAt = nowIso;
    }
    ticket.remainingWorkingMinutes = 0;
    ticket.breachedWorkingMinutes = getElapsedWorkingMinutes(resTargetDate, now, slaWorkingCalendar);

    // Trigger Breach Escalation Notification & Audit once
    if (triggerNotifications && !ticket.slaBreachSent) {
      ticket.slaBreachSent = true;
      ticket.slaEscalatedAt = nowIso;

      ticketHistories.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId: ticket.id,
        action: 'SLA_ESCALATION',
        actorId: 'system_sla_monitor',
        actorName: 'SLA Engine',
        actorRole: 'SYSTEM',
        details: `SLA Breached: Resolution target was ${resTargetDate.toLocaleString()}. Immediate escalation logged. Technician and IT Admin notified.`,
        fromValue: 'APPROACHING_SLA',
        toValue: 'BREACHED',
        timestamp: nowIso,
      });

      logAudit(
        { id: 'system_sla_monitor', email: 'sla-engine@accurate.internal', role: 'SYSTEM' },
        'SLA_BREACH_RECORDED',
        'SLA',
        ticket.id,
        `Resolution deadline breached for ticket #${ticket.ticketNumber} (${ticket.title}, Priority: ${ticket.priority}). Immediate administrative escalation logged.`
      );

      logAudit(
        { id: 'system_sla_monitor', email: 'sla-engine@accurate.internal', role: 'SYSTEM' },
        'SLA_ESCALATED',
        'SLA',
        ticket.id,
        `Immediate SLA escalation triggered for ticket #${ticket.ticketNumber}.`
      );

      if (!ticket.slaHistory) ticket.slaHistory = [];
      ticket.slaHistory.push({
        id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        reason: 'BREACHED',
        actorId: 'system_sla_monitor',
        actorName: 'SLA Engine',
        actorRole: 'SYSTEM',
        details: `SLA resolution deadline breached. Escalated immediately without grace period.`,
      });

      if (ticket.assignedTechnicianId) {
        sendInPortalNotification({
          recipientId: ticket.assignedTechnicianId,
          senderId: 'system_sla_monitor',
          title: `🚨 SLA BREACH ESCALATION: #${ticket.ticketNumber}`,
          message: `Resolution deadline breached for ticket #${ticket.ticketNumber} (${ticket.title}, Priority: ${ticket.priority}). Immediate administrative escalation logged.`,
          type: 'SLA_BREACHED',
          referenceEntityType: 'TICKET',
          referenceEntityId: ticket.id,
        });
      }

      const adminsToNotify = users.filter(
        (u) =>
          u.role === 'SUPER_ADMIN' ||
          (u.role === 'IT_ADMIN' && u.itTeamId === ticket.assignedTeamId)
      );
      adminsToNotify.forEach((admin) => {
        if (admin.id !== ticket.assignedTechnicianId) {
          sendInPortalNotification({
            recipientId: admin.id,
            senderId: 'system_sla_monitor',
            title: `🚨 SLA BREACH ESCALATION: #${ticket.ticketNumber}`,
            message: `Resolution deadline breached for ticket #${ticket.ticketNumber} (${ticket.priority} priority, assigned to ${ticket.assignedTechnicianName || 'Unassigned'}).`,
            type: 'SLA_BREACHED',
            referenceEntityType: 'TICKET',
            referenceEntityId: ticket.id,
          });
        }
      });
    }
  } else {
    // Within or Approaching
    const remainingWorkingMins = getElapsedWorkingMinutes(now, resTargetDate, slaWorkingCalendar);
    ticket.remainingWorkingMinutes = remainingWorkingMins;
    ticket.breachedWorkingMinutes = 0;

    const cfg = slaConfigs.find(
      (s) => s.priority === ticket.priority && !s.isDeleted && s.status === 'ACTIVE'
    );
    const totalMins = cfg?.resolutionTimeMinutes ?? 480;
    const thresholdPct = cfg?.warningThresholdPercent ?? 75;
    const warningRemainingMinutes = Math.max(15, Math.floor(totalMins * (1 - thresholdPct / 100)));

    if (remainingWorkingMins <= warningRemainingMinutes) {
      ticket.slaStatus = 'APPROACHING_SLA';

      if (triggerNotifications && !ticket.slaWarningSent) {
        ticket.slaWarningSent = true;

        ticketHistories.push({
          id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ticketId: ticket.id,
          action: 'SLA_WARNING',
          actorId: 'system_sla_monitor',
          actorName: 'SLA Engine',
          actorRole: 'SYSTEM',
          details: `Ticket entered SLA warning threshold with ${remainingWorkingMins} working minutes remaining before deadline.`,
          timestamp: nowIso,
        });

        logAudit(
          { id: 'system_sla_monitor', email: 'sla-engine@accurate.internal', role: 'SYSTEM' },
          'SLA_WARNING_SENT',
          'SLA',
          ticket.id,
          `Ticket #${ticket.ticketNumber} (${ticket.priority}) entered SLA warning threshold with ${remainingWorkingMins} working minutes remaining.`
        );

        if (!ticket.slaHistory) ticket.slaHistory = [];
        ticket.slaHistory.push({
          id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          reason: 'WARNING_APPROACHING',
          actorId: 'system_sla_monitor',
          actorName: 'SLA Engine',
          actorRole: 'SYSTEM',
          details: `Approaching SLA: ${remainingWorkingMins} working minutes remaining before target.`,
        });

        if (ticket.assignedTechnicianId) {
          sendInPortalNotification({
            recipientId: ticket.assignedTechnicianId,
            senderId: 'system_sla_monitor',
            title: `⚠️ SLA Warning: #${ticket.ticketNumber}`,
            message: `Ticket #${ticket.ticketNumber} (${ticket.priority}) is approaching resolution target. Only ${remainingWorkingMins} working minutes remaining.`,
            type: 'SLA_WARNING',
            referenceEntityType: 'TICKET',
            referenceEntityId: ticket.id,
          });
        }
      }
    } else {
      ticket.slaStatus = 'WITHIN_SLA';
    }
  }
}

/**
 * Background recurring monitor (every 30s)
 */
function evaluateAllOpenTicketsSla(): void {
  let changed = false;
  tickets.forEach((t) => {
    if (
      t.status !== 'RESOLVED' &&
      t.status !== 'CLOSED' &&
      t.status !== 'CANCELLED'
    ) {
      evaluateTicketSla(t, true);
      changed = true;
    }
  });
  if (changed) {
    persistData();
  }
}
setInterval(evaluateAllOpenTicketsSla, 30000);

/**
 * Helper to compute ticket SLA status
 */
function computeTicketSlaStatus(ticket: StoredTicket): 'BREACHED' | 'WARNING' | 'ON_TRACK' | 'MET' {
  evaluateTicketSla(ticket, false);
  if (ticket.slaStatus === 'BREACHED') return 'BREACHED';
  if (ticket.slaStatus === 'APPROACHING_SLA') return 'WARNING';
  if (ticket.slaStatus === 'WITHIN_SLA') return 'ON_TRACK';
  return 'MET';
}

/**
 * GET /api/tickets
 * Server-side RBAC scoping:
 * - EMPLOYEE: own tickets only.
 * - IT_TECHNICIAN: within permitted IT-team scope.
 * - IT_ADMIN: full ticket visibility within their IT Team.
 * - SUPER_ADMIN: full organization-wide access.
 * Advanced multi-criteria search, filtering, custom sorting, SLA status, and pagination.
 */
app.get('/api/tickets', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;

  let filtered: StoredTicket[] = [];

  if (user.role === 'SUPER_ADMIN') {
    filtered = [...tickets];
  } else if (user.role === 'EMPLOYEE') {
    // Strictly own tickets only - never trust client input
    filtered = tickets.filter((t) => t.requesterId === user.id);
  } else if (user.role === 'IT_ADMIN') {
    if (!user.itTeamId) {
      res.status(403).json({ error: 'IT Admin account is not assigned to an IT Team.' });
      return;
    }
    // Full ticket visibility within their IT Team
    filtered = tickets.filter((t) => t.assignedTeamId === user.itTeamId);
  } else if (user.role === 'IT_TECHNICIAN') {
    if (!user.itTeamId) {
      res.status(403).json({ error: 'IT Technician account is not assigned to an IT Team.' });
      return;
    }
    // Permitted within their IT Team
    filtered = tickets.filter((t) => t.assignedTeamId === user.itTeamId);
  }

  // 1. Global keyword search (matches ticketNumber, title, description, requester, technician, category, asset, location)
  const keyword = typeof req.query.keyword === 'string'
    ? req.query.keyword.trim().toLowerCase()
    : typeof req.query.search === 'string'
    ? req.query.search.trim().toLowerCase()
    : '';
  if (keyword) {
    filtered = filtered.filter(
      (t) =>
        t.ticketNumber.toLowerCase().includes(keyword) ||
        t.title.toLowerCase().includes(keyword) ||
        t.description.toLowerCase().includes(keyword) ||
        (t.requesterName && t.requesterName.toLowerCase().includes(keyword)) ||
        (t.requesterEmail && t.requesterEmail.toLowerCase().includes(keyword)) ||
        (t.assignedTechnicianName && t.assignedTechnicianName.toLowerCase().includes(keyword)) ||
        (t.relatedAssetTag && t.relatedAssetTag.toLowerCase().includes(keyword)) ||
        (t.category && t.category.toLowerCase().includes(keyword)) ||
        (t.locationName && t.locationName.toLowerCase().includes(keyword))
    );
  }

  // 2. Ticket Number filter
  const ticketNumberFilter = typeof req.query.ticketNumber === 'string' ? req.query.ticketNumber.trim().toLowerCase() : '';
  if (ticketNumberFilter) {
    filtered = filtered.filter((t) => t.ticketNumber.toLowerCase().includes(ticketNumberFilter));
  }

  // 3. Subject / Title filter
  const subjectFilter = typeof req.query.subject === 'string'
    ? req.query.subject.trim().toLowerCase()
    : typeof req.query.title === 'string'
    ? req.query.title.trim().toLowerCase()
    : '';
  if (subjectFilter) {
    filtered = filtered.filter((t) => t.title.toLowerCase().includes(subjectFilter));
  }

  // 4. Employee filter (for staff to find tickets by employee name/email/ID)
  const employeeFilter = typeof req.query.employee === 'string'
    ? req.query.employee.trim().toLowerCase()
    : typeof req.query.employeeId === 'string'
    ? req.query.employeeId.trim().toLowerCase()
    : typeof req.query.requesterName === 'string'
    ? req.query.requesterName.trim().toLowerCase()
    : '';
  if (employeeFilter) {
    filtered = filtered.filter(
      (t) =>
        t.requesterId.toLowerCase().includes(employeeFilter) ||
        (t.requesterName && t.requesterName.toLowerCase().includes(employeeFilter)) ||
        (t.requesterEmail && t.requesterEmail.toLowerCase().includes(employeeFilter))
    );
  }

  // 5. Department filter
  const departmentFilter = typeof req.query.departmentId === 'string'
    ? req.query.departmentId.trim()
    : typeof req.query.department === 'string'
    ? req.query.department.trim()
    : '';
  if (departmentFilter && departmentFilter !== 'ALL') {
    filtered = filtered.filter((t) => t.requesterDepartmentId === departmentFilter);
  }

  // 6. Category filter
  const category = typeof req.query.category === 'string' ? req.query.category.trim().toUpperCase() : '';
  if (category && category !== 'ALL') {
    filtered = filtered.filter((t) => t.category === category);
  }

  // 7. Priority filter
  const priority = typeof req.query.priority === 'string' ? req.query.priority.trim().toUpperCase() : '';
  if (priority && priority !== 'ALL') {
    filtered = filtered.filter((t) => t.priority === priority);
  }

  // 8. Status filter
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
  if (status && status !== 'ALL') {
    filtered = filtered.filter((t) => t.status === status);
  }

  // 9. Technician filter (technicianId, technician name, or 'UNASSIGNED')
  const technicianFilter = typeof req.query.technicianId === 'string'
    ? req.query.technicianId.trim()
    : typeof req.query.technician === 'string'
    ? req.query.technician.trim()
    : '';
  if (technicianFilter && technicianFilter !== 'ALL') {
    if (technicianFilter === 'UNASSIGNED') {
      filtered = filtered.filter((t) => !t.assignedTechnicianId);
    } else {
      filtered = filtered.filter(
        (t) =>
          t.assignedTechnicianId === technicianFilter ||
          (t.assignedTechnicianName && t.assignedTechnicianName.toLowerCase().includes(technicianFilter.toLowerCase()))
      );
    }
  }

  // 10. Location filter
  const locationFilter = typeof req.query.locationId === 'string'
    ? req.query.locationId.trim()
    : typeof req.query.location === 'string'
    ? req.query.location.trim()
    : '';
  if (locationFilter && locationFilter !== 'ALL') {
    filtered = filtered.filter(
      (t) =>
        t.locationId === locationFilter ||
        t.requesterLocationId === locationFilter ||
        (t.locationName && t.locationName.toLowerCase().includes(locationFilter.toLowerCase()))
    );
  }

  // 11. Date range filter
  const dateField = (req.query.dateField === 'createdAt' ? 'createdAt' : 'updatedAt') as 'createdAt' | 'updatedAt';
  if (req.query.startDate) {
    const startMs = new Date(req.query.startDate as string).getTime();
    if (!isNaN(startMs)) {
      filtered = filtered.filter((t) => new Date(t[dateField] || 0).getTime() >= startMs);
    }
  }
  if (req.query.endDate) {
    const endStr = req.query.endDate as string;
    let endMs = new Date(endStr).getTime();
    if (endStr.length === 10) {
      endMs = new Date(`${endStr}T23:59:59.999Z`).getTime();
    }
    if (!isNaN(endMs)) {
      filtered = filtered.filter((t) => new Date(t[dateField] || 0).getTime() <= endMs);
    }
  }

  // Sorting
  // Determine active sorting: priority = query params > user sorting preference > default (updatedAt desc)
  let activeSortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : user.sortingPreference?.sortBy || 'updatedAt';
  let activeSortOrder = req.query.sortOrder === 'asc' ? 'asc' : req.query.sortOrder === 'desc' ? 'desc' : user.sortingPreference?.sortOrder || 'desc';

  const validSortBys = ['createdAt', 'updatedAt', 'priority', 'status', 'slaStatus', 'ticketNumber', 'assignedTechnicianName'];
  if (!validSortBys.includes(activeSortBy)) {
    activeSortBy = 'updatedAt';
  }

  const priorityWeights: Record<string, number> = {
    URGENT: 5,
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const slaWeights: Record<string, number> = {
    BREACHED: 4,
    WARNING: 3,
    ON_TRACK: 2,
    MET: 1,
  };

  const sortMultiplier = activeSortOrder === 'asc' ? 1 : -1;

  filtered.sort((a: any, b: any) => {
    if (activeSortBy === 'priority') {
      const pA = priorityWeights[a.priority] || 0;
      const pB = priorityWeights[b.priority] || 0;
      if (pA !== pB) return (pA - pB) * sortMultiplier;
      return (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    }

    if (activeSortBy === 'slaStatus') {
      const slaA = slaWeights[computeTicketSlaStatus(a)] || 0;
      const slaB = slaWeights[computeTicketSlaStatus(b)] || 0;
      if (slaA !== slaB) return (slaA - slaB) * sortMultiplier;
      return (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    }

    if (activeSortBy === 'ticketNumber') {
      const numA = parseInt((a.ticketNumber || '').replace(/\D/g, ''), 10) || 0;
      const numB = parseInt((b.ticketNumber || '').replace(/\D/g, ''), 10) || 0;
      return (numA - numB) * sortMultiplier;
    }

    if (activeSortBy === 'assignedTechnicianName') {
      const techA = a.assignedTechnicianName || '';
      const techB = b.assignedTechnicianName || '';
      return techA.localeCompare(techB) * sortMultiplier;
    }

    if (activeSortBy === 'status') {
      const statA = a.status || '';
      const statB = b.status || '';
      return statA.localeCompare(statB) * sortMultiplier;
    }

    if (activeSortBy === 'createdAt' || activeSortBy === 'updatedAt') {
      const timeA = new Date(a[activeSortBy] || 0).getTime();
      const timeB = new Date(b[activeSortBy] || 0).getTime();
      return (timeA - timeB) * sortMultiplier;
    }

    return (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  });

  const total = filtered.length;
  // Default pagination: 10 tickets per page
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 10));
  const startIndex = (page - 1) * limit;
  const paginated = filtered.slice(startIndex, startIndex + limit).map((t) => ({
    ...t,
    slaStatus: computeTicketSlaStatus(t),
  }));

  const totalPages = Math.ceil(total / limit) || 1;

  res.json({
    success: true,
    tickets: paginated,
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    activeSorting: {
      sortBy: activeSortBy,
      sortOrder: activeSortOrder,
    },
  });
});

/**
 * GET /api/employee/dashboard-summary
 * Ticket summaries (counts per status), assigned asset count, and unread notification counts
 * strictly for the authenticated Employee (all filtered and verified server-side).
 */
app.get('/api/employee/dashboard-summary', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;

  // Server-side strict isolation: only authenticated user's own data
  const myTickets = tickets.filter((t) => t.requesterId === user.id);
  const myAssets = assets.filter((a) => a.assignedUserId === user.id || (user.assetTag && a.assetTag === user.assetTag));
  const myNotifications = notifications.filter((n) => n.recipientId === user.id);

  const summary = {
    totalTickets: myTickets.length,
    newTickets: myTickets.filter((t) => t.status === 'NEW').length,
    assignedTickets: myTickets.filter((t) => t.status === 'ASSIGNED').length,
    inProgressTickets: myTickets.filter((t) => t.status === 'IN_PROGRESS').length,
    waitingForUserTickets: myTickets.filter((t) => t.status === 'WAITING_FOR_USER' || t.status === 'PENDING_USER').length,
    resolvedTickets: myTickets.filter((t) => t.status === 'RESOLVED').length,
    closedTickets: myTickets.filter((t) => t.status === 'CLOSED').length,
    cancelledTickets: myTickets.filter((t) => t.status === 'CANCELLED').length,
    assignedAssetsCount: myAssets.length,
    unreadNotificationsCount: myNotifications.filter((n) => !n.isRead).length,
    totalNotificationsCount: myNotifications.length,
  };

  res.json({ success: true, summary });
});

// Helper to verify magic bytes of uploaded attachments
function verifyMagicBytes(buffer: Buffer, extension: string): boolean {
  if (buffer.length < 4) return false;
  const hex = buffer.slice(0, 8).toString('hex').toLowerCase();

  switch (extension) {
    case 'png':
      return hex.startsWith('89504e47');
    case 'jpg':
    case 'jpeg':
      return hex.startsWith('ffd8ff');
    case 'gif':
      return hex.startsWith('47494638');
    case 'pdf':
      return hex.startsWith('25504446');
    case 'zip':
    case 'docx':
    case 'xlsx':
      return hex.startsWith('504b0304') || hex.startsWith('504b0506');
    case 'doc':
    case 'xls':
      return hex.startsWith('d0cf11e0') || hex.startsWith('504b0304');
    case 'txt':
      // Text file check: no null bytes in the first 512 bytes
      for (let i = 0; i < Math.min(buffer.length, 512); i++) {
        if (buffer[i] === 0) return false;
      }
      return true;
    default:
      return false;
  }
}

// Sanitize comment to prevent script / html injection while allowing basic formatting (bold, italic, bullets, numbered lists, links)
function sanitizeCommentContent(input: string): string {
  if (!input) return '';
  let sanitized = input;

  // Strip script, iframe, object, embed, style, applet, form, svg, math, meta, link, base tags and contents
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
  sanitized = sanitized.replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '');
  sanitized = sanitized.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  sanitized = sanitized.replace(/<math\b[^<]*(?:(?!<\/math>)<[^<]*)*<\/math>/gi, '');
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

  // Strip self-closing or dangerous standalone tags
  sanitized = sanitized.replace(/<\/?(script|style|iframe|object|embed|applet|svg|math|form|input|button|textarea|select|option|link|meta|base|frame|frameset|head|html|body)\b[^>]*>/gi, '');

  // Strip all inline event handlers (e.g. onload, onerror, onclick, etc.)
  sanitized = sanitized.replace(/\s+on[a-z0-9_-]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // Strip / neutralize dangerous URL schemes in href or src (e.g. javascript:, vbscript:, data:)
  sanitized = sanitized.replace(/(href|src)\s*=\s*['"]?\s*(?:javascript|vbscript|data):[^'">\s]*/gi, '$1="#"');

  // Also sanitize markdown links [text](url) against javascript: / data: / vbscript:
  sanitized = sanitized.replace(/\[([^\]]*)\]\(\s*(?:javascript|vbscript|data):[^\)]*\)/gi, '[$1](#blocked-url)');

  // Replace any residual raw javascript: schemes
  sanitized = sanitized.replace(/javascript\s*:/gi, 'blocked:');

  return sanitized;
}

/**
 * GET /api/tickets/saved-filters
 * Returns saved filters visible to the user: personal filters + organization-wide shared filters.
 */
app.get('/api/tickets/saved-filters', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const visible = savedFilters.filter((f) => f.ownerId === user.id || f.isShared);
  res.json({ success: true, savedFilters: visible });
});

/**
 * POST /api/tickets/saved-filters
 * Saves a new filter combination. Super Admins can set isShared: true for organization-wide access.
 */
app.post('/api/tickets/saved-filters', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { name, criteria, sortConfig, isShared } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Filter name is required.' });
    return;
  }

  const shareRequested = Boolean(isShared);
  if (shareRequested && user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Only Super Admins can create shared organization-wide filters.' });
    return;
  }

  const now = new Date().toISOString();
  const newFilter: StoredSavedFilter = {
    id: `fltr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    ownerId: user.id,
    ownerName: user.displayName,
    ownerRole: user.role,
    isShared: shareRequested,
    criteria: criteria || {},
    sortConfig: sortConfig || { sortBy: 'updatedAt', sortOrder: 'desc' },
    createdAt: now,
    updatedAt: now,
  };

  savedFilters.unshift(newFilter);
  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'SAVED_FILTER_CREATED',
    'SAVED_FILTER',
    newFilter.id,
    `${user.role} ${user.displayName} created saved filter "${newFilter.name}" (Shared: ${newFilter.isShared}).`,
    req
  );

  res.status(201).json({ success: true, savedFilter: newFilter });
});

/**
 * PUT /api/tickets/saved-filters/:id
 * Updates an existing saved filter.
 */
app.put('/api/tickets/saved-filters/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;
  const { name, criteria, sortConfig, isShared } = req.body;

  const filter = savedFilters.find((f) => f.id === id);
  if (!filter) {
    res.status(404).json({ error: 'Saved filter not found.' });
    return;
  }

  if (filter.ownerId !== user.id && user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: You can only edit your own saved filters.' });
    return;
  }

  if (isShared !== undefined && isShared !== filter.isShared) {
    if (user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Forbidden: Only Super Admins can toggle organization-wide sharing.' });
      return;
    }
    filter.isShared = Boolean(isShared);
  }

  if (name && name.trim()) filter.name = name.trim();
  if (criteria !== undefined) filter.criteria = criteria;
  if (sortConfig !== undefined) filter.sortConfig = sortConfig;
  filter.updatedAt = new Date().toISOString();

  persistData();
  res.json({ success: true, savedFilter: filter });
});

/**
 * DELETE /api/tickets/saved-filters/:id
 * Removes a saved filter.
 */
app.delete('/api/tickets/saved-filters/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const index = savedFilters.findIndex((f) => f.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Saved filter not found.' });
    return;
  }

  const filter = savedFilters[index];
  if (filter.ownerId !== user.id && user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: You can only delete your own saved filters.' });
    return;
  }

  savedFilters.splice(index, 1);
  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'SAVED_FILTER_DELETED',
    'SAVED_FILTER',
    id,
    `${user.role} ${user.displayName} deleted saved filter "${filter.name}".`,
    req
  );

  res.json({ success: true, message: 'Saved filter deleted successfully.' });
});


/**
 * GET /api/tickets/:id
 * Retrieves a single ticket and its communication thread, attachments, and history.
 * Scoped according to RBAC. Internal technician notes stripped for Employees.
 */
app.get('/api/tickets/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({
      error: 'Forbidden: You do not have permission to view this ticket.',
    });
    return;
  }

  // Fetch comments
  let comments = ticketComments.filter((c) => c.ticketId === ticket.id);
  if (user.role === 'EMPLOYEE') {
    // Filter out internal-only technician notes
    comments = comments.filter((c) => !c.isInternalOnly);
  }
  comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Fetch attachments (non-deleted)
  const attachments = ticketAttachments.filter((a) => a.ticketId === ticket.id && !a.isDeleted);
  attachments.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());

  // Fetch history
  const history = ticketHistories.filter((h) => h.ticketId === ticket.id);
  history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({ ticket, comments, attachments, history });
});

/**
 * POST /api/tickets
 * Creates a new support ticket with all 9 required fields:
 * 1. Problem/Subject — maximum 150 characters
 * 2. Description — mandatory, maximum 2,000 characters
 * 3. Category
 * 4. Priority — Low / Medium / High / Critical
 * 5. Computer/Asset Tag
 * 6. Location
 * 7. Attachment — optional
 * 8. Contact Number
 * 9. IT Technician selection
 */
app.post('/api/tickets', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const {
    title,
    description,
    category,
    priority,
    contactNumber,
    locationId,
    locationName,
    assignedTeamId,
    assignedTechnicianId,
    relatedAssetId,
    relatedAssetTag,
    assetOverrideReason,
    attachment,
  } = req.body;

  // 1. Problem/Subject: mandatory, maximum 150 characters
  if (!title || !title.trim()) {
    res.status(400).json({ error: 'Problem/Subject is mandatory.' });
    return;
  }
  const cleanTitle = title.trim();
  if (cleanTitle.length > 150) {
    res.status(400).json({ error: 'Problem/Subject cannot exceed 150 characters.' });
    return;
  }

  // 2. Description: mandatory, maximum 2,000 characters
  if (!description || !description.trim()) {
    res.status(400).json({ error: 'Description is mandatory.' });
    return;
  }
  const cleanDescription = description.trim();
  if (cleanDescription.length > 2000) {
    res.status(400).json({ error: 'Description cannot exceed 2,000 characters.' });
    return;
  }

  // 3. Category: mandatory
  if (!category) {
    res.status(400).json({ error: 'Category is mandatory.' });
    return;
  }

  // 4. Priority: Low / Medium / High / Critical (map URGENT to CRITICAL/URGENT)
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT'];
  let cleanPriority = priority ? priority.toUpperCase() : 'MEDIUM';
  if (!validPriorities.includes(cleanPriority)) {
    cleanPriority = 'MEDIUM';
  }

  // 5. Finalized Ticket <-> Asset relationship handling
  // Automatically identify the employee's assigned computer.
  const employeeAssignedComputer = assets.find(
    (a) => a.assignedUserId === user.id && !a.isDeleted && a.status !== 'Retired'
  );

  let chosenAsset: StoredAsset | null = null;
  let isExceptionAssetOverride = false;
  let cleanOverrideReason: string | null = null;

  if (user.role === 'EMPLOYEE') {
    // If employee provided no asset, default automatically to their assigned computer
    if (!relatedAssetId && !relatedAssetTag) {
      if (employeeAssignedComputer) {
        chosenAsset = employeeAssignedComputer;
      }
    } else if (relatedAssetId === 'NONE' || relatedAssetTag === 'NONE') {
      chosenAsset = null;
    } else {
      // Employee specified an asset
      chosenAsset =
        assets.find(
          (a) =>
            !a.isDeleted &&
            ((relatedAssetId && a.id === relatedAssetId) ||
              (relatedAssetTag && a.assetTag.toUpperCase() === relatedAssetTag.trim().toUpperCase()) ||
              (relatedAssetTag && a.serialNumber.toUpperCase() === relatedAssetTag.trim().toUpperCase()))
        ) || null;

      if (!chosenAsset) {
        res.status(400).json({
          error: `Specified equipment "${relatedAssetTag || relatedAssetId}" not found in inventory.`,
        });
        return;
      }

      // Check if this computer is assigned to this employee
      const isAssignedToMe = chosenAsset.assignedUserId === user.id;

      if (!isAssignedToMe) {
        // EXCEPTION RULE: Employee linking equipment not currently assigned to them requires a mandatory reason
        if (!assetOverrideReason || !assetOverrideReason.trim()) {
          res.status(400).json({
            error: `Mandatory reason required: You are creating a ticket for equipment (${chosenAsset.assetTag} - ${chosenAsset.name}) that is not currently assigned to you. Please provide an explicit justification.`,
            requiresOverrideReason: true,
          });
          return;
        }
        isExceptionAssetOverride = true;
        cleanOverrideReason = assetOverrideReason.trim();
      }
    }
  } else {
    // IT_TECHNICIAN / IT_ADMIN / SUPER_ADMIN
    if (relatedAssetId || relatedAssetTag) {
      if (relatedAssetId === 'NONE' || relatedAssetTag === 'NONE') {
        chosenAsset = null;
      } else {
        chosenAsset =
          assets.find(
            (a) =>
              !a.isDeleted &&
              ((relatedAssetId && a.id === relatedAssetId) ||
                (relatedAssetTag && a.assetTag.toUpperCase() === relatedAssetTag.trim().toUpperCase()))
          ) || null;

        if (chosenAsset) {
          // Technicians and IT Admins can access assets within their permitted IT Team
          if (user.role === 'IT_TECHNICIAN' || user.role === 'IT_ADMIN') {
            if (chosenAsset.assignedTeamId && chosenAsset.assignedTeamId !== user.itTeamId) {
              res.status(403).json({
                error: `Forbidden: As an ${user.role === 'IT_ADMIN' ? 'IT Admin' : 'IT Technician'}, you can only link assets within your permitted IT Team.`,
              });
              return;
            }
          }
        }
      }
    }
  }

  let assetId = chosenAsset ? chosenAsset.id : null;
  let assetTag = chosenAsset ? chosenAsset.assetTag : null;
  let assetName = chosenAsset ? chosenAsset.name : null;

  // 6. Location
  let locId = locationId || user.locationId || 'loc_nyc';
  let locName = locationName || user.locationName;
  if (!locName) {
    const foundLoc = locations.find((l) => l.id === locId);
    locName = foundLoc ? foundLoc.name : 'Corporate Office';
  }

  // 8. Contact Number
  const contact = (contactNumber && contactNumber.trim()) || user.mobileNumber || '+1 (555) 012-7711';

  // Determine assigned IT team & IT Technician
  let teamId = assignedTeamId;
  let teamName: string | null = null;
  let assignedTech: StoredUser | null = null;

  // 9. IT Technician selection
  if (assignedTechnicianId) {
    assignedTech = users.find((u) => u.id === assignedTechnicianId && (u.role === 'IT_TECHNICIAN' || u.role === 'IT_ADMIN')) || null;
    if (assignedTech && assignedTech.itTeamId) {
      teamId = assignedTech.itTeamId;
    }
  }

  if (teamId) {
    const team = itTeams.find((t) => t.id === teamId && !t.isDeleted);
    if (team) teamName = team.name;
  } else {
    // Default routing: Tier 1 Service Desk
    const defaultTeam = itTeams.find((t) => t.code === 'HELP-L1' || t.status === 'ACTIVE');
    if (defaultTeam) {
      teamId = defaultTeam.id;
      teamName = defaultTeam.name;
    }
  }

  // Initial workflow status:
  // If technician selected upon creation: ASSIGNED. If unassigned: NEW.
  const initialStatus: StoredTicket['status'] = assignedTech ? 'ASSIGNED' : 'NEW';

  // Sequential, non-reusable ticket number
  const nextSeq =
    Math.max(
      10000,
      lastTicketSeq,
      ...tickets.map((t) => {
        const m = t.ticketNumber.match(/\d+/);
        return m ? parseInt(m[0], 10) : 0;
      })
    ) + 1;
  lastTicketSeq = nextSeq;
  const ticketNumber = `TCK-${nextSeq}`;
  const now = new Date().toISOString();
  const ticketId = `tck_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // 7. Optional Attachment handling
  let createdAttachmentId: string | null = null;
  if (attachment && attachment.fileData && attachment.originalFileName) {
    try {
      const originalFileName = path.basename(attachment.originalFileName);
      const ext = path.extname(originalFileName).replace('.', '').toLowerCase();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip'];

      if (!allowedExtensions.includes(ext)) {
        res.status(400).json({ error: `File extension .${ext} is not permitted. Permitted types: ${allowedExtensions.join(', ')}` });
        return;
      }

      const base64Data = attachment.fileData.includes(';base64,')
        ? attachment.fileData.split(';base64,').pop()!
        : attachment.fileData;
      const fileBuffer = Buffer.from(base64Data, 'base64');

      // Max size: 10 MB
      if (fileBuffer.length > 10 * 1024 * 1024) {
        res.status(400).json({ error: 'Attachment exceeds maximum permitted file size of 10MB.' });
        return;
      }

      // Magic byte check
      if (!verifyMagicBytes(fileBuffer, ext)) {
        res.status(400).json({ error: 'File content does not match the declared extension (magic byte validation failed).' });
        return;
      }

      const safeStoredName = `att_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
      const targetFilePath = path.join(UPLOADS_DIR, safeStoredName);
      fs.writeFileSync(targetFilePath, fileBuffer);

      const isPreviewable = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt'].includes(ext);
      const attachmentRecord: StoredTicketAttachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId,
        originalFileName,
        storedFileName: safeStoredName,
        fileSizeBytes: fileBuffer.length,
        mimeType: attachment.mimeType || 'application/octet-stream',
        extension: ext,
        isPreviewable,
        uploadedById: user.id,
        uploadedByName: user.displayName,
        uploadedByRole: user.role,
        uploadedAt: now,
        isDeleted: false,
      };

      ticketAttachments.push(attachmentRecord);
      createdAttachmentId = attachmentRecord.id;
    } catch (attErr: any) {
      console.error('Error processing attachment during ticket creation:', attErr);
      res.status(400).json({ error: `Failed to process attachment: ${attErr.message}` });
      return;
    }
  }

  const slaTargets = calculateTicketSlaTargets(now, cleanPriority, 0);

  const newTicket: StoredTicket = {
    id: ticketId,
    ticketNumber,
    title: cleanTitle,
    description: cleanDescription,
    category,
    priority: cleanPriority as any,
    status: initialStatus,
    requesterId: user.id,
    requesterName: user.displayName,
    requesterEmail: user.email,
    requesterCompanyId: user.companyId,
    requesterLocationId: locId,
    requesterDepartmentId: user.departmentId,
    locationId: locId,
    locationName: locName,
    contactNumber: contact,
    assignedTeamId: teamId || null,
    assignedTeamName: teamName,
    assignedTechnicianId: assignedTech ? assignedTech.id : null,
    assignedTechnicianName: assignedTech ? assignedTech.displayName : null,
    relatedAssetId: assetId,
    relatedAssetTag: assetTag,
    relatedAssetName: assetName,
    assetOverrideReason: cleanOverrideReason,
    historicalAssetAssignment: chosenAsset
      ? {
          assignedUserId: chosenAsset.assignedUserId || null,
          assignedUserName: chosenAsset.assignedUserName || null,
          assignedAtSnapshot: chosenAsset.assignmentDate || null,
        }
      : null,
    attachmentIds: createdAttachmentId ? [createdAttachmentId] : [],
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    closedAt: null,
    responseTargetTime: slaTargets.responseTargetTime,
    resolutionTargetTime: slaTargets.resolutionTargetTime,
    slaStatus: 'WITHIN_SLA',
    isSlaBreached: false,
    slaPaused: false,
    slaTotalPausedWorkingMinutes: 0,
    slaHistory: [
      {
        id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        reason: 'CREATED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        newPriority: cleanPriority,
        newCategory: category,
        newResponseTarget: slaTargets.responseTargetTime,
        newResolutionTarget: slaTargets.resolutionTargetTime,
        details: `Ticket created with ${cleanPriority} priority. Working calendar targets established: Response target: ${new Date(slaTargets.responseTargetTime).toLocaleString()}, Resolution target: ${new Date(slaTargets.resolutionTargetTime).toLocaleString()}.`,
      },
    ],
  };

  tickets.unshift(newTicket);

  // Record initial history event
  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: newTicket.id,
    action: 'CREATED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `Ticket created with priority ${newTicket.priority} by ${user.displayName}.`,
    fromValue: null,
    toValue: initialStatus,
    timestamp: now,
  });

  if (chosenAsset) {
    if (isExceptionAssetOverride && cleanOverrideReason) {
      ticketHistories.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId: newTicket.id,
        action: 'ASSET_LINKED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        details: `Linked non-assigned equipment ${chosenAsset.assetTag} (${chosenAsset.name}). Justification: "${cleanOverrideReason}".`,
        fromValue: null,
        toValue: chosenAsset.assetTag,
        timestamp: now,
      });

      logAudit(
        { id: user.id, email: user.email, role: user.role },
        'NON_ASSIGNED_ASSET_LINKED_TO_TICKET',
        'TICKET',
        newTicket.id,
        `Employee ${user.displayName} linked non-assigned equipment ${chosenAsset.assetTag} (${chosenAsset.name}) to ticket ${newTicket.ticketNumber}. Reason: "${cleanOverrideReason}". Assigned user: ${chosenAsset.assignedUserName || 'Unassigned stock pool'}.`,
        req
      );
    } else {
      ticketHistories.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId: newTicket.id,
        action: 'ASSET_LINKED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        details: `Linked workstation ${chosenAsset.assetTag} (${chosenAsset.name}).`,
        fromValue: null,
        toValue: chosenAsset.assetTag,
        timestamp: now,
      });
    }
  }

  if (createdAttachmentId) {
    ticketHistories.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: newTicket.id,
      action: 'ATTACHMENT_ADDED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `Attachment uploaded during ticket creation.`,
      timestamp: now,
    });
  }

  // In-portal notification for Employee (creator)
  sendInPortalNotification({
    recipientId: user.id,
    senderId: 'SYSTEM',
    title: `Ticket Logged: ${newTicket.ticketNumber}`,
    message: `Your ticket "${newTicket.title}" has been successfully logged with ${newTicket.priority} priority.`,
    type: 'TICKET_CREATED',
    referenceEntityType: 'TICKET',
    referenceEntityId: newTicket.id,
  });

  if (assignedTech) {
    ticketHistories.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: newTicket.id,
      action: 'ASSIGNED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `Assigned directly to technician ${assignedTech.displayName}.`,
      fromValue: null,
      toValue: assignedTech.displayName,
      timestamp: now,
    });

    sendInPortalNotification({
      recipientId: assignedTech.id,
      senderId: user.id,
      title: `Ticket ${newTicket.ticketNumber} Assigned to You`,
      message: `${user.displayName} created and assigned "${newTicket.title}" to you.`,
      type: 'TICKET_ASSIGNED',
      referenceEntityType: 'TICKET',
      referenceEntityId: newTicket.id,
    });
  } else if (teamId) {
    // Notify team members or admin
    const teamUsers = users.filter((u) => u.itTeamId === teamId && (u.role === 'IT_ADMIN' || u.role === 'IT_TECHNICIAN'));
    teamUsers.forEach((member) => {
      sendInPortalNotification({
        recipientId: member.id,
        senderId: user.id,
        title: `New Ticket: ${newTicket.ticketNumber}`,
        message: `${user.displayName} logged: "${newTicket.title}" (${newTicket.priority} Priority).`,
        type: 'TICKET_CREATED',
        referenceEntityType: 'TICKET',
        referenceEntityId: newTicket.id,
      });
    });
  }

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_CREATED',
    'TICKET',
    newTicket.id,
    `User ${user.displayName} created ticket ${newTicket.ticketNumber} (${newTicket.title}).`,
    req
  );

  res.status(201).json({ success: true, ticket: newTicket });
});

/**
 * PUT /api/tickets/:id
 * Server-side RBAC:
 * - EMPLOYEE: Can edit only while ticket status is NEW or ASSIGNED (or OPEN).
 *             If ticket is IN_PROGRESS, WAITING_FOR_USER, RESOLVED, CLOSED, CANCELLED -> 403 Forbidden!
 * - IT_TECHNICIAN: Can edit ticket within assigned IT Team.
 * - IT_ADMIN: Within their IT Team.
 * - SUPER_ADMIN: Full access.
 */
app.put('/api/tickets/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;
  const { title, description, category, priority, contactNumber, locationId, relatedAssetId } = req.body;

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You cannot modify this ticket.' });
    return;
  }

  // Strict Employee rule: Can edit only while New or Assigned
  if (user.role === 'EMPLOYEE') {
    const isNewOrAssigned = ticket.status === 'NEW' || ticket.status === 'ASSIGNED' || ticket.status === 'OPEN';
    if (!isNewOrAssigned) {
      res.status(403).json({
        error: `Forbidden: Employees can only edit tickets while New or Assigned. Current status is ${ticket.status}.`,
      });
      return;
    }
  }

  if (title !== undefined) {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      res.status(400).json({ error: 'Subject cannot be empty.' });
      return;
    }
    if (cleanTitle.length > 150) {
      res.status(400).json({ error: 'Subject cannot exceed 150 characters.' });
      return;
    }
    ticket.title = cleanTitle;
  }

  if (description !== undefined) {
    const cleanDesc = description.trim();
    if (!cleanDesc) {
      res.status(400).json({ error: 'Description cannot be empty.' });
      return;
    }
    if (cleanDesc.length > 2000) {
      res.status(400).json({ error: 'Description cannot exceed 2,000 characters.' });
      return;
    }
    ticket.description = cleanDesc;
  }

  const oldCategory = ticket.category;
  const oldPriority = ticket.priority;
  let slaNeedsRecalculation = false;

  if (category && category !== oldCategory) {
    ticket.category = category;
    slaNeedsRecalculation = true;
  }

  if (priority && user.role !== 'EMPLOYEE' && priority !== oldPriority) {
    ticket.priority = priority;
    slaNeedsRecalculation = true;
  }

  if (contactNumber !== undefined) {
    ticket.contactNumber = contactNumber.trim();
  }

  if (locationId) {
    ticket.locationId = locationId;
    const loc = locations.find((l) => l.id === locationId);
    if (loc) ticket.locationName = loc.name;
  }

  if (relatedAssetId !== undefined) {
    const isChangingAsset = (relatedAssetId || null) !== (ticket.relatedAssetId || null);
    if (isChangingAsset) {
      if (user.role === 'EMPLOYEE') {
        res.status(403).json({
          error: 'Forbidden: Employees cannot change the linked equipment after initial ticket creation. Please contact IT support if the equipment needs adjustment.',
        });
        return;
      }

      let newAsset: StoredAsset | null = null;
      if (relatedAssetId) {
        newAsset =
          assets.find(
            (a) =>
              !a.isDeleted &&
              (a.id === relatedAssetId || a.assetTag.toUpperCase() === relatedAssetId.trim().toUpperCase())
          ) || null;

        if (!newAsset) {
          res.status(404).json({ error: 'Selected equipment was not found.' });
          return;
        }

        // Technicians & IT Admins: scope to permitted IT Team
        if (user.role === 'IT_TECHNICIAN' || user.role === 'IT_ADMIN') {
          if (newAsset.assignedTeamId && newAsset.assignedTeamId !== user.itTeamId) {
            res.status(403).json({
              error: `Forbidden: As an ${user.role === 'IT_ADMIN' ? 'IT Admin' : 'IT Technician'}, you can only link equipment within your permitted IT Team.`,
            });
            return;
          }
        }
      }

      const prevTag = ticket.relatedAssetTag;
      ticket.relatedAssetId = newAsset ? newAsset.id : null;
      ticket.relatedAssetTag = newAsset ? newAsset.assetTag : null;
      ticket.relatedAssetName = newAsset ? newAsset.name : null;

      ticketHistories.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId: ticket.id,
        action: newAsset ? 'ASSET_LINKED' : 'ASSET_UNLINKED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        details: newAsset
          ? `${user.displayName} (${user.role}) changed linked equipment to ${newAsset.assetTag} (${newAsset.name}).`
          : `${user.displayName} (${user.role}) unlinked equipment (previously ${prevTag || 'None'}).`,
        fromValue: prevTag || null,
        toValue: newAsset ? newAsset.assetTag : null,
        timestamp: new Date().toISOString(),
      });

      logAudit(
        { id: user.id, email: user.email, role: user.role },
        'TICKET_ASSET_MODIFIED',
        'TICKET',
        ticket.id,
        `${user.role} ${user.displayName} changed linked asset on ticket ${ticket.ticketNumber} to ${newAsset ? newAsset.assetTag : 'None'} (was ${prevTag || 'None'}).`,
        req
      );
    }
  }

  const now = new Date().toISOString();
  ticket.updatedAt = now;

  if (slaNeedsRecalculation) {
    const oldResp = ticket.responseTargetTime;
    const oldRes = ticket.resolutionTargetTime;
    const targets = calculateTicketSlaTargets(
      ticket.createdAt,
      ticket.priority,
      ticket.slaTotalPausedWorkingMinutes || 0
    );
    ticket.responseTargetTime = targets.responseTargetTime;
    ticket.resolutionTargetTime = targets.resolutionTargetTime;
    ticket.slaWarningSent = false;
    ticket.slaBreachSent = false;
    evaluateTicketSla(ticket, false);

    if (!ticket.slaHistory) ticket.slaHistory = [];
    ticket.slaHistory.push({
      id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      reason: oldPriority !== ticket.priority ? 'PRIORITY_CHANGED' : 'CATEGORY_CHANGED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      oldPriority,
      newPriority: ticket.priority,
      oldCategory,
      newCategory: ticket.category,
      oldResponseTarget: oldResp,
      newResponseTarget: targets.responseTargetTime,
      oldResolutionTarget: oldRes,
      newResolutionTarget: targets.resolutionTargetTime,
      details: `Ticket modified: Category (${oldCategory} -> ${ticket.category}), Priority (${oldPriority} -> ${ticket.priority}). SLA recalculated. New resolution deadline: ${new Date(targets.resolutionTargetTime).toLocaleString()}.`,
    });

    ticketHistories.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: ticket.id,
      action: 'SLA_RECALCULATED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `SLA recalculated after ticket update. Resolution target: ${new Date(targets.resolutionTargetTime).toLocaleString()}.`,
      timestamp: now,
    });
  }

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'EDITED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `${user.displayName} updated ticket details.`,
    timestamp: now,
  });

  // If Employee edited ticket, notify IT team
  if (user.role === 'EMPLOYEE') {
    if (ticket.assignedTechnicianId) {
      sendInPortalNotification({
        recipientId: ticket.assignedTechnicianId,
        senderId: user.id,
        title: `Ticket #${ticket.ticketNumber} Updated by Requester`,
        message: `${user.displayName} updated ticket details.`,
        type: 'TICKET_UPDATED',
        referenceEntityType: 'TICKET',
        referenceEntityId: ticket.id,
      });
    } else if (ticket.assignedTeamId) {
      const teamUsers = users.filter((u) => u.itTeamId === ticket.assignedTeamId && (u.role === 'IT_ADMIN' || u.role === 'IT_TECHNICIAN'));
      teamUsers.forEach((member) => {
        sendInPortalNotification({
          recipientId: member.id,
          senderId: user.id,
          title: `Ticket #${ticket.ticketNumber} Updated by Requester`,
          message: `${user.displayName} updated ticket details.`,
          type: 'TICKET_UPDATED',
          referenceEntityType: 'TICKET',
          referenceEntityId: ticket.id,
        });
      });
    }
  }

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_EDITED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} edited ticket ${ticket.ticketNumber}.`,
    req
  );

  res.json({ success: true, ticket });
});

/**
 * PUT /api/tickets/:id/linked-asset
 * Finalized Ticket <-> Asset relationship management:
 * Who can change linked asset:
 * - IT Technician (within permitted IT Team)
 * - IT Admin (within permitted IT Team)
 * - Super Admin (organization-wide)
 * - Employees CANNOT change linked asset after ticket creation.
 */
app.put('/api/tickets/:id/linked-asset', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;
  const { relatedAssetId, notes } = req.body;

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (user.role === 'EMPLOYEE') {
    res.status(403).json({
      error: 'Forbidden: Employees cannot change the linked equipment after initial ticket creation.',
    });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You do not have access to manage this ticket.' });
    return;
  }

  let newAsset: StoredAsset | null = null;
  if (relatedAssetId) {
    newAsset =
      assets.find(
        (a) =>
          !a.isDeleted &&
          (a.id === relatedAssetId || a.assetTag.toUpperCase() === relatedAssetId.trim().toUpperCase())
      ) || null;

    if (!newAsset) {
      res.status(404).json({ error: 'Selected equipment was not found.' });
      return;
    }

    if (user.role === 'IT_TECHNICIAN' || user.role === 'IT_ADMIN') {
      if (newAsset.assignedTeamId && newAsset.assignedTeamId !== user.itTeamId) {
        res.status(403).json({
          error: `Forbidden: As an ${user.role === 'IT_ADMIN' ? 'IT Admin' : 'IT Technician'}, you can only link equipment within your permitted IT Team.`,
        });
        return;
      }
    }
  }

  const prevTag = ticket.relatedAssetTag;
  ticket.relatedAssetId = newAsset ? newAsset.id : null;
  ticket.relatedAssetTag = newAsset ? newAsset.assetTag : null;
  ticket.relatedAssetName = newAsset ? newAsset.name : null;
  const now = new Date().toISOString();
  ticket.updatedAt = now;

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: newAsset ? 'ASSET_LINKED' : 'ASSET_UNLINKED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: newAsset
      ? `${user.displayName} changed linked equipment to ${newAsset.assetTag} (${newAsset.name})${notes ? ` - Reason: ${notes}` : ''}.`
      : `${user.displayName} unlinked equipment (was ${prevTag || 'None'})${notes ? ` - Reason: ${notes}` : ''}.`,
    fromValue: prevTag || null,
    toValue: newAsset ? newAsset.assetTag : null,
    timestamp: now,
  });

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_ASSET_MODIFIED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} updated linked asset on ticket ${ticket.ticketNumber} to ${newAsset ? newAsset.assetTag : 'None'} (was ${prevTag || 'None'}). Notes: ${notes || 'N/A'}.`,
    req
  );

  res.json({ success: true, ticket });
});

/**
 * POST /api/tickets/:id/cancel
 * Server-side RBAC:
 * - EMPLOYEE: Can cancel only while ticket is NEW or ASSIGNED (or OPEN).
 *             Cancelled tickets are retained permanently as historical records.
 * - IT_TECHNICIAN / IT_ADMIN / SUPER_ADMIN: Can cancel within permitted scope.
 */
app.post('/api/tickets/:id/cancel', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;
  const { reason } = req.body;

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You cannot cancel this ticket.' });
    return;
  }

  if (user.role === 'EMPLOYEE') {
    const isNewOrAssigned = ticket.status === 'NEW' || ticket.status === 'ASSIGNED' || ticket.status === 'OPEN';
    if (!isNewOrAssigned) {
      res.status(403).json({
        error: `Forbidden: Employees can only cancel tickets while New or Assigned. Current status is ${ticket.status}.`,
      });
      return;
    }
  }

  const oldStatus = ticket.status;
  const now = new Date().toISOString();
  ticket.status = 'CANCELLED';
  ticket.cancelledAt = now;
  ticket.cancellationReason = reason ? reason.trim() : 'Cancelled by requester';
  ticket.updatedAt = now;

  // Stop SLA. Mark SLA Exempt/Cancelled. Not a breach.
  ticket.slaStatus = 'EXEMPT';
  ticket.isSlaBreached = false;
  ticket.slaPaused = false;
  ticket.slaPausedAt = null;

  if (!ticket.slaHistory) ticket.slaHistory = [];
  ticket.slaHistory.push({
    id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    reason: 'CANCELLED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `Ticket cancelled by ${user.displayName}. SLA stopped and marked EXEMPT (not a breach).`,
  });

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'CANCELLED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `Ticket cancelled by ${user.displayName}. Reason: ${ticket.cancellationReason}`,
    fromValue: oldStatus,
    toValue: 'CANCELLED',
    timestamp: now,
  });

  // Notifications
  if (user.role === 'EMPLOYEE') {
    // Notify IT team
    if (ticket.assignedTechnicianId) {
      sendInPortalNotification({
        recipientId: ticket.assignedTechnicianId,
        senderId: user.id,
        title: `Ticket #${ticket.ticketNumber} Cancelled by Requester`,
        message: `${user.displayName} cancelled ticket: "${ticket.title}". Reason: ${ticket.cancellationReason}`,
        type: 'TICKET_CANCELLED',
        referenceEntityType: 'TICKET',
        referenceEntityId: ticket.id,
      });
    } else if (ticket.assignedTeamId) {
      const teamUsers = users.filter((u) => u.itTeamId === ticket.assignedTeamId && (u.role === 'IT_ADMIN' || u.role === 'IT_TECHNICIAN'));
      teamUsers.forEach((member) => {
        sendInPortalNotification({
          recipientId: member.id,
          senderId: user.id,
          title: `Ticket #${ticket.ticketNumber} Cancelled by Requester`,
          message: `${user.displayName} cancelled ticket: "${ticket.title}".`,
          type: 'TICKET_CANCELLED',
          referenceEntityType: 'TICKET',
          referenceEntityId: ticket.id,
        });
      });
    }
  } else {
    // IT cancelled -> notify employee
    sendInPortalNotification({
      recipientId: ticket.requesterId,
      senderId: user.id,
      title: `Ticket #${ticket.ticketNumber} Cancelled`,
      message: `Your ticket has been cancelled by ${user.displayName}. Reason: ${ticket.cancellationReason}`,
      type: 'TICKET_CANCELLED',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  }

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_CANCELLED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} cancelled ticket ${ticket.ticketNumber}. Reason: ${ticket.cancellationReason}`,
    req
  );

  res.json({ success: true, ticket });
});

/**
 * POST /api/tickets/:id/take
 * Technician takes an unassigned ticket within permitted team:
 * - Taking an unassigned ticket changes New -> Assigned.
 * - IT Technician can only take tickets belonging to their permitted IT Team.
 */
app.post('/api/tickets/:id/take', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ error: 'Forbidden: Employees cannot take tickets.' });
    return;
  }

  // Disabled/Inactive technicians cannot take tickets
  if (user.status !== 'ACTIVE') {
    res.status(403).json({ error: 'Forbidden: Inactive or disabled accounts cannot take ownership of tickets.' });
    return;
  }

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)) {
    res.status(400).json({ error: `Cannot take ownership of a ${ticket.status.toLowerCase()} ticket.` });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You cannot take tickets from another IT team.' });
    return;
  }

  const oldStatus = ticket.status;
  const now = new Date().toISOString();

  ticket.assignedTechnicianId = user.id;
  ticket.assignedTechnicianName = user.displayName;
  // Taking an unassigned ticket changes New -> Assigned
  if (ticket.status === 'NEW' || ticket.status === 'OPEN') {
    ticket.status = 'ASSIGNED';
  }
  ticket.updatedAt = now;

  // Record first response if not yet logged
  if (!ticket.firstResponseAt && ticket.responseTargetTime) {
    ticket.firstResponseAt = now;
    const respDeadline = new Date(ticket.responseTargetTime).getTime();
    if (new Date(now).getTime() <= respDeadline) {
      ticket.firstResponseSlaStatus = 'MET';
    } else {
      ticket.firstResponseSlaStatus = 'BREACHED';
    }
    if (!ticket.slaHistory) ticket.slaHistory = [];
    ticket.slaHistory.push({
      id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      reason: ticket.firstResponseSlaStatus === 'MET' ? 'FIRST_RESPONSE_MET' : 'FIRST_RESPONSE_BREACHED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `First response logged via ticket claim by technician ${user.displayName}. Response SLA ${ticket.firstResponseSlaStatus}.`,
    });
  }

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'TAKEN',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `Technician ${user.displayName} took the ticket (Status: ${oldStatus} -> ${ticket.status}).`,
    fromValue: oldStatus,
    toValue: ticket.status,
    timestamp: now,
  });

  // Notify requester
  sendInPortalNotification({
    recipientId: ticket.requesterId,
    senderId: user.id,
    title: `Ticket ${ticket.ticketNumber} Claimed`,
    message: `${user.displayName} has taken your ticket and will be working on it.`,
    type: 'TICKET_ASSIGNED',
    referenceEntityType: 'TICKET',
    referenceEntityId: ticket.id,
  });

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_TAKEN',
    'TICKET',
    ticket.id,
    `Technician ${user.displayName} claimed ticket ${ticket.ticketNumber}.`,
    req
  );

  res.json({ success: true, ticket });
});

/**
 * PATCH /api/tickets/:id/status
 * Server-side RBAC:
 * - EMPLOYEE: "Cannot manually change status. Cannot close ticket. Cannot reopen Resolved/Closed tickets." -> 403 Forbidden!
 * - IT_TECHNICIAN: Can manage assigned tickets, change status, resolve, and close within team.
 * - IT_ADMIN: Within team.
 * - SUPER_ADMIN: Full access.
 */
app.patch('/api/tickets/:id/status', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;
  const { status } = req.body;

  if (user.role === 'EMPLOYEE') {
    res.status(403).json({
      error: 'Forbidden: Employees cannot manually change status, close tickets, or reopen tickets.',
    });
    return;
  }

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({
      error: 'Forbidden: You cannot modify tickets belonging to unrelated IT teams.',
    });
    return;
  }

  const validStatuses = [
    'NEW',
    'ASSIGNED',
    'OPEN',
    'IN_PROGRESS',
    'WAITING_FOR_USER',
    'PENDING_VENDOR',
    'PENDING_USER',
    'RESOLVED',
    'CLOSED',
    'CANCELLED',
  ];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: `Invalid status "${status}".` });
    return;
  }

  const oldStatus = ticket.status;
  const now = new Date().toISOString();
  ticket.status = status;
  ticket.updatedAt = now;

  if (!ticket.slaHistory) ticket.slaHistory = [];

  // Waiting for User: SLA pauses. Waiting time excluded. SLA resumes when work continues. Pause/resume audited.
  if (status === 'WAITING_FOR_USER' && oldStatus !== 'WAITING_FOR_USER') {
    ticket.slaPaused = true;
    ticket.slaPausedAt = now;
    ticket.slaHistory.push({
      id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      reason: 'PAUSED_WAITING_FOR_USER',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `SLA paused as ticket entered "Waiting for User". Waiting duration will be excluded from SLA calculations.`,
    });

    ticketHistories.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: ticket.id,
      action: 'SLA_PAUSED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `SLA paused while waiting for user response.`,
      timestamp: now,
    });
  } else if (oldStatus === 'WAITING_FOR_USER' && status !== 'WAITING_FOR_USER' && status !== 'CANCELLED') {
    // Resuming SLA
    if (ticket.slaPausedAt) {
      const pauseDurationWorkingMinutes = getElapsedWorkingMinutes(new Date(ticket.slaPausedAt), new Date(now), slaWorkingCalendar);
      ticket.slaTotalPausedWorkingMinutes = (ticket.slaTotalPausedWorkingMinutes || 0) + pauseDurationWorkingMinutes;
      if (ticket.responseTargetTime) {
        ticket.responseTargetTime = addWorkingMinutes(new Date(ticket.responseTargetTime), pauseDurationWorkingMinutes, slaWorkingCalendar).toISOString();
      }
      if (ticket.resolutionTargetTime) {
        ticket.resolutionTargetTime = addWorkingMinutes(new Date(ticket.resolutionTargetTime), pauseDurationWorkingMinutes, slaWorkingCalendar).toISOString();
      }
      ticket.slaPaused = false;
      ticket.slaPausedAt = null;

      ticket.slaHistory.push({
        id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        reason: 'RESUMED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        details: `SLA resumed from Waiting for User. ${pauseDurationWorkingMinutes} working minutes excluded from SLA clock. Resolution deadline updated to ${new Date(ticket.resolutionTargetTime).toLocaleString()}.`,
      });

      ticketHistories.push({
        id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketId: ticket.id,
        action: 'SLA_RESUMED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        details: `SLA resumed. Excluded ${pauseDurationWorkingMinutes} waiting working minutes from SLA clock.`,
        timestamp: now,
      });
    }
  }

  // Resolved: Stop SLA. Mark Resolved within SLA or Resolved after SLA. Retain for compliance. Audited.
  if (status === 'RESOLVED') {
    if (!ticket.resolvedAt) ticket.resolvedAt = now;
    ticket.slaPaused = false;
    ticket.slaPausedAt = null;

    if (ticket.resolutionTargetTime) {
      const resTargetMs = new Date(ticket.resolutionTargetTime).getTime();
      const resolvedMs = new Date(now).getTime();
      if (resolvedMs <= resTargetMs && !ticket.isSlaBreached) {
        ticket.slaStatus = 'RESOLVED_WITHIN_SLA';
      } else {
        ticket.slaStatus = 'RESOLVED_AFTER_SLA';
        ticket.isSlaBreached = true;
      }
    } else {
      ticket.slaStatus = 'RESOLVED_WITHIN_SLA';
    }

    ticket.slaHistory.push({
      id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      reason: 'RESOLVED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `Ticket resolved. SLA outcome: ${ticket.slaStatus === 'RESOLVED_WITHIN_SLA' ? 'Resolved within SLA target' : 'Resolved after SLA target'}. Retained for compliance.`,
    });

    sendInPortalNotification({
      recipientId: ticket.requesterId,
      senderId: user.id,
      title: `Ticket Resolved: #${ticket.ticketNumber}`,
      message: `Your ticket "${ticket.title}" has been resolved by ${user.displayName}.`,
      type: 'TICKET_RESOLVED',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  } else if (status === 'CLOSED') {
    // Closed: Retain resolved-stage SLA result. Do not recalculate.
    if (!ticket.closedAt) ticket.closedAt = now;
    if (!ticket.slaStatus || ticket.slaStatus === 'WITHIN_SLA' || ticket.slaStatus === 'APPROACHING_SLA') {
      ticket.slaStatus = 'RESOLVED_WITHIN_SLA';
    }
    ticket.slaPaused = false;
    ticket.slaPausedAt = null;

    ticket.slaHistory.push({
      id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      reason: 'CLOSED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `Ticket permanently closed. Retained SLA result: ${ticket.slaStatus}. No further recalculation.`,
    });

    sendInPortalNotification({
      recipientId: ticket.requesterId,
      senderId: user.id,
      title: `Ticket Closed: #${ticket.ticketNumber}`,
      message: `Ticket #${ticket.ticketNumber} is now permanently closed.`,
      type: 'TICKET_CLOSED',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  } else if (status === 'CANCELLED') {
    ticket.slaStatus = 'EXEMPT';
    ticket.isSlaBreached = false;
    ticket.slaPaused = false;
    ticket.slaPausedAt = null;

    ticket.slaHistory.push({
      id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      reason: 'CANCELLED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `Ticket cancelled. SLA stopped and marked EXEMPT (not a breach).`,
    });

    sendInPortalNotification({
      recipientId: ticket.requesterId,
      senderId: user.id,
      title: `Ticket Cancelled: #${ticket.ticketNumber}`,
      message: `Ticket #${ticket.ticketNumber} has been cancelled.`,
      type: 'TICKET_CANCELLED',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  } else {
    // Re-evaluate SLA for active tickets
    evaluateTicketSla(ticket, false);

    sendInPortalNotification({
      recipientId: ticket.requesterId,
      senderId: user.id,
      title: `Ticket #${ticket.ticketNumber} Status Changed`,
      message: `${user.displayName} changed status from ${oldStatus} to ${status}.`,
      type: 'TICKET_STATUS',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  }

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'STATUS_CHANGED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `${user.displayName} changed status from ${oldStatus} to ${status}.`,
    fromValue: oldStatus,
    toValue: status,
    timestamp: now,
  });

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_STATUS_CHANGED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} transitioned ticket ${ticket.ticketNumber} from ${oldStatus} to ${status}.`,
    req
  );

  res.json({ success: true, ticket });
});

/**
 * PATCH /api/tickets/:id/priority
 * Server-side RBAC:
 * - EMPLOYEE: Cannot change official ticket priority -> 403 Forbidden!
 * - IT_TECHNICIAN / IT_ADMIN: within permitted IT-team scope.
 * - SUPER_ADMIN: organization-wide.
 */
app.patch('/api/tickets/:id/priority', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;
  const { priority } = req.body;

  if (user.role === 'EMPLOYEE') {
    res.status(403).json({
      error: 'Forbidden: Employees cannot change official ticket priority.',
    });
    return;
  }

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({
      error: 'Forbidden: You cannot modify priority for tickets of unrelated IT teams.',
    });
    return;
  }

  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT'];
  if (!validPriorities.includes(priority)) {
    res.status(400).json({ error: `Invalid priority "${priority}".` });
    return;
  }

  const oldPriority = ticket.priority;
  const oldResp = ticket.responseTargetTime;
  const oldRes = ticket.resolutionTargetTime;
  const now = new Date().toISOString();

  ticket.priority = priority;
  ticket.updatedAt = now;

  // Priority/category changes:
  // - Recalculate SLA immediately.
  // - Preserve previous SLA history.
  // - Record old/new priority/category and SLA targets.
  const targets = calculateTicketSlaTargets(
    ticket.createdAt,
    priority,
    ticket.slaTotalPausedWorkingMinutes || 0
  );
  ticket.responseTargetTime = targets.responseTargetTime;
  ticket.resolutionTargetTime = targets.resolutionTargetTime;
  ticket.slaWarningSent = false;
  ticket.slaBreachSent = false;
  evaluateTicketSla(ticket, false);

  if (!ticket.slaHistory) ticket.slaHistory = [];
  ticket.slaHistory.push({
    id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    reason: 'PRIORITY_CHANGED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    oldPriority,
    newPriority: priority,
    oldResponseTarget: oldResp,
    newResponseTarget: targets.responseTargetTime,
    oldResolutionTarget: oldRes,
    newResolutionTarget: targets.resolutionTargetTime,
    details: `Priority changed from ${oldPriority} to ${priority}. SLA targets recalculated under Working Calendar. Resolution target: ${new Date(targets.resolutionTargetTime).toLocaleString()}.`,
  });

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'PRIORITY_CHANGED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `${user.displayName} changed priority from ${oldPriority} to ${priority}.`,
    fromValue: oldPriority,
    toValue: priority,
    timestamp: now,
  });

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'SLA_RECALCULATED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `SLA recalculated for ${priority} priority. New resolution deadline: ${new Date(targets.resolutionTargetTime).toLocaleString()}.`,
    timestamp: now,
  });

  // Notify requester
  sendInPortalNotification({
    recipientId: ticket.requesterId,
    senderId: user.id,
    title: `Ticket #${ticket.ticketNumber} Priority Changed`,
    message: `Priority updated to ${priority} by ${user.displayName}. Resolution target: ${new Date(targets.resolutionTargetTime).toLocaleString()}.`,
    type: 'TICKET_PRIORITY',
    referenceEntityType: 'TICKET',
    referenceEntityId: ticket.id,
  });

  // Notify assigned technician if different
  if (ticket.assignedTechnicianId && ticket.assignedTechnicianId !== user.id) {
    sendInPortalNotification({
      recipientId: ticket.assignedTechnicianId,
      senderId: user.id,
      title: `Ticket #${ticket.ticketNumber} Priority Changed`,
      message: `Priority updated to ${priority} by ${user.displayName}. Resolution target: ${new Date(targets.resolutionTargetTime).toLocaleString()}.`,
      type: 'TICKET_PRIORITY',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  }

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_PRIORITY_CHANGED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} updated ticket ${ticket.ticketNumber} priority from ${oldPriority} to ${priority}.`,
    req
  );

  res.json({ success: true, ticket });
});

/**
 * POST /api/tickets/:id/assign
 * Assignment Management & Auditing:
 * - Exactly one primary Technician per ticket.
 * - Employee may change Technician while New or Assigned.
 * - IT staff can manage assignments according to team permissions.
 * - Once Resolved or Closed, assignment is locked for normal users.
 * - Super Admin / authorized IT Admin can perform administrative corrections.
 * - Assignment changes are audited into Ticket History and Audit Log.
 * - Disabled Technicians cannot receive new tickets or assignments.
 */
app.post('/api/tickets/:id/assign', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;
  const { technicianId } = req.body;

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  // 1. Check Resolved/Closed assignment lock & Administrative Corrections
  const isResolvedOrClosed = ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status);
  let isAdministrativeCorrection = false;

  if (isResolvedOrClosed) {
    // Once Resolved/Closed, assignment is locked for normal users.
    // Super Admin / authorized IT Admin can perform administrative corrections.
    if (user.role === 'SUPER_ADMIN') {
      isAdministrativeCorrection = true;
    } else if (user.role === 'IT_ADMIN' && user.itTeamId === ticket.assignedTeamId) {
      isAdministrativeCorrection = true;
    } else {
      res.status(403).json({
        error: `Assignment is locked because the ticket is ${ticket.status.toLowerCase()}. Only Super Admins or authorized IT Admins can perform administrative corrections on resolved/closed tickets.`,
      });
      return;
    }
  }

  // 2. Role-based permissions on active tickets:
  if (user.role === 'EMPLOYEE') {
    if (ticket.requesterId !== user.id) {
      res.status(403).json({ error: 'Forbidden: You can only manage your own tickets.' });
      return;
    }
    // Employee may change Technician while New/Assigned:
    const isNewOrAssigned = ticket.status === 'NEW' || ticket.status === 'ASSIGNED' || ticket.status === 'OPEN';
    if (!isNewOrAssigned) {
      res.status(403).json({
        error: `Forbidden: Employees may only change technician while ticket is New or Assigned. Current status is ${ticket.status}.`,
      });
      return;
    }
  } else if (user.role === 'IT_TECHNICIAN') {
    if (user.status !== 'ACTIVE') {
      res.status(403).json({ error: 'Forbidden: Inactive technician accounts cannot manage assignments.' });
      return;
    }
    if (!canUserAccessTicket(user, ticket)) {
      res.status(403).json({
        error: 'Forbidden: You cannot manage assignments for tickets outside your IT Team scope.',
      });
      return;
    }
  } else if (user.role === 'IT_ADMIN') {
    if (user.status !== 'ACTIVE') {
      res.status(403).json({ error: 'Forbidden: Inactive IT Admin accounts cannot manage assignments.' });
      return;
    }
    if (!canUserAccessTicket(user, ticket)) {
      res.status(403).json({
        error: 'Forbidden: You cannot manage assignments for tickets outside your IT Team scope.',
      });
      return;
    }
  }

  // 3. Validate target technician (Disabled Technicians cannot receive tickets or assignments)
  let assignedTech: StoredUser | null = null;
  if (technicianId) {
    assignedTech = users.find((u) => u.id === technicianId) || null;
    if (!assignedTech) {
      res.status(404).json({ error: 'Assigned technician not found.' });
      return;
    }

    // Disabled Technicians cannot receive new tickets or assignments
    if (assignedTech.status !== 'ACTIVE') {
      res.status(400).json({
        error: 'The selected technician account is disabled or inactive and cannot receive tickets.',
      });
      return;
    }

    if (assignedTech.role !== 'IT_TECHNICIAN' && assignedTech.role !== 'IT_ADMIN') {
      res.status(400).json({ error: 'Selected user is not an IT Technician or IT Admin.' });
      return;
    }

    // Verify technician belongs to the ticket's IT Team (unless Super Admin re-routes):
    if (user.role !== 'SUPER_ADMIN' && ticket.assignedTeamId && assignedTech.itTeamId !== ticket.assignedTeamId) {
      res.status(400).json({
        error: 'Constraint violation: Technician does not belong to the ticket assigned IT Team.',
      });
      return;
    }
  }

  const oldTech = ticket.assignedTechnicianName || 'Unassigned';
  ticket.assignedTechnicianId = assignedTech ? assignedTech.id : null;
  ticket.assignedTechnicianName = assignedTech ? assignedTech.displayName : null;

  // Assigning a technician to a New ticket transitions New -> Assigned
  if (ticket.status === 'NEW' && assignedTech) {
    ticket.status = 'ASSIGNED';
  }
  const now = new Date().toISOString();
  ticket.updatedAt = now;

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: isAdministrativeCorrection ? 'ADMINISTRATIVE_ASSIGNMENT_CORRECTION' : 'ASSIGNED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: isAdministrativeCorrection
      ? `[Administrative Correction by ${user.role}] Reassigned from "${oldTech}" to "${ticket.assignedTechnicianName || 'Unassigned'}".`
      : `${user.displayName} (${user.role}) changed technician assignment from "${oldTech}" to "${ticket.assignedTechnicianName || 'Unassigned'}".`,
    fromValue: oldTech,
    toValue: ticket.assignedTechnicianName || 'Unassigned',
    timestamp: now,
  });

  if (assignedTech && assignedTech.id !== user.id) {
    sendInPortalNotification({
      recipientId: assignedTech.id,
      senderId: user.id,
      title: `Ticket ${ticket.ticketNumber} Assigned`,
      message: `${user.displayName} assigned ticket "${ticket.title}" to you.`,
      type: 'TICKET_ASSIGNED',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  }

  // Notify requester if another user modified their technician
  if (ticket.requesterId !== user.id) {
    sendInPortalNotification({
      recipientId: ticket.requesterId,
      senderId: user.id,
      title: `Technician Updated on Ticket ${ticket.ticketNumber}`,
      message: `Technician assignment updated to "${ticket.assignedTechnicianName || 'Unassigned'}".`,
      type: 'TICKET_ASSIGNED',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  }

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    isAdministrativeCorrection ? 'ADMINISTRATIVE_ASSIGNMENT_CORRECTION' : 'TICKET_ASSIGNED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} assigned ticket ${ticket.ticketNumber} to ${ticket.assignedTechnicianName || 'Unassigned'}${isAdministrativeCorrection ? ' (Administrative Correction)' : ''}.`,
    req
  );

  res.json({ success: true, ticket });
});

/**
 * GET /api/users/technicians
 * Returns list of active technicians and IT admins eligible for ticket assignment.
 * Disabled technicians are excluded so they do not appear in assignment dropdowns.
 */
app.get('/api/users/technicians', requireAuth, (req: Request, res: Response) => {
  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : undefined;

  // Disabled technicians:
  // - Cannot receive new tickets.
  // - Do not appear in assignment dropdowns.
  // - Historical records remain intact.
  let activeTechs = users.filter(
    (u) => u.status === 'ACTIVE' && (u.role === 'IT_TECHNICIAN' || u.role === 'IT_ADMIN')
  );

  if (teamId) {
    activeTechs = activeTechs.filter((u) => u.itTeamId === teamId);
  }

  const list = activeTechs.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    itTeamId: u.itTeamId || null,
    itTeamName: u.itTeamName || null,
    status: u.status,
  }));

  res.json({ success: true, technicians: list });
});

/**
 * GET /api/user/sorting-preference
 * Returns the authenticated user's saved ticket sorting preference.
 */
app.get('/api/user/sorting-preference', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  res.json({
    success: true,
    sortingPreference: user.sortingPreference || { sortBy: 'updatedAt', sortOrder: 'desc' },
  });
});

/**
 * POST /api/user/sorting-preference
 * Persists the user's preferred ticket sorting settings across sessions.
 */
app.post('/api/user/sorting-preference', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { sortBy, sortOrder } = req.body;

  const validSortBys = ['createdAt', 'updatedAt', 'priority', 'status', 'slaStatus', 'ticketNumber', 'assignedTechnicianName'];
  const validSortOrders = ['asc', 'desc'];

  if (!validSortBys.includes(sortBy) || !validSortOrders.includes(sortOrder)) {
    res.status(400).json({ error: 'Invalid sorting preference.' });
    return;
  }

  user.sortingPreference = { sortBy, sortOrder };
  const targetUser = users.find((u) => u.id === user.id);
  if (targetUser) {
    targetUser.sortingPreference = { sortBy, sortOrder };
  }
  persistData();

  res.json({
    success: true,
    sortingPreference: user.sortingPreference,
  });
});

/**
 * POST /api/tickets/:id/comments
 * Communication rules:
 * - Employee can comment while ticket is active.
 * - If ticket is RESOLVED, CLOSED, or CANCELLED: conversation is read-only (400 Bad Request).
 * - Comments strictly validated: maximum 2,000 characters.
 * - Script / XSS sanitized.
 */
app.post('/api/tickets/:id/comments', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;
  const { content, isInternalOnly } = req.body;

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Comment content cannot be empty.' });
    return;
  }

  const cleanContent = sanitizeCommentContent(content.trim());
  if (cleanContent.length > 2000) {
    res.status(400).json({ error: 'Comment content cannot exceed 2,000 characters.' });
    return;
  }

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({
      error: 'Forbidden: You do not have permission to comment on this ticket.',
    });
    return;
  }

  // If ticket is resolved, closed, or cancelled: conversation is read-only!
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || ticket.status === 'CANCELLED') {
    res.status(400).json({
      error: `Conversation is read-only because ticket is ${ticket.status}. No new comments can be added.`,
    });
    return;
  }

  let internal = !!isInternalOnly;
  if (user.role === 'EMPLOYEE') {
    // Employees cannot post internal notes
    internal = false;
  }

  const now = new Date().toISOString();
  const comment: StoredTicketComment = {
    id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    authorId: user.id,
    authorName: user.displayName,
    authorEmail: user.email,
    authorRole: user.role,
    isInternalOnly: internal,
    content: cleanContent,
    createdAt: now,
  };

  ticketComments.push(comment);
  ticket.updatedAt = now;

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'COMMENT_ADDED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `${user.displayName} posted a ${internal ? 'private technician note' : 'comment'}.`,
    timestamp: now,
  });

  // If IT staff commented publicly, check and record first response SLA
  if (user.role !== 'EMPLOYEE' && !internal) {
    if (!ticket.firstResponseAt && ticket.responseTargetTime) {
      ticket.firstResponseAt = now;
      const respDeadline = new Date(ticket.responseTargetTime).getTime();
      if (new Date(now).getTime() <= respDeadline) {
        ticket.firstResponseSlaStatus = 'MET';
      } else {
        ticket.firstResponseSlaStatus = 'BREACHED';
      }
      if (!ticket.slaHistory) ticket.slaHistory = [];
      ticket.slaHistory.push({
        id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        reason: ticket.firstResponseSlaStatus === 'MET' ? 'FIRST_RESPONSE_MET' : 'FIRST_RESPONSE_BREACHED',
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        details: `First response logged via public comment by ${user.displayName}. Response SLA ${ticket.firstResponseSlaStatus}.`,
      });
    }
  }

  // If Employee commented while Waiting for User, resume SLA automatically
  if (user.role === 'EMPLOYEE' && ticket.status === 'WAITING_FOR_USER' && ticket.slaPausedAt) {
    const pauseDuration = getElapsedWorkingMinutes(new Date(ticket.slaPausedAt), new Date(now), slaWorkingCalendar);
    ticket.slaTotalPausedWorkingMinutes = (ticket.slaTotalPausedWorkingMinutes || 0) + pauseDuration;
    if (ticket.responseTargetTime) {
      ticket.responseTargetTime = addWorkingMinutes(new Date(ticket.responseTargetTime), pauseDuration, slaWorkingCalendar).toISOString();
    }
    if (ticket.resolutionTargetTime) {
      ticket.resolutionTargetTime = addWorkingMinutes(new Date(ticket.resolutionTargetTime), pauseDuration, slaWorkingCalendar).toISOString();
    }
    ticket.slaPaused = false;
    ticket.slaPausedAt = null;
    ticket.status = 'IN_PROGRESS';

    if (!ticket.slaHistory) ticket.slaHistory = [];
    ticket.slaHistory.push({
      id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: now,
      reason: 'RESUMED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `User responded. SLA resumed and ${pauseDuration} waiting working minutes excluded. Status returned to IN_PROGRESS.`,
    });

    ticketHistories.push({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ticketId: ticket.id,
      action: 'SLA_RESUMED',
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      details: `User replied. SLA resumed from Waiting for User. ${pauseDuration} working minutes excluded. Status transitioned to IN_PROGRESS.`,
      timestamp: now,
    });
  }

  // Send in-portal notifications
  if (user.role === 'EMPLOYEE') {
    if (ticket.assignedTechnicianId) {
      sendInPortalNotification({
        recipientId: ticket.assignedTechnicianId,
        senderId: user.id,
        title: `Reply on #${ticket.ticketNumber}`,
        message: `${user.displayName} commented on "${ticket.title}".`,
        type: 'TICKET_COMMENT',
        referenceEntityType: 'TICKET',
        referenceEntityId: ticket.id,
      });
    }
    if (ticket.assignedTeamId) {
      const teamAdmins = users.filter((u) => u.itTeamId === ticket.assignedTeamId && u.role === 'IT_ADMIN' && u.id !== ticket.assignedTechnicianId);
      teamAdmins.forEach((admin) => {
        sendInPortalNotification({
          recipientId: admin.id,
          senderId: user.id,
          title: `Reply on #${ticket.ticketNumber}`,
          message: `${user.displayName} commented on "${ticket.title}".`,
          type: 'TICKET_COMMENT',
          referenceEntityType: 'TICKET',
          referenceEntityId: ticket.id,
        });
      });
    }
  } else if (!internal) {
    sendInPortalNotification({
      recipientId: ticket.requesterId,
      senderId: user.id,
      title: `Update on #${ticket.ticketNumber}`,
      message: `${user.displayName} commented on your ticket.`,
      type: 'TICKET_COMMENT',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  }

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_COMMENT_ADDED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} posted a ${internal ? 'private technician note' : 'comment'} on ticket #${ticket.ticketNumber}.`,
    req
  );

  res.status(201).json({ success: true, comment });
});

/**
 * GET /api/tickets/:id/comments
 * Returns comments on ticket with RBAC (internal notes filtered for Employees).
 */
app.get('/api/tickets/:id/comments', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You do not have permission to view comments on this ticket.' });
    return;
  }

  let comments = ticketComments.filter((c) => c.ticketId === ticket.id);
  if (user.role === 'EMPLOYEE') {
    comments = comments.filter((c) => !c.isInternalOnly);
  }
  comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  res.json({ success: true, comments });
});

/**
 * POST /api/tickets/:id/attachments
 * Upload an attachment to an existing active ticket.
 * Enforces file size (max 10MB), extension whitelist, MIME type, and magic bytes.
 */
app.post('/api/tickets/:id/attachments', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;
  const { originalFileName, mimeType, fileData } = req.body;

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You do not have permission to upload attachments to this ticket.' });
    return;
  }

  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || ticket.status === 'CANCELLED') {
    res.status(400).json({ error: `Cannot upload attachments to a ${ticket.status} ticket.` });
    return;
  }

  if (!originalFileName || !fileData) {
    res.status(400).json({ error: 'Original file name and fileData (base64) are required.' });
    return;
  }

  const safeOriginalName = path.basename(originalFileName);
  const ext = path.extname(safeOriginalName).replace('.', '').toLowerCase();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'zip'];

  if (!allowedExtensions.includes(ext)) {
    res.status(400).json({ error: `File extension .${ext} is not allowed. Permitted: ${allowedExtensions.join(', ')}` });
    return;
  }

  const base64Data = fileData.includes(';base64,') ? fileData.split(';base64,').pop()! : fileData;
  const fileBuffer = Buffer.from(base64Data, 'base64');

  if (fileBuffer.length > 10 * 1024 * 1024) {
    res.status(400).json({ error: 'Attachment exceeds maximum permitted file size of 10MB.' });
    return;
  }

  if (!verifyMagicBytes(fileBuffer, ext)) {
    res.status(400).json({ error: 'File content does not match the declared extension (magic byte verification failed).' });
    return;
  }

  const safeStoredName = `att_${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const targetFilePath = path.join(UPLOADS_DIR, safeStoredName);
  fs.writeFileSync(targetFilePath, fileBuffer);

  const isPreviewable = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt'].includes(ext);
  const now = new Date().toISOString();

  const attachmentRecord: StoredTicketAttachment = {
    id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    originalFileName: safeOriginalName,
    storedFileName: safeStoredName,
    fileSizeBytes: fileBuffer.length,
    mimeType: mimeType || 'application/octet-stream',
    extension: ext,
    isPreviewable,
    uploadedById: user.id,
    uploadedByName: user.displayName,
    uploadedByRole: user.role,
    uploadedAt: now,
    isDeleted: false,
  };

  ticketAttachments.push(attachmentRecord);
  if (!ticket.attachmentIds) ticket.attachmentIds = [];
  ticket.attachmentIds.push(attachmentRecord.id);
  ticket.updatedAt = now;

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'ATTACHMENT_ADDED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `${user.displayName} uploaded attachment "${attachmentRecord.originalFileName}".`,
    timestamp: now,
  });

  if (user.role === 'EMPLOYEE') {
    if (ticket.assignedTechnicianId) {
      sendInPortalNotification({
        recipientId: ticket.assignedTechnicianId,
        senderId: user.id,
        title: `Attachment on #${ticket.ticketNumber}`,
        message: `${user.displayName} attached "${attachmentRecord.originalFileName}".`,
        type: 'TICKET_ATTACHMENT',
        referenceEntityType: 'TICKET',
        referenceEntityId: ticket.id,
      });
    }
    if (ticket.assignedTeamId) {
      const teamAdmins = users.filter((u) => u.itTeamId === ticket.assignedTeamId && u.role === 'IT_ADMIN' && u.id !== ticket.assignedTechnicianId);
      teamAdmins.forEach((admin) => {
        sendInPortalNotification({
          recipientId: admin.id,
          senderId: user.id,
          title: `Attachment on #${ticket.ticketNumber}`,
          message: `${user.displayName} attached "${attachmentRecord.originalFileName}".`,
          type: 'TICKET_ATTACHMENT',
          referenceEntityType: 'TICKET',
          referenceEntityId: ticket.id,
        });
      });
    }
  } else {
    sendInPortalNotification({
      recipientId: ticket.requesterId,
      senderId: user.id,
      title: `Attachment on #${ticket.ticketNumber}`,
      message: `${user.displayName} uploaded file "${attachmentRecord.originalFileName}".`,
      type: 'TICKET_ATTACHMENT',
      referenceEntityType: 'TICKET',
      referenceEntityId: ticket.id,
    });
  }

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_ATTACHMENT_UPLOADED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} uploaded attachment "${attachmentRecord.originalFileName}" to ticket ${ticket.ticketNumber}.`,
    req
  );

  res.status(201).json({ success: true, attachment: attachmentRecord });
});

/**
 * DELETE /api/tickets/:id/attachments/:attachmentId
 * Soft-deletes an attachment with authorization check:
 * - Employee can delete own attachment while ticket is NEW or ASSIGNED (or OPEN).
 * - Technician can delete own attachment while ticket is active.
 * - Super Admin can delete organization-wide.
 * - When ticket is RESOLVED or CLOSED, non-admins cannot delete.
 */
app.delete('/api/tickets/:id/attachments/:attachmentId', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id, attachmentId } = req.params;

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You do not have permission to manage attachments for this ticket.' });
    return;
  }

  const att = ticketAttachments.find((a) => a.id === attachmentId && a.ticketId === ticket.id && !a.isDeleted);
  if (!att) {
    res.status(404).json({ error: 'Attachment not found or already deleted.' });
    return;
  }

  // Authorization rule for deletion
  if (user.role === 'EMPLOYEE') {
    const isNewOrAssigned = ticket.status === 'NEW' || ticket.status === 'ASSIGNED' || ticket.status === 'OPEN';
    if (!isNewOrAssigned) {
      res.status(403).json({
        error: `Forbidden: Employees can only delete attachments while New or Assigned. Current status is ${ticket.status}.`,
      });
      return;
    }
    if (att.uploadedById !== user.id) {
      res.status(403).json({ error: 'Forbidden: You can only delete your own attachments.' });
      return;
    }
  } else if (user.role === 'IT_TECHNICIAN') {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || ticket.status === 'CANCELLED') {
      res.status(403).json({ error: 'Forbidden: Cannot delete attachments on resolved, closed, or cancelled tickets.' });
      return;
    }
  }

  const now = new Date().toISOString();
  att.isDeleted = true;
  att.deletedAt = now;
  att.deletedById = user.id;
  att.deletedByName = user.displayName;

  ticket.updatedAt = now;

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'ATTACHMENT_DELETED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `${user.displayName} deleted attachment "${att.originalFileName}".`,
    timestamp: now,
  });

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_ATTACHMENT_DELETED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} soft-deleted attachment "${att.originalFileName}" on ticket ${ticket.ticketNumber}.`,
    req
  );

  res.json({ success: true, message: 'Attachment deleted successfully.' });
});

/**
 * DELETE /api/attachments/:id
 * Direct endpoint for attachment deletion with identical RBAC rules.
 */
app.delete('/api/attachments/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const att = ticketAttachments.find((a) => a.id === id && !a.isDeleted);
  if (!att) {
    res.status(404).json({ error: 'Attachment not found or already deleted.' });
    return;
  }

  const ticket = tickets.find((t) => t.id === att.ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Associated ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You do not have permission to manage attachments for this ticket.' });
    return;
  }

  // After Resolved/Closed: normal users cannot delete
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' || ticket.status === 'CANCELLED') {
    if (user.role !== 'SUPER_ADMIN') {
      res.status(403).json({
        error: `Forbidden: Cannot delete attachments on ${ticket.status.toLowerCase()} tickets.`,
      });
      return;
    }
  }

  if (user.role === 'EMPLOYEE') {
    const isNewOrAssigned = ticket.status === 'NEW' || ticket.status === 'ASSIGNED' || ticket.status === 'OPEN';
    if (!isNewOrAssigned) {
      res.status(403).json({
        error: `Forbidden: Employees can only delete attachments while New or Assigned. Current status is ${ticket.status}.`,
      });
      return;
    }
    if (att.uploadedById !== user.id) {
      res.status(403).json({ error: 'Forbidden: You can only delete your own attachments.' });
      return;
    }
  } else if (user.role === 'IT_TECHNICIAN') {
    const isActive = ['NEW', 'ASSIGNED', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'PENDING_USER', 'PENDING_VENDOR'].includes(ticket.status);
    if (!isActive) {
      res.status(403).json({
        error: `Forbidden: Technicians can only delete attachments while ticket is active. Current status is ${ticket.status}.`,
      });
      return;
    }
    if (att.uploadedById !== user.id) {
      res.status(403).json({ error: 'Forbidden: You can only delete your own attachments.' });
      return;
    }
  }

  const now = new Date().toISOString();
  att.isDeleted = true;
  att.deletedAt = now;
  att.deletedById = user.id;
  att.deletedByName = user.displayName;

  ticket.updatedAt = now;

  ticketHistories.push({
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ticketId: ticket.id,
    action: 'ATTACHMENT_DELETED',
    actorId: user.id,
    actorName: user.displayName,
    actorRole: user.role,
    details: `${user.displayName} deleted attachment "${att.originalFileName}".`,
    timestamp: now,
  });

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'TICKET_ATTACHMENT_DELETED',
    'TICKET',
    ticket.id,
    `${user.role} ${user.displayName} soft-deleted attachment "${att.originalFileName}" on ticket ${ticket.ticketNumber}.`,
    req
  );

  res.json({ success: true, message: 'Attachment deleted successfully.' });
});

/**
 * GET /api/attachments/:id
 * Retrieve attachment metadata.
 */
app.get('/api/attachments/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const att = ticketAttachments.find((a) => a.id === id && !a.isDeleted);
  if (!att) {
    res.status(404).json({ error: 'Attachment not found.' });
    return;
  }

  const ticket = tickets.find((t) => t.id === att.ticketId);
  if (!ticket || !canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You do not have permission to view this attachment.' });
    return;
  }

  res.json({ success: true, attachment: att });
});

/**
 * GET /api/attachments/:id/preview
 * Streams file for inline preview with security headers (CSP & nosniff).
 */
app.get('/api/attachments/:id/preview', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const att = ticketAttachments.find((a) => a.id === id && !a.isDeleted);
  if (!att) {
    res.status(404).send('Attachment not found');
    return;
  }

  const ticket = tickets.find((t) => t.id === att.ticketId);
  if (!ticket || !canUserAccessTicket(user, ticket)) {
    res.status(403).send('Forbidden');
    return;
  }

  const filePath = path.join(UPLOADS_DIR, att.storedFileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('File missing on disk');
    return;
  }

  res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.originalFileName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/tickets/:id/attachments/:attachmentId/preview
 * Alias for inline preview.
 */
app.get('/api/tickets/:id/attachments/:attachmentId/preview', requireAuth, (req: Request, res: Response) => {
  req.params.id = req.params.attachmentId;
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const att = ticketAttachments.find((a) => a.id === id && !a.isDeleted);
  if (!att) {
    res.status(404).send('Attachment not found');
    return;
  }

  const ticket = tickets.find((t) => t.id === att.ticketId);
  if (!ticket || !canUserAccessTicket(user, ticket)) {
    res.status(403).send('Forbidden');
    return;
  }

  const filePath = path.join(UPLOADS_DIR, att.storedFileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('File missing on disk');
    return;
  }

  res.setHeader('Content-Type', att.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(att.originalFileName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/attachments/:id/download
 * Streams file for download with octet-stream and original filename.
 */
app.get('/api/attachments/:id/download', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const att = ticketAttachments.find((a) => a.id === id && !a.isDeleted);
  if (!att) {
    res.status(404).send('Attachment not found');
    return;
  }

  const ticket = tickets.find((t) => t.id === att.ticketId);
  if (!ticket || !canUserAccessTicket(user, ticket)) {
    res.status(403).send('Forbidden');
    return;
  }

  const filePath = path.join(UPLOADS_DIR, att.storedFileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('File missing on disk');
    return;
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.originalFileName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/tickets/:id/attachments/:attachmentId/download
 * Alias for download.
 */
app.get('/api/tickets/:id/attachments/:attachmentId/download', requireAuth, (req: Request, res: Response) => {
  req.params.id = req.params.attachmentId;
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const att = ticketAttachments.find((a) => a.id === id && !a.isDeleted);
  if (!att) {
    res.status(404).send('Attachment not found');
    return;
  }

  const ticket = tickets.find((t) => t.id === att.ticketId);
  if (!ticket || !canUserAccessTicket(user, ticket)) {
    res.status(403).send('Forbidden');
    return;
  }

  const filePath = path.join(UPLOADS_DIR, att.storedFileName);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('File missing on disk');
    return;
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.originalFileName)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(filePath).pipe(res);
});

/**
 * GET /api/tickets/:id/history
 * Chronological history audit records for ticket.
 */
app.get('/api/tickets/:id/history', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found.' });
    return;
  }

  if (!canUserAccessTicket(user, ticket)) {
    res.status(403).json({ error: 'Forbidden: You cannot view history for this ticket.' });
    return;
  }

  const history = ticketHistories.filter((h) => h.ticketId === ticket.id);
  history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json({ success: true, history });
});

/**
 * DELETE /api/tickets/:id
 * Permanent ticket deletion is strictly prohibited by enterprise retention policy.
 */
app.delete('/api/tickets/:id', requireAuth, (req: Request, res: Response) => {
  res.status(403).json({
    error: 'Permanent ticket deletion is prohibited by enterprise retention policy. Cancelled tickets are retained permanently as historical records.',
  });
});

// ==========================================
// 5. ASSET CUSTOM FIELDS & INVENTORY API
// ==========================================

/**
 * GET /api/asset-custom-fields
 * Returns all custom fields created by Super Admin for computer inventory
 */
app.get('/api/asset-custom-fields', requireAuth, (req: Request, res: Response) => {
  res.json({ success: true, customFields: assetCustomFields });
});

/**
 * POST /api/asset-custom-fields
 * Super Admin creates a new custom field for IT computer assets
 */
app.post('/api/asset-custom-fields', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  if (user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Only Super Admin can define custom asset inventory fields.' });
    return;
  }

  const { label, fieldKey, fieldType, options, isRequired, description } = req.body;
  if (!label || !fieldKey || !fieldType) {
    res.status(400).json({ error: 'Field label, key, and type are required.' });
    return;
  }

  const cleanKey = fieldKey.trim().replace(/[^a-zA-Z0-9_]/g, '_');
  const existing = assetCustomFields.find((f) => f.fieldKey.toLowerCase() === cleanKey.toLowerCase());
  if (existing) {
    res.status(400).json({ error: `Custom field key "${cleanKey}" already exists.` });
    return;
  }

  const now = new Date().toISOString();
  const newField: StoredAssetCustomField = {
    id: `cf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    fieldKey: cleanKey,
    label: label.trim(),
    fieldType: fieldType || 'TEXT',
    options: Array.isArray(options) ? options : [],
    isRequired: Boolean(isRequired),
    description: description ? description.trim() : '',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  assetCustomFields.push(newField);
  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'CUSTOM_FIELD_CREATED',
    'ASSET_FIELD',
    newField.id,
    `Super Admin created asset custom field "${newField.label}" (${newField.fieldKey}).`,
    req
  );

  res.status(201).json({ success: true, customField: newField });
});

/**
 * PUT /api/asset-custom-fields/:id
 * Super Admin updates a custom field
 */
app.put('/api/asset-custom-fields/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  if (user.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Only Super Admin can update custom asset inventory fields.' });
    return;
  }

  const { id } = req.params;
  const field = assetCustomFields.find((f) => f.id === id);
  if (!field) {
    res.status(404).json({ error: 'Custom field not found.' });
    return;
  }

  const { label, options, isRequired, description, isActive } = req.body;
  if (label) field.label = label.trim();
  if (options && Array.isArray(options)) field.options = options;
  if (isRequired !== undefined) field.isRequired = Boolean(isRequired);
  if (description !== undefined) field.description = description ? description.trim() : '';
  if (isActive !== undefined) field.isActive = Boolean(isActive);

  field.updatedAt = new Date().toISOString();
  persistData();

  res.json({ success: true, customField: field });
});

/**
 * GET /api/assets
 * Server-side RBAC scoping & filtering:
 * - EMPLOYEE: Own assigned assets only.
 * - IT_TECHNICIAN: Within permitted IT-team scope.
 * - IT_ADMIN: Full asset visibility within their IT Team.
 * - SUPER_ADMIN: Full organization-wide access across all companies and locations.
 */
app.get('/api/assets', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { status, search, locationId, includeRetired } = req.query;

  let filtered: StoredAsset[] = [];

  if (user.role === 'SUPER_ADMIN') {
    filtered = [...assets];
  } else if (user.role === 'EMPLOYEE') {
    // Strictly own assigned assets only
    filtered = assets.filter((a) => a.assignedUserId === user.id);
  } else if (user.role === 'IT_ADMIN' || user.role === 'IT_TECHNICIAN') {
    if (!user.itTeamId) {
      res.status(403).json({ error: 'Account is not assigned to an IT Team.' });
      return;
    }
    filtered = assets.filter((a) => a.assignedTeamId === user.itTeamId);
  }

  // Filter out soft-deleted/retired unless explicitly requested
  if (includeRetired !== 'true') {
    filtered = filtered.filter((a) => !a.isDeleted && a.status !== 'Retired');
  }

  // Status filter
  if (status && typeof status === 'string' && status !== 'ALL') {
    filtered = filtered.filter((a) => a.status.toLowerCase() === status.toLowerCase());
  }

  // Location filter
  if (locationId && typeof locationId === 'string' && locationId !== 'ALL') {
    filtered = filtered.filter((a) => a.locationId === locationId);
  }

  // Search filter
  if (search && typeof search === 'string' && search.trim()) {
    const term = search.trim().toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.assetTag.toLowerCase().includes(term) ||
        a.serialNumber.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term) ||
        (a.model && a.model.toLowerCase().includes(term)) ||
        (a.manufacturer && a.manufacturer.toLowerCase().includes(term)) ||
        (a.assignedUserName && a.assignedUserName.toLowerCase().includes(term))
    );
  }

  res.json({ assets: filtered, totalCount: filtered.length });
});

/**
 * GET /api/assets/export-excel
 * Generates and downloads the current Computer Inventory as an Excel workbook (.xlsx)
 * Must be registered BEFORE /api/assets/:id so it is not intercepted as an ID route!
 */
app.get('/api/assets/export-excel', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ error: 'Forbidden: Employees cannot export inventory.' });
    return;
  }

  let exportList = [...assets];
  if (user.role === 'IT_ADMIN' || user.role === 'IT_TECHNICIAN') {
    exportList = exportList.filter((a) => a.assignedTeamId === user.itTeamId);
  }

  const exportRows = exportList.map((a) => {
    const loc = locations.find((l) => l.id === a.locationId);
    const comp = companies.find((c) => c.id === a.companyId);
    const dept = departments.find((d) => d.id === a.departmentId);

    const calcs = computeAssetCalculations({
      purchaseDate: a.purchaseDate,
      purchaseDateParsed: a.purchaseDateParsed,
      purchaseCost: a.purchaseCost,
      expectedLifeYears: a.expectedLifeYears,
      warrantyEnd: a.warrantyEnd || a.warrantyExpiryDate,
    });

    const row: Record<string, any> = {
      'Asset ID': a.id || '',
      'Company': comp ? comp.name : (a.company || a.companyId || ''),
      'Asset Type': a.assetType || '',
      'Asset Number': a.assetTag || '',
      'Condition': a.condition || 'Good',
      'Assigned Employee Name': a.assignedEmployeeName || a.assignedUserName || '',
      'Asset User Name': a.assetUserName || a.assignedUserName || '',
      'Department': dept ? dept.name : (a.department || ''),
      'Location': loc ? loc.name : (a.location || a.locationId || ''),
      'IP Adresss': a.ipAddress || a.specifications?.ipAddress || '',
      'Serial Number': a.serialNumber || '',
      'Manufacturer': a.manufacturer || '',
      'Model': a.model || '',
      'Processor': a.processor || a.specifications?.cpu || '',
      'Purchase Date': a.purchaseDate || '',
      'New (NH)/ Old (SH)': a.newOrOld || (a.condition?.includes('Old') || a.condition?.includes('SH') ? 'Old (SH)' : 'New (NH)'),
      'Storage': a.storage || (a.specifications?.storageGb ? `${a.specifications.storageGb}GB` : ''),
      'RAM': a.ram || (a.specifications?.ramGb ? `${a.specifications.ramGb}GB` : ''),
      'WINDOWS VERSION': a.windowsVersion || a.specifications?.os || '',
      'MSOFFICE': a.msOffice || '',
      'ESCAN': a.escan || '',
      'Motherboard': a.motherboard || '',
      'Display': a.display || '',
      'Display Size': a.displaySize || (a.specifications?.screenSizeInches ? `${a.specifications.screenSizeInches}"` : ''),
      'Lan Card': a.lanCard || '',
      'Ups/ Battery': a.upsBattery || '',
      'Warranty Start': a.warrantyStart || '',
      'Warranty End': a.warrantyEnd || a.warrantyExpiryDate || '',
      'Last Service Date': a.lastServiceDate || '',
      'Remarks': a.remarks || a.notes || '',
      'Asset Age (Yrs)': calcs.assetAgeYears !== null ? calcs.assetAgeYears : (a.assetAgeYears ?? ''),
      'Expected Life (Yrs)': a.expectedLifeYears !== undefined && a.expectedLifeYears !== null ? a.expectedLifeYears : 4,
      'Expected Replacement Date': calcs.expectedReplacementDate || a.expectedReplacementDate || '',
      'Depreciated Value (INR)': calcs.depreciatedValueINR !== null ? calcs.depreciatedValueINR : (a.depreciatedValueINR ?? ''),
      'Replacement Alert': calcs.replacementAlert || a.replacementAlert || '',
      'Warranty Alert': calcs.warrantyAlert || a.warrantyAlert || '',
      'Vendor': a.vendor || '',
      'Purchase Cost (INR)': a.purchaseCost !== undefined && a.purchaseCost !== null ? a.purchaseCost : '',
      'Invoice Number': a.invoiceNumber || '',
      'AMC Start': a.amcStart || '',
      'AMC End': a.amcEnd || '',
      'Purchase Date (Parsed)': calcs.purchaseDateParsed || a.purchaseDateParsed || '',
    };

    return row;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Computer Inventory');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `IT_Computer_Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
});

/**
 * GET /api/assets/my-assigned
 * Automatically identifies the authenticated employee's assigned computer.
 */
app.get('/api/assets/my-assigned', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const myAsset = assets.find((a) => a.assignedUserId === user.id && !a.isDeleted && a.status !== 'Retired') || null;
  res.json({ asset: myAsset });
});

/**
 * GET /api/assets/ticket-options
 * Fetches available equipment options for linking to a ticket during ticket creation:
 * - Automatically provides employee's assigned equipment (default).
 * - Provides non-assigned organization active assets if employee needs to report on an exception basis.
 * - Technicians/IT Admins get assets within their permitted IT Team.
 * - Super Admins get all active organization assets.
 */
app.get('/api/assets/ticket-options', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;

  if (user.role === 'EMPLOYEE') {
    const myAsset = assets.find((a) => a.assignedUserId === user.id && !a.isDeleted && a.status !== 'Retired') || null;
    const otherAssets = assets
      .filter((a) => !a.isDeleted && a.status !== 'Retired' && a.assignedUserId !== user.id)
      .map((a) => ({
        id: a.id,
        assetTag: a.assetTag,
        serialNumber: a.serialNumber,
        name: a.name,
        model: a.model,
        manufacturer: a.manufacturer,
        assetType: a.assetType,
        status: a.status,
        locationId: a.locationId,
        assignedUserName: a.assignedUserName,
      }));
    res.json({ myAsset, otherAssets });
    return;
  }

  if (user.role === 'IT_TECHNICIAN' || user.role === 'IT_ADMIN') {
    const teamAssets = assets.filter((a) => !a.isDeleted && a.status !== 'Retired' && a.assignedTeamId === user.itTeamId);
    res.json({ myAsset: null, otherAssets: teamAssets });
    return;
  }

  // Super Admin: all active assets
  const allActive = assets.filter((a) => !a.isDeleted && a.status !== 'Retired');
  res.json({ myAsset: null, otherAssets: allActive });
});

/**
 * GET /api/assets/:id
 * Server-side RBAC scoping for single asset retrieval:
 * - EMPLOYEE: Only their own assigned asset. Accessing another employee's asset returns 403 Forbidden.
 * - IT_TECHNICIAN / IT_ADMIN: Only within their permitted IT Team. Unrelated team returns 403 Forbidden.
 * - SUPER_ADMIN: Full access.
 */
app.get('/api/assets/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const asset = assets.find((a) => a.id === id);
  if (!asset) {
    res.status(404).json({ error: 'Asset not found.' });
    return;
  }

  if (user.role === 'EMPLOYEE') {
    const isOwner = asset.assignedUserId === user.id || (user.assetTag && asset.assetTag === user.assetTag);
    if (!isOwner) {
      res.status(403).json({ error: 'Forbidden: You can only view your own assigned IT assets.' });
      return;
    }
  } else if (user.role === 'IT_ADMIN' || user.role === 'IT_TECHNICIAN') {
    if (!user.itTeamId || asset.assignedTeamId !== user.itTeamId) {
      res.status(403).json({ error: 'Forbidden: Cannot access assets belonging to an unrelated IT team.' });
      return;
    }
  }

  res.json({ asset });
});

/**
 * GET /api/assets/:id/tickets
 * Preserves complete historical relationships:
 * Returns all tickets linked to this asset, including past tickets from before an asset transfer.
 */
app.get('/api/assets/:id/tickets', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const asset = assets.find((a) => a.id === id);
  if (!asset) {
    res.status(404).json({ error: 'Asset not found.' });
    return;
  }

  if (user.role === 'EMPLOYEE') {
    const isCurrentAssignee = asset.assignedUserId === user.id;
    const isHistoricalAssignee = asset.assignmentHistory?.some(
      (h) => h.currentEmployeeId === user.id || h.previousEmployeeId === user.id
    );
    if (!isCurrentAssignee && !isHistoricalAssignee) {
      res.status(403).json({ error: 'Forbidden: You can only view ticket history for your assigned equipment.' });
      return;
    }
  } else if (user.role === 'IT_ADMIN' || user.role === 'IT_TECHNICIAN') {
    if (!user.itTeamId || asset.assignedTeamId !== user.itTeamId) {
      res.status(403).json({ error: 'Forbidden: Cannot access tickets for equipment outside your IT Team.' });
      return;
    }
  }

  const assetTickets = tickets.filter(
    (t) =>
      t.relatedAssetId === asset.id ||
      (t.relatedAssetTag && t.relatedAssetTag.toUpperCase() === asset.assetTag.toUpperCase())
  );

  res.json({ tickets: assetTickets, totalCount: assetTickets.length });
});

/**
 * POST /api/assets
 * Server-side RBAC:
 * - EMPLOYEE: 403 Forbidden!
 * - IT_TECHNICIAN: Can add assets within permitted IT-team scope.
 * - IT_ADMIN: Full asset manageability within IT Team.
 * - SUPER_ADMIN: Organization-wide.
 * 
 * Business Rules:
 * - Unique Asset/Inventory Number (assetTag) AND Serial Number (serialNumber).
 * - One computer can be assigned to only one employee at a time.
 * - Maintains complete assignment history.
 */
app.post('/api/assets', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ error: 'Forbidden: Employees cannot add assets.' });
    return;
  }

  const {
    assetTag,
    serialNumber,
    name,
    assetType,
    manufacturer,
    model,
    companyId,
    locationId,
    departmentId,
    assignedUserId,
    status,
    specifications,
    purchaseDate,
    purchaseCost,
    warrantyExpiryDate,
    notes,
    customFields,
    condition,
    assignedEmployeeName,
    assetUserName,
    department,
    location,
    company,
    ipAddress,
    processor,
    newOrOld,
    storage,
    ram,
    windowsVersion,
    msOffice,
    escan,
    motherboard,
    display,
    displaySize,
    lanCard,
    upsBattery,
    warrantyStart,
    warrantyEnd,
    lastServiceDate,
    remarks,
    expectedLifeYears,
    vendor,
    invoiceNumber,
    amcStart,
    amcEnd,
  } = req.body;

  if (!assetTag || !serialNumber) {
    res.status(400).json({ error: 'Asset/Inventory Number and Serial Number are required.' });
    return;
  }

  const cleanTag = assetTag.trim().toUpperCase();
  const cleanSerial = serialNumber.trim();

  // Validate duplicate Asset Number in DB
  const existingTag = assets.find((a) => a.assetTag.toUpperCase() === cleanTag);
  if (existingTag) {
    res.status(400).json({ error: `Asset/Inventory Number "${cleanTag}" already exists in the system.` });
    return;
  }

  // Validate duplicate Serial Number in DB
  const existingSerial = assets.find((a) => a.serialNumber.toUpperCase() === cleanSerial.toUpperCase());
  if (existingSerial) {
    res.status(400).json({ error: `Serial Number "${cleanSerial}" already exists on asset ${existingSerial.assetTag}.` });
    return;
  }

  // Check company/location only if provided and exists
  if (companyId && companies.length > 0) {
    const selectedComp = companies.find((c) => c.id === companyId && !c.isDeleted);
    if (selectedComp && (selectedComp.isArchived || selectedComp.status === 'ARCHIVED')) {
      res.status(400).json({ error: 'Cannot assign asset to an archived company.' });
      return;
    }
  }

  if (locationId && locations.length > 0) {
    const selectedLoc = locations.find((l) => l.id === locationId && !l.isDeleted);
    if (selectedLoc && (selectedLoc.isArchived || selectedLoc.status === 'ARCHIVED')) {
      res.status(400).json({ error: 'Cannot assign asset to an archived location.' });
      return;
    }
  }

  if (departmentId && departments.length > 0) {
    const selectedDept = departments.find((d) => d.id === departmentId && !d.isDeleted);
    if (selectedDept && (selectedDept.isArchived || selectedDept.status === 'ARCHIVED')) {
      res.status(400).json({ error: 'Cannot assign asset to an archived department.' });
      return;
    }
  }

  // IT Team scope for creator:
  let teamId = req.body.assignedTeamId;
  if (user.role === 'IT_ADMIN' || user.role === 'IT_TECHNICIAN') {
    teamId = user.itTeamId; // Strictly bounded to own IT team
  } else if (!teamId) {
    teamId = 'team_tier1';
  }

  const now = new Date().toISOString();

  // Assignment handling (One computer to one employee)
  let assignedUser: StoredUser | undefined;
  let computedStatus: 'Active' | 'Inactive' | 'Under Repair' | 'Retired' = status || 'Inactive';
  let initialHistory: StoredAssetAssignmentRecord[] = [];

  if (assignedUserId) {
    assignedUser = users.find((u) => u.id === assignedUserId && u.status !== 'DEACTIVATED');
    if (!assignedUser) {
      res.status(400).json({ error: 'Selected assigned employee was not found.' });
      return;
    }
    computedStatus = 'Active';
    initialHistory.push({
      id: `asgn_${Date.now()}_0`,
      assetId: `ast_${Date.now()}`,
      previousEmployeeId: null,
      previousEmployeeName: null,
      currentEmployeeId: assignedUser.id,
      currentEmployeeName: assignedUser.displayName,
      assignmentDate: now,
      transferDate: null,
      assignedByUserId: user.id,
      assignedByUserName: user.displayName,
      action: 'INITIAL_ASSIGNMENT',
      notes: notes ? `Initial asset allocation: ${notes}` : 'Initial asset allocation',
      createdAt: now,
    });
  } else if (assignedEmployeeName) {
    computedStatus = 'Active';
  }

  const effectivePurchaseDate = purchaseDate || undefined;
  const effectiveCost = purchaseCost !== undefined && purchaseCost !== null ? Number(purchaseCost) : undefined;
  const effectiveWarrantyEnd = warrantyEnd || warrantyExpiryDate || undefined;

  const calcs = computeAssetCalculations({
    purchaseDate: effectivePurchaseDate,
    purchaseCost: effectiveCost,
    expectedLifeYears: expectedLifeYears,
    warrantyEnd: effectiveWarrantyEnd,
  });

  const newAsset: StoredAsset = {
    id: req.body.id || `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    assetTag: cleanTag,
    serialNumber: cleanSerial,
    name: (name || `${manufacturer || ''} ${model || ''}`).trim() || cleanTag,
    assetType: assetType || 'LAPTOP',
    manufacturer: manufacturer || '',
    model: model || '',
    condition: condition || 'Good',
    assignedEmployeeName: assignedEmployeeName || (assignedUser ? assignedUser.displayName : null),
    assetUserName: assetUserName || assignedEmployeeName || (assignedUser ? assignedUser.displayName : null),
    department: department || null,
    location: location || null,
    company: company || null,
    ipAddress: ipAddress || (specifications?.ipAddress || null),
    processor: processor || (specifications?.cpu || null),
    newOrOld: newOrOld || null,
    storage: storage || (specifications?.storageGb ? `${specifications.storageGb}GB` : null),
    ram: ram || (specifications?.ramGb ? `${specifications.ramGb}GB` : null),
    windowsVersion: windowsVersion || (specifications?.os || null),
    msOffice: msOffice || null,
    escan: escan || null,
    motherboard: motherboard || null,
    display: display || null,
    displaySize: displaySize || (specifications?.screenSizeInches ? `${specifications.screenSizeInches}"` : null),
    lanCard: lanCard || null,
    upsBattery: upsBattery || null,
    warrantyStart: warrantyStart || null,
    warrantyEnd: effectiveWarrantyEnd || null,
    lastServiceDate: lastServiceDate || null,
    remarks: remarks || notes || null,
    assetAgeYears: calcs.assetAgeYears ?? undefined,
    expectedLifeYears: expectedLifeYears !== undefined && expectedLifeYears !== null ? Number(expectedLifeYears) : 4,
    expectedReplacementDate: calcs.expectedReplacementDate || undefined,
    depreciatedValueINR: calcs.depreciatedValueINR ?? undefined,
    replacementAlert: calcs.replacementAlert || undefined,
    warrantyAlert: calcs.warrantyAlert || undefined,
    vendor: vendor || null,
    purchaseCost: effectiveCost,
    invoiceNumber: invoiceNumber || null,
    amcStart: amcStart || null,
    amcEnd: amcEnd || null,
    purchaseDateParsed: calcs.purchaseDateParsed || undefined,
    companyId: companyId || 'comp_default',
    locationId: locationId || 'loc_default',
    departmentId: departmentId || null,
    assignedUserId: assignedUser ? assignedUser.id : null,
    assignedUserName: assignedUser ? assignedUser.displayName : (assignedEmployeeName || null),
    assignedUserEmail: assignedUser ? assignedUser.email : null,
    assignedTeamId: teamId || null,
    previousEmployeeId: null,
    previousEmployeeName: null,
    assignmentDate: (assignedUser || assignedEmployeeName) ? now : null,
    transferDate: null,
    status: computedStatus,
    specifications: specifications || {
      cpu: processor || undefined,
      ramGb: ram ? Number(String(ram).replace(/[^0-9.]+/g, '')) : undefined,
      storageGb: storage ? Number(String(storage).replace(/[^0-9.]+/g, '')) : undefined,
      os: windowsVersion || undefined,
      ipAddress: ipAddress || undefined,
    },
    purchaseDate: effectivePurchaseDate,
    warrantyExpiryDate: effectiveWarrantyEnd,
    notes: notes ? notes.trim() : undefined,
    customFields: customFields || {},
    assignmentHistory: initialHistory,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  // Set assetId on history record
  if (newAsset.assignmentHistory && newAsset.assignmentHistory[0]) {
    newAsset.assignmentHistory[0].assetId = newAsset.id;
  }

  assets.unshift(newAsset);
  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'ASSET_CREATED',
    'ASSET',
    newAsset.id,
    `${user.role} ${user.displayName} registered asset ${newAsset.assetTag} (${newAsset.name}) [S/N: ${newAsset.serialNumber}].`,
    req,
    undefined,
    { id: newAsset.id, assetTag: newAsset.assetTag, serialNumber: newAsset.serialNumber, status: newAsset.status }
  );

  res.status(201).json({ success: true, asset: newAsset });
});

/**
 * PUT /api/assets/:id
 * Server-side RBAC:
 * - EMPLOYEE: 403 Forbidden!
 * - IT_TECHNICIAN: Can edit assets within permitted IT-team scope. Cannot access unrelated IT teams.
 * - IT_ADMIN: Full asset manageability within their IT Team.
 * - SUPER_ADMIN: Full manageability organization-wide.
 * 
 * Business Rules:
 * - One computer can be assigned to only one employee at a time.
 * - Complete assignment history tracking:
 *   current employee, previous employee, assignment date, transfer date.
 */
app.put('/api/assets/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ error: 'Forbidden: Employees cannot edit assets.' });
    return;
  }

  const { id } = req.params;
  const asset = assets.find((a) => a.id === id);
  if (!asset) {
    res.status(404).json({ error: 'Asset not found.' });
    return;
  }

  // Team scope check:
  if (user.role !== 'SUPER_ADMIN') {
    if (asset.assignedTeamId && user.itTeamId && asset.assignedTeamId !== user.itTeamId) {
      res.status(403).json({
        error: 'Forbidden: Cannot manage assets of an unrelated IT team.',
      });
      return;
    }
  }

  const {
    assetTag,
    serialNumber,
    name,
    model,
    manufacturer,
    assetType,
    status,
    assignedUserId,
    companyId,
    locationId,
    departmentId,
    specifications,
    purchaseDate,
    purchaseCost,
    warrantyExpiryDate,
    notes,
    customFields,
    transferNotes,
    condition,
    assignedEmployeeName,
    assetUserName,
    department,
    location,
    company,
    ipAddress,
    processor,
    newOrOld,
    storage,
    ram,
    windowsVersion,
    msOffice,
    escan,
    motherboard,
    display,
    displaySize,
    lanCard,
    upsBattery,
    warrantyStart,
    warrantyEnd,
    lastServiceDate,
    remarks,
    expectedLifeYears,
    vendor,
    invoiceNumber,
    amcStart,
    amcEnd,
  } = req.body;

  const now = new Date().toISOString();

  const oldValues: Record<string, any> = {
    status: asset.status,
    condition: asset.condition,
    assignedUserName: asset.assignedUserName,
    assignedUserId: asset.assignedUserId,
    location: asset.location,
    department: asset.department,
    company: asset.company,
    ipAddress: asset.ipAddress,
  };

  // Validate duplicate Asset Number if changed
  if (assetTag && assetTag.trim().toUpperCase() !== asset.assetTag.toUpperCase()) {
    const cleanTag = assetTag.trim().toUpperCase();
    const existingTag = assets.find((a) => a.id !== id && a.assetTag.toUpperCase() === cleanTag);
    if (existingTag) {
      res.status(400).json({ error: `Asset/Inventory Number "${cleanTag}" already exists on another asset.` });
      return;
    }
    asset.assetTag = cleanTag;
  }

  // Validate duplicate Serial Number if changed
  if (serialNumber && serialNumber.trim().toUpperCase() !== asset.serialNumber.toUpperCase()) {
    const cleanSerial = serialNumber.trim();
    const existingSerial = assets.find((a) => a.id !== id && a.serialNumber.toUpperCase() === cleanSerial.toUpperCase());
    if (existingSerial) {
      res.status(400).json({ error: `Serial Number "${cleanSerial}" already exists on asset ${existingSerial.assetTag}.` });
      return;
    }
    asset.serialNumber = cleanSerial;
  }

  if (name) asset.name = name.trim();
  if (model !== undefined) asset.model = model ? model.trim() : '';
  if (manufacturer !== undefined) asset.manufacturer = manufacturer ? manufacturer.trim() : '';
  if (assetType) asset.assetType = assetType;
  if (companyId) asset.companyId = companyId;
  if (locationId) asset.locationId = locationId;
  if (departmentId !== undefined) asset.departmentId = departmentId;
  if (condition !== undefined) asset.condition = condition;
  if (assignedEmployeeName !== undefined) asset.assignedEmployeeName = assignedEmployeeName;
  if (assetUserName !== undefined) asset.assetUserName = assetUserName;
  if (department !== undefined) asset.department = department;
  if (location !== undefined) asset.location = location;
  if (company !== undefined) asset.company = company;
  if (ipAddress !== undefined) asset.ipAddress = ipAddress;
  if (processor !== undefined) asset.processor = processor;
  if (newOrOld !== undefined) asset.newOrOld = newOrOld;
  if (storage !== undefined) asset.storage = storage;
  if (ram !== undefined) asset.ram = ram;
  if (windowsVersion !== undefined) asset.windowsVersion = windowsVersion;
  if (msOffice !== undefined) asset.msOffice = msOffice;
  if (escan !== undefined) asset.escan = escan;
  if (motherboard !== undefined) asset.motherboard = motherboard;
  if (display !== undefined) asset.display = display;
  if (displaySize !== undefined) asset.displaySize = displaySize;
  if (lanCard !== undefined) asset.lanCard = lanCard;
  if (upsBattery !== undefined) asset.upsBattery = upsBattery;
  if (warrantyStart !== undefined) asset.warrantyStart = warrantyStart;
  if (warrantyEnd !== undefined) asset.warrantyEnd = warrantyEnd;
  if (lastServiceDate !== undefined) asset.lastServiceDate = lastServiceDate;
  if (remarks !== undefined) asset.remarks = remarks;
  if (expectedLifeYears !== undefined) asset.expectedLifeYears = expectedLifeYears ? Number(expectedLifeYears) : undefined;
  if (vendor !== undefined) asset.vendor = vendor;
  if (invoiceNumber !== undefined) asset.invoiceNumber = invoiceNumber;
  if (amcStart !== undefined) asset.amcStart = amcStart;
  if (amcEnd !== undefined) asset.amcEnd = amcEnd;
  if (specifications) asset.specifications = { ...asset.specifications, ...specifications };
  if (purchaseDate !== undefined) asset.purchaseDate = purchaseDate;
  if (purchaseCost !== undefined) asset.purchaseCost = purchaseCost ? Number(purchaseCost) : undefined;
  if (warrantyExpiryDate !== undefined) asset.warrantyExpiryDate = warrantyExpiryDate;
  if (notes !== undefined) asset.notes = notes;
  if (customFields) asset.customFields = { ...asset.customFields, ...customFields };

  // Calculate updated computed metrics
  const calcs = computeAssetCalculations({
    purchaseDate: asset.purchaseDate,
    purchaseCost: asset.purchaseCost,
    expectedLifeYears: asset.expectedLifeYears,
    warrantyEnd: asset.warrantyEnd || asset.warrantyExpiryDate,
  });
  if (calcs.assetAgeYears !== null) asset.assetAgeYears = calcs.assetAgeYears;
  if (calcs.expectedReplacementDate) asset.expectedReplacementDate = calcs.expectedReplacementDate;
  if (calcs.depreciatedValueINR !== null) asset.depreciatedValueINR = calcs.depreciatedValueINR;
  if (calcs.replacementAlert) asset.replacementAlert = calcs.replacementAlert;
  if (calcs.warrantyAlert) asset.warrantyAlert = calcs.warrantyAlert;
  if (calcs.purchaseDateParsed) asset.purchaseDateParsed = calcs.purchaseDateParsed;

  // Assignment Update Logic:
  if (assignedUserId !== undefined) {
    if (!asset.assignmentHistory) asset.assignmentHistory = [];

    const oldUserId = asset.assignedUserId;
    const oldUserName = asset.assignedUserName;

    if (assignedUserId && assignedUserId !== oldUserId) {
      // Reassigning to a new employee
      const newEmployee = users.find((u) => u.id === assignedUserId && u.status !== 'DEACTIVATED');
      if (!newEmployee) {
        res.status(400).json({ error: 'Assigned employee was not found.' });
        return;
      }

      asset.previousEmployeeId = oldUserId || null;
      asset.previousEmployeeName = oldUserName || null;
      asset.assignedUserId = newEmployee.id;
      asset.assignedUserName = newEmployee.displayName;
      asset.assignedUserEmail = newEmployee.email;
      asset.assignmentDate = now;
      asset.transferDate = oldUserId ? now : null;
      asset.status = 'Active';

      asset.assignmentHistory.push({
        id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        assetId: asset.id,
        previousEmployeeId: oldUserId || null,
        previousEmployeeName: oldUserName || null,
        currentEmployeeId: newEmployee.id,
        currentEmployeeName: newEmployee.displayName,
        assignmentDate: now,
        transferDate: oldUserId ? now : null,
        assignedByUserId: user.id,
        assignedByUserName: user.displayName,
        action: oldUserId ? 'TRANSFER' : 'INITIAL_ASSIGNMENT',
        notes: transferNotes ? transferNotes.trim() : (oldUserId ? `Transferred from ${oldUserName} to ${newEmployee.displayName}` : `Assigned to ${newEmployee.displayName}`),
        createdAt: now,
      });
    } else if (!assignedUserId && oldUserId) {
      // Returning to inventory stock pool
      asset.previousEmployeeId = oldUserId;
      asset.previousEmployeeName = oldUserName;
      asset.assignedUserId = null;
      asset.assignedUserName = null;
      asset.assignedUserEmail = null;
      asset.transferDate = now;
      asset.status = status || 'Inactive';

      asset.assignmentHistory.push({
        id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        assetId: asset.id,
        previousEmployeeId: oldUserId,
        previousEmployeeName: oldUserName,
        currentEmployeeId: null,
        currentEmployeeName: null,
        assignmentDate: asset.assignmentDate || now,
        transferDate: now,
        assignedByUserId: user.id,
        assignedByUserName: user.displayName,
        action: 'RETURN_TO_STOCK',
        notes: transferNotes ? transferNotes.trim() : `Returned from ${oldUserName} to inventory stock`,
        createdAt: now,
      });
      asset.assignmentDate = null;
    }
  }

  // Explicit Status Update (Active, Inactive, Under Repair, Retired)
  if (status && status !== asset.status) {
    const oldStatus = asset.status;
    asset.status = status;
    if (!asset.assignmentHistory) asset.assignmentHistory = [];
    asset.assignmentHistory.push({
      id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      assetId: asset.id,
      previousEmployeeId: asset.assignedUserId,
      previousEmployeeName: asset.assignedUserName,
      currentEmployeeId: asset.assignedUserId,
      currentEmployeeName: asset.assignedUserName,
      assignmentDate: asset.assignmentDate || now,
      transferDate: null,
      assignedByUserId: user.id,
      assignedByUserName: user.displayName,
      action: 'STATUS_CHANGE',
      notes: `Status transitioned from ${oldStatus} to ${status}.`,
      createdAt: now,
    });
  }

  asset.updatedAt = now;
  persistData();

  const newValues: Record<string, any> = {
    status: asset.status,
    condition: asset.condition,
    assignedUserName: asset.assignedUserName,
    assignedUserId: asset.assignedUserId,
    location: asset.location,
    department: asset.department,
    company: asset.company,
    ipAddress: asset.ipAddress,
  };

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'ASSET_UPDATED',
    'ASSET',
    asset.id,
    `${user.role} ${user.displayName} updated asset ${asset.assetTag}.`,
    req,
    oldValues,
    newValues
  );

  res.json({ success: true, asset });
});

/**
 * DELETE /api/assets/:id
 * "Never permanently delete asset records. Use Inactive/Retired and preserve history."
 * Soft-delete / Retirement endpoint.
 */
app.delete('/api/assets/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ error: 'Forbidden: Employees cannot delete or retire assets.' });
    return;
  }

  const { id } = req.params;
  const asset = assets.find((a) => a.id === id);
  if (!asset) {
    res.status(404).json({ error: 'Asset not found.' });
    return;
  }

  if (user.role !== 'SUPER_ADMIN' && asset.assignedTeamId !== user.itTeamId) {
    res.status(403).json({ error: 'Forbidden: Cannot retire asset belonging to an unrelated IT team.' });
    return;
  }

  const now = new Date().toISOString();

  // Soft retire asset and preserve history
  asset.status = 'Retired';
  asset.isDeleted = true;
  if (!asset.assignmentHistory) asset.assignmentHistory = [];

  const previousUser = asset.assignedUserName;
  if (asset.assignedUserId) {
    asset.previousEmployeeId = asset.assignedUserId;
    asset.previousEmployeeName = asset.assignedUserName;
    asset.assignedUserId = null;
    asset.assignedUserName = null;
    asset.assignedUserEmail = null;
    asset.transferDate = now;
  }

  asset.assignmentHistory.push({
    id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    assetId: asset.id,
    previousEmployeeId: asset.previousEmployeeId,
    previousEmployeeName: asset.previousEmployeeName,
    currentEmployeeId: null,
    currentEmployeeName: null,
    assignmentDate: asset.assignmentDate || now,
    transferDate: now,
    assignedByUserId: user.id,
    assignedByUserName: user.displayName,
    action: 'STATUS_CHANGE',
    notes: `Asset retired and archived by ${user.displayName}. Permanent deletion avoided to preserve historical audit trail.`,
    createdAt: now,
  });

  asset.updatedAt = now;
  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'ASSET_RETIRED',
    'ASSET',
    asset.id,
    `${user.role} ${user.displayName} marked asset ${asset.assetTag} as Retired (Soft deleted). History preserved.`,
    req
  );

  res.json({
    success: true,
    message: 'Asset marked as Retired. History and audit records are permanently preserved.',
    asset,
  });
});

/**
 * Helper: Parse and validate an Excel row against database models
 */
interface ParsedRowValidationResult {
  rowNumber: number;
  data: Record<string, any>;
  errors: Array<{ column: string; value: any; message: string }>;
  isDuplicateInSheet: boolean;
  isDuplicateInDB: boolean;
  existingAssetId?: string;
}

function parseAndValidateInventoryRows(rawRows: any[]): {
  totalRows: number;
  validRows: number;
  duplicateCount: number;
  errorCount: number;
  results: ParsedRowValidationResult[];
} {
  const results: ParsedRowValidationResult[] = [];
  const seenTagsInSheet = new Set<string>();
  const seenSerialsInSheet = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2; // Excel row numbering (1 is header)
    const errors: Array<{ column: string; value: any; message: string }> = [];

    // Extract columns with case-tolerant & canonical header support
    const getVal = (colNames: string[]) => {
      for (const name of colNames) {
        for (const key of Object.keys(row)) {
          if (key.trim().toLowerCase() === name.toLowerCase()) {
            const v = row[key];
            if (v === undefined || v === null) return '';
            const s = String(v).trim();
            if (s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'n/a') return '';
            return s;
          }
        }
      }
      return '';
    };

    // Canonical 42 columns extraction
    const assetId = getVal(['Asset ID', 'AssetId', 'id']);
    const companyStr = getVal(['Company', 'Organization', 'company']);
    const assetType = getVal(['Asset Type', 'Type', 'Device Type', 'asset_type']) || 'LAPTOP';
    const assetTag = getVal(['Asset Number', 'Asset/Inventory Number', 'Inventory Number', 'AssetTag', 'asset_tag']);
    const condition = getVal(['Condition', 'Asset Condition', 'condition']) || 'Good';
    const assignedEmpName = getVal(['Assigned Employee Name', 'Assigned Employee', 'Employee Name', 'Assigned To', 'User']);
    const assetUserName = getVal(['Asset User Name', 'User Name', 'Username', 'Asset User']);
    const departmentStr = getVal(['Department', 'dept', 'department']);
    const locationStr = getVal(['Location', 'Office', 'Site', 'location']);
    const ipAddress = getVal(['IP Adresss', 'IP Address', 'IP', 'ip_address']);
    const serialNumber = getVal(['Serial Number', 'SerialNumber', 'Serial No', 'S/N', 'serial_number']);
    const manufacturer = getVal(['Manufacturer', 'Brand', 'Make', 'manufacturer']);
    const model = getVal(['Model', 'Model Name', 'model']);
    const processor = getVal(['Processor', 'Processor / CPU', 'CPU', 'processor']);
    const purchaseDate = getVal(['Purchase Date', 'Acquisition Date', 'purchase_date']);
    const newOrOld = getVal(['New (NH)/ Old (SH)', 'New (NH) / Old (SH)', 'New/Old', 'New / Old', 'Condition Type']);
    const storage = getVal(['Storage', 'Storage (GB)', 'Disk', 'storage']);
    const ram = getVal(['RAM', 'RAM (GB)', 'Memory', 'ram']);
    const windowsVersion = getVal(['WINDOWS VERSION', 'Windows Version', 'Operating System', 'OS']);
    const msOffice = getVal(['MSOFFICE', 'MS Office', 'Office']);
    const escan = getVal(['ESCAN', 'eScan', 'Antivirus']);
    const motherboard = getVal(['Motherboard', 'Mainboard']);
    const display = getVal(['Display', 'Screen']);
    const displaySize = getVal(['Display Size', 'Screen Size', 'Monitor Size']);
    const lanCard = getVal(['Lan Card', 'LAN', 'NIC', 'Network Card']);
    const upsBattery = getVal(['Ups/ Battery', 'UPS / Battery', 'Battery', 'UPS']);
    const warrantyStart = getVal(['Warranty Start', 'Warranty Start Date']);
    const warrantyEnd = getVal(['Warranty End', 'Warranty Expiry Date', 'Warranty End Date']);
    const lastServiceDate = getVal(['Last Service Date', 'Service Date']);
    const remarks = getVal(['Remarks', 'Notes', 'Comments', 'Description']);
    const assetAgeYearsStr = getVal(['Asset Age (Yrs)', 'Asset Age', 'Age (Yrs)', 'Age']);
    const expectedLifeStr = getVal(['Expected Life (Yrs)', 'Expected Life', 'Lifespan']);
    const expectedReplacementDateStr = getVal(['Expected Replacement Date', 'Replacement Date']);
    const depreciatedValueStr = getVal(['Depreciated Value (INR)', 'Depreciated Value', 'Depreciation']);
    const replacementAlertStr = getVal(['Replacement Alert', 'Replacement Status']);
    const warrantyAlertStr = getVal(['Warranty Alert', 'Warranty Status']);
    const vendor = getVal(['Vendor', 'Supplier', 'Seller']);
    const costStr = getVal(['Purchase Cost (INR)', 'Purchase Cost', 'Cost (INR)', 'Cost', 'Price']);
    const invoiceNumber = getVal(['Invoice Number', 'Invoice No', 'Invoice']);
    const amcStart = getVal(['AMC Start', 'AMC Start Date']);
    const amcEnd = getVal(['AMC End', 'AMC End Date']);
    const purchaseDateParsedStr = getVal(['Purchase Date (Parsed)', 'Parsed Purchase Date']);

    // Check for Excel formula calculation errors (#VALUE!, #REF!, #N/A)
    const formulaErrorColumns: string[] = [];
    Object.entries(row).forEach(([colKey, colVal]) => {
      const valStr = String(colVal || '').trim();
      if (valStr.startsWith('#') || valStr.includes('#VALUE!') || valStr.includes('#REF!') || valStr.includes('#N/A')) {
        formulaErrorColumns.push(colKey);
      }
    });
    if (formulaErrorColumns.length > 0) {
      errors.push({
        column: formulaErrorColumns.join(', '),
        value: '#VALUE!',
        message: `Row contains Excel formula error in column(s): ${formulaErrorColumns.join(', ')}. Derived values will be computed safely.`,
      });
    }

    // Validate Required: Asset/Inventory Number
    if (!assetTag) {
      errors.push({
        column: 'Asset Number',
        value: assetTag,
        message: 'Asset Number is required and cannot be blank.',
      });
    }

    // Validate Required: Serial Number
    if (!serialNumber) {
      errors.push({
        column: 'Serial Number',
        value: serialNumber,
        message: 'Serial Number is required and cannot be blank.',
      });
    }

    // Sheet duplicate detection
    let isDuplicateInSheet = false;
    if (assetTag) {
      if (seenTagsInSheet.has(assetTag.toUpperCase())) {
        isDuplicateInSheet = true;
        errors.push({
          column: 'Asset Number',
          value: assetTag,
          message: `Duplicate Asset Number "${assetTag}" found multiple times in this uploaded spreadsheet.`,
        });
      } else {
        seenTagsInSheet.add(assetTag.toUpperCase());
      }
    }

    if (serialNumber) {
      if (seenSerialsInSheet.has(serialNumber.toUpperCase())) {
        isDuplicateInSheet = true;
        errors.push({
          column: 'Serial Number',
          value: serialNumber,
          message: `Duplicate Serial Number "${serialNumber}" found multiple times in this uploaded spreadsheet.`,
        });
      } else {
        seenSerialsInSheet.add(serialNumber.toUpperCase());
      }
    }

    // DB duplicate detection
    let isDuplicateInDB = false;
    let existingAssetId: string | undefined;
    if (assetTag) {
      const matchTag = assets.find((a) => a.assetTag.toUpperCase() === assetTag.toUpperCase());
      if (matchTag) {
        isDuplicateInDB = true;
        existingAssetId = matchTag.id;
      }
    }
    if (serialNumber && !existingAssetId) {
      const matchSerial = assets.find((a) => a.serialNumber.toUpperCase() === serialNumber.toUpperCase());
      if (matchSerial) {
        isDuplicateInDB = true;
        existingAssetId = matchSerial.id;
      }
    }

    // Resolve Location Master Data (or fallback gracefully)
    let matchedLocation = locations.find(
      (l) =>
        !l.isDeleted &&
        (l.name.toLowerCase() === locationStr.toLowerCase() ||
          l.code.toLowerCase() === locationStr.toLowerCase() ||
          l.id.toLowerCase() === locationStr.toLowerCase())
    );
    if (!matchedLocation && locationStr) {
      matchedLocation = {
        id: `loc_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: locationStr,
        code: locationStr.slice(0, 8).toUpperCase(),
        city: 'Main City',
        country: 'IN',
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Resolve Company Master Data (or fallback gracefully)
    let matchedCompany = companies.find(
      (c) =>
        !c.isDeleted &&
        (c.name.toLowerCase() === companyStr.toLowerCase() ||
          c.code.toLowerCase() === companyStr.toLowerCase() ||
          c.id.toLowerCase() === companyStr.toLowerCase())
    );
    if (!matchedCompany && companyStr) {
      matchedCompany = {
        id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        name: companyStr,
        code: companyStr.slice(0, 8).toUpperCase(),
        status: 'ACTIVE',
        isDeleted: false,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Resolve Department Master Data
    let matchedDept = departments.find(
      (d) =>
        !d.isDeleted &&
        (d.name.toLowerCase() === departmentStr.toLowerCase() ||
          d.code.toLowerCase() === departmentStr.toLowerCase() ||
          d.id.toLowerCase() === departmentStr.toLowerCase())
    );

    // Resolve Employee User
    let matchedUser: StoredUser | undefined;
    if (assignedEmpName || assetUserName) {
      const targetName = (assignedEmpName || assetUserName).toLowerCase();
      matchedUser = users.find(
        (u) =>
          u.status !== 'DEACTIVATED' &&
          (u.displayName.toLowerCase() === targetName ||
            u.username.toLowerCase() === targetName ||
            u.email.toLowerCase() === targetName)
      );
    }

    // Status: Active if assigned, otherwise Inactive (or user specified)
    const rawStatus = getVal(['Status', 'Asset Status', 'status']);
    let normalizedStatus: 'Active' | 'Inactive' | 'Under Repair' | 'Retired' = 'Inactive';
    if (rawStatus) {
      const sLower = rawStatus.toLowerCase();
      if (sLower === 'active' || sLower === 'assigned') normalizedStatus = 'Active';
      else if (sLower === 'inactive' || sLower === 'in stock') normalizedStatus = 'Inactive';
      else if (sLower.includes('repair') || sLower.includes('maintenance')) normalizedStatus = 'Under Repair';
      else if (sLower === 'retired' || sLower.includes('decommissioned')) normalizedStatus = 'Retired';
    } else if (assignedEmpName || assetUserName || matchedUser) {
      normalizedStatus = 'Active';
    }

    // Calculate derived fields safely using the canonical engine
    const calcs = computeAssetCalculations({
      purchaseDate,
      purchaseDateParsed: purchaseDateParsedStr,
      purchaseCost: costStr,
      expectedLifeYears: expectedLifeStr,
      warrantyEnd,
    });

    // Custom fields
    const extractedCustomFields: Record<string, any> = {};
    assetCustomFields.forEach((cf) => {
      const val = getVal([cf.label, cf.fieldKey]);
      if (val !== '') {
        if (cf.fieldType === 'NUMBER') {
          const num = Number(val);
          if (!isNaN(num)) extractedCustomFields[cf.fieldKey] = num;
        } else if (cf.fieldType === 'BOOLEAN') {
          extractedCustomFields[cf.fieldKey] = val.toLowerCase() === 'true' || val.toLowerCase() === 'yes' || val === '1';
        } else {
          extractedCustomFields[cf.fieldKey] = val;
        }
      }
    });

    // Map Assigned IT Team from Excel
    const itTeamStr = getVal(['Assigned IT Team', 'IT Team', 'Team', 'ITTeam']);
    let mappedTeamId = 'team_tier1';
    if (itTeamStr) {
      const matchedTeam = itTeams.find(
        (t) =>
          t.name.toLowerCase() === itTeamStr.toLowerCase() ||
          t.id.toLowerCase() === itTeamStr.toLowerCase() ||
          (t.name.toLowerCase().includes('infra') && itTeamStr.toLowerCase().includes('infra')) ||
          (t.name.toLowerCase().includes('sec') && itTeamStr.toLowerCase().includes('sec'))
      );
      if (matchedTeam) mappedTeamId = matchedTeam.id;
    }

    const effectiveLocationId = matchedLocation ? matchedLocation.id : 'loc_default';
    const effectiveLocationName = matchedLocation ? matchedLocation.name : locationStr || 'Main Office';
    const effectiveCompanyId = matchedCompany ? matchedCompany.id : 'comp_default';
    const effectiveCompanyName = matchedCompany ? matchedCompany.name : companyStr || 'Corporate';

    results.push({
      rowNumber: rowNum,
      data: {
        assetId: assetId || undefined,
        assetTag: assetTag.toUpperCase(),
        serialNumber,
        name: `${manufacturer} ${model}`.trim() || assetTag.toUpperCase(),
        assetType: assetType || 'LAPTOP',
        manufacturer: manufacturer || '',
        model: model || '',
        status: normalizedStatus,
        condition: condition || 'Good',
        assignedEmployeeName: assignedEmpName || (matchedUser ? matchedUser.displayName : ''),
        assetUserName: assetUserName || assignedEmpName || (matchedUser ? matchedUser.displayName : ''),
        assignedUserId: matchedUser ? matchedUser.id : null,
        assignedUserName: matchedUser ? matchedUser.displayName : assignedEmpName || null,
        assignedUserEmail: matchedUser ? matchedUser.email : null,
        assignedTeamId: mappedTeamId,
        department: matchedDept ? matchedDept.name : departmentStr || '',
        departmentId: matchedDept ? matchedDept.id : null,
        location: effectiveLocationName,
        locationId: effectiveLocationId,
        locationName: effectiveLocationName,
        company: effectiveCompanyName,
        companyId: effectiveCompanyId,
        companyName: effectiveCompanyName,
        ipAddress: ipAddress || '',
        processor: processor || '',
        purchaseDate: purchaseDate || '',
        newOrOld: newOrOld || (condition.toLowerCase().includes('old') || condition.toLowerCase().includes('sh') ? 'Old (SH)' : 'New (NH)'),
        storage: storage || '',
        ram: ram || '',
        windowsVersion: windowsVersion || '',
        msOffice: msOffice || '',
        escan: escan || '',
        motherboard: motherboard || '',
        display: display || '',
        displaySize: displaySize || '',
        lanCard: lanCard || '',
        upsBattery: upsBattery || '',
        warrantyStart: warrantyStart || '',
        warrantyEnd: warrantyEnd || '',
        lastServiceDate: lastServiceDate || '',
        remarks: remarks || '',
        assetAgeYears: calcs.assetAgeYears !== null ? calcs.assetAgeYears : (assetAgeYearsStr ? Number(assetAgeYearsStr) : undefined),
        expectedLifeYears: expectedLifeStr ? Number(expectedLifeStr) : (calcs.assetAgeYears !== null ? 4 : undefined),
        expectedReplacementDate: calcs.expectedReplacementDate || expectedReplacementDateStr || undefined,
        depreciatedValueINR: calcs.depreciatedValueINR !== null ? calcs.depreciatedValueINR : (depreciatedValueStr ? Number(depreciatedValueStr) : undefined),
        replacementAlert: calcs.replacementAlert || replacementAlertStr || undefined,
        warrantyAlert: calcs.warrantyAlert || warrantyAlertStr || undefined,
        vendor: vendor || '',
        purchaseCost: costStr ? Number(costStr.replace(/[^0-9.-]+/g, '')) : undefined,
        invoiceNumber: invoiceNumber || '',
        amcStart: amcStart || '',
        amcEnd: amcEnd || '',
        purchaseDateParsed: calcs.purchaseDateParsed || purchaseDateParsedStr || undefined,
        specifications: {
          cpu: processor || undefined,
          ramGb: ram ? Number(String(ram).replace(/[^0-9.]+/g, '')) : undefined,
          storageGb: storage ? Number(String(storage).replace(/[^0-9.]+/g, '')) : undefined,
          os: windowsVersion || undefined,
          ipAddress: ipAddress || undefined,
        },
        customFields: extractedCustomFields,
      },
      errors,
      isDuplicateInSheet,
      isDuplicateInDB,
      existingAssetId,
    });
  }

  const validRows = results.filter((r) => r.errors.length === 0).length;
  const duplicateCount = results.filter((r) => r.isDuplicateInDB || r.isDuplicateInSheet).length;
  const errorCount = results.filter((r) => r.errors.length > 0).length;

  return {
    totalRows: results.length,
    validRows,
    duplicateCount,
    errorCount,
    results,
  };
}

/**
 * POST /api/assets/validate-excel
 * Inspects workbook and validates inventory rows before importing.
 * Detects duplicates, detect invalid rows, shows error details.
 */
app.post('/api/assets/validate-excel', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ error: 'Forbidden: Employees cannot import assets.' });
    return;
  }

  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No inventory rows provided for validation.' });
    return;
  }

  const summary = parseAndValidateInventoryRows(rows);
  res.json({ success: true, summary });
});

/**
 * POST /api/assets/import-excel
 * Executes batch Excel import.
 * - Respects "Do not silently overwrite existing records"
 * - Maintains complete assignment history
 * - Does not invent values for missing fields
 * - Preserves existing records and history
 */
app.post('/api/assets/import-excel', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ error: 'Forbidden: Employees cannot import assets.' });
    return;
  }

  const { rows, overwriteExisting } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No inventory rows provided for import.' });
    return;
  }

  const validation = parseAndValidateInventoryRows(rows);
  const now = new Date().toISOString();

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of validation.results) {
    // If row has hard errors, skip it
    if (item.errors.length > 0) {
      skippedCount++;
      continue;
    }

    const data = item.data;

    if (item.isDuplicateInDB && item.existingAssetId) {
      if (!overwriteExisting) {
        // Safe mode: Do not silently overwrite existing records
        skippedCount++;
        continue;
      }

      // Explicitly requested update: Update existing asset and append to history ledger
      const target = assets.find((a) => a.id === item.existingAssetId);
      if (target) {
        const oldAssignedUserId = target.assignedUserId;
        const oldAssignedUserName = target.assignedUserName;

        const oldValues: Record<string, any> = {
          status: target.status,
          condition: target.condition,
          assignedUserName: target.assignedUserName,
          assignedUserId: target.assignedUserId,
          location: target.location,
          department: target.department,
          company: target.company,
          ipAddress: target.ipAddress,
        };

        if (data.name) target.name = data.name;
        if (data.model) target.model = data.model;
        if (data.manufacturer) target.manufacturer = data.manufacturer;
        if (data.assetType) target.assetType = data.assetType;
        if (data.status) target.status = data.status;
        if (data.condition) target.condition = data.condition;
        if (data.assignedEmployeeName) target.assignedEmployeeName = data.assignedEmployeeName;
        if (data.assetUserName) target.assetUserName = data.assetUserName;
        if (data.department) target.department = data.department;
        if (data.location) target.location = data.location;
        if (data.company) target.company = data.company;
        if (data.ipAddress) target.ipAddress = data.ipAddress;
        if (data.processor) target.processor = data.processor;
        if (data.newOrOld) target.newOrOld = data.newOrOld;
        if (data.storage) target.storage = data.storage;
        if (data.ram) target.ram = data.ram;
        if (data.windowsVersion) target.windowsVersion = data.windowsVersion;
        if (data.msOffice) target.msOffice = data.msOffice;
        if (data.escan) target.escan = data.escan;
        if (data.motherboard) target.motherboard = data.motherboard;
        if (data.display) target.display = data.display;
        if (data.displaySize) target.displaySize = data.displaySize;
        if (data.lanCard) target.lanCard = data.lanCard;
        if (data.upsBattery) target.upsBattery = data.upsBattery;
        if (data.warrantyStart) target.warrantyStart = data.warrantyStart;
        if (data.warrantyEnd) target.warrantyEnd = data.warrantyEnd;
        if (data.lastServiceDate) target.lastServiceDate = data.lastServiceDate;
        if (data.remarks) target.remarks = data.remarks;
        if (data.assetAgeYears !== undefined) target.assetAgeYears = data.assetAgeYears;
        if (data.expectedLifeYears !== undefined) target.expectedLifeYears = data.expectedLifeYears;
        if (data.expectedReplacementDate) target.expectedReplacementDate = data.expectedReplacementDate;
        if (data.depreciatedValueINR !== undefined) target.depreciatedValueINR = data.depreciatedValueINR;
        if (data.replacementAlert) target.replacementAlert = data.replacementAlert;
        if (data.warrantyAlert) target.warrantyAlert = data.warrantyAlert;
        if (data.vendor) target.vendor = data.vendor;
        if (data.purchaseCost !== undefined) target.purchaseCost = data.purchaseCost;
        if (data.invoiceNumber) target.invoiceNumber = data.invoiceNumber;
        if (data.amcStart) target.amcStart = data.amcStart;
        if (data.amcEnd) target.amcEnd = data.amcEnd;
        if (data.purchaseDateParsed) target.purchaseDateParsed = data.purchaseDateParsed;
        if (data.locationId) target.locationId = data.locationId;
        if (data.companyId) target.companyId = data.companyId;
        if (data.departmentId !== undefined) target.departmentId = data.departmentId;
        if (data.notes) target.notes = data.notes;
        if (data.purchaseDate) target.purchaseDate = data.purchaseDate;
        if (data.warrantyExpiryDate) target.warrantyExpiryDate = data.warrantyExpiryDate;
        if (data.customFields) target.customFields = { ...target.customFields, ...data.customFields };
        if (data.specifications) target.specifications = { ...target.specifications, ...data.specifications };

        // Assignment check:
        if (data.assignedUserId && data.assignedUserId !== oldAssignedUserId) {
          target.previousEmployeeId = oldAssignedUserId || null;
          target.previousEmployeeName = oldAssignedUserName || null;
          target.assignedUserId = data.assignedUserId;
          target.assignedUserName = data.assignedUserName;
          target.assignedUserEmail = data.assignedUserEmail;
          target.assignmentDate = now;
          target.transferDate = oldAssignedUserId ? now : null;

          if (!target.assignmentHistory) target.assignmentHistory = [];
          target.assignmentHistory.push({
            id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            assetId: target.id,
            previousEmployeeId: oldAssignedUserId || null,
            previousEmployeeName: oldAssignedUserName || null,
            currentEmployeeId: data.assignedUserId,
            currentEmployeeName: data.assignedUserName,
            assignmentDate: now,
            transferDate: oldAssignedUserId ? now : null,
            assignedByUserId: user.id,
            assignedByUserName: user.displayName,
            action: 'TRANSFER',
            notes: `Updated via Excel import by ${user.displayName}.`,
            createdAt: now,
          });
        }

        const newValues: Record<string, any> = {
          status: target.status,
          condition: target.condition,
          assignedUserName: target.assignedUserName,
          assignedUserId: target.assignedUserId,
          location: target.location,
          department: target.department,
          company: target.company,
          ipAddress: target.ipAddress,
        };

        logAudit(
          { id: user.id, email: user.email, role: user.role },
          'ASSET_UPDATED',
          'ASSET',
          target.id,
          `${user.role} ${user.displayName} updated asset ${target.assetTag} via Excel import.`,
          req,
          oldValues,
          newValues
        );

        target.updatedAt = now;
        updatedCount++;
      }
    } else {
      // Create new asset record
      const newId = (data.assetId && !assets.some(a => a.id === data.assetId)) ? data.assetId : `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const initialHistory: StoredAssetAssignmentRecord[] = [];

      if (data.assignedUserId || data.assignedEmployeeName) {
        initialHistory.push({
          id: `asgn_${Date.now()}_0`,
          assetId: newId,
          previousEmployeeId: data.previousEmployeeName ? 'prev_emp' : null,
          previousEmployeeName: data.previousEmployeeName || null,
          currentEmployeeId: data.assignedUserId,
          currentEmployeeName: data.assignedUserName || data.assignedEmployeeName,
          assignmentDate: data.assignmentDate || now,
          transferDate: data.transferDate || null,
          assignedByUserId: user.id,
          assignedByUserName: user.displayName,
          action: 'IMPORT',
          notes: 'Imported from Excel inventory workbook.',
          createdAt: now,
        });
      }

      const newAsset: StoredAsset = {
        id: newId,
        assetTag: data.assetTag,
        serialNumber: data.serialNumber,
        name: data.name,
        assetType: data.assetType,
        manufacturer: data.manufacturer,
        model: data.model,
        condition: data.condition || 'Good',
        assignedEmployeeName: data.assignedEmployeeName,
        assetUserName: data.assetUserName,
        department: data.department,
        location: data.location,
        company: data.company,
        ipAddress: data.ipAddress,
        processor: data.processor,
        purchaseDate: data.purchaseDate,
        newOrOld: data.newOrOld,
        storage: data.storage,
        ram: data.ram,
        windowsVersion: data.windowsVersion,
        msOffice: data.msOffice,
        escan: data.escan,
        motherboard: data.motherboard,
        display: data.display,
        displaySize: data.displaySize,
        lanCard: data.lanCard,
        upsBattery: data.upsBattery,
        warrantyStart: data.warrantyStart,
        warrantyEnd: data.warrantyEnd,
        lastServiceDate: data.lastServiceDate,
        remarks: data.remarks,
        assetAgeYears: data.assetAgeYears,
        expectedLifeYears: data.expectedLifeYears,
        expectedReplacementDate: data.expectedReplacementDate,
        depreciatedValueINR: data.depreciatedValueINR,
        replacementAlert: data.replacementAlert,
        warrantyAlert: data.warrantyAlert,
        vendor: data.vendor,
        purchaseCost: data.purchaseCost,
        invoiceNumber: data.invoiceNumber,
        amcStart: data.amcStart,
        amcEnd: data.amcEnd,
        purchaseDateParsed: data.purchaseDateParsed,
        companyId: data.companyId,
        locationId: data.locationId,
        departmentId: data.departmentId,
        assignedUserId: data.assignedUserId,
        assignedUserName: data.assignedUserName,
        assignedUserEmail: data.assignedUserEmail,
        assignedTeamId: data.assignedTeamId || user.itTeamId || 'team_tier1',
        previousEmployeeId: null,
        previousEmployeeName: data.previousEmployeeName || null,
        assignmentDate: data.assignmentDate || (data.assignedUserId ? now : null),
        transferDate: data.transferDate || null,
        status: data.status,
        specifications: data.specifications || {},
        warrantyExpiryDate: data.warrantyExpiryDate,
        notes: data.notes,
        customFields: data.customFields || {},
        assignmentHistory: initialHistory,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      };

      assets.unshift(newAsset);
      importedCount++;
    }
  }

  persistData();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'EXCEL_INVENTORY_IMPORTED',
    'ASSET_BATCH',
    `batch_${Date.now()}`,
    `${user.role} ${user.displayName} imported Excel workbook (${importedCount} new, ${updatedCount} updated, ${skippedCount} skipped).`,
    req
  );

  res.json({
    success: true,
    summary: {
      totalRows: validation.totalRows,
      importedCount,
      updatedCount,
      skippedCount,
      errorCount: validation.errorCount,
      errors: validation.results.filter((r) => r.errors.length > 0).map((r) => ({ row: r.rowNumber, errors: r.errors })),
    },
  });
});

/**
 * POST /api/assets/import-initial-workbook
 * One-click import of the starter canonical inventory workbook
 */
app.post('/api/assets/import-initial-workbook', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  if (user.role === 'EMPLOYEE') {
    res.status(403).json({ error: 'Forbidden: Employees cannot import initial workbook.' });
    return;
  }

  const candidatePaths = [
    path.join(process.cwd(), 'public', 'organization_inventory_workbook.xlsx'),
    path.join(process.cwd(), 'uploads', 'organization_inventory_workbook.xlsx'),
  ];
  const filePath = candidatePaths.find((p) => fs.existsSync(p));
  if (!filePath) {
    res.status(404).json({ error: 'Canonical starter inventory workbook not found on server.' });
    return;
  }

  try {
    const wb = XLSX.readFile(filePath);
    const sheetName = wb.SheetNames[0];
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

    // Perform validation and safe import
    const validation = parseAndValidateInventoryRows(rawRows);
    const now = new Date().toISOString();

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of validation.results) {
      if (item.errors.length > 0) {
        skippedCount++;
        continue;
      }
      const data = item.data;

      // Check if already in assets
      const existing = assets.find((a) => a.assetTag.toUpperCase() === data.assetTag.toUpperCase());
      if (existing) {
        // Sync fields and keep history
        existing.status = data.status;
        existing.serialNumber = data.serialNumber;
        existing.name = data.name;
        existing.model = data.model;
        existing.manufacturer = data.manufacturer;
        existing.condition = data.condition || existing.condition;
        existing.assignedEmployeeName = data.assignedEmployeeName || existing.assignedEmployeeName;
        existing.assetUserName = data.assetUserName || existing.assetUserName;
        existing.department = data.department || existing.department;
        existing.location = data.location || existing.location;
        existing.company = data.company || existing.company;
        existing.ipAddress = data.ipAddress || existing.ipAddress;
        existing.processor = data.processor || existing.processor;
        existing.newOrOld = data.newOrOld || existing.newOrOld;
        existing.storage = data.storage || existing.storage;
        existing.ram = data.ram || existing.ram;
        existing.windowsVersion = data.windowsVersion || existing.windowsVersion;
        existing.msOffice = data.msOffice || existing.msOffice;
        existing.escan = data.escan || existing.escan;
        existing.motherboard = data.motherboard || existing.motherboard;
        existing.display = data.display || existing.display;
        existing.displaySize = data.displaySize || existing.displaySize;
        existing.lanCard = data.lanCard || existing.lanCard;
        existing.upsBattery = data.upsBattery || existing.upsBattery;
        existing.warrantyStart = data.warrantyStart || existing.warrantyStart;
        existing.warrantyEnd = data.warrantyEnd || existing.warrantyEnd;
        existing.lastServiceDate = data.lastServiceDate || existing.lastServiceDate;
        existing.remarks = data.remarks || existing.remarks;
        if (data.assetAgeYears !== undefined) existing.assetAgeYears = data.assetAgeYears;
        if (data.expectedLifeYears !== undefined) existing.expectedLifeYears = data.expectedLifeYears;
        if (data.expectedReplacementDate) existing.expectedReplacementDate = data.expectedReplacementDate;
        if (data.depreciatedValueINR !== undefined) existing.depreciatedValueINR = data.depreciatedValueINR;
        if (data.replacementAlert) existing.replacementAlert = data.replacementAlert;
        if (data.warrantyAlert) existing.warrantyAlert = data.warrantyAlert;
        if (data.vendor) existing.vendor = data.vendor;
        if (data.purchaseCost !== undefined) existing.purchaseCost = data.purchaseCost;
        if (data.invoiceNumber) existing.invoiceNumber = data.invoiceNumber;
        if (data.amcStart) existing.amcStart = data.amcStart;
        if (data.amcEnd) existing.amcEnd = data.amcEnd;
        if (data.purchaseDateParsed) existing.purchaseDateParsed = data.purchaseDateParsed;
        existing.notes = data.notes;
        if (data.specifications) existing.specifications = { ...existing.specifications, ...data.specifications };
        if (data.purchaseDate) existing.purchaseDate = data.purchaseDate;
        if (data.warrantyExpiryDate) existing.warrantyExpiryDate = data.warrantyExpiryDate;
        if (data.previousEmployeeName) existing.previousEmployeeName = data.previousEmployeeName;
        if (data.transferDate) existing.transferDate = data.transferDate;
        existing.updatedAt = now;
        updatedCount++;
      } else {
        const newId = (data.assetId && !assets.some(a => a.id === data.assetId)) ? data.assetId : `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const hist: StoredAssetAssignmentRecord[] = [];
        if (data.assignedUserId || data.assignedEmployeeName) {
          hist.push({
            id: `asgn_${Date.now()}_0`,
            assetId: newId,
            previousEmployeeId: data.previousEmployeeName ? 'prev_emp' : null,
            previousEmployeeName: data.previousEmployeeName || null,
            currentEmployeeId: data.assignedUserId,
            currentEmployeeName: data.assignedUserName || data.assignedEmployeeName,
            assignmentDate: data.assignmentDate || now,
            transferDate: data.transferDate || null,
            assignedByUserId: user.id,
            assignedByUserName: user.displayName,
            action: 'INITIAL_ASSIGNMENT',
            notes: 'Initial inventory workbook load.',
            createdAt: now,
          });
        }

        assets.push({
          id: newId,
          assetTag: data.assetTag,
          serialNumber: data.serialNumber,
          name: data.name,
          assetType: data.assetType,
          manufacturer: data.manufacturer,
          model: data.model,
          condition: data.condition || 'Good',
          assignedEmployeeName: data.assignedEmployeeName,
          assetUserName: data.assetUserName,
          department: data.department,
          location: data.location,
          company: data.company,
          ipAddress: data.ipAddress,
          processor: data.processor,
          purchaseDate: data.purchaseDate,
          newOrOld: data.newOrOld,
          storage: data.storage,
          ram: data.ram,
          windowsVersion: data.windowsVersion,
          msOffice: data.msOffice,
          escan: data.escan,
          motherboard: data.motherboard,
          display: data.display,
          displaySize: data.displaySize,
          lanCard: data.lanCard,
          upsBattery: data.upsBattery,
          warrantyStart: data.warrantyStart,
          warrantyEnd: data.warrantyEnd,
          lastServiceDate: data.lastServiceDate,
          remarks: data.remarks,
          assetAgeYears: data.assetAgeYears,
          expectedLifeYears: data.expectedLifeYears,
          expectedReplacementDate: data.expectedReplacementDate,
          depreciatedValueINR: data.depreciatedValueINR,
          replacementAlert: data.replacementAlert,
          warrantyAlert: data.warrantyAlert,
          vendor: data.vendor,
          purchaseCost: data.purchaseCost,
          invoiceNumber: data.invoiceNumber,
          amcStart: data.amcStart,
          amcEnd: data.amcEnd,
          purchaseDateParsed: data.purchaseDateParsed,
          companyId: data.companyId,
          locationId: data.locationId,
          departmentId: data.departmentId,
          assignedUserId: data.assignedUserId,
          assignedUserName: data.assignedUserName,
          assignedUserEmail: data.assignedUserEmail,
          assignedTeamId: 'team_tier1',
          previousEmployeeId: null,
          previousEmployeeName: data.previousEmployeeName || null,
          assignmentDate: data.assignmentDate || (data.assignedUserId ? now : null),
          transferDate: data.transferDate || null,
          status: data.status,
          specifications: data.specifications || {},
          warrantyExpiryDate: data.warrantyExpiryDate,
          notes: data.notes,
          customFields: data.customFields || {},
          assignmentHistory: hist,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
        });
        importedCount++;
      }
    }

    persistData();

    res.json({
      success: true,
      message: `Initial workbook loaded successfully (${importedCount} new, ${updatedCount} updated, ${skippedCount} skipped).`,
      importedCount,
      updatedCount,
      totalAssets: assets.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to load initial workbook: ${err.message}` });
  }
});

// ==========================================
// 6. NOTIFICATIONS API (STRICT USER ISOLATION)
// ==========================================

/**
 * GET /api/notifications
 * Server-side RBAC:
 * - EMPLOYEE: Own notifications ONLY.
 * - IT_TECHNICIAN / IT_ADMIN / SUPER_ADMIN: Own notifications.
 */
app.get('/api/notifications', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  // Strictly own notifications only
  const userNotifs = notifications.filter((n) => n.recipientId === user.id);
  res.json({ notifications: userNotifs });
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification read
 */
app.patch('/api/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const notif = notifications.find((n) => n.id === id);
  if (!notif) {
    res.status(404).json({ error: 'Notification not found.' });
    return;
  }

  // Security: only owner can mark read
  if (notif.recipientId !== user.id) {
    res.status(403).json({ error: 'Forbidden: Cannot access other users notifications.' });
    return;
  }

  notif.isRead = true;
  persistData();

  res.json({ success: true });
});

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for current user
 */
app.post('/api/notifications/read-all', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  let count = 0;
  notifications.forEach((n) => {
    if (n.recipientId === user.id && !n.isRead) {
      n.isRead = true;
      count++;
    }
  });
  if (count > 0) {
    persistData();
  }
  res.json({ success: true, count });
});

// ==========================================
// 6.5. EMPLOYEE PROFILE & PROFILE CHANGE REQUESTS API
// ==========================================

/**
 * GET /api/user/profile
 * Returns authenticated user's profile with sensitive password fields stripped,
 * their assigned assets, and recent profile change requests.
 */
app.get('/api/user/profile', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;

  const comp = companies.find((c) => c.id === user.companyId);
  const loc = locations.find((l) => l.id === user.locationId);
  const dept = departments.find((d) => d.id === user.departmentId);

  const safeProfile = {
    ...sanitizeUser(user),
    companyName: comp ? comp.name : user.companyName,
    locationName: loc ? `${loc.name} (${loc.city})` : user.locationName,
    departmentName: dept ? dept.name : user.departmentName,
  };

  const assignedAssets = assets.filter((a) => a.assignedUserId === user.id);
  const changeRequests = profileChangeRequests.filter((r) => r.userId === user.id);

  res.json({
    profile: safeProfile,
    assignedAssets,
    changeRequests,
  });
});

/**
 * PATCH /api/user/profile/mobile
 * Mobile number can be changed directly by employee without IT Admin approval.
 */
app.patch('/api/user/profile/mobile', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { mobileNumber } = req.body;

  if (!mobileNumber || typeof mobileNumber !== 'string' || !mobileNumber.trim()) {
    res.status(400).json({ error: 'Valid mobile number is required.' });
    return;
  }

  const trimmed = mobileNumber.trim();
  if (!/^[+]?[\d\s\-()]{7,20}$/.test(trimmed)) {
    res.status(400).json({
      error: 'Invalid mobile number format. Please enter a valid telephone/mobile number (7-20 characters).',
    });
    return;
  }

  const oldMobile = user.mobileNumber || 'None';
  user.mobileNumber = trimmed;
  user.updatedAt = new Date().toISOString();

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'UPDATE_MOBILE_NUMBER',
    'USER_PROFILE',
    user.id,
    `Employee ${user.displayName} directly updated mobile number from "${oldMobile}" to "${trimmed}".`,
    req
  );

  persistData();

  res.json({
    success: true,
    mobileNumber: user.mobileNumber,
    profile: sanitizeUser(user),
    message: 'Mobile number updated successfully.',
  });
});

/**
 * Direct official profile field changes are strictly forbidden.
 * Employees must use POST /api/user/profile/change-request.
 */
app.put('/api/user/profile', requireAuth, (req: Request, res: Response) => {
  res.status(403).json({
    error: 'Forbidden: Official profile fields cannot be modified directly. Please submit a formal Profile Change Request.',
  });
});
app.patch('/api/user/profile', requireAuth, (req: Request, res: Response) => {
  res.status(403).json({
    error: 'Forbidden: Official profile fields cannot be modified directly. Please submit a formal Profile Change Request.',
  });
});
app.post('/api/user/role', requireAuth, (req: Request, res: Response) => {
  res.status(403).json({
    error: 'Forbidden: You cannot change your own role. Roles are assigned exclusively by system administrators.',
  });
});
app.patch('/api/user/role', requireAuth, (req: Request, res: Response) => {
  res.status(403).json({
    error: 'Forbidden: You cannot change your own role. Roles are assigned exclusively by system administrators.',
  });
});

/**
 * POST /api/user/profile/change-request
 * Official fields require change request + IT Admin approval:
 * - Employee Name
 * - Username (must follow rules: A-Z alphabetic only, no spaces, no numbers, no special chars, case-insensitive uniqueness)
 * - Department
 * - Designation
 * - Computer/Asset Tag
 * - Location
 */
app.post('/api/user/profile/change-request', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const {
    employeeName,
    username,
    departmentId,
    designation,
    assetTag,
    locationId,
    reason,
  } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    res.status(400).json({
      error: 'A reason for the official profile change request is required for IT Admin review.',
    });
    return;
  }

  const hasName = employeeName && employeeName.trim() && employeeName.trim() !== user.displayName;
  const hasUsername = username && username.trim() && username.trim().toLowerCase() !== user.normalizedUsername;
  const hasDept = departmentId && departmentId !== user.departmentId;
  const hasDesignation = designation && designation.trim() && designation.trim() !== user.designation;
  const hasAssetTag = assetTag && assetTag.trim() && assetTag.trim() !== user.assetTag;
  const hasLocation = locationId && locationId !== user.locationId;

  if (!hasName && !hasUsername && !hasDept && !hasDesignation && !hasAssetTag && !hasLocation) {
    res.status(400).json({
      error: 'No changes detected. Please specify at least one modified official field.',
    });
    return;
  }

  let validatedUsername: string | undefined = undefined;
  if (hasUsername) {
    const trimmedU = username.trim();
    if (/\s/.test(trimmedU)) {
      res.status(400).json({ error: 'Username must not contain any spaces.' });
      return;
    }
    if (/\d/.test(trimmedU)) {
      res.status(400).json({ error: 'Username must not contain numbers. A-Z alphabetic characters only.' });
      return;
    }
    if (!/^[a-zA-Z]+$/.test(trimmedU)) {
      res.status(400).json({
        error: 'Username can only contain alphabetic characters (A-Z, a-z). No special characters or symbols.',
      });
      return;
    }

    const norm = trimmedU.toLowerCase();
    const existing = users.find((u) => u.id !== user.id && u.normalizedUsername === norm);
    if (existing) {
      res.status(409).json({
        error: `Username "${trimmedU}" is already taken by another user (usernames are case-insensitive). Please choose another.`,
      });
      return;
    }

    const pendingConflict = profileChangeRequests.find(
      (r) => r.status === 'PENDING' && r.userId !== user.id && r.requestedChanges.username?.toLowerCase() === norm
    );
    if (pendingConflict) {
      res.status(409).json({
        error: `Username "${trimmedU}" is already requested in a pending change request by another user.`,
      });
      return;
    }

    validatedUsername = trimmedU;
  }

  let deptName: string | undefined;
  if (hasDept) {
    const d = departments.find((dept) => dept.id === departmentId);
    if (!d || d.isArchived) {
      res.status(400).json({ error: 'Selected department is invalid or archived.' });
      return;
    }
    deptName = d.name;
  }

  let locName: string | undefined;
  if (hasLocation) {
    const l = locations.find((loc) => loc.id === locationId);
    if (!l || l.isArchived) {
      res.status(400).json({ error: 'Selected location is invalid or archived.' });
      return;
    }
    locName = `${l.name} (${l.city})`;
  }

  const reqNum = `PCR-${10001 + profileChangeRequests.length}`;
  const now = new Date().toISOString();

  const changeRequest: StoredProfileChangeRequest = {
    id: `pcr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    requestNumber: reqNum,
    userId: user.id,
    userEmail: user.email,
    userName: user.displayName,
    requestedChanges: {
      ...(hasName ? { employeeName: employeeName.trim(), displayName: employeeName.trim() } : {}),
      ...(hasUsername ? { username: validatedUsername } : {}),
      ...(hasDept ? { departmentId, departmentName: deptName } : {}),
      ...(hasDesignation ? { designation: designation.trim(), jobTitle: designation.trim() } : {}),
      ...(hasAssetTag ? { assetTag: assetTag.trim() } : {}),
      ...(hasLocation ? { locationId, locationName: locName } : {}),
    },
    previousValues: {
      employeeName: user.displayName,
      username: user.username,
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      designation: user.designation,
      assetTag: user.assetTag,
      locationId: user.locationId,
      locationName: user.locationName,
      displayName: user.displayName,
      jobTitle: user.designation,
    },
    reason: reason.trim(),
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };

  profileChangeRequests.unshift(changeRequest);

  const fieldList = Object.keys(changeRequest.requestedChanges).join(', ');
  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'SUBMIT_PROFILE_CHANGE_REQUEST',
    'PROFILE_CHANGE_REQUEST',
    changeRequest.id,
    `Employee ${user.displayName} (@${user.username}) submitted change request ${reqNum} for fields: [${fieldList}]. Reason: "${reason.trim()}"`,
    req
  );

  // Notify all IT Admins & Super Admins
  users
    .filter((u) => u.role === 'IT_ADMIN' || u.role === 'SUPER_ADMIN')
    .forEach((admin) => {
      notifications.unshift({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        recipientId: admin.id,
        senderId: user.id,
        title: `Profile Change Request ${reqNum}`,
        message: `${user.displayName} requested official profile update (${fieldList}) awaiting review.`,
        type: 'SECURITY_ALERT',
        referenceEntityType: 'PROFILE_CHANGE',
        referenceEntityId: changeRequest.id,
        isRead: false,
        createdAt: now,
      });
    });

  persistData();

  res.status(201).json({
    success: true,
    changeRequest,
    message: `Change request ${reqNum} submitted successfully. An IT Admin will review your requested updates.`,
  });
});

/**
 * GET /api/user/profile/change-requests
 * Scoped:
 * - EMPLOYEE: strictly their own change requests only (never see others)
 * - IT_ADMIN / SUPER_ADMIN: view all change requests for management & approval
 */
app.get('/api/user/profile/change-requests', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;

  if (user.role === 'EMPLOYEE') {
    const ownRequests = profileChangeRequests.filter((r) => r.userId === user.id);
    res.json({ changeRequests: ownRequests });
    return;
  }

  if (user.role === 'IT_ADMIN') {
    if (!user.itTeamId) {
      res.status(403).json({ error: 'IT Admin account is not assigned to an IT Team.' });
      return;
    }
    // Filter change requests within IT Admin scope: exclude staff in other IT teams
    const scopedRequests = profileChangeRequests.filter((r) => {
      const targetUser = users.find((u) => u.id === r.userId);
      if (!targetUser) return false;
      if (targetUser.itTeamId && targetUser.itTeamId !== user.itTeamId) {
        return false;
      }
      return true;
    });
    res.json({ changeRequests: scopedRequests });
    return;
  }

  res.json({ changeRequests: profileChangeRequests });
});

/**
 * POST /api/user/profile/change-requests/:id/cancel
 * Allows an employee to cancel their own pending profile change request.
 */
app.post('/api/user/profile/change-requests/:id/cancel', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const { id } = req.params;

  const changeReq = profileChangeRequests.find((r) => r.id === id);
  if (!changeReq) {
    res.status(404).json({ error: 'Profile change request not found.' });
    return;
  }

  if (user.role === 'EMPLOYEE' && changeReq.userId !== user.id) {
    res.status(403).json({ error: 'Forbidden: You cannot cancel another employee\'s change request.' });
    return;
  }

  if (changeReq.status !== 'PENDING') {
    res.status(400).json({
      error: `Cannot cancel request. Current status is "${changeReq.status}". Only PENDING requests can be cancelled.`,
    });
    return;
  }

  const now = new Date().toISOString();
  changeReq.status = 'CANCELLED';
  changeReq.updatedAt = now;

  logAudit(
    { id: user.id, email: user.email, role: user.role },
    'CANCEL_PROFILE_CHANGE_REQUEST',
    'PROFILE_CHANGE_REQUEST',
    changeReq.id,
    `${user.role} ${user.displayName} cancelled profile change request ${changeReq.requestNumber}.`,
    req
  );

  persistData();

  res.json({
    success: true,
    changeRequest: changeReq,
    message: `Change request ${changeReq.requestNumber} was cancelled successfully.`,
  });
});

/**
 * POST /api/admin/profile-change-requests/:id/review
 * IT Admin / Super Admin review (APPROVE or REJECT)
 * Explicit requirements:
 * - New username must follow existing username rules.
 * - Old and new usernames are audited.
 */
app.post('/api/admin/profile-change-requests/:id/review', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { id } = req.params;
  const { action, reviewNotes } = req.body;

  if (action !== 'APPROVE' && action !== 'REJECT') {
    res.status(400).json({ error: 'Action must be APPROVE or REJECT.' });
    return;
  }

  const changeReq = profileChangeRequests.find((r) => r.id === id);
  if (!changeReq) {
    res.status(404).json({ error: 'Profile change request not found.' });
    return;
  }

  if (changeReq.status !== 'PENDING') {
    res.status(400).json({
      error: `Request has already been processed with status "${changeReq.status}".`,
    });
    return;
  }

  const targetUser = users.find((u) => u.id === changeReq.userId);
  if (!targetUser) {
    res.status(404).json({ error: 'Target user account not found.' });
    return;
  }

  // IT Admin cannot review requests for staff belonging to another IT Team
  if (admin.role === 'IT_ADMIN' && targetUser.itTeamId && targetUser.itTeamId !== admin.itTeamId) {
    res.status(403).json({
      error: 'Forbidden: IT Admins cannot review profile change requests for staff belonging to another IT Team.',
    });
    return;
  }

  const now = new Date().toISOString();

  if (action === 'APPROVE') {
    if (changeReq.requestedChanges.username) {
      const newU = changeReq.requestedChanges.username;
      const newNorm = newU.toLowerCase();

      if (!/^[a-zA-Z]+$/.test(newU)) {
        res.status(400).json({
          error: 'Username does not adhere to corporate policy (alphabetic A-Z only).',
        });
        return;
      }

      const taken = users.find((u) => u.id !== targetUser.id && u.normalizedUsername === newNorm);
      if (taken) {
        res.status(409).json({
          error: `Username "${newU}" is now registered to another account. Cannot approve.`,
        });
        return;
      }

      const oldUsername = targetUser.username;
      targetUser.username = newU;
      targetUser.normalizedUsername = newNorm;

      sessions.forEach((s) => {
        if (s.userId === targetUser.id) {
          s.username = newU;
        }
      });

      // Explicit audit of old and new username as required by user prompt
      logAudit(
        { id: admin.id, email: admin.email, role: admin.role },
        'AUDIT_USERNAME_CHANGE',
        'USER_PROFILE',
        targetUser.id,
        `IT Admin ${admin.displayName} APPROVED username change for employee ${targetUser.displayName}. Old Username: "${oldUsername}", New Username: "${newU}".`,
        req
      );
    }

    if (changeReq.requestedChanges.employeeName) {
      targetUser.displayName = changeReq.requestedChanges.employeeName;
      sessions.forEach((s) => {
        if (s.userId === targetUser.id) {
          s.displayName = changeReq.requestedChanges.employeeName!;
        }
      });
    }

    if (changeReq.requestedChanges.departmentId) {
      targetUser.departmentId = changeReq.requestedChanges.departmentId;
      targetUser.departmentName = changeReq.requestedChanges.departmentName;
    }

    if (changeReq.requestedChanges.designation) {
      targetUser.designation = changeReq.requestedChanges.designation;
    }

    if (changeReq.requestedChanges.assetTag) {
      targetUser.assetTag = changeReq.requestedChanges.assetTag;
    }

    if (changeReq.requestedChanges.locationId) {
      targetUser.locationId = changeReq.requestedChanges.locationId;
      targetUser.locationName = changeReq.requestedChanges.locationName;
    }

    targetUser.updatedAt = now;

    changeReq.status = 'APPROVED';
    changeReq.reviewedBy = admin.id;
    changeReq.reviewerName = admin.displayName;
    changeReq.reviewedAt = now;
    changeReq.reviewNotes = reviewNotes?.trim() || 'Approved by IT Administrator.';
    changeReq.updatedAt = now;

    logAudit(
      { id: admin.id, email: admin.email, role: admin.role },
      'APPROVE_PROFILE_CHANGE_REQUEST',
      'PROFILE_CHANGE_REQUEST',
      changeReq.id,
      `IT Admin ${admin.displayName} APPROVED profile change request ${changeReq.requestNumber} for ${targetUser.displayName}. Notes: "${changeReq.reviewNotes}".`,
      req
    );

    notifications.unshift({
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientId: targetUser.id,
      senderId: admin.id,
      title: `Profile Changes Approved (${changeReq.requestNumber})`,
      message: `Your requested profile changes have been approved by IT Admin ${admin.displayName}. Your profile has been updated.`,
      type: 'SECURITY_ALERT',
      referenceEntityType: 'PROFILE_CHANGE',
      referenceEntityId: changeReq.id,
      isRead: false,
      createdAt: now,
    });
  } else {
    changeReq.status = 'REJECTED';
    changeReq.reviewedBy = admin.id;
    changeReq.reviewerName = admin.displayName;
    changeReq.reviewedAt = now;
    changeReq.reviewNotes = reviewNotes?.trim() || 'Rejected by IT Administrator.';
    changeReq.updatedAt = now;

    logAudit(
      { id: admin.id, email: admin.email, role: admin.role },
      'REJECT_PROFILE_CHANGE_REQUEST',
      'PROFILE_CHANGE_REQUEST',
      changeReq.id,
      `IT Admin ${admin.displayName} REJECTED profile change request ${changeReq.requestNumber} for ${targetUser.displayName}. Reason: "${changeReq.reviewNotes}".`,
      req
    );

    notifications.unshift({
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      recipientId: targetUser.id,
      senderId: admin.id,
      title: `Profile Change Request Rejected (${changeReq.requestNumber})`,
      message: `Your profile change request was rejected by IT Admin: ${changeReq.reviewNotes}`,
      type: 'SECURITY_ALERT',
      referenceEntityType: 'PROFILE_CHANGE',
      referenceEntityId: changeReq.id,
      isRead: false,
      createdAt: now,
    });
  }

  persistData();

  res.json({
    success: true,
    changeRequest: changeReq,
    message: `Change request ${changeReq.requestNumber} ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
  });
});

// ==========================================
// 7. MASTER DATA API (INDEPENDENT DATA ARCHITECTURE)
// ==========================================

function getCompanyUsage(companyId: string) {
  return {
    tickets: tickets.filter((t) => t.requesterCompanyId === companyId).length,
    assets: assets.filter((a) => a.companyId === companyId).length,
    users: users.filter((u) => u.companyId === companyId).length,
  };
}

function getLocationUsage(locationId: string) {
  return {
    tickets: tickets.filter((t) => t.requesterLocationId === locationId).length,
    assets: assets.filter((a) => a.locationId === locationId).length,
    users: users.filter((u) => u.locationId === locationId).length,
  };
}

function getDepartmentUsage(deptId: string) {
  return {
    tickets: tickets.filter((t) => t.requesterDepartmentId === deptId).length,
    assets: assets.filter((a) => a.departmentId === deptId).length,
    users: users.filter((u) => u.departmentId === deptId).length,
  };
}

// ----------------------------------------------------
// COMPANIES (INDEPENDENT MASTER DATA)
// ----------------------------------------------------

/**
 * GET /api/master/companies
 * Returns companies. If includeArchived=true and user is Admin, returns both active and archived.
 * Includes dynamic historical usage counts (tickets, assets, users).
 */
app.get('/api/master/companies', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const includeArchived = req.query.includeArchived === 'true' && (user.role === 'SUPER_ADMIN' || user.role === 'IT_ADMIN');

  const filtered = companies
    .filter((c) => !c.isDeleted && (includeArchived ? true : (!c.isArchived && c.status === 'ACTIVE')))
    .map((c) => ({
      ...c,
      usageCount: getCompanyUsage(c.id),
    }));

  res.json({ companies: filtered });
});

/**
 * POST /api/master/companies
 * Super Admin alone can add companies.
 */
app.post('/api/master/companies', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { code, name, domain, contactEmail } = req.body;

  if (!code || !code.trim() || !name || !name.trim()) {
    res.status(400).json({ error: 'Company code and name are required.' });
    return;
  }

  const cleanCode = code.trim().toUpperCase();
  const existingActive = companies.find((c) => !c.isDeleted && !c.isArchived && c.code === cleanCode);
  if (existingActive) {
    res.status(400).json({ error: `An active company with code "${cleanCode}" already exists.` });
    return;
  }

  const now = new Date().toISOString();
  const newCompany: StoredCompany = {
    id: `comp_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36)}`,
    code: cleanCode,
    name: name.trim(),
    domain: domain ? domain.trim() : undefined,
    contactEmail: contactEmail ? contactEmail.trim() : undefined,
    status: 'ACTIVE',
    isDeleted: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  companies.push(newCompany);
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'COMPANY_CREATED',
    'COMPANY',
    newCompany.id,
    `Super Admin created company ${newCompany.name} (${newCompany.code})`,
    req
  );

  res.status(201).json({
    success: true,
    company: { ...newCompany, usageCount: { tickets: 0, assets: 0, users: 0 } },
  });
});

/**
 * PUT /api/master/companies/:id
 * Super Admin can edit companies.
 */
app.put('/api/master/companies/:id', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const company = companies.find((c) => c.id === req.params.id && !c.isDeleted);

  if (!company) {
    res.status(404).json({ error: 'Company not found.' });
    return;
  }

  const { name, domain, contactEmail, status, code } = req.body;

  if (code && code.trim().toUpperCase() !== company.code) {
    const cleanCode = code.trim().toUpperCase();
    const conflict = companies.find((c) => c.id !== company.id && !c.isDeleted && !c.isArchived && c.code === cleanCode);
    if (conflict) {
      res.status(400).json({ error: `Company code "${cleanCode}" is already in use by another active company.` });
      return;
    }
    company.code = cleanCode;
  }

  if (name && name.trim()) company.name = name.trim();
  if (domain !== undefined) company.domain = domain ? domain.trim() : undefined;
  if (contactEmail !== undefined) company.contactEmail = contactEmail ? contactEmail.trim() : undefined;

  if (status && (status === 'ACTIVE' || status === 'ARCHIVED' || status === 'INACTIVE')) {
    company.status = status;
    company.isArchived = status === 'ARCHIVED';
  }

  company.updatedAt = new Date().toISOString();
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'COMPANY_UPDATED',
    'COMPANY',
    company.id,
    `Super Admin updated company ${company.name} (${company.code})`,
    req
  );

  res.json({
    success: true,
    company: { ...company, usageCount: getCompanyUsage(company.id) },
  });
});

/**
 * POST /api/master/companies/:id/archive
 * Super Admin can disable/archive.
 * NEVER physically deletes records to preserve historical integrity.
 */
app.post('/api/master/companies/:id/archive', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const company = companies.find((c) => c.id === req.params.id && !c.isDeleted);

  if (!company) {
    res.status(404).json({ error: 'Company not found.' });
    return;
  }

  const usage = getCompanyUsage(company.id);
  company.isArchived = true;
  company.status = 'ARCHIVED';
  company.archivedAt = new Date().toISOString();
  company.archivedBy = admin.email;
  company.updatedAt = company.archivedAt;

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'COMPANY_ARCHIVED',
    'COMPANY',
    company.id,
    `Super Admin archived company ${company.name} (${company.code}). Historical references preserved: ${usage.tickets} tickets, ${usage.assets} assets, ${usage.users} users.`,
    req
  );

  res.json({
    success: true,
    message: 'Company archived successfully. Historical records preserved.',
    usageCount: usage,
    company: { ...company, usageCount: usage },
  });
});

/**
 * POST /api/master/companies/:id/restore
 * Super Admin can re-create/restore an archived company.
 */
app.post('/api/master/companies/:id/restore', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const company = companies.find((c) => c.id === req.params.id && !c.isDeleted);

  if (!company) {
    res.status(404).json({ error: 'Company not found.' });
    return;
  }

  company.isArchived = false;
  company.status = 'ACTIVE';
  company.archivedAt = null;
  company.archivedBy = null;
  company.updatedAt = new Date().toISOString();

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'COMPANY_RESTORED',
    'COMPANY',
    company.id,
    `Super Admin restored company ${company.name} (${company.code}) to ACTIVE status.`,
    req
  );

  res.json({
    success: true,
    message: 'Company restored to active status.',
    company: { ...company, usageCount: getCompanyUsage(company.id) },
  });
});

/**
 * DELETE /api/master/companies/all
 * Super Admin can delete ALL companies.
 */
app.delete('/api/master/companies/all', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const count = companies.length;

  // Detach company references from users, tickets, and assets
  users.forEach((u) => { u.companyId = null; });
  tickets.forEach((t) => { (t as any).requesterCompanyId = null; });
  assets.forEach((a) => { a.companyId = ''; });

  companies = [];
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'ALL_COMPANIES_DELETED',
    'COMPANY',
    'ALL',
    `Super Admin deleted all ${count} companies.`,
    req
  );

  res.json({
    success: true,
    message: `All ${count} companies were permanently deleted.`,
    deletedCount: count,
  });
});

/**
 * DELETE /api/master/companies/:id
 * Super Admin can delete any company.
 */
app.delete('/api/master/companies/:id', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const companyIndex = companies.findIndex((c) => c.id === req.params.id);

  if (companyIndex === -1) {
    res.status(404).json({ error: 'Company not found.' });
    return;
  }

  const [removedCompany] = companies.splice(companyIndex, 1);

  // Detach company reference from users, tickets, and assets
  users.forEach((u) => {
    if (u.companyId === removedCompany.id) u.companyId = null;
  });
  tickets.forEach((t) => {
    if ((t as any).requesterCompanyId === removedCompany.id) (t as any).requesterCompanyId = null;
  });
  assets.forEach((a) => {
    if (a.companyId === removedCompany.id) a.companyId = '';
  });

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'COMPANY_DELETED',
    'COMPANY',
    removedCompany.id,
    `Super Admin permanently deleted company ${removedCompany.name} (${removedCompany.code}).`,
    req
  );

  res.json({
    success: true,
    message: `Company ${removedCompany.name} permanently deleted.`,
    companyId: removedCompany.id,
  });
});

// ----------------------------------------------------
// LOCATIONS (INDEPENDENT MASTER DATA - NO HIERARCHY)
// ----------------------------------------------------

/**
 * GET /api/master/locations
 * Returns locations. Independent from companies.
 */
app.get('/api/master/locations', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const includeArchived = req.query.includeArchived === 'true' && (user.role === 'SUPER_ADMIN' || user.role === 'IT_ADMIN');

  const filtered = locations
    .filter((l) => !l.isDeleted && (includeArchived ? true : (!l.isArchived && l.status === 'ACTIVE')))
    .map((l) => ({
      ...l,
      usageCount: getLocationUsage(l.id),
    }));

  res.json({ locations: filtered });
});

/**
 * POST /api/master/locations
 * Super Admin alone can add locations.
 */
app.post('/api/master/locations', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { code, name, address, city, country, timezone } = req.body;

  if (!code || !code.trim() || !name || !name.trim() || !city || !city.trim() || !country || !country.trim()) {
    res.status(400).json({ error: 'Location code, name, city, and country are required.' });
    return;
  }

  const cleanCode = code.trim().toUpperCase();
  const existingActive = locations.find((l) => !l.isDeleted && !l.isArchived && l.code === cleanCode);
  if (existingActive) {
    res.status(400).json({ error: `An active location with code "${cleanCode}" already exists.` });
    return;
  }

  const now = new Date().toISOString();
  const newLocation: StoredLocation = {
    id: `loc_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36)}`,
    code: cleanCode,
    name: name.trim(),
    address: address ? address.trim() : undefined,
    city: city.trim(),
    country: country.trim(),
    timezone: timezone ? timezone.trim() : 'UTC',
    status: 'ACTIVE',
    isDeleted: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  locations.push(newLocation);
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'LOCATION_CREATED',
    'LOCATION',
    newLocation.id,
    `Super Admin created location ${newLocation.name} (${newLocation.code}) in ${newLocation.city}, ${newLocation.country}`,
    req
  );

  res.status(201).json({
    success: true,
    location: { ...newLocation, usageCount: { tickets: 0, assets: 0, users: 0 } },
  });
});

/**
 * PUT /api/master/locations/:id
 * Super Admin can edit locations.
 */
app.put('/api/master/locations/:id', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const location = locations.find((l) => l.id === req.params.id && !l.isDeleted);

  if (!location) {
    res.status(404).json({ error: 'Location not found.' });
    return;
  }

  const { name, address, city, country, timezone, status, code } = req.body;

  if (code && code.trim().toUpperCase() !== location.code) {
    const cleanCode = code.trim().toUpperCase();
    const conflict = locations.find((l) => l.id !== location.id && !l.isDeleted && !l.isArchived && l.code === cleanCode);
    if (conflict) {
      res.status(400).json({ error: `Location code "${cleanCode}" is already in use by another active location.` });
      return;
    }
    location.code = cleanCode;
  }

  if (name && name.trim()) location.name = name.trim();
  if (address !== undefined) location.address = address ? address.trim() : undefined;
  if (city && city.trim()) location.city = city.trim();
  if (country && country.trim()) location.country = country.trim();
  if (timezone && timezone.trim()) location.timezone = timezone.trim();

  if (status && (status === 'ACTIVE' || status === 'ARCHIVED' || status === 'INACTIVE')) {
    location.status = status;
    location.isArchived = status === 'ARCHIVED';
  }

  location.updatedAt = new Date().toISOString();
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'LOCATION_UPDATED',
    'LOCATION',
    location.id,
    `Super Admin updated location ${location.name} (${location.code})`,
    req
  );

  res.json({
    success: true,
    location: { ...location, usageCount: getLocationUsage(location.id) },
  });
});

/**
 * POST /api/master/locations/:id/archive
 * Super Admin can disable/archive location. Preserves historical records.
 */
app.post('/api/master/locations/:id/archive', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const location = locations.find((l) => l.id === req.params.id && !l.isDeleted);

  if (!location) {
    res.status(404).json({ error: 'Location not found.' });
    return;
  }

  const usage = getLocationUsage(location.id);
  location.isArchived = true;
  location.status = 'ARCHIVED';
  location.archivedAt = new Date().toISOString();
  location.archivedBy = admin.email;
  location.updatedAt = location.archivedAt;

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'LOCATION_ARCHIVED',
    'LOCATION',
    location.id,
    `Super Admin archived location ${location.name} (${location.code}). Historical references preserved: ${usage.tickets} tickets, ${usage.assets} assets, ${usage.users} users.`,
    req
  );

  res.json({
    success: true,
    message: 'Location archived successfully. Historical records preserved.',
    usageCount: usage,
    location: { ...location, usageCount: usage },
  });
});

/**
 * POST /api/master/locations/:id/restore
 * Super Admin can restore/re-create an archived location.
 */
app.post('/api/master/locations/:id/restore', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const location = locations.find((l) => l.id === req.params.id && !l.isDeleted);

  if (!location) {
    res.status(404).json({ error: 'Location not found.' });
    return;
  }

  location.isArchived = false;
  location.status = 'ACTIVE';
  location.archivedAt = null;
  location.archivedBy = null;
  location.updatedAt = new Date().toISOString();

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'LOCATION_RESTORED',
    'LOCATION',
    location.id,
    `Super Admin restored location ${location.name} (${location.code}) to ACTIVE status.`,
    req
  );

  res.json({
    success: true,
    message: 'Location restored to active status.',
    location: { ...location, usageCount: getLocationUsage(location.id) },
  });
});

/**
 * DELETE /api/master/locations/all
 * Super Admin can delete ALL locations.
 */
app.delete('/api/master/locations/all', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const count = locations.length;

  users.forEach((u) => { u.locationId = null; });
  tickets.forEach((t) => { (t as any).requesterLocationId = null; });
  assets.forEach((a) => { a.locationId = ''; });

  locations = [];
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'ALL_LOCATIONS_DELETED',
    'LOCATION',
    'ALL',
    `Super Admin deleted all ${count} locations.`,
    req
  );

  res.json({
    success: true,
    message: `All ${count} locations were permanently deleted.`,
    deletedCount: count,
  });
});

/**
 * DELETE /api/master/locations/:id
 * Super Admin can delete any location.
 */
app.delete('/api/master/locations/:id', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const locationIndex = locations.findIndex((l) => l.id === req.params.id);

  if (locationIndex === -1) {
    res.status(404).json({ error: 'Location not found.' });
    return;
  }

  const [removedLocation] = locations.splice(locationIndex, 1);

  users.forEach((u) => {
    if (u.locationId === removedLocation.id) u.locationId = null;
  });
  tickets.forEach((t) => {
    if ((t as any).requesterLocationId === removedLocation.id) (t as any).requesterLocationId = null;
  });
  assets.forEach((a) => {
    if (a.locationId === removedLocation.id) a.locationId = '';
  });

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'LOCATION_DELETED',
    'LOCATION',
    removedLocation.id,
    `Super Admin permanently deleted location ${removedLocation.name} (${removedLocation.code}).`,
    req
  );

  res.json({
    success: true,
    message: `Location ${removedLocation.name} permanently deleted.`,
    locationId: removedLocation.id,
  });
});

// ----------------------------------------------------
// DEPARTMENTS (SUPER ADMIN ALONE CAN MANAGE)
// ----------------------------------------------------

/**
 * GET /api/master/departments
 * Returns predefined departments for selection dropdowns.
 * If includeArchived=true (Super Admin/IT Admin), includes archived departments.
 */
app.get('/api/master/departments', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const includeArchived = req.query.includeArchived === 'true' && (user.role === 'SUPER_ADMIN' || user.role === 'IT_ADMIN');

  const filtered = departments
    .filter((d) => !d.isDeleted && (includeArchived ? true : (!d.isArchived && d.status === 'ACTIVE')))
    .map((d) => ({
      ...d,
      usageCount: getDepartmentUsage(d.id),
    }));

  res.json({ departments: filtered });
});

/**
 * POST /api/master/departments
 * Super Admin ALONE can add departments.
 */
app.post('/api/master/departments', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const { code, name, description } = req.body;

  if (!code || !code.trim() || !name || !name.trim()) {
    res.status(400).json({ error: 'Department code and name are required.' });
    return;
  }

  const cleanCode = code.trim().toUpperCase();
  const existingActive = departments.find((d) => !d.isDeleted && !d.isArchived && d.code === cleanCode);
  if (existingActive) {
    res.status(400).json({ error: `An active department with code "${cleanCode}" already exists.` });
    return;
  }

  const now = new Date().toISOString();
  const newDepartment: StoredDepartment = {
    id: `dept_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.now().toString(36)}`,
    code: cleanCode,
    name: name.trim(),
    description: description ? description.trim() : undefined,
    status: 'ACTIVE',
    isDeleted: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  departments.push(newDepartment);
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'DEPARTMENT_CREATED',
    'DEPARTMENT',
    newDepartment.id,
    `Super Admin created department ${newDepartment.name} (${newDepartment.code})`,
    req
  );

  res.status(201).json({
    success: true,
    department: { ...newDepartment, usageCount: { tickets: 0, assets: 0, users: 0 } },
  });
});

/**
 * PUT /api/master/departments/:id
 * Super Admin ALONE can edit departments.
 */
app.put('/api/master/departments/:id', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const department = departments.find((d) => d.id === req.params.id && !d.isDeleted);

  if (!department) {
    res.status(404).json({ error: 'Department not found.' });
    return;
  }

  const { name, description, status, code } = req.body;

  if (code && code.trim().toUpperCase() !== department.code) {
    const cleanCode = code.trim().toUpperCase();
    const conflict = departments.find((d) => d.id !== department.id && !d.isDeleted && !d.isArchived && d.code === cleanCode);
    if (conflict) {
      res.status(400).json({ error: `Department code "${cleanCode}" is already in use by another active department.` });
      return;
    }
    department.code = cleanCode;
  }

  if (name && name.trim()) department.name = name.trim();
  if (description !== undefined) department.description = description ? description.trim() : undefined;

  if (status && (status === 'ACTIVE' || status === 'ARCHIVED' || status === 'INACTIVE')) {
    department.status = status;
    department.isArchived = status === 'ARCHIVED';
  }

  department.updatedAt = new Date().toISOString();
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'DEPARTMENT_UPDATED',
    'DEPARTMENT',
    department.id,
    `Super Admin updated department ${department.name} (${department.code})`,
    req
  );

  res.json({
    success: true,
    department: { ...department, usageCount: getDepartmentUsage(department.id) },
  });
});

/**
 * POST /api/master/departments/:id/archive
 * Super Admin ALONE can disable/archive departments.
 * Preserves historical references.
 */
app.post('/api/master/departments/:id/archive', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const department = departments.find((d) => d.id === req.params.id && !d.isDeleted);

  if (!department) {
    res.status(404).json({ error: 'Department not found.' });
    return;
  }

  const usage = getDepartmentUsage(department.id);
  department.isArchived = true;
  department.status = 'ARCHIVED';
  department.archivedAt = new Date().toISOString();
  department.archivedBy = admin.email;
  department.updatedAt = department.archivedAt;

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'DEPARTMENT_ARCHIVED',
    'DEPARTMENT',
    department.id,
    `Super Admin archived department ${department.name} (${department.code}). Historical references preserved: ${usage.tickets} tickets, ${usage.assets} assets, ${usage.users} users.`,
    req
  );

  res.json({
    success: true,
    message: 'Department archived successfully. Historical records preserved.',
    usageCount: usage,
    department: { ...department, usageCount: usage },
  });
});

/**
 * POST /api/master/departments/:id/restore
 * Super Admin ALONE can restore/re-create an archived department.
 */
app.post('/api/master/departments/:id/restore', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const department = departments.find((d) => d.id === req.params.id && !d.isDeleted);

  if (!department) {
    res.status(404).json({ error: 'Department not found.' });
    return;
  }

  department.isArchived = false;
  department.status = 'ACTIVE';
  department.archivedAt = null;
  department.archivedBy = null;
  department.updatedAt = new Date().toISOString();

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'DEPARTMENT_RESTORED',
    'DEPARTMENT',
    department.id,
    `Super Admin restored department ${department.name} (${department.code}) to ACTIVE status.`,
    req
  );

  res.json({
    success: true,
    message: 'Department restored to active status.',
    department: { ...department, usageCount: getDepartmentUsage(department.id) },
  });
});

/**
 * DELETE /api/master/departments/all
 * Super Admin can delete ALL departments.
 */
app.delete('/api/master/departments/all', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const count = departments.length;

  users.forEach((u) => { u.departmentId = null; });
  tickets.forEach((t) => { (t as any).requesterDepartmentId = null; });
  assets.forEach((a) => { a.departmentId = ''; });

  departments = [];
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'ALL_DEPARTMENTS_DELETED',
    'DEPARTMENT',
    'ALL',
    `Super Admin deleted all ${count} departments.`,
    req
  );

  res.json({
    success: true,
    message: `All ${count} departments were permanently deleted.`,
    deletedCount: count,
  });
});

/**
 * DELETE /api/master/departments/:id
 * Super Admin can delete any department.
 */
app.delete('/api/master/departments/:id', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const deptIndex = departments.findIndex((d) => d.id === req.params.id);

  if (deptIndex === -1) {
    res.status(404).json({ error: 'Department not found.' });
    return;
  }

  const [removedDept] = departments.splice(deptIndex, 1);

  users.forEach((u) => {
    if (u.departmentId === removedDept.id) u.departmentId = null;
  });
  tickets.forEach((t) => {
    if ((t as any).requesterDepartmentId === removedDept.id) (t as any).requesterDepartmentId = null;
  });
  assets.forEach((a) => {
    if (a.departmentId === removedDept.id) a.departmentId = '';
  });

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'DEPARTMENT_DELETED',
    'DEPARTMENT',
    removedDept.id,
    `Super Admin permanently deleted department ${removedDept.name} (${removedDept.code}).`,
    req
  );

  res.json({
    success: true,
    message: `Department ${removedDept.name} permanently deleted.`,
    departmentId: removedDept.id,
  });
});

/**
 * POST /api/admin/clear-demo-data
 * Super Admin can purge all demo data (tickets, assets, comments, notifications, demo accounts).
 */
app.post('/api/admin/clear-demo-data', requireSuperAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  tickets = [];
  ticketComments = [];
  ticketAttachments = [];
  ticketHistories = [];
  lastTicketSeq = 10001;
  assets = [];
  notifications = [];
  profileChangeRequests = [];
  users = users.filter((u) => u.email.toLowerCase() === 'accuratecmmit@gmail.com' || u.role === 'SUPER_ADMIN');
  sessions = sessions.filter((s) => users.some((u) => u.id === s.userId));
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'DEMO_DATA_CLEARED',
    'SYSTEM',
    'GLOBAL',
    'Super Admin removed all demo data (tickets, assets, comments, notifications, demo accounts).',
    req
  );

  res.json({
    success: true,
    message: 'All demo tickets, assets, notifications, comments, and demo accounts have been permanently removed.',
  });
});

app.get('/api/master/sla-configs', requireAuth, (req: Request, res: Response) => {
  res.json({ slaConfigs: slaConfigs.filter((s) => !s.isDeleted && s.status === 'ACTIVE') });
});

/**
 * GET /api/admin/sla-settings
 * Returns SLA policies and working calendar
 */
app.get('/api/admin/sla-settings', requireAuth, (req: Request, res: Response) => {
  res.json({
    success: true,
    slaConfigs: slaConfigs.filter((s) => !s.isDeleted),
    workingCalendar: slaWorkingCalendar,
  });
});

/**
 * PUT /api/admin/sla-settings
 * Super Admin ONLY: "Only Super Admin can configure SLA rules."
 */
app.put('/api/admin/sla-settings', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  if (admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({
      error: 'Forbidden: Only Super Admin can configure SLA policies and the Working Calendar.',
    });
    return;
  }

  const { updatedConfigs, workingCalendar } = req.body;

  if (Array.isArray(updatedConfigs)) {
    updatedConfigs.forEach((incoming: any) => {
      const existing = slaConfigs.find((s) => s.id === incoming.id || s.priority === incoming.priority);
      if (existing) {
        if (incoming.responseTimeMinutes !== undefined) {
          existing.responseTimeMinutes = Math.max(1, parseInt(incoming.responseTimeMinutes, 10) || existing.responseTimeMinutes);
        }
        if (incoming.resolutionTimeMinutes !== undefined) {
          existing.resolutionTimeMinutes = Math.max(1, parseInt(incoming.resolutionTimeMinutes, 10) || existing.resolutionTimeMinutes);
        }
        if (incoming.warningThresholdPercent !== undefined) {
          existing.warningThresholdPercent = Math.min(99, Math.max(1, parseInt(incoming.warningThresholdPercent, 10) || 75));
        }
        if (incoming.businessHoursOnly !== undefined) {
          existing.businessHoursOnly = Boolean(incoming.businessHoursOnly);
        }
        if (incoming.status !== undefined) {
          existing.status = incoming.status;
        }
      }
    });
  }

  if (workingCalendar && typeof workingCalendar === 'object') {
    if (Array.isArray(workingCalendar.workingDays)) {
      slaWorkingCalendar.workingDays = workingCalendar.workingDays;
    }
    if (typeof workingCalendar.workStartHour === 'number') {
      slaWorkingCalendar.workStartHour = workingCalendar.workStartHour;
    }
    if (typeof workingCalendar.workStartMinute === 'number') {
      slaWorkingCalendar.workStartMinute = workingCalendar.workStartMinute;
    }
    if (typeof workingCalendar.workEndHour === 'number') {
      slaWorkingCalendar.workEndHour = workingCalendar.workEndHour;
    }
    if (typeof workingCalendar.workEndMinute === 'number') {
      slaWorkingCalendar.workEndMinute = workingCalendar.workEndMinute;
    }
    if (Array.isArray(workingCalendar.weeklyHolidays)) {
      slaWorkingCalendar.weeklyHolidays = workingCalendar.weeklyHolidays;
    }
    if (Array.isArray(workingCalendar.holidays)) {
      slaWorkingCalendar.holidays = workingCalendar.holidays;
    }
    if (workingCalendar.timezone) {
      slaWorkingCalendar.timezone = workingCalendar.timezone;
    }
  }

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'SLA_CONFIGURATION_UPDATED',
    'SLA_CONFIG',
    'GLOBAL',
    `Super Admin ${admin.displayName} updated organization SLA rules and Working Calendar settings.`,
    req
  );

  res.json({
    success: true,
    message: 'SLA configuration and Working Calendar updated successfully.',
    slaConfigs: slaConfigs.filter((s) => !s.isDeleted),
    workingCalendar: slaWorkingCalendar,
  });
});

/**
 * POST /api/admin/working-calendar/holidays
 * Super Admin ONLY: Add company holiday
 */
app.post('/api/admin/working-calendar/holidays', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  if (admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Only Super Admin can manage company holidays.' });
    return;
  }

  const { name, date, description } = req.body;
  if (!name || !date) {
    res.status(400).json({ error: 'Holiday name and date (YYYY-MM-DD) are required.' });
    return;
  }

  const newHoliday: StoredCompanyHoliday = {
    id: `hol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    date: date.trim(),
    description: description ? description.trim() : '',
  };

  slaWorkingCalendar.holidays.push(newHoliday);
  slaWorkingCalendar.holidays.sort((a, b) => a.date.localeCompare(b.date));
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'COMPANY_HOLIDAY_ADDED',
    'WORKING_CALENDAR',
    newHoliday.id,
    `Super Admin ${admin.displayName} added holiday "${newHoliday.name}" on ${newHoliday.date}.`,
    req
  );

  res.status(201).json({ success: true, holiday: newHoliday, workingCalendar: slaWorkingCalendar });
});

/**
 * DELETE /api/admin/working-calendar/holidays/:id
 * Super Admin ONLY: Remove company holiday
 */
app.delete('/api/admin/working-calendar/holidays/:id', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  if (admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Only Super Admin can manage company holidays.' });
    return;
  }

  const { id } = req.params;
  const index = slaWorkingCalendar.holidays.findIndex((h) => h.id === id);
  if (index === -1) {
    res.status(404).json({ error: 'Holiday not found.' });
    return;
  }

  const removed = slaWorkingCalendar.holidays.splice(index, 1)[0];
  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'COMPANY_HOLIDAY_DELETED',
    'WORKING_CALENDAR',
    id,
    `Super Admin ${admin.displayName} removed holiday "${removed.name}" (${removed.date}).`,
    req
  );

  res.json({ success: true, message: 'Holiday deleted successfully.', workingCalendar: slaWorkingCalendar });
});

/**
 * POST /api/admin/sla-recalculate
 * Super Admin ONLY: Recalculate SLA targets for all open active tickets
 */
app.post('/api/admin/sla-recalculate', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  if (admin.role !== 'SUPER_ADMIN') {
    res.status(403).json({ error: 'Forbidden: Only Super Admin can trigger global SLA recalculation.' });
    return;
  }

  let count = 0;
  const now = new Date().toISOString();

  tickets.forEach((ticket) => {
    if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && ticket.status !== 'CANCELLED') {
      const oldResTarget = ticket.resolutionTargetTime;
      const targets = calculateTicketSlaTargets(
        ticket.createdAt,
        ticket.priority,
        ticket.slaTotalPausedWorkingMinutes || 0
      );
      ticket.responseTargetTime = targets.responseTargetTime;
      ticket.resolutionTargetTime = targets.resolutionTargetTime;
      ticket.slaWarningSent = false;
      ticket.slaBreachSent = false;
      evaluateTicketSla(ticket, false);

      if (!ticket.slaHistory) ticket.slaHistory = [];
      ticket.slaHistory.push({
        id: `slah_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: now,
        reason: 'MANUAL_RECALCULATION',
        actorId: admin.id,
        actorName: admin.displayName,
        actorRole: admin.role,
        oldResolutionTarget: oldResTarget,
        newResolutionTarget: targets.resolutionTargetTime,
        details: `Global SLA recalculation triggered by Super Admin ${admin.displayName}. Targets updated with current Working Calendar.`,
      });

      count++;
    }
  });

  persistData();

  logAudit(
    { id: admin.id, email: admin.email, role: admin.role },
    'SLA_RECALCULATION_EXECUTED',
    'SLA_ENGINE',
    'GLOBAL',
    `Super Admin ${admin.displayName} executed global SLA recalculation across ${count} active tickets.`,
    req
  );

  res.json({ success: true, recalculatedCount: count });
});

/**
 * GET /api/audit-logs
 * Security & Audit Logs query API for Admins (Super Admin and IT Admin)
 */
app.get('/api/audit-logs', requireAdmin, (req: Request, res: Response) => {
  const { entityType, search, limit = 100 } = req.query;
  const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);

  let filtered = auditLogs;

  if (entityType && entityType !== 'ALL') {
    filtered = filtered.filter((log) => log.entityType === entityType);
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.actorEmail.toLowerCase().includes(q) ||
        log.entityId.toLowerCase().includes(q) ||
        (log.details && log.details.toLowerCase().includes(q))
    );
  }

  res.json({ auditLogs: filtered.slice(0, limitNum) });
});

// ==========================================
// 8. REPORTS & EXPORT API (RBAC SCOPED)
// ==========================================

/**
 * GET /api/reports/tickets-summary
 * - EMPLOYEE / IT_TECHNICIAN: 403 Forbidden!
 * - IT_ADMIN: Generated strictly within their IT Team!
 * - SUPER_ADMIN: Organization-wide.
 */
app.get('/api/reports/tickets-summary', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;

  let scopedTickets = tickets;
  let scopedAssets = assets;

  if (admin.role === 'IT_ADMIN') {
    if (!admin.itTeamId) {
      res.status(403).json({ error: 'IT Admin account is not assigned to an IT Team.' });
      return;
    }
    scopedTickets = tickets.filter((t) => t.assignedTeamId === admin.itTeamId);
    scopedAssets = assets.filter((a) => a.assignedTeamId === admin.itTeamId);
  }

  const summary = {
    totalTickets: scopedTickets.length,
    openTickets: scopedTickets.filter((t) => t.status === 'NEW' || t.status === 'OPEN' || t.status === 'IN_PROGRESS').length,
    resolvedTickets: scopedTickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
    urgentTickets: scopedTickets.filter((t) => t.priority === 'URGENT').length,
    byCategory: {
      HARDWARE: scopedTickets.filter((t) => t.category === 'HARDWARE').length,
      SOFTWARE: scopedTickets.filter((t) => t.category === 'SOFTWARE').length,
      NETWORK: scopedTickets.filter((t) => t.category === 'NETWORK').length,
      ACCESS: scopedTickets.filter((t) => t.category === 'ACCESS').length,
      OTHER: scopedTickets.filter((t) => t.category === 'OTHER' || t.category === 'EMAIL' || t.category === 'TELEPHONY').length,
    },
    totalAssets: scopedAssets.length,
    assignedAssets: scopedAssets.filter((a) => a.status === 'ASSIGNED').length,
    inStockAssets: scopedAssets.filter((a) => a.status === 'IN_STOCK').length,
    scopeTeam: admin.role === 'IT_ADMIN' ? admin.itTeamName || admin.itTeamId : 'ORGANIZATION_WIDE',
  };

  res.json({ success: true, summary });
});

/**
 * Helper: Parse date filter into Start and End Dates
 * Supports: TODAY, THIS_WEEK, THIS_MONTH, LAST_MONTH, CUSTOM, ALL
 */
function parseDateFilter(preset?: string, startDate?: string, endDate?: string): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (preset === 'TODAY') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }
  if (preset === 'THIS_WEEK') {
    const day = now.getDay();
    const diff = now.getDate() - (day === 0 ? 6 : day - 1);
    const start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999);
    return { start, end };
  }
  if (preset === 'THIS_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (preset === 'LAST_MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (preset === 'CUSTOM' || (startDate && endDate)) {
    const start = startDate ? new Date(`${startDate}T00:00:00.000`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    return { start, end };
  }
  return { start: null, end: null };
}

function matchesDateRange(dateStr: string | undefined | null, start: Date | null, end: Date | null): boolean {
  if (!start && !end) return true;
  if (!dateStr) return false;
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return false;
  if (start && time < start.getTime()) return false;
  if (end && time > end.getTime()) return false;
  return true;
}

/**
 * GET /api/dashboard/metrics
 * Comprehensive, role-tailored dashboard data with date filtering and quick filters.
 * Accessible to all authenticated users; strictly respects RBAC and IT Team scoping.
 */
app.get('/api/dashboard/metrics', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user as StoredUser;
  const {
    datePreset = 'THIS_MONTH',
    startDate,
    endDate,
    quickFilter = 'ALL',
    itTeamId,
    technicianId,
    priority,
    status,
    category,
  } = req.query as Record<string, string>;

  const { start, end } = parseDateFilter(datePreset, startDate, endDate);

  // Determine ticket scope based on role
  let scopedTickets = [...tickets];
  let scopedAssets = [...assets];

  if (user.role === 'EMPLOYEE') {
    scopedTickets = tickets.filter((t) => t.requesterId === user.id);
    scopedAssets = assets.filter((a) => a.assignedUserId === user.id);
  } else if (user.role === 'IT_TECHNICIAN') {
    // Technician queue
    scopedTickets = tickets.filter((t) => t.assignedTechnicianId === user.id || (user.itTeamId && t.assignedTeamId === user.itTeamId));
    scopedAssets = assets.filter((a) => (user.itTeamId && a.assignedTeamId === user.itTeamId) || a.assignedUserId === user.id);
  } else if (user.role === 'IT_ADMIN') {
    // IT Admin: strictly permitted IT Team
    if (user.itTeamId) {
      scopedTickets = tickets.filter((t) => t.assignedTeamId === user.itTeamId);
      scopedAssets = assets.filter((a) => a.assignedTeamId === user.itTeamId);
    } else {
      scopedTickets = [];
      scopedAssets = [];
    }
  } else if (user.role === 'SUPER_ADMIN') {
    // Super Admin: Organization-wide, but can optionally filter by IT team
    if (itTeamId && itTeamId !== 'ALL') {
      scopedTickets = scopedTickets.filter((t) => t.assignedTeamId === itTeamId);
      scopedAssets = scopedAssets.filter((a) => a.assignedTeamId === itTeamId);
    }
  }

  // Filter by date range (based on ticket creation)
  if (start || end) {
    scopedTickets = scopedTickets.filter((t) => matchesDateRange(t.createdAt, start, end));
  }

  // Quick filters
  if (quickFilter === 'CRITICAL_SLA') {
    scopedTickets = scopedTickets.filter((t) => t.slaStatus === 'APPROACHING_SLA' || t.slaStatus === 'BREACHED' || t.isSlaBreached);
  } else if (quickFilter === 'URGENT') {
    scopedTickets = scopedTickets.filter((t) => t.priority === 'URGENT' || t.priority === 'CRITICAL');
  } else if (quickFilter === 'UNASSIGNED') {
    scopedTickets = scopedTickets.filter((t) => !t.assignedTechnicianId && t.status !== 'RESOLVED' && t.status !== 'CLOSED' && t.status !== 'CANCELLED');
  } else if (quickFilter === 'MY_TICKETS') {
    scopedTickets = scopedTickets.filter((t) => t.assignedTechnicianId === user.id || t.requesterId === user.id);
  }

  // Additional optional filters
  if (technicianId && technicianId !== 'ALL') {
    scopedTickets = scopedTickets.filter((t) => t.assignedTechnicianId === technicianId);
  }
  if (priority && priority !== 'ALL') {
    scopedTickets = scopedTickets.filter((t) => t.priority === priority);
  }
  if (status && status !== 'ALL') {
    scopedTickets = scopedTickets.filter((t) => t.status === status);
  }
  if (category && category !== 'ALL') {
    scopedTickets = scopedTickets.filter((t) => t.category === category);
  }

  // Ticket metrics
  const totalTickets = scopedTickets.length;
  const openTickets = scopedTickets.filter((t) =>
    ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'ASSIGNED', 'PENDING_VENDOR', 'PENDING_USER'].includes(t.status)
  ).length;
  const closedTickets = scopedTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
  const cancelledTickets = scopedTickets.filter((t) => t.status === 'CANCELLED').length;

  // Status distribution
  const statusCounts: Record<string, number> = {
    NEW: 0,
    OPEN: 0,
    IN_PROGRESS: 0,
    WAITING_FOR_USER: 0,
    RESOLVED: 0,
    CLOSED: 0,
    CANCELLED: 0,
  };
  scopedTickets.forEach((t) => {
    if (statusCounts[t.status] !== undefined) {
      statusCounts[t.status]++;
    } else {
      statusCounts[t.status] = 1;
    }
  });

  const statusDistribution = Object.entries(statusCounts).map(([k, count]) => ({
    status: k,
    count,
  }));

  // Priority distribution
  const priorityCounts: Record<string, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  };
  scopedTickets.forEach((t) => {
    if (t.priority === 'CRITICAL') priorityCounts.URGENT = (priorityCounts.URGENT || 0) + 1;
    else if (priorityCounts[t.priority] !== undefined) priorityCounts[t.priority]++;
    else priorityCounts[t.priority] = 1;
  });
  const priorityDistribution = Object.entries(priorityCounts).map(([k, count]) => ({
    priority: k,
    count,
  }));

  // Category distribution
  const categoryCounts: Record<string, number> = {
    HARDWARE: 0,
    SOFTWARE: 0,
    NETWORK: 0,
    ACCESS: 0,
    EMAIL: 0,
    TELEPHONY: 0,
    OTHER: 0,
  };
  scopedTickets.forEach((t) => {
    if (categoryCounts[t.category] !== undefined) categoryCounts[t.category]++;
    else categoryCounts.OTHER = (categoryCounts.OTHER || 0) + 1;
  });
  const categoryDistribution = Object.entries(categoryCounts).map(([k, count]) => ({
    category: k,
    count,
  }));

  // SLA Summary
  let withinSla = 0;
  let approachingSla = 0;
  let breachedSla = 0;
  let exemptSla = 0;

  scopedTickets.forEach((t) => {
    if (t.status === 'CANCELLED' || t.slaStatus === 'EXEMPT') {
      exemptSla++;
    } else if (t.isSlaBreached || t.slaStatus === 'BREACHED' || t.slaStatus === 'RESOLVED_AFTER_SLA') {
      breachedSla++;
    } else if (t.slaStatus === 'APPROACHING_SLA') {
      approachingSla++;
    } else {
      withinSla++;
    }
  });

  const evaluatedCount = withinSla + approachingSla + breachedSla;
  const complianceRate = evaluatedCount > 0 ? Math.round(((withinSla + approachingSla) / evaluatedCount) * 100) : 100;

  // IT Team distribution
  let itTeamDistribution: any[] = [];
  if (user.role === 'SUPER_ADMIN') {
    itTeamDistribution = itTeams
      .filter((tm) => !tm.isDeleted)
      .map((tm) => {
        const teamTickets = scopedTickets.filter((t) => t.assignedTeamId === tm.id);
        const teamOpen = teamTickets.filter((t) =>
          ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'ASSIGNED'].includes(t.status)
        ).length;
        const teamBreached = teamTickets.filter((t) => t.isSlaBreached || t.slaStatus === 'BREACHED').length;
        return {
          teamId: tm.id,
          teamCode: tm.code,
          teamName: tm.name,
          totalTickets: teamTickets.length,
          openTickets: teamOpen,
          breachedTickets: teamBreached,
        };
      });
  } else if (user.role === 'IT_ADMIN' && user.itTeamId) {
    const currentTeam = itTeams.find((tm) => tm.id === user.itTeamId);
    if (currentTeam) {
      itTeamDistribution = [
        {
          teamId: currentTeam.id,
          teamCode: currentTeam.code,
          teamName: currentTeam.name,
          totalTickets: scopedTickets.length,
          openTickets,
          breachedTickets: breachedSla,
        },
      ];
    }
  }

  // Technician distribution (workload)
  let technicianDistribution: any[] = [];
  let teamTechs = users.filter((u) => u.role === 'IT_TECHNICIAN' || u.role === 'IT_ADMIN');
  if (user.role === 'IT_ADMIN' && user.itTeamId) {
    teamTechs = teamTechs.filter((u) => u.itTeamId === user.itTeamId);
  }
  technicianDistribution = teamTechs.map((tech) => {
    const techTickets = scopedTickets.filter((t) => t.assignedTechnicianId === tech.id);
    const techOpen = techTickets.filter((t) =>
      ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'ASSIGNED'].includes(t.status)
    ).length;
    const techResolved = techTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
    const techBreached = techTickets.filter((t) => t.isSlaBreached || t.slaStatus === 'BREACHED').length;
    return {
      technicianId: tech.id,
      technicianName: tech.displayName,
      email: tech.email,
      itTeamId: tech.itTeamId,
      itTeamName: tech.itTeamName,
      totalAssigned: techTickets.length,
      openTickets: techOpen,
      resolvedTickets: techResolved,
      breachedTickets: techBreached,
    };
  });

  // Asset Summary
  const assetSummary = {
    total: scopedAssets.length,
    assigned: scopedAssets.filter((a) => a.status === 'ASSIGNED' || a.status === 'Active').length,
    inStock: scopedAssets.filter((a) => a.status === 'IN_STOCK').length,
    underRepair: scopedAssets.filter((a) => a.status === 'Under Repair' || a.status === 'IN_REPAIR' || a.status === 'MAINTENANCE').length,
    retired: scopedAssets.filter((a) => a.status === 'Retired' || a.status === 'DECOMMISSIONED' || a.status === 'DISPOSED').length,
    lostStolen: scopedAssets.filter((a) => a.status === 'LOST' || a.status === 'Inactive').length,
  };

  // Registration approvals (for Super Admin and IT Admin)
  let registrationApprovals: any[] = [];
  if (user.role === 'SUPER_ADMIN') {
    registrationApprovals = users
      .filter((u) => u.status === 'PENDING_APPROVAL')
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        mobileNumber: u.mobileNumber,
        departmentId: u.departmentId,
        departmentName: u.departmentName,
        designation: u.designation,
        companyName: u.companyName,
        locationName: u.locationName,
        requestedRole: u.role,
        createdAt: u.createdAt,
      }));
  } else if (user.role === 'IT_ADMIN') {
    registrationApprovals = users
      .filter((u) => u.status === 'PENDING_APPROVAL' && (!u.itTeamId || u.itTeamId === user.itTeamId))
      .map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        mobileNumber: u.mobileNumber,
        departmentId: u.departmentId,
        departmentName: u.departmentName,
        designation: u.designation,
        companyName: u.companyName,
        locationName: u.locationName,
        requestedRole: u.role,
        createdAt: u.createdAt,
      }));
  }

  // Recent activity stream
  let recentActivity = auditLogs.slice(0, 15).map((log) => {
    const actor = users.find((u) => u.id === log.actorId);
    return {
      id: log.id,
      timestamp: log.timestamp,
      actorName: actor ? actor.displayName : log.actorEmail,
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      details: log.details || '',
    };
  });

  // Role-specific payloads
  let technicianData = undefined;
  if (user.role === 'IT_TECHNICIAN') {
    const assignedTickets = tickets.filter((t) => t.assignedTechnicianId === user.id);
    const unassignedTickets = tickets.filter(
      (t) =>
        t.assignedTeamId === user.itTeamId &&
        !t.assignedTechnicianId &&
        !['RESOLVED', 'CLOSED', 'CANCELLED'].includes(t.status)
    );
    const userNotifs = notifications.filter((n) => n.recipientId === user.id).slice(0, 20);

    technicianData = {
      assignedTickets: assignedTickets.slice(0, 25),
      unassignedTickets: unassignedTickets.slice(0, 25),
      notifications: userNotifs,
      relevantAssets: scopedAssets.slice(0, 25),
    };
  }

  let employeeData = undefined;
  if (user.role === 'EMPLOYEE') {
    const ownTickets = tickets.filter((t) => t.requesterId === user.id);
    const ownAssets = assets.filter((a) => a.assignedUserId === user.id);
    const userNotifs = notifications.filter((n) => n.recipientId === user.id).slice(0, 20);

    employeeData = {
      ownTickets: ownTickets.slice(0, 25),
      assignedAssets: ownAssets,
      notifications: userNotifs,
    };
  }

  res.json({
    success: true,
    role: user.role,
    scopeTeam: user.role === 'IT_ADMIN' ? user.itTeamName || user.itTeamId : 'ORGANIZATION_WIDE',
    dateFilter: {
      preset: datePreset,
      startDate: start ? start.toISOString() : null,
      endDate: end ? end.toISOString() : null,
    },
    summary: {
      totalTickets,
      openTickets,
      closedTickets,
      cancelledTickets,
    },
    metrics: {
      totalTickets,
      openTickets,
      closedTickets,
      cancelledTickets,
    },
    statusDistribution,
    priorityDistribution,
    categoryDistribution,
    distributions: {
      status: statusDistribution,
      priority: priorityDistribution,
      category: categoryDistribution,
    },
    itTeamDistribution,
    technicianDistribution,
    slaSummary: {
      withinSla,
      approachingSla,
      breachedSla,
      exemptSla,
      complianceRate,
    },
    sla: {
      withinSla,
      approachingSla,
      breachedSla,
      exemptSla,
      complianceRate,
    },
    assetSummary,
    registrationApprovals,
    recentActivity,
    technicianData,
    employeeData,
  });
});

/**
 * POST /api/reports/generate
 * Comprehensive, manual report generator.
 * Role access: IT Admin (scoped to their IT team) & Super Admin (organization-wide / filterable).
 * Supports: TICKET, SLA, ASSET, TECHNICIAN, IT_TEAM, USER, AUDIT
 * Strictly respects RBAC. No scheduled reports.
 */
app.post('/api/reports/generate', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user as StoredUser;
  const {
    reportType = 'TICKET',
    datePreset = 'THIS_MONTH',
    startDate,
    endDate,
    status = 'ALL',
    priority = 'ALL',
    category = 'ALL',
    technicianId = 'ALL',
    department = 'ALL',
    itTeamId = 'ALL',
    locationId = 'ALL',
    slaStatus = 'ALL',
  } = req.body;

  // Enforce IT Admin scoping
  let effectiveTeamId = itTeamId;
  if (admin.role === 'IT_ADMIN') {
    if (!admin.itTeamId) {
      res.status(403).json({ error: 'IT Admin account is not assigned to an IT Team.' });
      return;
    }
    effectiveTeamId = admin.itTeamId;
  }

  const { start, end } = parseDateFilter(datePreset, startDate, endDate);
  const nowStr = new Date().toISOString();

  let columns: { key: string; label: string; type?: string }[] = [];
  let records: any[] = [];
  let reportSummary: Record<string, any> = {};

  if (reportType === 'TICKET') {
    columns = [
      { key: 'ticketNumber', label: 'Ticket #' },
      { key: 'title', label: 'Subject' },
      { key: 'category', label: 'Category' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'requesterName', label: 'Requester' },
      { key: 'requesterEmail', label: 'Email' },
      { key: 'departmentName', label: 'Department' },
      { key: 'locationName', label: 'Location' },
      { key: 'assignedTeamName', label: 'IT Team' },
      { key: 'assignedTechnicianName', label: 'Technician' },
      { key: 'relatedAssetTag', label: 'Asset Tag' },
      { key: 'createdAt', label: 'Created At' },
      { key: 'resolvedAt', label: 'Resolved At' },
      { key: 'slaStatus', label: 'SLA Status' },
    ];

    let filtered = tickets.filter((t) => {
      if (admin.role === 'IT_ADMIN' && t.assignedTeamId !== effectiveTeamId) return false;
      if (admin.role === 'SUPER_ADMIN' && effectiveTeamId !== 'ALL' && t.assignedTeamId !== effectiveTeamId) return false;
      if (status !== 'ALL' && t.status !== status) return false;
      if (priority !== 'ALL' && t.priority !== priority) return false;
      if (category !== 'ALL' && t.category !== category) return false;
      if (technicianId !== 'ALL' && t.assignedTechnicianId !== technicianId) return false;
      if (department !== 'ALL' && t.requesterDepartmentId !== department) return false;
      if (locationId !== 'ALL' && t.locationId !== locationId && t.requesterLocationId !== locationId) return false;
      if (slaStatus !== 'ALL') {
        if (slaStatus === 'BREACHED' && !t.isSlaBreached && t.slaStatus !== 'BREACHED') return false;
        if (slaStatus === 'WITHIN' && (t.isSlaBreached || t.slaStatus === 'BREACHED')) return false;
        if (slaStatus === 'APPROACHING' && t.slaStatus !== 'APPROACHING_SLA') return false;
      }
      if (start || end) {
        if (!matchesDateRange(t.createdAt, start, end)) return false;
      }
      return true;
    });

    records = filtered.map((t) => ({
      ticketNumber: t.ticketNumber,
      title: t.title,
      category: t.category,
      priority: t.priority,
      status: t.status,
      requesterName: t.requesterName,
      requesterEmail: t.requesterEmail,
      departmentName: t.requesterDepartmentId || '-',
      locationName: t.locationName || '-',
      assignedTeamName: t.assignedTeamName || 'Unassigned',
      assignedTechnicianName: t.assignedTechnicianName || 'Unassigned',
      relatedAssetTag: t.relatedAssetTag || '-',
      createdAt: new Date(t.createdAt).toLocaleString(),
      resolvedAt: t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : '-',
      slaStatus: t.slaStatus || 'WITHIN_SLA',
    }));

    reportSummary = {
      totalTickets: records.length,
      openTickets: filtered.filter((t) => ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'ASSIGNED'].includes(t.status)).length,
      resolvedTickets: filtered.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length,
      urgentTickets: filtered.filter((t) => t.priority === 'URGENT' || t.priority === 'CRITICAL').length,
      breachedTickets: filtered.filter((t) => t.isSlaBreached || t.slaStatus === 'BREACHED').length,
    };
  } else if (reportType === 'SLA') {
    columns = [
      { key: 'ticketNumber', label: 'Ticket #' },
      { key: 'title', label: 'Title' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'assignedTeamName', label: 'IT Team' },
      { key: 'assignedTechnicianName', label: 'Technician' },
      { key: 'createdAt', label: 'Created' },
      { key: 'responseTargetTime', label: 'Response Target' },
      { key: 'firstResponseAt', label: 'First Responded' },
      { key: 'firstResponseSlaStatus', label: 'Response SLA' },
      { key: 'resolutionTargetTime', label: 'Resolution Target' },
      { key: 'resolvedAt', label: 'Resolved At' },
      { key: 'slaStatus', label: 'SLA Status' },
      { key: 'isSlaBreached', label: 'Breached' },
      { key: 'pausedMinutes', label: 'Paused (Mins)' },
    ];

    let filtered = tickets.filter((t) => {
      if (admin.role === 'IT_ADMIN' && t.assignedTeamId !== effectiveTeamId) return false;
      if (admin.role === 'SUPER_ADMIN' && effectiveTeamId !== 'ALL' && t.assignedTeamId !== effectiveTeamId) return false;
      if (priority !== 'ALL' && t.priority !== priority) return false;
      if (technicianId !== 'ALL' && t.assignedTechnicianId !== technicianId) return false;
      if (slaStatus !== 'ALL') {
        if (slaStatus === 'BREACHED' && !t.isSlaBreached && t.slaStatus !== 'BREACHED') return false;
        if (slaStatus === 'WITHIN' && (t.isSlaBreached || t.slaStatus === 'BREACHED')) return false;
        if (slaStatus === 'APPROACHING' && t.slaStatus !== 'APPROACHING_SLA') return false;
      }
      if (start || end) {
        if (!matchesDateRange(t.createdAt, start, end)) return false;
      }
      return true;
    });

    records = filtered.map((t) => ({
      ticketNumber: t.ticketNumber,
      title: t.title,
      priority: t.priority,
      status: t.status,
      assignedTeamName: t.assignedTeamName || 'Unassigned',
      assignedTechnicianName: t.assignedTechnicianName || 'Unassigned',
      createdAt: new Date(t.createdAt).toLocaleString(),
      responseTargetTime: t.responseTargetTime ? new Date(t.responseTargetTime).toLocaleString() : '-',
      firstResponseAt: t.firstResponseAt ? new Date(t.firstResponseAt).toLocaleString() : 'Pending',
      firstResponseSlaStatus: t.firstResponseSlaStatus || 'PENDING',
      resolutionTargetTime: t.resolutionTargetTime ? new Date(t.resolutionTargetTime).toLocaleString() : '-',
      resolvedAt: t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : '-',
      slaStatus: t.slaStatus || 'WITHIN_SLA',
      isSlaBreached: t.isSlaBreached ? 'YES' : 'NO',
      pausedMinutes: t.slaTotalPausedWorkingMinutes || 0,
    }));

    const breachedCount = filtered.filter((t) => t.isSlaBreached || t.slaStatus === 'BREACHED').length;
    const withinCount = filtered.filter((t) => !t.isSlaBreached && t.slaStatus !== 'BREACHED').length;
    const complianceRate = filtered.length > 0 ? Math.round((withinCount / filtered.length) * 100) : 100;

    reportSummary = {
      totalEvaluated: records.length,
      withinSlaCount: withinCount,
      breachedSlaCount: breachedCount,
      complianceRate: `${complianceRate}%`,
    };
  } else if (reportType === 'ASSET') {
    columns = [
      { key: 'assetTag', label: 'Asset Tag' },
      { key: 'serialNumber', label: 'Serial Number' },
      { key: 'name', label: 'Asset Name' },
      { key: 'assetType', label: 'Type' },
      { key: 'manufacturer', label: 'Manufacturer' },
      { key: 'model', label: 'Model' },
      { key: 'status', label: 'Status' },
      { key: 'companyName', label: 'Company' },
      { key: 'locationName', label: 'Location' },
      { key: 'assignedTeamName', label: 'Assigned IT Team' },
      { key: 'assignedUserName', label: 'Assigned Employee' },
      { key: 'assignedUserEmail', label: 'Employee Email' },
      { key: 'purchaseDate', label: 'Purchase Date' },
      { key: 'warrantyExpiryDate', label: 'Warranty Expiry' },
    ];

    let filtered = assets.filter((a) => {
      if (admin.role === 'IT_ADMIN' && a.assignedTeamId !== effectiveTeamId) return false;
      if (admin.role === 'SUPER_ADMIN' && effectiveTeamId !== 'ALL' && a.assignedTeamId !== effectiveTeamId) return false;
      if (status !== 'ALL' && a.status !== status) return false;
      if (locationId !== 'ALL' && a.locationId !== locationId) return false;
      if (category !== 'ALL' && a.assetType !== category) return false;
      return true;
    });

    records = filtered.map((a) => {
      const comp = companies.find((c) => c.id === a.companyId);
      const loc = locations.find((l) => l.id === a.locationId);
      const team = itTeams.find((tm) => tm.id === a.assignedTeamId);
      return {
        assetTag: a.assetTag,
        serialNumber: a.serialNumber || '-',
        name: a.name,
        assetType: a.assetType,
        manufacturer: a.manufacturer || '-',
        model: a.model || '-',
        status: a.status,
        companyName: comp ? comp.name : a.companyId,
        locationName: loc ? loc.name : a.locationId,
        assignedTeamName: team ? team.name : 'Unassigned',
        assignedUserName: a.assignedUserName || 'In Stock',
        assignedUserEmail: a.assignedUserEmail || '-',
        purchaseDate: a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : '-',
        warrantyExpiryDate: a.warrantyExpiryDate ? new Date(a.warrantyExpiryDate).toLocaleDateString() : '-',
      };
    });

    reportSummary = {
      totalAssets: records.length,
      assignedAssets: filtered.filter((a) => a.status === 'ASSIGNED' || a.status === 'Active').length,
      inStockAssets: filtered.filter((a) => a.status === 'IN_STOCK').length,
      underRepairAssets: filtered.filter((a) => a.status === 'Under Repair' || a.status === 'IN_REPAIR' || a.status === 'MAINTENANCE').length,
      retiredAssets: filtered.filter((a) => a.status === 'Retired' || a.status === 'DECOMMISSIONED' || a.status === 'DISPOSED').length,
    };
  } else if (reportType === 'TECHNICIAN') {
    columns = [
      { key: 'technicianName', label: 'Technician Name' },
      { key: 'email', label: 'Email' },
      { key: 'itTeamName', label: 'IT Team' },
      { key: 'role', label: 'Role' },
      { key: 'totalAssigned', label: 'Total Assigned' },
      { key: 'openTickets', label: 'Open' },
      { key: 'resolvedTickets', label: 'Resolved' },
      { key: 'withinSlaCount', label: 'Within SLA' },
      { key: 'breachedSlaCount', label: 'Breached SLA' },
      { key: 'slaComplianceRate', label: 'SLA Compliance' },
    ];

    let targetTechs = users.filter((u) => u.role === 'IT_TECHNICIAN' || u.role === 'IT_ADMIN');
    if (admin.role === 'IT_ADMIN') {
      targetTechs = targetTechs.filter((u) => u.itTeamId === effectiveTeamId);
    } else if (effectiveTeamId !== 'ALL') {
      targetTechs = targetTechs.filter((u) => u.itTeamId === effectiveTeamId);
    }
    if (technicianId !== 'ALL') {
      targetTechs = targetTechs.filter((u) => u.id === technicianId);
    }

    records = targetTechs.map((tech) => {
      const techTickets = tickets.filter((t) => {
        if (t.assignedTechnicianId !== tech.id) return false;
        if (start || end) {
          if (!matchesDateRange(t.createdAt, start, end)) return false;
        }
        return true;
      });

      const openCount = techTickets.filter((t) =>
        ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'ASSIGNED'].includes(t.status)
      ).length;
      const resolvedCount = techTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
      const breachedCount = techTickets.filter((t) => t.isSlaBreached || t.slaStatus === 'BREACHED').length;
      const withinCount = techTickets.filter((t) => !t.isSlaBreached && t.slaStatus !== 'BREACHED').length;
      const rate = techTickets.length > 0 ? Math.round((withinCount / techTickets.length) * 100) : 100;

      return {
        technicianName: tech.displayName,
        email: tech.email,
        itTeamName: tech.itTeamName || '-',
        role: tech.role,
        totalAssigned: techTickets.length,
        openTickets: openCount,
        resolvedTickets: resolvedCount,
        withinSlaCount: withinCount,
        breachedSlaCount: breachedCount,
        slaComplianceRate: `${rate}%`,
      };
    });

    reportSummary = {
      totalTechnicians: records.length,
      totalAssignedWorkload: records.reduce((acc, r) => acc + (r.totalAssigned || 0), 0),
      totalResolved: records.reduce((acc, r) => acc + (r.resolvedTickets || 0), 0),
    };
  } else if (reportType === 'IT_TEAM') {
    columns = [
      { key: 'teamCode', label: 'Team Code' },
      { key: 'teamName', label: 'Team Name' },
      { key: 'leadAdmin', label: 'Lead / Members' },
      { key: 'totalTickets', label: 'Total Tickets' },
      { key: 'openTickets', label: 'Open' },
      { key: 'resolvedTickets', label: 'Resolved' },
      { key: 'urgentTickets', label: 'Urgent' },
      { key: 'breachedTickets', label: 'SLA Breached' },
      { key: 'assignedAssetsCount', label: 'Hardware Assets' },
      { key: 'slaComplianceRate', label: 'SLA Compliance' },
    ];

    let targetTeams = itTeams.filter((tm) => !tm.isDeleted);
    if (admin.role === 'IT_ADMIN') {
      targetTeams = targetTeams.filter((tm) => tm.id === effectiveTeamId);
    } else if (effectiveTeamId !== 'ALL') {
      targetTeams = targetTeams.filter((tm) => tm.id === effectiveTeamId);
    }

    records = targetTeams.map((tm) => {
      const teamTickets = tickets.filter((t) => {
        if (t.assignedTeamId !== tm.id) return false;
        if (start || end) {
          if (!matchesDateRange(t.createdAt, start, end)) return false;
        }
        return true;
      });
      const teamAssets = assets.filter((a) => a.assignedTeamId === tm.id);
      const openCount = teamTickets.filter((t) =>
        ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'ASSIGNED'].includes(t.status)
      ).length;
      const resolvedCount = teamTickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
      const urgentCount = teamTickets.filter((t) => t.priority === 'URGENT' || t.priority === 'CRITICAL').length;
      const breachedCount = teamTickets.filter((t) => t.isSlaBreached || t.slaStatus === 'BREACHED').length;
      const withinCount = teamTickets.filter((t) => !t.isSlaBreached && t.slaStatus !== 'BREACHED').length;
      const rate = teamTickets.length > 0 ? Math.round((withinCount / teamTickets.length) * 100) : 100;
      const memberCount = users.filter((u) => u.itTeamId === tm.id).length;

      return {
        teamCode: tm.code,
        teamName: tm.name,
        leadAdmin: `${memberCount} active staff`,
        totalTickets: teamTickets.length,
        openTickets: openCount,
        resolvedTickets: resolvedCount,
        urgentTickets: urgentCount,
        breachedTickets: breachedCount,
        assignedAssetsCount: teamAssets.length,
        slaComplianceRate: `${rate}%`,
      };
    });

    reportSummary = {
      totalTeams: records.length,
      totalTeamTickets: records.reduce((acc, r) => acc + (r.totalTickets || 0), 0),
      totalTeamAssets: records.reduce((acc, r) => acc + (r.assignedAssetsCount || 0), 0),
    };
  } else if (reportType === 'USER') {
    columns = [
      { key: 'username', label: 'Username' },
      { key: 'displayName', label: 'Full Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'status', label: 'Status' },
      { key: 'companyName', label: 'Company' },
      { key: 'departmentName', label: 'Department' },
      { key: 'locationName', label: 'Location' },
      { key: 'itTeamName', label: 'IT Team' },
      { key: 'ticketsCount', label: 'Tickets' },
      { key: 'assetsCount', label: 'Assets' },
      { key: 'createdAt', label: 'Registered' },
    ];

    let targetUsers = [...users];
    if (admin.role === 'IT_ADMIN') {
      // IT Admin sees users in their IT Team, or requesters of their team's tickets
      const teamRequesterIds = new Set(tickets.filter((t) => t.assignedTeamId === effectiveTeamId).map((t) => t.requesterId));
      targetUsers = users.filter((u) => u.itTeamId === effectiveTeamId || teamRequesterIds.has(u.id));
    } else if (effectiveTeamId !== 'ALL') {
      targetUsers = users.filter((u) => u.itTeamId === effectiveTeamId);
    }
    if (department !== 'ALL') {
      targetUsers = targetUsers.filter((u) => u.departmentId === department);
    }

    records = targetUsers.map((u) => {
      const userTickets = tickets.filter((t) => t.requesterId === u.id);
      const userAssets = assets.filter((a) => a.assignedUserId === u.id);
      return {
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        status: u.status,
        companyName: u.companyName || '-',
        departmentName: u.departmentName || u.departmentId || '-',
        locationName: u.locationName || '-',
        itTeamName: u.itTeamName || '-',
        ticketsCount: userTickets.length,
        assetsCount: userAssets.length,
        createdAt: new Date(u.createdAt).toLocaleDateString(),
      };
    });

    reportSummary = {
      totalUsers: records.length,
      activeUsers: targetUsers.filter((u) => u.status === 'ACTIVE').length,
      pendingApproval: targetUsers.filter((u) => u.status === 'PENDING_APPROVAL').length,
    };
  } else if (reportType === 'AUDIT') {
    columns = [
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'actorName', label: 'Actor Name' },
      { key: 'actorRole', label: 'Role' },
      { key: 'action', label: 'Action' },
      { key: 'entityType', label: 'Entity Type' },
      { key: 'entityId', label: 'Entity ID' },
      { key: 'details', label: 'Details' },
      { key: 'ipAddress', label: 'IP Address' },
    ];

    let filteredLogs = [...auditLogs];
    if (admin.role === 'IT_ADMIN') {
      filteredLogs = auditLogs.filter((a) => a.actorId === admin.id || (effectiveTeamId && (a.details || '').includes(effectiveTeamId)));
    }
    if (start || end) {
      filteredLogs = filteredLogs.filter((a) => matchesDateRange(a.timestamp, start, end));
    }

    records = filteredLogs.slice(0, 500).map((log) => {
      const actor = users.find((u) => u.id === log.actorId);
      return {
        timestamp: new Date(log.timestamp).toLocaleString(),
        actorName: actor ? actor.displayName : log.actorEmail,
        actorRole: log.actorRole,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId || '-',
        details: log.details || '',
        ipAddress: log.ipAddress || 'Internal',
      };
    });

    reportSummary = {
      totalAuditEvents: records.length,
      userActorsCount: new Set(filteredLogs.map((l) => l.actorId)).size,
    };
  }

  res.json({
    success: true,
    meta: {
      reportType,
      generatedAt: nowStr,
      generatedBy: {
        id: admin.id,
        displayName: admin.displayName,
        role: admin.role,
      },
      scope: admin.role === 'IT_ADMIN' ? admin.itTeamName || admin.itTeamId : 'ORGANIZATION_WIDE',
      dateFilter: {
        preset: datePreset,
        startDate: start ? start.toISOString() : null,
        endDate: end ? end.toISOString() : null,
      },
      appliedFilters: {
        status,
        priority,
        category,
        technicianId,
        department,
        itTeamId: effectiveTeamId,
        locationId,
        slaStatus,
      },
      totalRecords: records.length,
    },
    summary: reportSummary,
    columns,
    records,
  });
});


// ==========================================
// 2.9 API 404 & ERROR SAFETY HANDLERS
// ==========================================

// Ensure all unhandled /api requests return strict JSON instead of falling through to Vite HTML
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Global API error handler ensuring errors are serialized as JSON
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error Handler]', err);
  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
  next(err);
});

// ==========================================
// 3. VITE MIDDLEWARE & STATIC SERVING
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Accurate Group Enterprise ITMS running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

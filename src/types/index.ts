/**
 * Enterprise IT Support Helpdesk & Computer Inventory Management System
 * Complete Normalized Domain Models, Database Schema Types, and RBAC Definitions.
 */

// ==========================================
// 1. Roles & Access Control
// ==========================================

export type UserRole = 'EMPLOYEE' | 'IT_TECHNICIAN' | 'IT_ADMIN' | 'SUPER_ADMIN';

export interface RoleDefinition {
  id: UserRole;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: RolePermissions;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermissions {
  canManageCompanies: boolean;
  canManageLocations: boolean;
  canManageDepartments: boolean;
  canManageITTeams: boolean;
  canAssignRoles: boolean;
  canViewAuditLogs: boolean;
  canManageInventory: boolean;
  canManageTickets: boolean;
  canAssignTickets: boolean;
  canSubmitTickets: boolean;
  canViewAllTickets: boolean;
  canManageSystemConfig: boolean;
  canManageSLA: boolean;
  canReviewProfileChanges: boolean;
  canViewReports: boolean;
  label: string;
  description: string;
  colorClass: string;
  badgeBg: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RolePermissions> = {
  SUPER_ADMIN: {
    canManageCompanies: true,
    canManageLocations: true,
    canManageDepartments: true,
    canManageITTeams: true,
    canAssignRoles: true,
    canViewAuditLogs: true,
    canManageInventory: true,
    canManageTickets: true,
    canAssignTickets: true,
    canSubmitTickets: true,
    canViewAllTickets: true,
    canManageSystemConfig: true,
    canManageSLA: true,
    canReviewProfileChanges: true,
    canViewReports: true,
    label: 'Super Admin',
    description: 'Full organizational authority over master data, IT teams, security, audit logs, and global configuration.',
    colorClass: 'text-purple-700 dark:text-purple-300',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  },
  IT_ADMIN: {
    canManageCompanies: false, // Managed by Super Admin
    canManageLocations: false,
    canManageDepartments: false,
    canManageITTeams: false,
    canAssignRoles: false,
    canViewAuditLogs: true,
    canManageInventory: true,
    canManageTickets: true,
    canAssignTickets: true,
    canSubmitTickets: true,
    canViewAllTickets: true,
    canManageSystemConfig: false,
    canManageSLA: true,
    canReviewProfileChanges: true,
    canViewReports: true,
    label: 'IT Admin',
    description: 'Manages team ticketing queues, SLAs, hardware asset lifecycles, technician allocations, and reviews audit logs.',
    colorClass: 'text-blue-700 dark:text-blue-300',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  },
  IT_TECHNICIAN: {
    canManageCompanies: false,
    canManageLocations: false,
    canManageDepartments: false,
    canManageITTeams: false,
    canAssignRoles: false,
    canViewAuditLogs: false,
    canManageInventory: true,
    canManageTickets: true,
    canAssignTickets: false,
    canSubmitTickets: true,
    canViewAllTickets: true,
    canManageSystemConfig: false,
    canManageSLA: false,
    canReviewProfileChanges: false,
    canViewReports: false,
    label: 'IT Technician',
    description: 'Diagnoses computer hardware, resolves assigned tickets, records technical troubleshooting, and logs asset changes.',
    colorClass: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  EMPLOYEE: {
    canManageCompanies: false,
    canManageLocations: false,
    canManageDepartments: false,
    canManageITTeams: false,
    canAssignRoles: false,
    canViewAuditLogs: false,
    canManageInventory: false,
    canManageTickets: false,
    canAssignTickets: false,
    canSubmitTickets: true,
    canViewAllTickets: false,
    canManageSystemConfig: false,
    canManageSLA: false,
    canReviewProfileChanges: false,
    canViewReports: false,
    label: 'Employee',
    description: 'Internal organization member who submits IT requests, tracks personal tickets, and views assigned hardware.',
    colorClass: 'text-emerald-700 dark:text-emerald-300',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
};

// ==========================================
// 2. Independent Master Data
// ==========================================

export interface MasterDataUsageCount {
  tickets: number;
  assets: number;
  users: number;
}

export interface Company {
  id: string;
  code: string;
  name: string;
  domain?: string;
  contactEmail?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'INACTIVE' | 'SUSPENDED';
  isDeleted: boolean; // Soft delete flag to preserve history
  isArchived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  usageCount?: MasterDataUsageCount;
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  address?: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  timezone?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'INACTIVE' | 'MAINTENANCE';
  isDeleted: boolean; // Soft delete flag to preserve history
  isArchived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  usageCount?: MasterDataUsageCount;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  code: string; // e.g., 'ENG', 'FIN', 'HR', 'IT'
  name: string;
  description?: string;
  headOfDepartmentId?: string; // FK -> UserProfile.id
  status: 'ACTIVE' | 'ARCHIVED' | 'INACTIVE';
  isDeleted: boolean;
  isArchived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  usageCount?: MasterDataUsageCount;
  createdAt: string;
  updatedAt: string;
}

export interface ITTeam {
  id: string;
  code: string; // e.g. 'TIER-1', 'NET-INFRA', 'SEC-OPS'
  name: string;
  description?: string;
  leadAdminId?: string; // FK -> UserProfile.id (IT_ADMIN or SUPER_ADMIN)
  status: 'ACTIVE' | 'INACTIVE';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 3. User & Profile Models
// ==========================================

export interface UserProfile {
  id: string; // Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  role: UserRole;
  
  // Decoupled organizational relationships
  companyId?: string; // FK -> Company.id, or 'ALL' for Super Admin
  locationId?: string; // FK -> Location.id, or 'ALL' for Super Admin
  departmentId?: string; // FK -> Department.id
  
  // IT Team Constraint:
  // - IT_ADMIN: must belong to exactly one ITTeam
  // - IT_TECHNICIAN: must belong to exactly one ITTeam
  // - EMPLOYEE: must NOT belong to an ITTeam (null/undefined)
  // - SUPER_ADMIN: organization-wide access (null or 'ALL')
  itTeamId?: string | null;

  jobTitle?: string;
  designation?: string; // Job designation
  username?: string; // Original casing alphabetic username
  normalizedUsername?: string; // Lowercase for case-insensitive lookup
  assetTag?: string; // Computer/Asset Tag e.g. AST-00101
  departmentName?: string;
  locationName?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL' | 'REJECTED' | 'DEACTIVATED';
  mfaEnabled: boolean;
  
  // Cryptographic credentials (secure PBKDF2 hash, never plaintext)
  passwordHash?: string;
  passwordSalt?: string;
  passwordIterations?: number;

  // Security and Lockout Policies
  failedLoginAttempts: number; // Cumulative counter (not reset automatically)
  lockoutUntil?: string | null; // ISO timestamp for 15-min lockout
  mustChangePassword?: boolean; // Set to true when admin generates temporary password
  temporaryPasswordGeneratedAt?: string;
  rejectionReason?: string | null; // Mandatory reason if registration was rejected

  lastLoginAt?: string;
  isDeleted: boolean; // Preserves historical references
  createdAt: string;
  updatedAt: string;
}

export interface UserRegistrationInput {
  employeeName: string;
  username: string; // A-Z only
  password: string;
  confirmPassword: string;
  departmentId: string;
  departmentName?: string;
  designation: string;
  assetTag: string;
  locationId: string;
  locationName?: string;
  mobileNumber: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  rules: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
  normalized: string;
}

export interface LoginResult {
  success: boolean;
  user?: UserProfile;
  token?: string;
  sessionId?: string;
  mustChangePassword?: boolean;
  error?: string;
  isLocked?: boolean;
  lockoutUntil?: string | null;
  remainingSeconds?: number;
  failedAttempts?: number;
  remainingAttempts?: number;
  warnAfter3rdAttempt?: boolean;
  status?: string;
  rejectionReason?: string | null;
}

export interface UserProfileChangeRequest {
  id: string;
  requestNumber: string; // e.g. 'PCR-10001'
  userId: string; // FK -> UserProfile.id
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
  reviewedBy?: string; // FK -> UserProfile.id (IT_ADMIN or SUPER_ADMIN)
  reviewerName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRecord {
  id: string; // User UID
  email: string;
  role: 'IT_ADMIN' | 'SUPER_ADMIN';
  itTeamId?: string | null;
  grantedBy?: string;
  grantedAt: string;
}

// ==========================================
// 4. Ticket System Models
// ==========================================

export type TicketCategory =
  | 'HARDWARE'
  | 'SOFTWARE'
  | 'NETWORK'
  | 'ACCESS'
  | 'EMAIL'
  | 'TELEPHONY'
  | 'OTHER';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'URGENT';

export type TicketStatus =
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

export interface TicketAttachment {
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

export interface TicketHistoryItem {
  id: string;
  ticketId: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  details: string;
  fromValue?: string | null;
  toValue?: string | null;
  timestamp: string;
}

export interface Ticket {
  id: string;
  // Non-reusable sequential identifier (e.g. TCK-10001)
  ticketNumber: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;

  // Requester context (fully decoupled)
  requesterId: string; // FK -> UserProfile.id
  requesterName?: string;
  requesterEmail?: string;
  requesterCompanyId?: string; // FK -> Company.id
  requesterLocationId?: string; // FK -> Location.id
  requesterDepartmentId?: string; // FK -> Department.id

  // Location & contact context
  locationId?: string;
  locationName?: string;
  contactNumber?: string;

  // Assignment context
  assignedTeamId?: string | null; // FK -> ITTeam.id
  assignedTeamName?: string | null;
  assignedTechnicianId?: string | null; // FK -> UserProfile.id (IT_TECHNICIAN or IT_ADMIN)
  assignedTechnicianName?: string | null;

  // Associated hardware/computer (optional)
  relatedAssetId?: string | null; // FK -> Asset.id
  relatedAssetTag?: string | null;
  relatedAssetName?: string | null;
  assetOverrideReason?: string | null; // Mandatory reason if employee created ticket for asset not assigned to them
  historicalAssetAssignment?: {
    assignedUserId?: string | null;
    assignedUserName?: string | null;
    assignedAtSnapshot?: string | null;
  } | null;

  // Attachments
  attachmentIds?: string[];

  // SLA Tracking
  slaConfigId?: string | null; // FK -> SLAConfig.id
  slaResponseDueAt?: string | null;
  slaResolutionDueAt?: string | null;
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;

  isDeleted: boolean; // Soft delete flag to preserve history
  createdAt: string;
  updatedAt: string;
}

// Immutable Historical Records (Never deleted or overwritten)

export interface TicketStatusHistory {
  id: string;
  ticketId: string; // FK -> Ticket.id
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  changedById: string; // FK -> UserProfile.id
  changedByEmail: string;
  reason?: string;
  timestamp: string;
}

export interface TicketPriorityHistory {
  id: string;
  ticketId: string; // FK -> Ticket.id
  fromPriority: TicketPriority;
  toPriority: TicketPriority;
  changedById: string; // FK -> UserProfile.id
  reason: string;
  timestamp: string;
}

export interface TicketAssignmentHistory {
  id: string;
  ticketId: string; // FK -> Ticket.id
  fromTeamId?: string | null;
  toTeamId?: string | null;
  fromTechnicianId?: string | null;
  toTechnicianId?: string | null;
  assignedById: string; // FK -> UserProfile.id
  assignmentNote?: string;
  timestamp: string;
}

export interface TicketComment {
  id: string;
  ticketId: string; // FK -> Ticket.id
  authorId: string; // FK -> UserProfile.id
  authorEmail: string;
  authorRole: UserRole;
  isInternalOnly: boolean; // Visible only to IT personnel
  content: string;
  attachmentIds?: string[]; // FKs -> Attachment.id
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  entityType: 'TICKET' | 'COMMENT' | 'ASSET' | 'PROFILE';
  entityId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storagePath: string;
  uploadedById: string; // FK -> UserProfile.id
  uploadedAt: string;
  isDeleted: boolean;
}

// ==========================================
// 5. Assets & Computer Inventory Models
// ==========================================

export type AssetType =
  | 'LAPTOP'
  | 'DESKTOP'
  | 'WORKSTATION'
  | 'SERVER'
  | 'MONITOR'
  | 'NETWORK_DEVICE'
  | 'PERIPHERAL'
  | 'TABLET';

export type AssetStatus =
  | 'Active'
  | 'Inactive'
  | 'Under Repair'
  | 'Retired'
  | 'IN_STOCK'
  | 'ASSIGNED'
  | 'IN_REPAIR'
  | 'MAINTENANCE'
  | 'DECOMMISSIONED'
  | 'DISPOSED'
  | 'LOST';

export interface AssetSpecifications {
  cpu?: string;
  ramGb?: number;
  storageGb?: number;
  storageType?: 'SSD' | 'NVMe' | 'HDD' | 'Flash' | string;
  os?: string;
  macAddress?: string;
  ipAddress?: string;
  screenSizeInches?: number;
  [key: string]: any;
}

export interface AssetCustomField {
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

export interface AssetAssignmentRecord {
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

export interface Asset {
  id: string;
  // Non-reusable unique asset identifier (e.g. AST-00801 / Asset Number)
  assetTag: string;
  serialNumber: string;
  name: string;
  assetType: AssetType;
  manufacturer: string;
  model: string;
  specifications: AssetSpecifications;

  // Master Data Affiliations (strictly independent)
  companyId: string; // FK -> Company.id
  companyName?: string;
  company?: string | null;
  locationId: string; // FK -> Location.id
  locationName?: string;
  location?: string | null;
  departmentId?: string | null; // FK -> Department.id
  departmentName?: string | null;
  department?: string | null;

  // Allocation & Complete Assignment Tracking
  assignedUserId?: string | null; // FK -> UserProfile.id (or null if unallocated)
  assignedUserName?: string | null;
  assignedUserEmail?: string | null;
  assignedEmployeeName?: string | null; // Exact mapping to Excel Assigned Employee Name
  assetUserName?: string | null; // Exact mapping to Excel Asset User Name
  assignedTeamId?: string | null; // FK -> ITTeam.id (for pool devices)
  previousEmployeeId?: string | null;
  previousEmployeeName?: string | null;
  assignmentDate?: string | null;
  transferDate?: string | null;

  // Status & Condition (strictly separated)
  status: AssetStatus; // 'Active' | 'Inactive' | 'Under Repair' | 'Retired'
  condition?: string; // 'Good' | 'Fair' | 'Damaged' | 'Working' | 'New (NH)' | 'Old (SH)' | string

  // Hardware Specifications & Components
  ipAddress?: string; // Excel column: 'IP Adresss'
  processor?: string;
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
  newOrOld?: string; // 'New (NH)' | 'Old (SH)'

  // Financial & Procurement Details
  purchaseDate?: string;
  purchaseDateParsed?: string | null;
  purchaseCost?: number | null; // Purchase Cost (INR)
  vendor?: string;
  invoiceNumber?: string;

  // Lifecycle, Warranties & Services
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyExpiryDate?: string;
  lastServiceDate?: string;
  amcStart?: string;
  amcEnd?: string;
  remarks?: string;
  notes?: string;

  // Automated Calculated Fields
  assetAgeYears?: number | null; // Asset Age (Yrs)
  expectedLifeYears?: number | null; // Expected Life (Yrs)
  expectedReplacementDate?: string | null; // Expected Replacement Date
  depreciatedValueINR?: number | null; // Depreciated Value (INR)
  replacementAlert?: string | null; // Replacement Alert
  warrantyAlert?: string | null; // Warranty Alert

  customFields?: Record<string, any>;
  assignmentHistory?: AssetAssignmentRecord[];

  isDeleted: boolean; // Soft delete flag to preserve history (never permanently deleted)
  createdAt: string;
  updatedAt: string;
}

// Immutable Asset History Ledgers

export interface AssetAssignmentHistory {
  id: string;
  assetId: string; // FK -> Asset.id
  assignedToUserId?: string | null; // FK -> UserProfile.id (null if returned to inventory)
  assignedToCompanyId: string; // FK -> Company.id
  assignedToLocationId: string; // FK -> Location.id
  assignedByUserId: string; // FK -> UserProfile.id
  action: 'ASSIGN' | 'RETURN' | 'TRANSFER' | 'RELOCATE';
  notes?: string;
  assignedAt: string;
}

export interface AssetChangeHistory {
  id: string;
  assetId: string; // FK -> Asset.id
  changedByUserId: string; // FK -> UserProfile.id
  fieldChanged: string; // e.g. 'status', 'locationId', 'specifications'
  previousValue: any;
  newValue: any;
  changeReason?: string;
  timestamp: string;
}

// ==========================================
// 6. SLA Configurations & SLA Tracking
// ==========================================

export interface SLAConfig {
  id: string;
  name: string;
  priority: TicketPriority;
  responseTimeMinutes: number; // Max time to first technician response
  resolutionTimeMinutes: number; // Max time to ticket resolution
  businessHoursOnly: boolean;
  escalationTeamId?: string | null; // FK -> ITTeam.id
  isDefault: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SLAHistory {
  id: string;
  ticketId: string; // FK -> Ticket.id
  slaConfigId: string; // FK -> SLAConfig.id
  eventType:
    | 'RESPONSE_MET'
    | 'RESPONSE_BREACHED'
    | 'RESOLUTION_MET'
    | 'RESOLUTION_BREACHED'
    | 'SLA_PAUSED'
    | 'SLA_RESUMED';
  targetDueAt: string;
  actualOccurredAt: string;
  breachDurationMinutes?: number;
  recordedAt: string;
  notes?: string;
}

// ==========================================
// 7. Security, Auditing & Sessions
// ==========================================

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorEmail: string;
  actorRole: UserRole | string;
  action: string;
  entityType:
    | 'COMPANY'
    | 'LOCATION'
    | 'DEPARTMENT'
    | 'IT_TEAM'
    | 'USER'
    | 'TICKET'
    | 'ASSET'
    | 'INVENTORY'
    | 'SLA'
    | 'AUTH'
    | 'CONFIG';
  entityId: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  companyId?: string;
  locationId?: string;
}

export interface LoginSecurityHistory {
  id: string;
  userId?: string | null;
  userEmail: string;
  attemptTimestamp: string;
  status:
    | 'SUCCESS'
    | 'FAILED_INVALID_CREDENTIALS'
    | 'FAILED_SUSPENDED'
    | 'FAILED_MFA';
  ipAddress: string;
  userAgent: string;
  failureReason?: string;
}

export interface UserSession {
  id: string; // Session ID
  userId: string; // FK -> UserProfile.id
  username?: string;
  displayName?: string;
  userEmail: string;
  userRole: UserRole;
  activeTokenHash: string;
  ipAddress?: string;
  userAgent?: string;
  deviceLabel?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface Notification {
  id: string;
  recipientId: string; // FK -> UserProfile.id
  senderId?: string | null; // FK -> UserProfile.id or 'SYSTEM'
  title: string;
  message: string;
  type:
    | 'TICKET_ASSIGNED'
    | 'TICKET_UPDATED'
    | 'SLA_WARNING'
    | 'SLA_BREACHED'
    | 'PROFILE_CHANGE_REVIEW'
    | 'ASSET_ALLOCATED'
    | 'SECURITY_ALERT';
  referenceEntityType?: 'TICKET' | 'ASSET' | 'USER_CHANGE_REQUEST';
  referenceEntityId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// ==========================================
// 8. Saved Filters & Reports Configuration
// ==========================================

export interface SavedFilter {
  id: string;
  userId: string; // FK -> UserProfile.id
  name: string;
  entityType: 'TICKET' | 'ASSET' | 'AUDIT_LOG';
  filterCriteria: Record<string, any>;
  isShared: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportConfig {
  id: string;
  name: string;
  reportType:
    | 'SLA_COMPLIANCE'
    | 'TICKET_VOLUME_BY_COMPANY'
    | 'HARDWARE_LIFECYCLE'
    | 'TECHNICIAN_WORKLOAD'
    | 'ASSET_BY_LOCATION';
  parameters: Record<string, any>;
  createdByUserId: string; // FK -> UserProfile.id
  schedule: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  lastGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceCounter {
  id: string; // e.g. 'ticket_sequence', 'asset_sequence'
  prefix: string; // 'TCK', 'AST'
  currentNumber: number;
  updatedAt: string;
}

export interface SystemConfig {
  id: string;
  initialSeedCompleted: boolean;
  seededAt?: string;
  systemVersion: string;
  updatedAt: string;
}

// ==========================================
// 9. Error & Operation Enums
// ==========================================

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

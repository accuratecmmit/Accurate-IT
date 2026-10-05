/**
 * Helpdesk Ticket Firestore Data Structure & Schema Specifications
 * Authoritative Firestore model definition, priority levels, status lifecycles,
 * assignee mapping, and timestamp auditing.
 */

import {
  Ticket,
  TicketFirestoreSchema,
  TicketPriority,
  TicketPriorityDefinition,
  TicketStatus,
  TicketStatusDefinition,
  TicketMetrics,
  TicketCategory,
} from '../types';

export const TICKET_PRIORITIES: TicketPriorityDefinition[] = [
  {
    id: 'LOW',
    label: 'Low',
    level: 1,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    badgeBg: 'bg-slate-500',
    textColor: 'text-slate-600 dark:text-slate-400',
    defaultResponseMinutes: 480, // 8 hours
    defaultResolutionMinutes: 2880, // 48 hours
    description: 'Minor inconvenience, non-critical inquiry, cosmetic issue or general question. No impact on business operations.',
  },
  {
    id: 'MEDIUM',
    label: 'Medium',
    level: 2,
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    badgeBg: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    defaultResponseMinutes: 240, // 4 hours
    defaultResolutionMinutes: 1440, // 24 hours
    description: 'Standard issue impacting an individual user with an existing temporary workaround available.',
  },
  {
    id: 'HIGH',
    label: 'High',
    level: 3,
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    badgeBg: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    defaultResponseMinutes: 60, // 1 hour
    defaultResolutionMinutes: 480, // 8 hours
    description: 'Significant issue preventing a single user from performing primary duties, or impacting a department partially without workaround.',
  },
  {
    id: 'CRITICAL',
    label: 'Critical',
    level: 4,
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
    badgeBg: 'bg-rose-500',
    textColor: 'text-rose-600 dark:text-rose-400',
    defaultResponseMinutes: 30, // 30 minutes
    defaultResolutionMinutes: 240, // 4 hours
    description: 'Mission-critical outage affecting multiple users, core enterprise software downtime, or network infrastructure failure.',
  },
  {
    id: 'URGENT',
    label: 'Urgent',
    level: 5,
    badgeClass: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800 animate-pulse',
    badgeBg: 'bg-red-600',
    textColor: 'text-red-600 dark:text-red-400',
    defaultResponseMinutes: 15, // 15 minutes
    defaultResolutionMinutes: 120, // 2 hours
    description: 'Emergency tier: security incident, complete site blackout, data breach risk, or executive system failure.',
  },
];

export const TICKET_STATUSES: TicketStatusDefinition[] = [
  {
    id: 'NEW',
    label: 'New',
    stage: 'NEW',
    isTerminal: false,
    allowsEdit: true,
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800',
    badgeBg: 'bg-sky-500',
    textColor: 'text-sky-600 dark:text-sky-400',
    description: 'Ticket newly created by employee; awaiting triage and IT team or technician assignment.',
    allowedTransitions: ['ASSIGNED', 'OPEN', 'IN_PROGRESS', 'CANCELLED'],
  },
  {
    id: 'ASSIGNED',
    label: 'Assigned',
    stage: 'ASSIGNED',
    isTerminal: false,
    allowsEdit: true,
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
    badgeBg: 'bg-indigo-500',
    textColor: 'text-indigo-600 dark:text-indigo-400',
    description: 'Ticket routed to an IT Team or assigned directly to a designated IT Technician.',
    allowedTransitions: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'PENDING_VENDOR', 'CANCELLED'],
  },
  {
    id: 'OPEN',
    label: 'Open',
    stage: 'WORKING',
    isTerminal: false,
    allowsEdit: true,
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    badgeBg: 'bg-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
    description: 'Ticket accepted and acknowledged by the technician; under active review.',
    allowedTransitions: ['IN_PROGRESS', 'WAITING_FOR_USER', 'PENDING_VENDOR', 'RESOLVED', 'CANCELLED'],
  },
  {
    id: 'IN_PROGRESS',
    label: 'In Progress',
    stage: 'WORKING',
    isTerminal: false,
    allowsEdit: true,
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    badgeBg: 'bg-amber-500',
    textColor: 'text-amber-600 dark:text-amber-400',
    description: 'Technical troubleshooting, hardware repair, configuration, or investigation currently underway.',
    allowedTransitions: ['WAITING_FOR_USER', 'PENDING_VENDOR', 'RESOLVED', 'CANCELLED'],
  },
  {
    id: 'WAITING_FOR_USER',
    label: 'Waiting for User',
    stage: 'WAITING',
    isTerminal: false,
    allowsEdit: true,
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    badgeBg: 'bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    description: 'Technician has requested feedback, diagnostics, or approval from employee. SLA clock paused.',
    allowedTransitions: ['IN_PROGRESS', 'OPEN', 'RESOLVED', 'CANCELLED'],
  },
  {
    id: 'PENDING_VENDOR',
    label: 'Pending Vendor',
    stage: 'WAITING',
    isTerminal: false,
    allowsEdit: true,
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
    badgeBg: 'bg-orange-500',
    textColor: 'text-orange-600 dark:text-orange-400',
    description: 'Awaiting hardware warranty replacement, vendor RMA, or third-party service provider response.',
    allowedTransitions: ['IN_PROGRESS', 'OPEN', 'RESOLVED', 'CANCELLED'],
  },
  {
    id: 'PENDING_USER',
    label: 'Pending User',
    stage: 'WAITING',
    isTerminal: false,
    allowsEdit: true,
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    badgeBg: 'bg-purple-500',
    textColor: 'text-purple-600 dark:text-purple-400',
    description: 'Alias for waiting for user response and verification.',
    allowedTransitions: ['IN_PROGRESS', 'OPEN', 'RESOLVED', 'CANCELLED'],
  },
  {
    id: 'RESOLVED',
    label: 'Resolved',
    stage: 'RESOLVED',
    isTerminal: false,
    allowsEdit: false,
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    badgeBg: 'bg-emerald-500',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    description: 'Technical resolution completed and verified. Employee has confirmation window before auto-close.',
    allowedTransitions: ['CLOSED', 'IN_PROGRESS'],
  },
  {
    id: 'CLOSED',
    label: 'Closed',
    stage: 'CLOSED',
    isTerminal: true,
    allowsEdit: false,
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    badgeBg: 'bg-slate-600',
    textColor: 'text-slate-500 dark:text-slate-400',
    description: 'Ticket finalized, resolution confirmed by requester, and archived in historical ledger.',
    allowedTransitions: [],
  },
  {
    id: 'CANCELLED',
    label: 'Cancelled',
    stage: 'CANCELLED',
    isTerminal: true,
    allowsEdit: false,
    badgeClass: 'bg-rose-200 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
    badgeBg: 'bg-rose-600',
    textColor: 'text-rose-500 dark:text-rose-400',
    description: 'Ticket cancelled by user or IT Admin before or during execution. Cancellation reason recorded.',
    allowedTransitions: [],
  },
];

export const TICKET_FIRESTORE_SCHEMA: TicketFirestoreSchema = {
  collectionPath: '/tickets/{ticketId}',
  subcollections: {
    comments: '/tickets/{ticketId}/comments/{commentId}',
    statusHistory: '/tickets/{ticketId}/status_history/{historyId}',
    priorityHistory: '/tickets/{ticketId}/priority_history/{historyId}',
    assignmentHistory: '/tickets/{ticketId}/assignment_history/{historyId}',
  },
  priorities: TICKET_PRIORITIES,
  statuses: TICKET_STATUSES,
  fields: [
    // 1. IDENTIFIERS & CORE
    {
      name: 'id',
      type: 'string',
      required: true,
      category: 'IDENTIFIER',
      maxLength: 128,
      description: 'Unique Firestore document ID (UUID or generated ID matching /tickets/{ticketId}).',
    },
    {
      name: 'ticketNumber',
      type: 'string',
      required: true,
      isImmutable: true,
      category: 'IDENTIFIER',
      maxLength: 32,
      description: 'Human-readable sequential identifier (e.g. TCK-10001). Strictly non-reusable and immutable.',
    },
    {
      name: 'title',
      type: 'string',
      required: true,
      category: 'IDENTIFIER',
      maxLength: 200,
      description: 'Concise summary of the IT issue, request, or hardware symptom.',
    },
    {
      name: 'description',
      type: 'string',
      required: true,
      category: 'IDENTIFIER',
      maxLength: 4000,
      description: 'Detailed explanation including reproduction steps, error logs, and business impact.',
    },
    {
      name: 'category',
      type: 'string',
      required: true,
      category: 'IDENTIFIER',
      enum: ['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCESS', 'EMAIL', 'TELEPHONY', 'OTHER'],
      description: 'Standard IT classification determining assignment routing and diagnostic triage.',
    },

    // 2. PRIORITY
    {
      name: 'priority',
      type: 'string',
      required: true,
      category: 'PRIORITY',
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT'],
      description: 'Impact & urgency tier dictating response and resolution SLA deadlines.',
    },

    // 3. STATUS
    {
      name: 'status',
      type: 'string',
      required: true,
      category: 'STATUS',
      enum: ['NEW', 'ASSIGNED', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'PENDING_VENDOR', 'PENDING_USER', 'RESOLVED', 'CLOSED', 'CANCELLED'],
      description: 'Current lifecycle state. Transitions are strictly validated against allowable next states.',
    },

    // 4. ASSIGNEE
    {
      name: 'assignedTeamId',
      type: 'string',
      required: false,
      category: 'ASSIGNEE',
      maxLength: 128,
      description: 'Foreign key to /it_teams/{teamId}. IT support team responsible for ticket dispatch.',
    },
    {
      name: 'assignedTeamName',
      type: 'string',
      required: false,
      category: 'ASSIGNEE',
      maxLength: 120,
      description: 'Denormalized display name of the assigned IT team for query & rendering performance.',
    },
    {
      name: 'assignedTechnicianId',
      type: 'string',
      required: false,
      category: 'ASSIGNEE',
      maxLength: 128,
      description: 'Foreign key to /users/{userId}. Designated IT Technician or IT Admin owner.',
    },
    {
      name: 'assignedTechnicianName',
      type: 'string',
      required: false,
      category: 'ASSIGNEE',
      maxLength: 120,
      description: 'Denormalized technician display name for instant queue rendering.',
    },
    {
      name: 'assignedTechnicianEmail',
      type: 'string',
      required: false,
      category: 'ASSIGNEE',
      maxLength: 120,
      description: 'Corporate email address of the assigned technician for alert dispatch.',
    },
    {
      name: 'assignedAt',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'ASSIGNEE',
      description: 'ISO 8601 timestamp recording when the latest technician or team assignment was made.',
    },

    // 5. TIMESTAMPS
    {
      name: 'createdAt',
      type: 'string',
      format: 'date-time',
      required: true,
      isImmutable: true,
      category: 'TIMESTAMPS',
      description: 'Server-stamped ISO 8601 creation timestamp. Immutable once written.',
    },
    {
      name: 'updatedAt',
      type: 'string',
      format: 'date-time',
      required: true,
      category: 'TIMESTAMPS',
      description: 'Server-stamped ISO 8601 modification timestamp updated on every mutation.',
    },
    {
      name: 'firstRespondedAt',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'ISO 8601 timestamp of technician first response; stops the First Response SLA clock.',
    },
    {
      name: 'firstResponseAt',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'Alternative timestamp alias for first technician response.',
    },
    {
      name: 'resolvedAt',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'ISO 8601 timestamp when ticket entered RESOLVED state; evaluates Resolution SLA compliance.',
    },
    {
      name: 'closedAt',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'ISO 8601 timestamp when ticket moved to terminal CLOSED state.',
    },
    {
      name: 'cancelledAt',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'ISO 8601 timestamp when ticket was cancelled.',
    },
    {
      name: 'cancellationReason',
      type: 'string',
      required: false,
      category: 'TIMESTAMPS',
      maxLength: 500,
      description: 'Mandatory justification provided when ticket is cancelled.',
    },
    {
      name: 'responseTargetTime',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'Calculated ISO 8601 target deadline for first response under active SLA policy.',
    },
    {
      name: 'resolutionTargetTime',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'Calculated ISO 8601 target deadline for complete resolution under active SLA policy.',
    },
    {
      name: 'slaResponseDueAt',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'SLA target response timestamp (normalized alias).',
    },
    {
      name: 'slaResolutionDueAt',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'SLA target resolution timestamp (normalized alias).',
    },
    {
      name: 'slaPausedAt',
      type: 'string',
      format: 'date-time',
      required: false,
      category: 'TIMESTAMPS',
      description: 'Timestamp when ticket entered WAITING_FOR_USER state, pausing the SLA countdown.',
    },

    // 6. REQUESTER CONTEXT
    {
      name: 'requesterId',
      type: 'string',
      required: true,
      category: 'REQUESTER',
      maxLength: 128,
      description: 'Foreign key to /users/{userId}. Employee who submitted the ticket.',
    },
    {
      name: 'requesterName',
      type: 'string',
      required: false,
      category: 'REQUESTER',
      maxLength: 120,
      description: 'Full name of the requesting user.',
    },
    {
      name: 'requesterEmail',
      type: 'string',
      required: false,
      category: 'REQUESTER',
      maxLength: 120,
      description: 'Email address of the requesting user.',
    },
    {
      name: 'requesterCompanyId',
      type: 'string',
      required: true,
      category: 'REQUESTER',
      maxLength: 128,
      description: 'Independent Company master data foreign key for multi-tenant isolation.',
    },
    {
      name: 'requesterLocationId',
      type: 'string',
      required: true,
      category: 'REQUESTER',
      maxLength: 128,
      description: 'Independent Location master data foreign key for facility dispatch.',
    },
    {
      name: 'requesterDepartmentId',
      type: 'string',
      required: false,
      category: 'REQUESTER',
      maxLength: 128,
      description: 'Department master data foreign key.',
    },
    {
      name: 'locationId',
      type: 'string',
      required: false,
      category: 'REQUESTER',
      maxLength: 128,
      description: 'Physical building/site where assistance is needed.',
    },
    {
      name: 'locationName',
      type: 'string',
      required: false,
      category: 'REQUESTER',
      maxLength: 120,
      description: 'Denormalized location name.',
    },
    {
      name: 'contactNumber',
      type: 'string',
      required: false,
      category: 'REQUESTER',
      maxLength: 32,
      description: 'Phone or extension number for fast technician follow-up.',
    },

    // 7. RELATIONS & INVENTORY
    {
      name: 'relatedAssetId',
      type: 'string',
      required: false,
      category: 'RELATION',
      maxLength: 128,
      description: 'Foreign key to /assets/{assetId}. Computer, server, or hardware related to issue.',
    },
    {
      name: 'relatedAssetTag',
      type: 'string',
      required: false,
      category: 'RELATION',
      maxLength: 64,
      description: 'Hardware asset tag (e.g. AST-00101) for physical verification.',
    },
    {
      name: 'relatedAssetName',
      type: 'string',
      required: false,
      category: 'RELATION',
      maxLength: 150,
      description: 'Hardware model and specification summary.',
    },
    {
      name: 'slaConfigId',
      type: 'string',
      required: false,
      category: 'RELATION',
      maxLength: 128,
      description: 'Foreign key to /sla_configs/{configId}. SLA rule applied to ticket.',
    },

    // 8. SYSTEM
    {
      name: 'isDeleted',
      type: 'boolean',
      required: true,
      category: 'SYSTEM',
      description: 'Soft delete flag. Tickets are never permanently deleted to preserve audit logs.',
    },
  ],
};

/**
 * Calculates real-time metric aggregates for any list of tickets.
 */
export function computeTicketMetrics(tickets: Ticket[]): TicketMetrics {
  const activeTickets = (tickets || []).filter((t) => !t.isDeleted);

  const initialPriorities: Record<TicketPriority, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
    URGENT: 0,
  };

  const initialStatuses: Record<TicketStatus, number> = {
    NEW: 0,
    ASSIGNED: 0,
    OPEN: 0,
    IN_PROGRESS: 0,
    WAITING_FOR_USER: 0,
    PENDING_VENDOR: 0,
    PENDING_USER: 0,
    RESOLVED: 0,
    CLOSED: 0,
    CANCELLED: 0,
  };

  const initialCategories: Record<string, number> = {
    HARDWARE: 0,
    SOFTWARE: 0,
    NETWORK: 0,
    ACCESS: 0,
    EMAIL: 0,
    TELEPHONY: 0,
    OTHER: 0,
  };

  let openCount = 0;
  let inProgressCount = 0;
  let waitingCount = 0;
  let resolvedCount = 0;
  let closedCount = 0;
  let cancelledCount = 0;
  let unassignedCount = 0;
  let criticalUrgentCount = 0;
  let slaBreachedCount = 0;

  for (const t of activeTickets) {
    // Priority tally
    if (t.priority && initialPriorities[t.priority] !== undefined) {
      initialPriorities[t.priority]++;
    }
    if (t.priority === 'CRITICAL' || t.priority === 'URGENT') {
      criticalUrgentCount++;
    }

    // Status tally
    if (t.status && initialStatuses[t.status] !== undefined) {
      initialStatuses[t.status]++;
    }

    // Category tally
    if (t.category && initialCategories[t.category] !== undefined) {
      initialCategories[t.category]++;
    }

    // Stage tallies
    if (['NEW', 'ASSIGNED', 'OPEN'].includes(t.status)) {
      openCount++;
    } else if (t.status === 'IN_PROGRESS') {
      inProgressCount++;
    } else if (['WAITING_FOR_USER', 'PENDING_VENDOR', 'PENDING_USER'].includes(t.status)) {
      waitingCount++;
    } else if (t.status === 'RESOLVED') {
      resolvedCount++;
    } else if (t.status === 'CLOSED') {
      closedCount++;
    } else if (t.status === 'CANCELLED') {
      cancelledCount++;
    }

    // Unassigned check
    if (!t.assignedTechnicianId && !t.assignedTeamId) {
      unassignedCount++;
    }

    // SLA breach check
    const now = new Date();
    if (
      t.status !== 'RESOLVED' &&
      t.status !== 'CLOSED' &&
      t.status !== 'CANCELLED'
    ) {
      const resDeadline = t.resolutionTargetTime || t.slaResolutionDueAt;
      if (resDeadline && new Date(resDeadline) < now) {
        slaBreachedCount++;
      }
    }
  }

  return {
    totalCount: activeTickets.length,
    openCount,
    inProgressCount,
    waitingCount,
    resolvedCount,
    closedCount,
    cancelledCount,
    unassignedCount,
    criticalUrgentCount,
    slaBreachedCount,
    byPriority: initialPriorities,
    byStatus: initialStatuses,
    byCategory: initialCategories,
  };
}

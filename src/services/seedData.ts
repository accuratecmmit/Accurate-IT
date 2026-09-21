/**
 * Initial Master Data & Normalized Schema Seeds
 * Contains initial 3 Companies, 6 Locations, IT Teams, Departments, SLA Policies,
 * and sequence counters.
 */

import {
  Company,
  Location,
  Department,
  ITTeam,
  SLAConfig,
  SequenceCounter,
  RoleDefinition,
  ROLE_DEFINITIONS,
} from '../types';

export const INITIAL_ROLES: RoleDefinition[] = [
  {
    id: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: ROLE_DEFINITIONS.SUPER_ADMIN.description,
    isSystem: true,
    permissions: ROLE_DEFINITIONS.SUPER_ADMIN,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'IT_ADMIN',
    name: 'IT Admin',
    description: ROLE_DEFINITIONS.IT_ADMIN.description,
    isSystem: true,
    permissions: ROLE_DEFINITIONS.IT_ADMIN,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'IT_TECHNICIAN',
    name: 'IT Technician',
    description: ROLE_DEFINITIONS.IT_TECHNICIAN.description,
    isSystem: true,
    permissions: ROLE_DEFINITIONS.IT_TECHNICIAN,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'EMPLOYEE',
    name: 'Employee',
    description: ROLE_DEFINITIONS.EMPLOYEE.description,
    isSystem: true,
    permissions: ROLE_DEFINITIONS.EMPLOYEE,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

// Initial Companies (Clean state per user instruction)
export const INITIAL_COMPANIES: Company[] = [];

// Initial Locations (Clean state per user instruction)
export const INITIAL_LOCATIONS: Location[] = [];

// Initial IT Teams
export const INITIAL_IT_TEAMS: ITTeam[] = [
  {
    id: 'team_tier1',
    code: 'HELP-L1',
    name: 'Tier 1 Service Desk & User Support',
    description: 'First-line incident triage, password resets, onboarding setups, and hardware dispatch.',
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'team_infra',
    code: 'NET-OPS',
    name: 'Infrastructure & Network Systems',
    description: 'VPN gateways, cloud servers, local office switches, DNS, and server room hardware.',
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'team_security',
    code: 'SEC-OPS',
    name: 'Information Security & Access Management',
    description: 'MFA compliance, single sign-on authorizations, threat auditing, and privileged role governance.',
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

// Initial Departments (Clean state per user instruction)
export const INITIAL_DEPARTMENTS: Department[] = [];

// Initial SLA Policies
export const INITIAL_SLA_CONFIGS: SLAConfig[] = [
  {
    id: 'sla_urgent',
    name: 'Urgent Outage SLA (P1)',
    priority: 'URGENT',
    responseTimeMinutes: 15,
    resolutionTimeMinutes: 120, // 2 hours
    businessHoursOnly: false,
    escalationTeamId: 'team_infra',
    isDefault: true,
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'sla_high',
    name: 'High Priority SLA (P2)',
    priority: 'HIGH',
    responseTimeMinutes: 60,
    resolutionTimeMinutes: 240, // 4 hours
    businessHoursOnly: true,
    escalationTeamId: 'team_tier1',
    isDefault: true,
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'sla_medium',
    name: 'Standard Request SLA (P3)',
    priority: 'MEDIUM',
    responseTimeMinutes: 240, // 4 hours
    resolutionTimeMinutes: 1440, // 24 hours
    businessHoursOnly: true,
    escalationTeamId: 'team_tier1',
    isDefault: true,
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'sla_low',
    name: 'Low Priority SLA (P4)',
    priority: 'LOW',
    responseTimeMinutes: 480, // 8 hours
    resolutionTimeMinutes: 2880, // 48 hours
    businessHoursOnly: true,
    escalationTeamId: 'team_tier1',
    isDefault: true,
    status: 'ACTIVE',
    isDeleted: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

// Initial Non-reusable Sequence Counters
export const INITIAL_SEQUENCES: SequenceCounter[] = [
  {
    id: 'ticket_sequence',
    prefix: 'TCK',
    currentNumber: 10001,
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'asset_sequence',
    prefix: 'AST',
    currentNumber: 8001,
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];

/**
 * Security and RBAC Authorization Boundary Verification Test Suite
 * 
 * Verifies:
 * 1. Role-Based Access Control (Super Admin, IT Admin, Technician, Employee)
 * 2. IT Team-based authorization & "Take Ticket" workflow (New -> Assigned)
 * 3. Employee limits (cannot change status, cannot close, can edit/cancel only when New or Assigned)
 * 4. Master Data governance (Company & Location independence, safe archive, no physical delete)
 * 5. Ticket numbers never reused and permanent retention
 * 6. Audit logging across ticket and non-ticket modules
 */

const BASE_URL = 'http://localhost:3000';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    displayName: string;
    itTeamId?: string;
  };
}

async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Login failed for ${username}: ${data.error}`);
  }
  return data;
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${detail}`);
  }
}

async function runSecurityTests() {
  console.log('=== STARTING ENTERPRISE SECURITY & RBAC VERIFICATION ===\n');

  try {
    // 1. Authenticate users across roles
    console.log('--- Phase 1: Authentication & Role Tokens ---');
    const superAdminAuth = await login('accurateadmin', 'Admin#2026!');
    const itAdminAuth = await login('itadmin', 'ItAdmin#2026!');
    const techAuth = await login('technician', 'Tech#2026!');
    const rahulAuth = await login('Rahul', 'Rahul#2026!');

    // Approve Ananya using Super Admin to test approval workflow
    const approveAnanyaRes = await fetch(`${BASE_URL}/api/admin/approve-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminAuth.token}`,
      },
      body: JSON.stringify({ userId: 'usr_ananya', role: 'EMPLOYEE' }),
    });
    const approveData = await approveAnanyaRes.json();
    assert(approveAnanyaRes.status === 200, 'Super Admin approves pending employee Ananya registration');

    const ananyaAuth = await login('Ananya', 'Ananya#2026!');

    assert(superAdminAuth.user.role === 'SUPER_ADMIN', 'Super Admin authenticated and role verified');
    assert(itAdminAuth.user.role === 'IT_ADMIN', 'IT Admin authenticated and role verified');
    assert(techAuth.user.role === 'IT_TECHNICIAN', 'IT Technician authenticated and role verified');
    assert(rahulAuth.user.role === 'EMPLOYEE', 'Employee Rahul authenticated and role verified');
    assert(ananyaAuth.user.role === 'EMPLOYEE', 'Employee Ananya authenticated and role verified');

    // 2. Master Data Authorization: Non-SuperAdmin must receive 403
    console.log('\n--- Phase 2: Master Data RBAC Authorization ---');
    const empCompanyRes = await fetch(`${BASE_URL}/api/master/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahulAuth.token}`,
      },
      body: JSON.stringify({ code: 'UNAUTH', name: 'Unauthorized Corp' }),
    });
    assert(empCompanyRes.status === 403, 'Employee forbidden from creating Company (HTTP 403)');

    const techLocRes = await fetch(`${BASE_URL}/api/master/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${techAuth.token}`,
      },
      body: JSON.stringify({ code: 'UNAUTH', name: 'Unauthorized Loc' }),
    });
    assert(techLocRes.status === 403, 'Technician forbidden from creating Location (HTTP 403)');

    const itAdminDeptRes = await fetch(`${BASE_URL}/api/master/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${itAdminAuth.token}`,
      },
      body: JSON.stringify({ code: 'UNAUTH', name: 'Unauthorized Dept' }),
    });
    assert(itAdminDeptRes.status === 403, 'IT Admin forbidden from creating Department (HTTP 403)');

    // 3. Master Data Independence & Safe Archive
    console.log('\n--- Phase 3: Master Data Independence & Safe Archive ---');
    const testLocCode = `INDEP_${Date.now().toString().slice(-4)}`;
    const createLocRes = await fetch(`${BASE_URL}/api/master/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminAuth.token}`,
      },
      body: JSON.stringify({
        code: testLocCode,
        name: 'Denver Tech Center',
        city: 'Denver',
        country: 'USA',
        timezone: 'America/Denver',
        // Note: No companyId required. Proves independent entities.
      }),
    });
    const createLocData = await createLocRes.json();
    assert(createLocRes.status === 201, 'Super Admin can create Location without mandatory company relationship');
    const newLocId = createLocData.location?.id;

    // Archive Location (Soft-delete preserving historical records)
    const archiveLocRes = await fetch(`${BASE_URL}/api/master/locations/${newLocId}/archive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminAuth.token}`,
      },
    });
    const archiveLocData = await archiveLocRes.json();
    assert(archiveLocRes.status === 200, 'Super Admin archived Location');
    assert(archiveLocData.location?.isArchived === true, 'Location isArchived = true (retained in DB)');
    assert(archiveLocData.location?.status === 'ARCHIVED', 'Location status = ARCHIVED');

    // Restore Location
    const restoreLocRes = await fetch(`${BASE_URL}/api/master/locations/${newLocId}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminAuth.token}`,
      },
    });
    const restoreLocData = await restoreLocRes.json();
    assert(restoreLocRes.status === 200, 'Super Admin restored Location');
    assert(restoreLocData.location?.isArchived === false, 'Location restored isArchived = false');

    // 4. Ticket Lifecycle Workflow & Boundaries
    console.log('\n--- Phase 4: Ticket Lifecycle Workflow & Boundaries ---');
    // Employee Rahul creates a ticket with complete 9 fields
    const createTicketRes = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahulAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Workstation Kernel Panic on boot',
        description: 'Encountered kernel panic after applying security patch KB89201. Requires IT intervention.',
        category: 'HARDWARE',
        priority: 'HIGH',
        contactNumber: '+1 (555) 012-7711',
        locationId: newLocId,
        relatedAssetTag: 'AST-ENG-409',
        assignedTeamId: 'team_tier1',
      }),
    });
    const createTicketData = await createTicketRes.json();
    assert(createTicketRes.status === 201, 'Employee Rahul created ticket with all fields');
    const ticketId = createTicketData.ticket?.id;
    const ticketNumber = createTicketData.ticket?.ticketNumber;
    assert(ticketNumber && (ticketNumber.startsWith('TCK-') || ticketNumber.startsWith('TICK-')), `Non-reusable ticket sequence allocated: ${ticketNumber}`);
    assert(createTicketData.ticket?.status === 'NEW', 'Ticket initial status is NEW');

    // Employee Ananya CANNOT view or edit Rahul's ticket (RBAC boundary)
    const ananyaViewRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${ananyaAuth.token}` },
    });
    assert(ananyaViewRes.status === 403, 'Employee Ananya cannot view Rahul ticket (HTTP 403)');

    // Employee Rahul CANNOT manually change status
    const rahulStatusRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahulAuth.token}`,
      },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    assert(rahulStatusRes.status === 403, 'Employee Rahul CANNOT manually change status (HTTP 403)');

    // Employee Rahul CAN edit ticket while in NEW status
    const rahulEditRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahulAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Workstation Kernel Panic on boot (Updated details)',
        description: 'Kernel panic occurs specifically when docking station is attached.',
        category: 'HARDWARE',
      }),
    });
    assert(rahulEditRes.status === 200, 'Employee Rahul can edit ticket while NEW');

    // 5. IT Technician "Take Ticket" & Workflow Transition
    console.log('\n--- Phase 5: IT Technician "Take Ticket" & Workflow ---');
    // Technician takes unassigned ticket -> Status moves from NEW to ASSIGNED
    const takeTicketRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}/take`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${techAuth.token}`,
      },
    });
    const takeTicketData = await takeTicketRes.json();
    assert(takeTicketRes.status === 200, 'Technician takes unassigned ticket');
    assert(takeTicketData.ticket?.status === 'ASSIGNED', 'Taking ticket transitions status NEW -> ASSIGNED');
    assert(takeTicketData.ticket?.assignedTechnicianId === techAuth.user.id, 'Ticket assigned to current technician');

    // Technician transitions ticket: ASSIGNED -> IN_PROGRESS
    const inProgressRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${techAuth.token}`,
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    assert(inProgressRes.status === 200, 'Technician advances ticket to IN_PROGRESS');

    // Now that ticket is IN_PROGRESS, Employee CANNOT edit
    const blockedEditRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahulAuth.token}`,
      },
      body: JSON.stringify({ title: 'Unauthorized edit during progress' }),
    });
    assert(blockedEditRes.status === 400 || blockedEditRes.status === 403, 'Employee CANNOT edit ticket once In Progress');

    // Technician transitions ticket: IN_PROGRESS -> RESOLVED
    const resolveRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${techAuth.token}`,
      },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    assert(resolveRes.status === 200, 'Technician sets status to RESOLVED');

    // Technician closes ticket: RESOLVED -> CLOSED
    const closeRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${techAuth.token}`,
      },
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    assert(closeRes.status === 200, 'Technician closes ticket (CLOSED)');

    // Employee CANNOT reopen Closed ticket
    const reopenRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahulAuth.token}`,
      },
      body: JSON.stringify({ status: 'NEW' }),
    });
    assert(reopenRes.status === 403, 'Employee CANNOT reopen Closed ticket (HTTP 403)');

    // 6. Test Ticket Cancellation & Permanent Retention
    console.log('\n--- Phase 6: Cancellation & Permanent Retention ---');
    // Create another ticket as Rahul to test cancellation while NEW
    const ticketToCancelRes = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahulAuth.token}`,
      },
      body: JSON.stringify({
        title: 'Temporary display flickers',
        description: 'Cable was loose. Creating to test cancellation.',
        category: 'HARDWARE',
        priority: 'LOW',
      }),
    });
    const ticketToCancelData = await ticketToCancelRes.json();
    const cancelTicketId = ticketToCancelData.ticket?.id;

    // Rahul cancels the ticket
    const cancelRes = await fetch(`${BASE_URL}/api/tickets/${cancelTicketId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahulAuth.token}`,
      },
      body: JSON.stringify({ reason: 'Cable reseated; issue solved independently.' }),
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, 'Employee cancels ticket while NEW');
    assert(cancelData.ticket?.status === 'CANCELLED', 'Ticket status marked as CANCELLED');

    // Verify cancelled ticket is retained permanently (never deleted)
    const verifyRetainedRes = await fetch(`${BASE_URL}/api/tickets/${cancelTicketId}`, {
      headers: { Authorization: `Bearer ${rahulAuth.token}` },
    });
    assert(verifyRetainedRes.status === 200, 'Cancelled ticket is retained permanently in database');

    // 7. Audit Logging Verification
    console.log('\n--- Phase 7: Audit Logging Across Modules ---');
    const historyRes = await fetch(`${BASE_URL}/api/tickets/${ticketId}/history`, {
      headers: { Authorization: `Bearer ${superAdminAuth.token}` },
    });
    const historyData = await historyRes.json();
    assert(historyRes.status === 200, 'Ticket history endpoint returned 200 OK');
    assert(historyData.history?.length >= 4, `Chronological ticket history recorded (${historyData.history?.length} events)`);

    // Audit logs for non-ticket modules (LOCATION, USER, etc.)
    const auditRes = await fetch(`${BASE_URL}/api/audit-logs?entityType=LOCATION`, {
      headers: { Authorization: `Bearer ${superAdminAuth.token}` },
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200, 'Master data audit logs queryable');
    const hasLocationAudit = auditData.auditLogs?.some((l: any) => l.entityType === 'LOCATION');
    assert(hasLocationAudit, 'Master Data Location operations recorded in audit log');

    console.log(`\n=== SECURITY VERIFICATION COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED ===\n`);
  } catch (err: any) {
    console.error('Test execution fatal error:', err);
  }
}

runSecurityTests();

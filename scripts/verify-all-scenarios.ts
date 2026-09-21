/**
 * Verification Test Suite for Section 29 (TESTING VERIFICATION)
 * 
 * Verifies:
 * - Employee Tests (Attempts + Verifications)
 * - Technician Tests (Attempts + Verifications)
 * - IT Admin Tests (Attempts + Verifications)
 * - Super Admin Tests (Verifications)
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
    assetTag?: string;
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

async function runScenarioTests() {
  console.log('===============================================================');
  console.log('  ENTERPRISE IT HELPDESK: SECTION 29 SECURITY VERIFICATION');
  console.log('===============================================================\n');

  try {
    // Authenticate users across roles
    const superAdmin = await login('accurateadmin', 'Admin#2026!');
    const itAdmin = await login('itadmin', 'ItAdmin#2026!');
    const tech = await login('technician', 'Tech#2026!');
    const rahul = await login('Rahul', 'Rahul#2026!');
    const ananya = await login('Ananya', 'Ananya#2026!');

    console.log('--- Phase 1: Authentication Verified Across All Roles ---');
    assert(superAdmin.user.role === 'SUPER_ADMIN', 'Super Admin logged in');
    assert(itAdmin.user.role === 'IT_ADMIN', 'IT Admin logged in (Team: team_tier1)');
    assert(tech.user.role === 'IT_TECHNICIAN', 'IT Technician logged in (Team: team_tier1)');
    assert(rahul.user.role === 'EMPLOYEE', 'Employee Rahul logged in');
    assert(ananya.user.role === 'EMPLOYEE', 'Employee Ananya logged in');

    // =========================================================================
    // SECTION 29: EMPLOYEE TESTS
    // =========================================================================
    console.log('\n--- Section 29: Employee Tests (Attempt & Verify) ---');

    // Setup: Rahul creates a ticket
    const rahulTicketRes = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({
        title: 'Rahul Laptop Battery Health Degraded',
        description: 'Battery cycle count exceeds 1200, requires replacement.',
        category: 'HARDWARE',
        priority: 'MEDIUM',
        assignedTeamId: 'team_tier1',
      }),
    });
    const rahulTicketData = await rahulTicketRes.json();
    const rahulTicketId = rahulTicketData.ticket.id;
    assert(rahulTicketRes.status === 201, 'Rahul created a new ticket');

    // Setup: Ananya creates a ticket
    const ananyaTicketRes = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ananya.token}`,
      },
      body: JSON.stringify({
        title: 'Ananya VPN Access Issue',
        description: 'Unable to connect to APAC gateway.',
        category: 'NETWORK',
        priority: 'HIGH',
        assignedTeamId: 'team_tier1',
      }),
    });
    const ananyaTicketData = await ananyaTicketRes.json();
    const ananyaTicketId = ananyaTicketData.ticket.id;

    // 1. Attempt: Access another employee's ticket -> MUST FAIL
    const empAccessTicketRes = await fetch(`${BASE_URL}/api/tickets/${ananyaTicketId}`, {
      headers: { Authorization: `Bearer ${rahul.token}` },
    });
    assert(empAccessTicketRes.status === 403, 'Attempt: Rahul access Ananya ticket -> MUST FAIL (HTTP 403)');

    // 2. Attempt: Access another employee's asset -> MUST FAIL
    // ast_fin_112 is HP Elite Dragonfly assigned to Finance / non-Rahul asset
    const empAccessAssetRes = await fetch(`${BASE_URL}/api/assets/ast_fin_112`, {
      headers: { Authorization: `Bearer ${rahul.token}` },
    });
    assert(empAccessAssetRes.status === 403, 'Attempt: Rahul access another asset (ast_fin_112) -> MUST FAIL (HTTP 403)');

    // 3. Attempt: Access another employee's notifications -> MUST FAIL
    // Fetch ananya notifications to get an ID
    const ananyaNotifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${ananya.token}` },
    });
    const ananyaNotifData = await ananyaNotifRes.json();
    let ananyaNotifId = ananyaNotifData.notifications?.[0]?.id;
    if (!ananyaNotifId) {
      ananyaNotifId = 'notif_ananya_test';
    }
    const rahulReadAnanyaNotifRes = await fetch(`${BASE_URL}/api/notifications/${ananyaNotifId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rahul.token}` },
    });
    assert(rahulReadAnanyaNotifRes.status === 403 || rahulReadAnanyaNotifRes.status === 404, 'Attempt: Rahul access Ananya notification -> MUST FAIL (HTTP 403/404)');

    // 4. Attempt: Change official profile fields directly -> MUST FAIL
    const empChangeProfileRes = await fetch(`${BASE_URL}/api/user/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({ displayName: 'Hacked Name', departmentId: 'dept_it' }),
    });
    assert(empChangeProfileRes.status === 403, 'Attempt: Rahul change official profile fields directly -> MUST FAIL (HTTP 403)');

    // 5. Attempt: Change ticket status manually -> MUST FAIL
    const empChangeStatusRes = await fetch(`${BASE_URL}/api/tickets/${rahulTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    assert(empChangeStatusRes.status === 403, 'Attempt: Rahul change ticket status manually -> MUST FAIL (HTTP 403)');

    // 6. Attempt: Close ticket -> MUST FAIL
    const empCloseTicketRes = await fetch(`${BASE_URL}/api/tickets/${rahulTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    assert(empCloseTicketRes.status === 403, 'Attempt: Rahul close ticket -> MUST FAIL (HTTP 403)');

    // 7. Attempt: Reopen ticket -> MUST FAIL
    const empReopenTicketRes = await fetch(`${BASE_URL}/api/tickets/${rahulTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    assert(empReopenTicketRes.status === 403, 'Attempt: Rahul reopen ticket -> MUST FAIL (HTTP 403)');

    // 8. Verify: Employee can edit ticket while New or Assigned
    const empEditNewTicketRes = await fetch(`${BASE_URL}/api/tickets/${rahulTicketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({
        title: 'Rahul Laptop Battery Health Degraded (Updated Diagnostics)',
        description: 'Battery health dropped to 68% and causes random shutdowns.',
      }),
    });
    assert(empEditNewTicketRes.status === 200, 'Verify: Rahul can edit ticket while NEW');

    // 9. Advance ticket to IN_PROGRESS using Technician
    await fetch(`${BASE_URL}/api/tickets/${rahulTicketId}/take`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tech.token}` },
    });
    await fetch(`${BASE_URL}/api/tickets/${rahulTicketId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tech.token}`,
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });

    // 10. Attempt: Cancel ticket after progress begins -> MUST FAIL
    const empCancelInProgressRes = await fetch(`${BASE_URL}/api/tickets/${rahulTicketId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({ reason: 'Trying to cancel in progress' }),
    });
    assert(empCancelInProgressRes.status === 400 || empCancelInProgressRes.status === 403, 'Attempt: Rahul cancel ticket after progress begins -> MUST FAIL (HTTP 400/403)');

    // 11. Attempt: Edit ticket after progress begins -> MUST FAIL
    const empEditInProgressRes = await fetch(`${BASE_URL}/api/tickets/${rahulTicketId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({ title: 'Illegal edit during IN_PROGRESS' }),
    });
    assert(empEditInProgressRes.status === 400 || empEditInProgressRes.status === 403, 'Attempt: Rahul edit ticket after progress begins -> MUST FAIL (HTTP 400/403)');

    // 12. Verify: Employee can update mobile number
    const updateMobileRes = await fetch(`${BASE_URL}/api/user/profile/mobile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({ mobileNumber: '+1 (415) 555-0199' }),
    });
    const updateMobileData = await updateMobileRes.json();
    assert(updateMobileRes.status === 200, 'Verify: Employee Rahul can update mobile number directly');
    assert(updateMobileData.mobileNumber === '+1 (415) 555-0199', 'Mobile number updated successfully');

    // 13. Verify: Employee can submit profile change request
    const uniqueTitle = `Staff Specialist ${Date.now() % 10000}`;
    const changeReqRes = await fetch(`${BASE_URL}/api/user/profile/change-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({
        designation: uniqueTitle,
        reason: 'Annual role reclassification to Staff Specialist.',
      }),
    });
    const changeReqData = await changeReqRes.json();
    assert(changeReqRes.status === 201, 'Verify: Employee can submit official profile change request', changeReqData.error || '');
    const rahulReqId = changeReqData.changeRequest?.id;

    // 14. Verify: Employee can cancel ticket while New or Assigned
    const rahulTicket2Res = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({
        title: 'Monitor flickering issue',
        description: 'HDMI cable loose.',
        category: 'HARDWARE',
        priority: 'LOW',
        assignedTeamId: 'team_tier1',
      }),
    });
    const rahulTicket2Data = await rahulTicket2Res.json();
    const rahulTicket2Id = rahulTicket2Data.ticket.id;

    const cancelTicketRes = await fetch(`${BASE_URL}/api/tickets/${rahulTicket2Id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rahul.token}`,
      },
      body: JSON.stringify({ reason: 'Replaced cable independently, resolved.' }),
    });
    assert(cancelTicketRes.status === 200, 'Verify: Employee can cancel ticket while NEW');

    // 15. Verify: Employee dashboard summary numbers match actual owned tickets
    const summaryRes = await fetch(`${BASE_URL}/api/employee/dashboard-summary`, {
      headers: { Authorization: `Bearer ${rahul.token}` },
    });
    const summaryData = await summaryRes.json();
    assert(summaryRes.status === 200, 'Verify: Employee dashboard summary endpoint returns 200 OK');
    
    // Fetch actual owned tickets
    const myTicketsRes = await fetch(`${BASE_URL}/api/tickets`, {
      headers: { Authorization: `Bearer ${rahul.token}` },
    });
    const myTicketsData = await myTicketsRes.json();
    assert(
      summaryData.summary.totalTickets === myTicketsData.tickets.length,
      `Verify: Dashboard total tickets (${summaryData.summary.totalTickets}) strictly equals owned tickets (${myTicketsData.tickets.length})`
    );

    // =========================================================================
    // SECTION 29: TECHNICIAN TESTS
    // =========================================================================
    console.log('\n--- Section 29: Technician Tests (Attempt & Verify) ---');

    // 1. Attempt: Access another team's ticket -> MUST FAIL
    // tck_1002 is assigned to team_infra, while tech is in team_tier1
    const techAccessOtherTeamTicketRes = await fetch(`${BASE_URL}/api/tickets/tck_1002`, {
      headers: { Authorization: `Bearer ${tech.token}` },
    });
    assert(techAccessOtherTeamTicketRes.status === 403, 'Attempt: Technician access another team ticket (tck_1002) -> MUST FAIL (HTTP 403)');

    // 2. Attempt: Access another team's asset -> MUST FAIL
    // ast_infra_switch_01 is assigned to team_infra
    const techAccessOtherTeamAssetRes = await fetch(`${BASE_URL}/api/assets/ast_infra_switch_01`, {
      headers: { Authorization: `Bearer ${tech.token}` },
    });
    assert(techAccessOtherTeamAssetRes.status === 403, 'Attempt: Technician access another team asset (ast_infra_switch_01) -> MUST FAIL (HTTP 403)');

    // 3. Attempt: Change unauthorized ticket -> MUST FAIL
    const techModifyOtherTeamTicketRes = await fetch(`${BASE_URL}/api/tickets/tck_1002/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tech.token}`,
      },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    assert(techModifyOtherTeamTicketRes.status === 403, 'Attempt: Technician modify unauthorized ticket status -> MUST FAIL (HTTP 403)');

    // 4. Attempt: Assign users to teams -> MUST FAIL
    const techAssignTeamRes = await fetch(`${BASE_URL}/api/admin/assign-team`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tech.token}`,
      },
      body: JSON.stringify({ userId: 'usr_ananya', itTeamId: 'team_tier1' }),
    });
    assert(techAssignTeamRes.status === 403, 'Attempt: Technician assign user to team -> MUST FAIL (HTTP 403)');

    // 5. Attempt: Change own role -> MUST FAIL
    const techChangeRoleRes = await fetch(`${BASE_URL}/api/user/role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tech.token}`,
      },
      body: JSON.stringify({ role: 'SUPER_ADMIN' }),
    });
    assert(techChangeRoleRes.status === 403, 'Attempt: Technician change own role -> MUST FAIL (HTTP 403)');

    // 6. Verify: Take unassigned ticket within team
    // Create an unassigned ticket in team_tier1
    const unassignedTicketRes = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ananya.token}`,
      },
      body: JSON.stringify({
        title: 'Ananya Software Licensing Setup',
        description: 'Need IDE license key assigned.',
        category: 'SOFTWARE',
        priority: 'MEDIUM',
        assignedTeamId: 'team_tier1',
      }),
    });
    const unassignedData = await unassignedTicketRes.json();
    const unassignedId = unassignedData.ticket.id;

    const takeRes = await fetch(`${BASE_URL}/api/tickets/${unassignedId}/take`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tech.token}` },
    });
    const takeData = await takeRes.json();
    assert(takeRes.status === 200, 'Verify: Technician can take unassigned ticket within their team');
    assert(takeData.ticket?.status === 'ASSIGNED', 'Taking ticket transitions status NEW -> ASSIGNED');
    assert(takeData.ticket?.assignedTechnicianId === tech.user.id, 'Ticket assigned to current technician');

    // 7. Verify: Update ticket status according to permitted workflow
    const progressRes = await fetch(`${BASE_URL}/api/tickets/${unassignedId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tech.token}`,
      },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    assert(progressRes.status === 200, 'Verify: Technician advances status to IN_PROGRESS');

    const resolveRes = await fetch(`${BASE_URL}/api/tickets/${unassignedId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tech.token}`,
      },
      body: JSON.stringify({ status: 'RESOLVED' }),
    });
    assert(resolveRes.status === 200, 'Verify: Technician advances status to RESOLVED');

    const closeRes = await fetch(`${BASE_URL}/api/tickets/${unassignedId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tech.token}`,
      },
      body: JSON.stringify({ status: 'CLOSED' }),
    });
    assert(closeRes.status === 200, 'Verify: Technician closes ticket (CLOSED)');

    // =========================================================================
    // SECTION 29: IT ADMIN TESTS
    // =========================================================================
    console.log('\n--- Section 29: IT Admin Tests (Attempt & Verify) ---');

    // 1. Attempt: Access another team's tickets -> MUST FAIL
    const itAdminOtherTicketRes = await fetch(`${BASE_URL}/api/tickets/tck_1002`, {
      headers: { Authorization: `Bearer ${itAdmin.token}` },
    });
    assert(itAdminOtherTicketRes.status === 403, 'Attempt: IT Admin access another team ticket (tck_1002) -> MUST FAIL (HTTP 403)');

    // 2. Attempt: Manage another team's users -> MUST FAIL
    // usr_infra_tech is in team_infra, while itAdmin is in team_tier1
    const itAdminManageOtherTeamUserRes = await fetch(`${BASE_URL}/api/admin/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${itAdmin.token}`,
      },
      body: JSON.stringify({ userId: 'usr_infra_tech' }),
    });
    assert(itAdminManageOtherTeamUserRes.status === 403, 'Attempt: IT Admin reset password for user in another IT Team -> MUST FAIL (HTTP 403)');

    // 3. Attempt: Change IT Team structure -> MUST FAIL
    const itAdminChangeTeamRes = await fetch(`${BASE_URL}/api/it-teams/team_tier1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${itAdmin.token}`,
      },
      body: JSON.stringify({ name: 'Unauthorized Renamed Team' }),
    });
    assert(itAdminChangeTeamRes.status === 403, 'Attempt: IT Admin change IT Team structure -> MUST FAIL (HTTP 403)');

    // 4. Attempt: Move user to another IT Team -> MUST FAIL
    const itAdminMoveUserTeamRes = await fetch(`${BASE_URL}/api/admin/assign-team`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${itAdmin.token}`,
      },
      body: JSON.stringify({ userId: 'usr_ananya', itTeamId: 'team_infra' }),
    });
    assert(itAdminMoveUserTeamRes.status === 403, 'Attempt: IT Admin move user to another IT Team -> MUST FAIL (HTTP 403)');

    // 5. Attempt: Manage Company -> MUST FAIL
    const itAdminCreateCompanyRes = await fetch(`${BASE_URL}/api/master/companies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${itAdmin.token}`,
      },
      body: JSON.stringify({ name: 'Unauthorized Company LLC' }),
    });
    assert(itAdminCreateCompanyRes.status === 403, 'Attempt: IT Admin manage Company -> MUST FAIL (HTTP 403)');

    // 6. Attempt: Manage Location -> MUST FAIL
    const itAdminCreateLocationRes = await fetch(`${BASE_URL}/api/master/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${itAdmin.token}`,
      },
      body: JSON.stringify({ name: 'Unauthorized Tokyo DC', code: 'TYO', city: 'Tokyo', country: 'Japan' }),
    });
    assert(itAdminCreateLocationRes.status === 403, 'Attempt: IT Admin manage Location -> MUST FAIL (HTTP 403)');

    // 7. Attempt: Manage Department -> MUST FAIL
    const itAdminCreateDeptRes = await fetch(`${BASE_URL}/api/master/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${itAdmin.token}`,
      },
      body: JSON.stringify({ name: 'Unauthorized Marketing Dept', code: 'MKT' }),
    });
    assert(itAdminCreateDeptRes.status === 403, 'Attempt: IT Admin manage Department -> MUST FAIL (HTTP 403)');

    // 8. Verify: Review profile change request within scope
    // IT Admin reviews Rahul's change request (usr_rahul has no IT team, in general scope)
    const reviewReqRes = await fetch(`${BASE_URL}/api/admin/profile-change-requests/${rahulReqId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${itAdmin.token}`,
      },
      body: JSON.stringify({
        action: 'APPROVE',
        reviewNotes: 'Verified promotion and department updates with HR.',
      }),
    });
    const reviewReqData = await reviewReqRes.json();
    assert(reviewReqRes.status === 200, 'Verify: IT Admin can review profile change request within scope');
    assert(reviewReqData.changeRequest?.status === 'APPROVED', 'Change request status marked APPROVED');

    // 9. Verify: Reset user password within scope
    // Register and approve a test user to keep Ananya/Rahul passwords stable
    const testLetters = Math.random().toString(36).replace(/[^a-zA-Z]/g, '').slice(0, 6) || 'abcdef';
    const testUsername = `Candidate${testLetters}`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeName: 'Reset Candidate Employee',
        username: testUsername,
        password: 'Password#2026!',
        confirmPassword: 'Password#2026!',
        companyId: 'comp_accurate',
        locationId: 'loc_sfo',
        departmentId: 'dept_it',
        designation: 'Software Associate',
        assetTag: `AST-TEST-${Date.now() % 10000}`,
        mobileNumber: '+1 (555) 019-9988',
      }),
    });
    const regData = await regRes.json();
    const candidateUserId = regData.userId;

    // Super Admin approves the user as EMPLOYEE
    await fetch(`${BASE_URL}/api/admin/approve-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`,
      },
      body: JSON.stringify({ userId: candidateUserId, role: 'EMPLOYEE' }),
    });

    const resetUserPassRes = await fetch(`${BASE_URL}/api/admin/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${itAdmin.token}`,
      },
      body: JSON.stringify({ userId: candidateUserId }),
    });
    const resetUserPassData = await resetUserPassRes.json();
    assert(resetUserPassRes.status === 200, 'Verify: IT Admin can reset password for employee within scope', resetUserPassData.error || '');
    assert(resetUserPassData.temporaryPassword?.length >= 8, 'Temporary compliant password generated');

    // =========================================================================
    // SECTION 29: SUPER ADMIN TESTS
    // =========================================================================
    console.log('\n--- Section 29: Super Admin Tests (Verify) ---');

    // 1. Verify organization-wide access works correctly
    const allTicketsRes = await fetch(`${BASE_URL}/api/tickets`, {
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
    const allTicketsData = await allTicketsRes.json();
    assert(allTicketsRes.status === 200, 'Super Admin can access all tickets organization-wide');
    assert(allTicketsData.tickets.length >= 3, `Super Admin sees all tickets across all teams (count: ${allTicketsData.tickets.length})`);

    const allAssetsRes = await fetch(`${BASE_URL}/api/assets`, {
      headers: { Authorization: `Bearer ${superAdmin.token}` },
    });
    const allAssetsData = await allAssetsRes.json();
    assert(allAssetsRes.status === 200, 'Super Admin can access all assets organization-wide');
    assert(allAssetsData.assets.length >= 3, `Super Admin sees assets across all companies and locations (count: ${allAssetsData.assets.length})`);

    // Super Admin can create and modify IT Teams
    const createTeamRes = await fetch(`${BASE_URL}/api/it-teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`,
      },
      body: JSON.stringify({
        code: `SRE_${Date.now() % 100000}`,
        name: `DevOps Team ${Date.now() % 10000}`,
        description: 'Cloud systems and Kubernetes cluster reliability.',
      }),
    });
    const createTeamData = await createTeamRes.json();
    assert(createTeamRes.status === 201, 'Super Admin can create new IT Teams', createTeamData.error || '');
    const newTeamId = createTeamData.team?.id;

    // Super Admin can assign technician to an IT Team
    const assignUserTeamRes = await fetch(`${BASE_URL}/api/admin/assign-team`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`,
      },
      body: JSON.stringify({ userId: 'usr_technician', itTeamId: newTeamId }),
    });
    const assignUserTeamData = await assignUserTeamRes.json();
    assert(assignUserTeamRes.status === 200, 'Super Admin can assign users to IT Teams', assignUserTeamData.error || '');

    // Revert technician back to team_tier1 for test consistency
    await fetch(`${BASE_URL}/api/admin/assign-team`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`,
      },
      body: JSON.stringify({ userId: 'usr_technician', itTeamId: 'team_tier1' }),
    });

    // Super Admin can manage Company, Location, Department master data
    const randomSuffix = Math.floor(Math.random() * 90000 + 10000);
    const createLocRes = await fetch(`${BASE_URL}/api/master/locations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdmin.token}`,
      },
      body: JSON.stringify({
        name: `Austin Hub ${randomSuffix}`,
        code: `AT${randomSuffix % 1000}`,
        city: 'Austin',
        country: 'United States',
      }),
    });
    const createLocData = await createLocRes.json();
    assert(createLocRes.status === 201, 'Super Admin can create Master Data Locations', createLocData.error || '');

    console.log('\n===============================================================');
    console.log(`  VERIFICATION COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('===============================================================\n');

  } catch (err: any) {
    console.error('Fatal error running scenario tests:', err);
    process.exit(1);
  }
}

runScenarioTests();

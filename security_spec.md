# Security Specification: IT Support Helpdesk & Computer Inventory Management

## Phase 0: Security TDD & Invariants

### 1. Data Invariants
1. **Master Gate & Independent Master Data**:
   - `companies` and `locations` are independent master data entities. Only authenticated `SUPER_ADMIN` and `IT_ADMIN` users can create or modify them. Super Admin has unrestricted authority to create, update, and manage companies and locations.
   - Deletion of master data is restricted to Super Admin only.
   - Authenticated internal users (`EMPLOYEE`, `IT_TECHNICIAN`) have read-only access to active companies and locations to associate their tickets and inventory inquiries.
2. **Role-Based Access Control (RBAC)**:
   - Four distinct organizational roles:
     - `EMPLOYEE`: Can read active master data, read/write their own profile, submit/view own tickets.
     - `IT_TECHNICIAN`: Can read master data, view and update tickets, view inventory items.
     - `IT_ADMIN`: Can manage tickets, manage inventory, view audit logs, view user profiles.
     - `SUPER_ADMIN`: Complete control over master data (companies, locations), role assignments, system configuration, and audit logs.
   - Bootstrapped Super Admin: The organization owner `accuratecmmit@gmail.com` is granted authoritative Super Admin privileges.
3. **Identity & Privilege Escalation Prevention**:
   - A standard user cannot self-assign or elevate their `role` in `/users/{userId}` to `IT_ADMIN` or `SUPER_ADMIN`.
   - The `/admins/{adminId}` collection can only be written to by an existing Super Admin or through server bootstrap.
4. **Audit Log Immutability**:
   - `/audit_logs/{logId}` can be created by authenticated actors performing audited actions.
   - Updates and deletes on `/audit_logs/{logId}` are strictly forbidden (`allow update, delete: if false;`) to ensure non-repudiation.
5. **Timestamp & Key Strictness**:
   - `createdAt` is immutable on update.
   - `updatedAt` must be set via server timestamp `request.time`.
   - No unknown shadow fields may be injected beyond the strict schema.

---

### 2. The "Dirty Dozen" Payloads (Adversarial Test Vectors)

1. **Payload 1 (Privilege Escalation via Profile Update)**:
   - An `EMPLOYEE` tries to patch their own role to `SUPER_ADMIN`:
   ```json
   {
     "path": "/users/user_123",
     "operation": "update",
     "auth": { "uid": "user_123", "email": "employee@example.com" },
     "data": { "role": "SUPER_ADMIN" },
     "expectedResult": "PERMISSION_DENIED"
   }
   ```

2. **Payload 2 (Unauthorized Company Injection)**:
   - An unauthenticated user attempts to create a fake company:
   ```json
   {
     "path": "/companies/comp_evil",
     "operation": "create",
     "auth": null,
     "data": { "id": "comp_evil", "code": "EVIL", "name": "Evil Corp", "status": "ACTIVE" },
     "expectedResult": "PERMISSION_DENIED"
   }
   ```

3. **Payload 3 (Employee Tampering with Master Data)**:
   - An authenticated `EMPLOYEE` attempts to edit a location master record:
   ```json
   {
     "path": "/locations/loc_nyc",
     "operation": "update",
     "auth": { "uid": "user_emp_1", "email": "emp@company.com" },
     "data": { "name": "Hacked Location" },
     "expectedResult": "PERMISSION_DENIED"
   }
   ```

4. **Payload 4 (Audit Trail Modification)**:
   - An attacker attempts to overwrite an existing audit log entry to cover tracks:
   ```json
   {
     "path": "/audit_logs/log_999",
     "operation": "update",
     "auth": { "uid": "super_admin_1", "email": "accuratecmmit@gmail.com" },
     "data": { "action": "NORMAL_LOGIN" },
     "expectedResult": "PERMISSION_DENIED"
   }
   ```

5. **Payload 5 (Audit Trail Deletion)**:
   - Any user or admin attempts to delete an audit log:
   ```json
   {
     "path": "/audit_logs/log_999",
     "operation": "delete",
     "auth": { "uid": "super_admin_1", "email": "accuratecmmit@gmail.com" },
     "expectedResult": "PERMISSION_DENIED"
   }
   ```

6. **Payload 6 (Shadow Field Injection in Company Creation)**:
   - An admin attempts to create a company with unapproved shadow property `backdoorAccess: true`:
   ```json
   {
     "path": "/companies/comp_test",
     "operation": "create",
     "auth": { "uid": "super_admin_1", "email": "accuratecmmit@gmail.com" },
     "data": { "id": "comp_test", "code": "TEST", "name": "Test Co", "status": "ACTIVE", "backdoorAccess": true },
     "expectedResult": "PERMISSION_DENIED"
   }
   ```

7. **Payload 7 (Unverified Email Admin Spoofing)**:
   - Attacker signs in with `accuratecmmit@gmail.com` on an unverified provider (`email_verified == false`):
   ```json
   {
     "path": "/companies/comp_new",
     "operation": "create",
     "auth": { "uid": "spoofed_uid", "email": "accuratecmmit@gmail.com", "email_verified": false },
     "data": { "id": "comp_new", "code": "NEW", "name": "New Co", "status": "ACTIVE" },
     "expectedResult": "PERMISSION_DENIED"
   }
   ```

8. **Payload 8 (Document ID Poisoning / Oversized Key)**:
   - Attacker uses an ID with 2000 junk characters:
   ```json
   {
     "path": "/companies/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa...",
     "operation": "create",
     "auth": { "uid": "super_admin_1", "email": "accuratecmmit@gmail.com" },
     "data": { "code": "POIS", "name": "Poison" },
     "expectedResult": "PERMISSION_DENIED"
   }
   ```

9. **Payload 9 (Direct Admin Collection Write by Regular User)**:
   - Regular employee tries to write directly to `/admins/user_123`:
   ```json
   {
     "path": "/admins/user_123",
     "operation": "create",
     "auth": { "uid": "user_123", "email": "regular@company.com" },
     "data": { "role": "SUPER_ADMIN" },
     "expectedResult": "PERMISSION_DENIED"
   }
   ```

10. **Payload 10 (Timestamp Forgery on User Profile Creation)**:
    - User tries to set `createdAt` to a past timestamp rather than `request.time`:
    ```json
    {
      "path": "/users/user_fake",
      "operation": "create",
      "auth": { "uid": "user_fake", "email": "fake@company.com" },
      "data": { "id": "user_fake", "email": "fake@company.com", "createdAt": "2020-01-01T00:00:00Z" },
      "expectedResult": "PERMISSION_DENIED"
    }
    ```

11. **Payload 11 (Blanket Collection Scraping without Authentication)**:
    - Unauthenticated client requests `/users` list:
    ```json
    {
      "path": "/users",
      "operation": "list",
      "auth": null,
      "expectedResult": "PERMISSION_DENIED"
    }
    ```

12. **Payload 12 (Immortality Violation on Company ID)**:
    - Admin attempts to change immutable company ID or createdAt during update:
    ```json
    {
      "path": "/companies/comp_1",
      "operation": "update",
      "auth": { "uid": "super_admin_1", "email": "accuratecmmit@gmail.com" },
      "data": { "id": "comp_renamed", "createdAt": "2026-01-01T00:00:00Z" },
      "expectedResult": "PERMISSION_DENIED"
    }
    ```

---

### 3. Verification Protocol
All test payloads are prevented by the `firestore.rules` rule engine:
- Catch-all default deny.
- `isAdmin()` and `isSuperAdmin()` checking verified identity or `/admins/` document existence.
- Hardened `isValidId()` enforcing character sets and size limits.
- Immutability of key fields (`id`, `createdAt`).
- Zero-trust audit logging: append-only, no update, no delete.

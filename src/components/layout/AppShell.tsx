import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar, NavSection } from './Sidebar';
import { ArchitectureOverview } from '../dashboard/ArchitectureOverview';
import { MasterDataManager } from '../admin/MasterDataManager';
import { AuditLogViewer } from '../audit/AuditLogViewer';
import { SchemaInspector } from '../schema/SchemaInspector';
import { UserManagementView } from '../admin/UserManagementView';
import { TicketManagementView } from '../tickets/TicketManagementView';
import { InventoryManagementView } from '../inventory/InventoryManagementView';
import { ITTeamManagementView } from '../teams/ITTeamManagementView';
import { ReportsView } from '../reports/ReportsView';
import { EmployeeDashboardView } from '../employee/EmployeeDashboardView';
import { EmployeeProfileView } from '../employee/EmployeeProfileView';
import { SuperAdminDashboardView } from '../dashboard/SuperAdminDashboardView';
import { ITAdminDashboardView } from '../dashboard/ITAdminDashboardView';
import { TechnicianDashboardView } from '../dashboard/TechnicianDashboardView';
import { AuthModal } from '../auth/AuthModal';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { SessionManagerModal } from '../auth/SessionManagerModal';
import { InactivityWarningModal } from '../auth/InactivityWarningModal';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { LogIn, ShieldAlert, Ticket, Laptop, UserPlus, Users } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export const AppShell: React.FC = () => {
  const { user, profile, effectiveRole, isLoading, openAuthModal } = useAuth();
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');

  useEffect(() => {
    if (effectiveRole === 'EMPLOYEE') {
      setActiveSection('employee_dashboard');
    } else {
      setActiveSection('dashboard');
    }
  }, [effectiveRole]);

  const isAuthenticated = !!(user || profile);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      <Header />

      {/* Guest Authentication Banner */}
      {!isAuthenticated && !isLoading && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-slate-900 text-white px-5 py-3.5 rounded-2xl border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong className="text-amber-300">Enterprise Authentication Active:</strong> Sign in with your Accurate Group employee credentials or submit a new employee registration for IT Admin review.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openAuthModal('REGISTER')}
                icon={UserPlus}
                className="font-semibold rounded-xl text-xs"
              >
                Register (9 Fields)
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openAuthModal('LOGIN')}
                icon={LogIn}
                className="font-semibold rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
        />

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {/* Executive / IT Admin / Technician Dashboard */}
          {activeSection === 'dashboard' && (
            <>
              {effectiveRole === 'SUPER_ADMIN' && (
                <SuperAdminDashboardView
                  onNavigateToTickets={() => setActiveSection('tickets')}
                  onNavigateToUsers={() => setActiveSection('users')}
                  onNavigateToInventory={() => setActiveSection('inventory')}
                  onNavigateToTeams={() => setActiveSection('it_teams')}
                  onNavigateToReports={() => setActiveSection('reports')}
                />
              )}
              {effectiveRole === 'IT_ADMIN' && (
                <ITAdminDashboardView
                  onNavigateToTickets={() => setActiveSection('tickets')}
                  onNavigateToInventory={() => setActiveSection('inventory')}
                  onNavigateToReports={() => setActiveSection('reports')}
                />
              )}
              {effectiveRole === 'IT_TECHNICIAN' && (
                <TechnicianDashboardView
                  onNavigateToTickets={() => setActiveSection('tickets')}
                  onNavigateToInventory={() => setActiveSection('inventory')}
                />
              )}
              {effectiveRole === 'EMPLOYEE' && (
                <EmployeeDashboardView
                  onNavigateToProfile={() => setActiveSection('employee_profile')}
                  onNavigateToTickets={() => setActiveSection('tickets')}
                  onNavigateToInventory={() => setActiveSection('inventory')}
                />
              )}
            </>
          )}

          {/* Employee Dashboard */}
          {activeSection === 'employee_dashboard' && (
            <EmployeeDashboardView
              onNavigateToProfile={() => setActiveSection('employee_profile')}
              onNavigateToTickets={() => setActiveSection('tickets')}
              onNavigateToInventory={() => setActiveSection('inventory')}
            />
          )}

          {/* Employee Profile */}
          {activeSection === 'employee_profile' && <EmployeeProfileView />}

          {/* System Architecture (for Admins / Technicians) */}
          {activeSection === 'overview' && effectiveRole !== 'EMPLOYEE' && (
            <ArchitectureOverview
              onNavigate={(section) => setActiveSection(section as NavSection)}
            />
          )}

          {activeSection === 'users' && <UserManagementView />}

          {activeSection === 'schema' && <SchemaInspector />}

          {activeSection === 'master_data' && <MasterDataManager />}

          {activeSection === 'audit_logs' && <AuditLogViewer />}

          {activeSection === 'tickets' && <TicketManagementView />}

          {activeSection === 'inventory' && <InventoryManagementView />}

          {activeSection === 'it_teams' && <ITTeamManagementView />}

          {activeSection === 'reports' && <ReportsView />}
        </main>
      </div>

      {/* Enterprise Security Modals */}
      <AuthModal />
      <ChangePasswordModal />
      <SessionManagerModal />
      <InactivityWarningModal />
    </div>
  );
};

/**
 * Production-ready IT Support Helpdesk & Computer Inventory Management System
 * Multi-company independent master data architecture with RBAC and audit logging.
 */

import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { MasterDataProvider } from './context/MasterDataContext';
import { AppShell } from './components/layout/AppShell';

export default function App() {
  return (
    <AuthProvider>
      <MasterDataProvider>
        <AppShell />
      </MasterDataProvider>
    </AuthProvider>
  );
}

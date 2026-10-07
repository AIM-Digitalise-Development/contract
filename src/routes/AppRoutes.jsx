import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import MainLayout from '../components/layout/MainLayout';

import Login from '../pages/auth/Login';
import Dashboard from '../pages/dashboard/Dashboard';
import MasterEntry from '../pages/master/MasterEntry';
import GodownList from '../pages/godowns/GodownList';
import ProductList from '../pages/products/ProductList';
import StockOverview from '../pages/stock/StockOverview';
import TransferList from '../pages/transfers/TransferList';
import ApprovalCenter from '../pages/approvals/ApprovalCenter';
import EmployeeList from '../pages/employees/EmployeeList';
import WorkerList from '../pages/workers/WorkerList';
import WorkerDetail from '../pages/workers/WorkerDetail';
import WorkerStockRequests from '../pages/workerStock/WorkerStockRequests';
import AuditLogList from '../pages/auditLogs/AuditLogList';
import AuditEntry from '../pages/audit/AuditEntry';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />

      {/* Authenticated Application */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Master Entry (Tabs: Client Entry, Godown Entry, Product Entry, Employee Entry) */}
        <Route path="master-entry" element={<MasterEntry />} />
        <Route path="master" element={<Navigate to="/master-entry" replace />} />
        <Route path="clients" element={<Navigate to="/master-entry?tab=client" replace />} />

        {/* Workers Directory & Detail */}
        <Route path="workers" element={<WorkerList />} />
        <Route path="workers/:id" element={<WorkerDetail />} />

        {/* Warehouses & Catalog */}
        <Route path="godowns" element={<GodownList />} />
        <Route path="products" element={<ProductList />} />

        {/* Inventory & Godown Stock */}
        <Route path="stock" element={<StockOverview />} />
        <Route path="inventory" element={<Navigate to="/stock" replace />} />

        {/* Transfers */}
        <Route path="transfers" element={<TransferList />} />

        {/* Worker Stock Balances & Requests */}
        <Route path="worker-stock" element={<WorkerStockRequests />} />
        <Route path="worker-stock/requests" element={<WorkerStockRequests />} />

        {/* Supervisor, Manager & Admin Approvals */}
        <Route
          path="approvals"
          element={
            <RoleRoute allowedRoles={['admin', 'supervisor', 'manager']}>
              <ApprovalCenter />
            </RoleRoute>
          }
        />
        <Route
          path="pending-approvals"
          element={
            <RoleRoute allowedRoles={['admin', 'supervisor', 'manager']}>
              <ApprovalCenter initialTab="worker_stock" />
            </RoleRoute>
          }
        />

        {/* System Employees Management */}
        <Route
          path="employees"
          element={
            <RoleRoute allowedRoles={['admin', 'supervisor', 'manager']}>
              <EmployeeList />
            </RoleRoute>
          }
        />

        {/* Audit Entry - Complete Client Work & Material Movement Records */}
        <Route path="audit-entry" element={<AuditEntry />} />

        {/* Audit Logs (Admin only) */}
        <Route
          path="audit-logs"
          element={
            <RoleRoute allowedRoles={['admin']}>
              <AuditLogList />
            </RoleRoute>
          }
        />
      </Route>

      {/* 404 Catch All */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
            <div>
              <h1 className="text-4xl font-extrabold text-slate-900 mb-2">404</h1>
              <p className="text-sm text-slate-600 mb-6">Page not found or resource does not exist.</p>
              <a
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                Return to Dashboard
              </a>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

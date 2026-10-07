import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import auditService from '../../services/auditService';
import { extractItems } from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import { exportToCSV } from '../../utils/csvExport';
import { Download } from 'lucide-react';
import {
  ShieldAlert,
  Search,
  Filter,
  Clock,
  User,
  Activity,
  Calendar,
  Eye,
  FileText
} from '../../components/common/Icons';

export default function AuditLogList() {
  const { user } = useAuth();
  const toast = useToast();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const debouncedSearch = useDebounce(search, 300);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entity_type = entityFilter;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await auditService.getAuditLogs(params);
      setLogs(extractItems(res));
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      toast.error('Failed to load audit logs.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const safeLogs = Array.isArray(logs) ? logs : [];

  const getActionBadgeColor = (action) => {
    const act = (action || '').toLowerCase();
    if (act.includes('approve')) return 'bg-emerald-100 text-emerald-800';
    if (act.includes('reject')) return 'bg-red-100 text-red-800';
    if (act.includes('create') || act.includes('store')) return 'bg-blue-100 text-blue-800';
    if (act.includes('update')) return 'bg-amber-100 text-amber-800';
    if (act.includes('delete')) return 'bg-rose-100 text-rose-800';
    return 'bg-gray-100 text-gray-800';
  };

  const handleExportCSV = () => {
    if (!safeLogs || safeLogs.length === 0) {
      toast.warning('No audit logs to export.');
      return;
    }
    const headers = [
      { key: 'log_id', label: 'Log ID' },
      { key: 'date', label: 'Date' },
      { key: 'user', label: 'User' },
      { key: 'action', label: 'Action' },
      { key: 'entity', label: 'Entity' },
      { key: 'description', label: 'Details / Description' },
    ];
    const data = safeLogs.map((log) => {
      const entity = (log.auditable_type || log.entity_type || '').split('\\').pop();
      return {
        log_id: String(log.id).replace(/^#+/, ''),
        date: log.created_at ? new Date(log.created_at).toLocaleString() : '',
        user: log.user?.name || log.user_name || 'System / Automated',
        action: log.event || log.action || '',
        entity: `${entity} ${log.auditable_id || log.entity_id || ''}`.trim(),
        description: log.description || log.url || '',
      };
    });
    exportToCSV('audit_logs_export', headers, data);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Audit Trail"
        subtitle="Immutable records of all inventory operations, stock approvals, and administrative actions"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </Button>
            <Button variant="secondary" onClick={fetchLogs} loading={loading}>
              Refresh Logs
            </Button>
          </div>
        }
      />

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, description, or ID..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-corporate-blue focus:border-corporate-blue"
          />
        </div>

        <div className="flex gap-3 items-center">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-corporate-blue focus:border-corporate-blue"
          >
            <option value="">All Actions</option>
            <option value="create">Created / Inward</option>
            <option value="approve">Approved</option>
            <option value="reject">Rejected</option>
            <option value="update">Updated</option>
            <option value="delete">Deleted</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-corporate-blue focus:border-corporate-blue"
          >
            <option value="">All Entities</option>
            <option value="StockEntry">Stock Entries</option>
            <option value="Transfer">Transfers</option>
            <option value="WorkerStockRequest">Worker Stock Requests</option>
            <option value="Product">Products</option>
            <option value="Godown">Godowns</option>
            <option value="User">Users</option>
          </select>

          <Button variant="secondary" onClick={fetchLogs} loading={loading}>
            Filter
          </Button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading audit records...</div>
        ) : safeLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-900">No audit events recorded</p>
            <p className="text-sm">Audit records will automatically populate as actions are performed in the system.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3 text-left w-20">Log ID</th>
                  <th className="px-6 py-3 text-left">Date</th>
                  <th className="px-6 py-3 text-left">User</th>
                  <th className="px-6 py-3 text-left">Action</th>
                  <th className="px-6 py-3 text-left">Entity</th>
                  <th className="px-6 py-3 text-left">Details / Description</th>
                  <th className="px-6 py-3 text-right">View Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {safeLogs.map((log) => {
                  const entity = (log.auditable_type || log.entity_type || '').split('\\').pop();
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-700 text-xs font-mono font-bold">
                        {log.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs font-mono">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {log.user?.name || log.user_name || 'System / Automated'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActionBadgeColor(log.event || log.action)}`}>
                          {log.event || log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-corporate-blue font-semibold">
                        {entity} {log.auditable_id || log.entity_id || ''}
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-sm truncate" title={log.description || log.url || ''}>
                        {log.description || `${log.event || log.action} on ${entity}`}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {(log.old_values || log.new_values) && (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-corporate-blue hover:text-blue-800 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Diff
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diff / Detail Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Audit Record #${selectedLog.id} Details`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-3 rounded border">
              <div>
                <span className="font-semibold text-gray-600">Action:</span> {selectedLog.event || selectedLog.action}
              </div>
              <div>
                <span className="font-semibold text-gray-600">Performed By:</span> {selectedLog.user?.name || 'System'}
              </div>
              <div>
                <span className="font-semibold text-gray-600">IP Address:</span> {selectedLog.ip_address || '127.0.0.1'}
              </div>
              <div>
                <span className="font-semibold text-gray-600">Timestamp:</span> {new Date(selectedLog.created_at).toLocaleString()}
              </div>
            </div>

            {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">Previous Values</h4>
                <pre className="bg-red-50 text-red-900 p-3 rounded text-xs font-mono overflow-x-auto border border-red-200">
                  {JSON.stringify(selectedLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-gray-500 mb-1">New Values</h4>
                <pre className="bg-emerald-50 text-emerald-900 p-3 rounded text-xs font-mono overflow-x-auto border border-emerald-200">
                  {JSON.stringify(selectedLog.new_values, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t">
              <Button variant="secondary" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

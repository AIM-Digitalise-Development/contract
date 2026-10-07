import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import godownService from '../../services/godownService';
import stockService from '../../services/stockService';
import { extractErrorMessage } from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { exportToCSV } from '../../utils/csvExport';
import { Download } from 'lucide-react';

export default function GodownList({ embedded = false }) {
  const { isAdmin, isManager } = useAuth();
  const toast = useToast();

  const [godowns, setGodowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedGodown, setSelectedGodown] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'PRIMARY',
    location: '',
    status: 'ACTIVE',
  });

  // Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsStock, setDetailsStock] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Delete Confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [godownToDelete, setGodownToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGodowns = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await godownService.getGodowns({
        page,
        per_page: 10,
        search: debouncedSearch || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setGodowns(res.data?.items || []);
      setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load godowns.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, statusFilter]);

  useEffect(() => {
    fetchGodowns(1);
  }, [fetchGodowns]);

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedGodown(null);
    setFormData({
      name: '',
      code: '',
      type: 'PRIMARY',
      location: '',
      status: 'ACTIVE',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (g) => {
    setFormMode('edit');
    setSelectedGodown(g);
    setFormData({
      name: g.name || '',
      code: g.code || '',
      type: g.type || 'PRIMARY',
      location: g.location || '',
      status: g.status || 'ACTIVE',
    });
    setIsFormOpen(true);
  };

  const handleViewDetails = async (g) => {
    setSelectedGodown(g);
    setDetailsModalOpen(true);
    setDetailsLoading(true);
    try {
      const res = await stockService.getStock({ godown_id: g.id, per_page: 50 });
      setDetailsStock(res.data?.items || []);
    } catch {
      setDetailsStock([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (formMode === 'create') {
        await godownService.createGodown(formData);
        toast.success('Godown created successfully.');
      } else {
        await godownService.updateGodown(selectedGodown.id, formData);
        toast.success('Godown updated successfully.');
      }
      setIsFormOpen(false);
      fetchGodowns(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to save godown.'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!godownToDelete) return;
    setDeleting(true);
    try {
      await godownService.deleteGodown(godownToDelete.id);
      toast.success(`Godown "${godownToDelete.name}" deleted.`);
      setDeleteConfirmOpen(false);
      setGodownToDelete(null);
      fetchGodowns(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete godown.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = () => {
    try {
      exportToCSV({
        filename: `Godown_List_${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { label: 'Code / ID', format: (g) => String(g.code || g.id).replace(/^#+/, '') },
          { label: 'Date', format: (g) => (g.created_at ? new Date(g.created_at).toLocaleDateString() : '—') },
          { label: 'Godown Name', key: 'name' },
          { label: 'Type', key: 'type' },
          { label: 'Location', format: (g) => g.location || '—' },
          { label: 'Active Stock', format: (g) => g.total_active_stock || 0 },
          { label: 'Status', key: 'status' },
        ],
        data: godowns,
      });
      toast.success(`Exported ${godowns.length} godown records.`);
    } catch (err) {
      toast.error(err.message || 'Failed to export CSV.');
    }
  };

  return (
    <div>
      {!embedded ? (
        <PageHeader
          title="Godown Management"
          description="Monitor, configure, and inspect Primary central hubs and Retail storage godowns."
        >
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleExportCSV} className="text-xs font-semibold cursor-pointer">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download CSV
            </Button>
            {(isAdmin || isManager) && (
              <Button onClick={handleOpenCreate}>
                + Add Godown
              </Button>
            )}
          </div>
        </PageHeader>
      ) : (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Godown Directory</h2>
            <p className="text-xs text-slate-500">Configure Primary central hubs and Retail storage depots.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportCSV} className="text-xs font-semibold cursor-pointer">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download CSV
            </Button>
            {(isAdmin || isManager) && (
              <Button onClick={handleOpenCreate} size="sm">
                + Add Godown
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <Input
            placeholder="Search by godown name, code, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder="All Types"
            options={[
              { value: 'PRIMARY', label: 'PRIMARY' },
              { value: 'RETAIL', label: 'RETAIL' },
            ]}
          />
        </div>
        <div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Statuses"
            options={[
              { value: 'ACTIVE', label: 'ACTIVE' },
              { value: 'INACTIVE', label: 'INACTIVE' },
            ]}
          />
        </div>
      </div>

      {/* Godowns Table - Order Standard: Code/ID -> Date -> Other Information */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={() => fetchGodowns(pagination.current_page)} />
          </div>
        ) : godowns.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No godowns found"
              description="Get started by creating your primary warehouse or retail depots."
              actionLabel={isAdmin || isManager ? "+ Add Godown" : undefined}
              onAction={isAdmin || isManager ? handleOpenCreate : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap">Code / ID</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                  <th className="px-5 py-3.5 min-w-[180px]">Godown Name</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap text-center">Type</th>
                  <th className="px-4 py-3.5 min-w-[180px]">Location</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Active Stock</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap text-center">Status</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap text-center">Stock Info</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {godowns.map((g) => {
                  const cleanCode = String(g.code || g.id).replace(/^#+/, '');
                  return (
                    <tr key={g.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-xs text-blue-600 font-medium whitespace-nowrap">
                        {cleanCode}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {g.created_at ? new Date(g.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{g.name}</td>
                      <td className="px-3.5 py-3.5 text-center whitespace-nowrap">
                        <Badge variant={g.type === 'PRIMARY' ? 'primary' : 'retail'}>
                          {g.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 max-w-xs truncate">{g.location || '—'}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {g.total_active_stock > 0 ? (
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-bold text-slate-900 text-sm">
                                {Number(g.total_active_stock).toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">units</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {g.active_products_count || 1} product{g.active_products_count === 1 ? '' : 's'}
                              </span>
                              {g.active_stocks && g.active_stocks.length > 0 && (
                                <span 
                                  className="text-[10px] text-slate-400 truncate max-w-[140px]" 
                                  title={g.active_stocks.map(s => `${s.product_name}: ${s.quantity} ${s.unit}`).join(', ')}
                                >
                                  ({g.active_stocks[0]?.product_name}: {g.active_stocks[0]?.quantity})
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 italic">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            0 units (Empty)
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-3.5 text-center whitespace-nowrap">
                        <Badge variant={g.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {g.status}
                        </Badge>
                      </td>
                      <td className="px-3.5 py-3.5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(g)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
                          title="View Stock Breakdown"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAdmin ? (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenEdit(g)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setGodownToDelete(g);
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                Delete
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">View only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={pagination.current_page}
          totalPages={pagination.last_page}
          total={pagination.total}
          perPage={pagination.per_page}
          onPageChange={fetchGodowns}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={formMode === 'create' ? 'Add New Godown' : 'Edit Godown'}
        subtitle="Manage warehouse profile and location specs."
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Input
            label="Godown Name"
            name="name"
            required
            placeholder="e.g. Central Mother Hub, Site Retail Depot A"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label="Code (Optional)"
            name="code"
            placeholder="e.g. GDW-PRI-01"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
          />

          <Select
            label="Godown Type"
            name="type"
            required
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            options={[
              { value: 'PRIMARY', label: 'PRIMARY (Inbound Sourcing Central Hub)' },
              { value: 'RETAIL', label: 'RETAIL (Site Distribution & Worker Operations)' },
            ]}
          />

          <Input
            label="Physical Location"
            name="location"
            placeholder="e.g. Industrial Area Phase 2, Kolkata"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />

          <Select
            label="Status"
            name="status"
            required
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'ACTIVE', label: 'ACTIVE' },
              { value: 'INACTIVE', label: 'INACTIVE' },
            ]}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={formLoading}>
              {formMode === 'create' ? 'Create Godown' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stock Breakdown Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={`${selectedGodown?.name || 'Godown'} — Active Stock Breakdown`}
        subtitle={`Type: ${selectedGodown?.type} • Location: ${selectedGodown?.location || 'Operational Site'}`}
        maxWidth="max-w-xl"
      >
        {detailsLoading ? (
          <div className="p-8 flex justify-center">
            <Spinner size="md" className="text-blue-600" />
          </div>
        ) : detailsStock.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No active stock balance recorded in this warehouse.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5 font-mono">Code</th>
                  <th className="p-2.5 text-right">Available Balance</th>
                  <th className="p-2.5 text-right">Last Movement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailsStock.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-semibold text-slate-900">{s.product?.name}</td>
                    <td className="p-2.5 font-mono text-blue-600">{s.product?.code}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-800">
                      {s.quantity} {s.product?.unit}
                    </td>
                    <td className="p-2.5 text-right text-slate-500">
                      {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Godown"
        message={`Are you sure you want to delete "${godownToDelete?.name}"? Godowns with inventory balances cannot be permanently deleted.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

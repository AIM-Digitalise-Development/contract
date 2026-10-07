import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import clientService from '../../services/clientService';
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
import { formatIndianPhone } from '../../utils/phoneUtils';
import {
  Briefcase,
  MapPin,
  Phone,
  Mail,
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  Layers,
  CheckCircle,
  Clock,
  ExternalLink,
  Package,
  Download,
  Calendar,
} from 'lucide-react';

export default function ClientList({ embedded = false }) {
  const { isAdmin, isManager, isSupervisor } = useAuth();
  const toast = useToast();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);


  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedClient, setSelectedClient] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact_number: '',
    email: '',
    location: '',
    materials_required: '',
    work_details: '',
    description: '',
    status: 'ACTIVE',
  });

  // Client Details Modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [activeClientDetails, setActiveClientDetails] = useState(null);

  // Delete Confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClients = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await clientService.getClients({
        page,
        per_page: 10,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        location: locationFilter || undefined,
      });
      setClients(res.data?.items || []);
      setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load client records.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, locationFilter]);

  useEffect(() => {
    fetchClients(1);
  }, [fetchClients]);

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedClient(null);
    setFormData({
      name: '',
      contact_number: '',
      email: '',
      location: '',
      materials_required: '',
      work_details: '',
      description: '',
      status: 'ACTIVE',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (client) => {
    setFormMode('edit');
    setSelectedClient(client);
    setFormData({
      name: client.name || '',
      contact_number: client.contact_number || '',
      email: client.email || '',
      location: client.location || '',
      materials_required: client.materials_required || '',
      work_details: client.work_details || '',
      description: client.description || '',
      status: client.status || 'ACTIVE',
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (formMode === 'create') {
        await clientService.createClient(formData);
        toast.success(`Client "${formData.name}" added successfully.`);
      } else {
        await clientService.updateClient(selectedClient.id, formData);
        toast.success(`Client "${formData.name}" updated successfully.`);
      }
      setIsFormOpen(false);
      fetchClients(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, `Failed to ${formMode} client.`));
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenDelete = (client) => {
    setClientToDelete(client);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    setDeleting(true);
    try {
      await clientService.deleteClient(clientToDelete.id);
      toast.success(`Client "${clientToDelete.name}" removed successfully.`);
      setDeleteConfirmOpen(false);
      setClientToDelete(null);
      fetchClients(1);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete client.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleViewDetails = async (client) => {
    try {
      const res = await clientService.getClient(client.id);
      setActiveClientDetails(res.data?.item || res.data || client);
      setDetailsModalOpen(true);
    } catch {
      setActiveClientDetails(client);
      setDetailsModalOpen(true);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      let exportData = clients;
      try {
        const res = await clientService.getClients({
          per_page: 2000,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          location: locationFilter || undefined,
        });
        if (res?.data?.items && res.data.items.length > 0) {
          exportData = res.data.items;
        }
      } catch (e) {
        console.warn('Fallback to loaded page clients for CSV export:', e);
      }

      if (!exportData || exportData.length === 0) {
        toast.warning('No client records found to export with currently applied filters.');
        return;
      }

      const headers = [
        { key: 'id', label: 'Client ID' },
        { key: 'created_at', label: 'Date' },
        { key: 'name', label: 'Client Name' },
        { key: 'contact_number', label: 'Contact Number' },
        { key: 'location', label: 'Work Location' },
        { key: 'work_details', label: 'Work Details' },
        { key: 'materials_required', label: 'Materials Required' },
        { key: 'status', label: 'Status' },
        { key: 'description', label: 'Description' },
      ];
      const data = exportData.map((c) => ({
        ...c,
        id: String(c.id).replace(/^#+/, ''),
        created_at: c.created_at ? new Date(c.created_at).toLocaleDateString() : '',
        contact_number: formatIndianPhone(c.contact_number),
      }));

      exportToCSV('clients_export', headers, data);
      toast.success(`Exported ${exportData.length} filtered client records.`);
    } catch (err) {
      toast.error(err.message || 'Failed to export CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {!embedded && (
        <PageHeader
          title="Client Entry Management"
          description="Register client profiles, contract project locations, required materials, and work scopes for worker assignments."
        >
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              loading={isExporting}
              className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </Button>
            {(isAdmin || isManager || isSupervisor) && (
              <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-1.5" />
                + Add Client
              </Button>
            )}
          </div>
        </PageHeader>
      )}

      {embedded && (
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">Client Directory & Work Sites</h3>
            <p className="text-xs text-slate-500">Configure client profiles to link workers, schedules, and materials.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              loading={isExporting}
              className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </Button>
            {(isAdmin || isManager || isSupervisor) && (
              <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="w-4 h-4 mr-1.5" />
                + Add Client
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client name, phone, location, work details..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active Projects</option>
            <option value="COMPLETED">Completed</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <input
            type="text"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="Filter by location..."
            className="border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 w-44"
          />

          {(search || statusFilter || locationFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setLocationFilter('');
              }}
              className="text-xs text-slate-500 hover:text-slate-700 underline font-medium px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={() => fetchClients(pagination.current_page)} />
          </div>
        ) : clients.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No clients found"
              description="Register your first client and work location to enable worker material assignments."
              actionLabel="+ Add Client"
              onAction={handleOpenCreate}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-20">Client ID</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Client Name</th>
                  <th className="px-5 py-3.5">Contact Number</th>
                  <th className="px-5 py-3.5">Work Location</th>
                  <th className="px-5 py-3.5">Work Details / Scope</th>
                  <th className="px-5 py-3.5">Materials Required</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-slate-600 font-medium">
                      {c.id}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{c.name}</span>
                      </div>
                      {c.email && <div className="text-[11px] text-slate-400 mt-0.5">{c.email}</div>}
                    </td>

                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{formatIndianPhone(c.contact_number)}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 text-slate-700">
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                        <span className="font-medium">{c.location}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="line-clamp-2 text-slate-600 text-xs">
                        {c.work_details || '—'}
                      </p>
                    </td>

                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="line-clamp-2 text-slate-600 font-mono text-[11px]">
                        {c.materials_required || '—'}
                      </p>
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'COMPLETED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleViewDetails(c)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                          title="View Client Full Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(c)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition cursor-pointer"
                              title="Edit Client"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDelete(c)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                              title="Delete Client"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="p-4 border-t border-slate-100">
            <Pagination
              currentPage={pagination.current_page}
              totalPages={pagination.last_page}
              totalItems={pagination.total}
              perPage={pagination.per_page}
              onPageChange={(page) => fetchClients(page)}
            />
          </div>
        )}
      </div>

      {/* Add / Edit Client Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={formMode === 'create' ? '+ Add Client' : 'Edit Client Details'}
        subtitle="Specify client identity, project location, material requirements, and scope of work."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Client Name */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Client Name <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. Apex Infra Construction Ltd"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Client Contact Number */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Client Contact Number <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. +91 98765 43210"
                value={formData.contact_number}
                onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Client / Work Location */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Client / Work Location <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                required
                placeholder="e.g. Site #4B, Sector 62 Industrial Complex"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                helperText="Physical site address where work is executed."
              />
            </div>

            {/* Contact Email */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Email Address (Optional)
              </label>
              <Input
                type="email"
                placeholder="e.g. client@project.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          {/* Work Details */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Work Details / Scope of Project
            </label>
            <textarea
              rows="3"
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              placeholder="Describe the nature of work (e.g. Heavy structural foundation welding, High-voltage cabling for transformer units, Plumbing installation)..."
              value={formData.work_details}
              onChange={(e) => setFormData({ ...formData, work_details: e.target.value })}
            />
          </div>

          {/* Materials Required */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Materials Required
            </label>
            <textarea
              rows="2.5"
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 font-mono text-[11px]"
              placeholder="List required items (e.g. 50x Safety Helmets, 200m 4-Core Copper Cable, 40 Bags Cement Grade 53)..."
              value={formData.materials_required}
              onChange={(e) => setFormData({ ...formData, materials_required: e.target.value })}
              helperText="Specifies estimated supplies needed for this client's assignment."
            />
          </div>

          {/* Description & Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-start">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Description / Internal Notes
              </label>
              <Input
                type="text"
                placeholder="e.g. Purchase order PO-9921 signed, site supervisor is Mr. Rao"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Status
              </label>
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={[
                  { value: 'ACTIVE', label: 'ACTIVE' },
                  { value: 'COMPLETED', label: 'COMPLETED' },
                  { value: 'INACTIVE', label: 'INACTIVE' },
                ]}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={formLoading} className="bg-blue-600 hover:bg-blue-700">
              {formMode === 'create' ? '+ Add Client' : 'Update Client'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Client Full Details & Work Breakdown Modal */}
      {detailsModalOpen && activeClientDetails && (
        <Modal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          title={`Client Profile: ${activeClientDetails.name}`}
          subtitle={`Location: ${activeClientDetails.location} | Phone: ${activeClientDetails.contact_number}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs text-slate-700">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200">
                <span className="text-[11px] text-blue-700 font-semibold block">Client Status</span>
                <span className="text-sm font-bold text-blue-900 mt-0.5 block">{activeClientDetails.status}</span>
              </div>
              <div className="p-3 rounded-lg bg-purple-50/70 border border-purple-200">
                <span className="text-[11px] text-purple-700 font-semibold block">Total Work Orders</span>
                <span className="text-sm font-bold text-purple-900 mt-0.5 block">
                  {activeClientDetails.total_requests_count ?? (activeClientDetails.worker_stock_requests?.length || 0)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
                <span className="text-[11px] text-emerald-700 font-semibold block">Usage Records</span>
                <span className="text-sm font-bold text-emerald-900 mt-0.5 block">
                  {activeClientDetails.total_usages_count ?? (activeClientDetails.worker_stock_usages?.length || 0)}
                </span>
              </div>
            </div>

            {/* Scope of Work */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Scope of Work</span>
              <p className="text-slate-600 leading-relaxed">{activeClientDetails.work_details || 'No specific work details provided.'}</p>
            </div>

            {/* Materials Required */}
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                Required Materials
              </span>
              <p className="font-mono text-slate-600 text-[11px] whitespace-pre-line">
                {activeClientDetails.materials_required || 'None specified.'}
              </p>
            </div>

            {/* Internal Notes */}
            {activeClientDetails.description && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-amber-900">
                <span className="font-bold block mb-0.5 text-[11px]">Notes:</span>
                <p>{activeClientDetails.description}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setDetailsModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Client Record?"
        message={`Are you sure you want to remove client "${clientToDelete?.name}"? Historical stock transactions will remain archived.`}
        confirmText="Delete Client"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}

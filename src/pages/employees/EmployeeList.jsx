import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import employeeService from '../../services/employeeService';
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
import { Download } from 'lucide-react';

export default function EmployeeList({ embedded = false }) {
  const { user, isAdmin, isSupervisor, isManager } = useAuth();
  const canManagePersonnel = isAdmin || isManager || isSupervisor || embedded;
  const toast = useToast();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });

  // Roles list
  const [roles, setRoles] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);


  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
    status: 'active',
  });

  // Assign Workers Modal (for supervisors)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [supervisorToAssign, setSupervisorToAssign] = useState(null);
  const [allWorkers, setAllWorkers] = useState([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // Delete Confirm
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch Roles
  useEffect(() => {
    async function loadRoles() {
      try {
        const res = await employeeService.getRoles();
        const roleData = res.data?.items || res.data || [];
        setRoles(roleData);
      } catch {
        // Fallback roles if API endpoint fails
        setRoles([
          { id: 1, name: 'Administrator', slug: 'admin' },
          { id: 2, name: 'Supervisor', slug: 'supervisor' },
          { id: 3, name: 'Manager', slug: 'manager' },
          { id: 4, name: 'Worker', slug: 'worker' },
        ]);
      }
    }
    loadRoles();
  }, []);

  // Fetch Employees List
  const fetchEmployees = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        per_page: 10,
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      };
      const res = await employeeService.getEmployees(params);
      setEmployees(res.data?.items || []);
      setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load employee records.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    fetchEmployees(1);
  }, [fetchEmployees]);

  function handleOpenCreate() {
    setFormMode('create');
    setSelectedEmployee(null);
    const workerRole = roles.find((r) => r.slug === 'worker');
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      role_id: workerRole ? workerRole.id : (roles.length > 0 ? roles[0].id : ''),
      status: 'active',
    });
    setIsFormOpen(true);
  }

  function handleOpenEdit(emp) {
    setFormMode('edit');
    setSelectedEmployee(emp);
    const isAutoEmail = emp.email && (emp.email.endsWith('.internal') || emp.email.startsWith('emp_'));
    setFormData({
      name: emp.name || '',
      email: isAutoEmail ? '' : (emp.email || ''),
      phone: emp.phone ? String(emp.phone).replace(/\D/g, '').slice(-10) : '',
      password: '', // Leave blank unless updating
      role_id: emp.role?.id || '',
      status: (emp.status || 'active').toLowerCase(),
    });
    setIsFormOpen(true);
  }

  function handlePhoneChange(e) {
    // Only numbers allowed - strip all letters and non-digit characters
    const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: numericOnly }));
  }

  function handlePhoneKeyDown(e) {
    // Allow navigation and editing control keys
    if (
      ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }
    // Block any non-digit character (letters, punctuation, etc.)
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    setFormLoading(true);
    try {
      let finalEmail = formData.email ? formData.email.trim() : '';
      if (!finalEmail) {
        if (formMode === 'create' || !selectedEmployee?.email) {
          const cleanName = (formData.name || 'emp').toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanPhone = formData.phone ? formData.phone.replace(/\D/g, '').slice(-6) : '';
          const suffix = cleanPhone || `${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 900 + 100)}`;
          finalEmail = `emp_${cleanName}_${suffix}@vrgroup.internal`;
        } else {
          finalEmail = selectedEmployee.email;
        }
      }

      const payload = {
        name: formData.name,
        email: finalEmail,
        phone: formData.phone || undefined,
        role_id: Number(formData.role_id),
        status: formData.status.toLowerCase(),
      };

      if (formMode === 'create') {
        payload.password = formData.password || 'vrgroup@123';
        await employeeService.createEmployee(payload);
        toast.success('Employee created successfully.');
      } else {
        if (formData.password) {
          payload.password = formData.password;
        }
        await employeeService.updateEmployee(selectedEmployee.id, payload);
        toast.success('Employee record updated successfully.');
      }

      setIsFormOpen(false);
      fetchEmployees(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to save employee profile.'));
    } finally {
      setFormLoading(false);
    }
  }

  async function handleOpenAssignWorkers(supervisor) {
    setSupervisorToAssign(supervisor);
    setIsAssignModalOpen(true);
    setAssignLoading(true);
    try {
      const [allRes, assignedRes] = await Promise.all([
        employeeService.getEmployees({ role: 'worker', per_page: 200 }),
        employeeService.getSupervisedWorkers(supervisor.id),
      ]);
      setAllWorkers(allRes.data?.items || []);
      const assigned = assignedRes.data?.items || [];
      setSelectedWorkerIds(assigned.map((w) => w.id));
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to fetch team configuration.'));
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleSaveWorkerAssignments() {
    if (!supervisorToAssign) return;
    setAssignLoading(true);
    try {
      await employeeService.assignWorkers(supervisorToAssign.id, selectedWorkerIds);
      toast.success('Supervisor worker team updated successfully.');
      setIsAssignModalOpen(false);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to update assigned workers.'));
    } finally {
      setAssignLoading(false);
    }
  }

  function toggleWorkerSelection(workerId) {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
    );
  }

  async function handleDeleteConfirm() {
    if (!employeeToDelete) return;
    setDeleting(true);
    try {
      await employeeService.deleteEmployee(employeeToDelete.id);
      toast.success('Personnel record deleted successfully.');
      setDeleteConfirmOpen(false);
      fetchEmployees(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete employee.'));
    } finally {
      setDeleting(false);
    }
  }

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      let exportData = employees;
      try {
        const res = await employeeService.getEmployees({
          per_page: 2000,
          search: debouncedSearch || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
        });
        if (res?.data?.items && res.data.items.length > 0) {
          exportData = res.data.items;
        }
      } catch (e) {
        console.warn('Fallback to loaded page employees for CSV export:', e);
      }

      if (!exportData || exportData.length === 0) {
        toast.warning('No personnel records found to export with currently applied filters.');
        return;
      }

      exportToCSV({
        filename: `Personnel_List_${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { label: 'Employee ID', format: (e) => `EMP-${e.id}` },
          { label: 'Date', format: (e) => (e.created_at ? new Date(e.created_at).toLocaleDateString() : '-') },
          { label: 'Full Name', key: 'name' },
          { 
            label: 'Email / Login ID', 
            format: (e) => (e.email && !e.email.endsWith('.internal') && !e.email.startsWith('emp_') ? e.email : '') 
          },
          { label: 'Phone', format: (e) => formatIndianPhone(e.phone) },
          { label: 'Role', format: (e) => e.role?.name || 'Worker' },
          { label: 'Portal Access', format: (e) => (e.role?.slug === 'worker' ? 'No' : 'Yes') },
          { label: 'Status', key: 'status' },
        ],
        data: exportData,
      });
      toast.success(`Exported ${exportData.length} filtered personnel records.`);
    } catch (err) {
      toast.error(err.message || 'Failed to export CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedRole = roles.find((r) => String(r.id) === String(formData.role_id));
  const isWorkerRoleSelected = selectedRole?.slug === 'worker';

  return (
    <div className="space-y-6">
      {!embedded ? (
        <PageHeader
          title="Personnel & User Management"
          subtitle="Manage administrative staff, warehouse supervisors, managers, and operational workers."
        >
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              onClick={handleExportCSV} 
              loading={isExporting}
              className="text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download CSV
            </Button>
            {canManagePersonnel && (
              <Button variant="primary" onClick={handleOpenCreate}>
                + Add New Personnel
              </Button>
            )}
          </div>
        </PageHeader>
      ) : (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Personnel & Employee Directory</h2>
            <p className="text-xs text-slate-500">Manage administrator, supervisor, manager, and worker accounts.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleExportCSV} 
              loading={isExporting}
              className="text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download CSV
            </Button>
            {canManagePersonnel && (
              <Button variant="primary" onClick={handleOpenCreate} size="sm">
                + Add New Personnel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          placeholder="All Roles"
          options={[
            { value: '', label: 'All Roles' },
            ...roles.map((r) => ({ value: r.slug, label: r.name })),
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All Statuses"
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </div>

      {/* Employee Table - Order Standard: ID -> Date -> Other Information */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorState message={error} onRetry={() => fetchEmployees(pagination.current_page)} />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <EmptyState
              title="No Personnel Found"
              description="No employee or worker records match the active search and filter criteria."
              actionLabel={canManagePersonnel ? "+ Add Personnel" : undefined}
              onAction={canManagePersonnel ? handleOpenCreate : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Joined Date</th>
                  <th className="px-5 py-3.5">Full Name</th>
                  <th className="px-5 py-3.5">Email / Login ID</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">System Role</th>
                  <th className="px-5 py-3.5">Portal Access</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => {
                  const isWorker = emp.role?.slug === 'worker';
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-900">
                        EMP-{emp.id}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {emp.created_at ? new Date(emp.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-900">
                        {emp.name}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs font-mono">
                        {emp.email && !emp.email.endsWith('.internal') && !emp.email.startsWith('emp_') ? (
                          emp.email
                        ) : (
                          <span className="text-slate-400 font-sans italic">Not provided</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs font-mono whitespace-nowrap">
                        {formatIndianPhone(emp.phone)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            emp.role?.slug === 'admin'
                              ? 'info'
                              : emp.role?.slug === 'manager'
                              ? 'warning'
                              : emp.role?.slug === 'supervisor'
                              ? 'purple'
                              : 'slate'
                          }
                        >
                          {emp.role?.name || 'Worker'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        {isWorker ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                            No (Stock Holder)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                            Yes (Sanctum Login)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={emp.status === 'active' || emp.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {emp.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isWorker && (
                            <Link to={`/workers/${emp.id}`}>
                              <Button size="sm" variant="ghost">
                                Stock View
                              </Button>
                            </Link>
                          )}

                          {emp.role?.slug === 'supervisor' && (isAdmin || user?.id === emp.id) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenAssignWorkers(emp)}
                            >
                              Team
                            </Button>
                          )}

                          {(isAdmin || isManager || canManagePersonnel) ? (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(emp)}>
                                Edit
                              </Button>
                              {user?.id !== emp.id && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setEmployeeToDelete(emp);
                                    setDeleteConfirmOpen(true);
                                  }}
                                >
                                  Delete
                                </Button>
                              )}
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
          onPageChange={fetchEmployees}
        />
      </div>

      {/* Create / Edit Employee Profile Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={formMode === 'create' ? 'Add New Personnel' : 'Edit Personnel Profile'}
        subtitle="Configure personnel identities, access hierarchy, and system roles."
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Input
            label="Full Name"
            name="name"
            required
            placeholder="e.g. Rahul Sharma"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label={isWorkerRoleSelected ? "Email Address (Optional)" : "Email Address / System Login (Optional)"}
            name="email"
            type="email"
            placeholder={isWorkerRoleSelected ? "Optional for workers (leave blank if none)" : "e.g. rahul@company.com (optional)"}
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            helperText={
              isWorkerRoleSelected
                ? "Workers do not require email or portal login credentials."
                : "Required only if this user needs web portal access."
            }
          />

          <Input
            label="Phone Number (Indian format +91)"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="e.g. 9876543210 (Numbers only)"
            value={formData.phone}
            onChange={handlePhoneChange}
            onKeyDown={handlePhoneKeyDown}
            helperText={
              formData.phone
                ? `Formatted: ${formatIndianPhone(formData.phone)} (${formData.phone.length}/10 digits)`
                : 'Numbers only (no letters allowed). Enter 10-digit Indian mobile number.'
            }
          />

          <Select
            label="System Role"
            name="role_id"
            required
            value={formData.role_id}
            onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
            options={roles.map((r) => ({
              value: r.id,
              label: `${r.name} ${r.slug === 'worker' ? '(Material Holding Only)' : '(System User)'}`,
            }))}
          />

          {isWorkerRoleSelected && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <span className="font-bold">Notice:</span> Workers do not receive login credentials. They are assigned physical custody of inventory items.
            </div>
          )}

          <Input
            label={formMode === 'create' ? 'Account Password' : 'New Password (Leave blank to keep current)'}
            name="password"
            type="password"
            required={formMode === 'create' && !isWorkerRoleSelected}
            placeholder={isWorkerRoleSelected ? 'Auto-generated internal token' : 'Minimum 8 characters'}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />

          <Select
            label="Operational Status"
            name="status"
            required
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={formLoading}>
              {formMode === 'create' ? 'Create Personnel' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Workers Modal (Supervisor Team Assignment) */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title={`Configure Supervised Team — ${supervisorToAssign?.name}`}
        subtitle="Select workers who report to this supervisor for stock requests and sign-offs."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Select workers from the directory to attach them directly under this supervisor:
          </p>

          <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
            {allWorkers.map((worker) => (
              <label
                key={worker.id}
                className="flex items-center gap-3 p-2 bg-white rounded border border-slate-200 hover:bg-blue-50/50 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  checked={selectedWorkerIds.includes(worker.id)}
                  onChange={() => toggleWorkerSelection(worker.id)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-slate-800">{worker.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">EMP-{worker.id} • {formatIndianPhone(worker.phone)}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsAssignModalOpen(false)} disabled={assignLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveWorkerAssignments} loading={assignLoading}>
              Save Team Configuration
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Personnel Account"
        message={`Are you sure you want to delete ${employeeToDelete?.name}? This action will permanently remove access.`}
        confirmText="Delete Account"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

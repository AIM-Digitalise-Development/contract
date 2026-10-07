import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import employeeService from '../../services/employeeService';
import workerStockService from '../../services/workerStockService';
import godownService from '../../services/godownService';
import productService from '../../services/productService';
import stockService from '../../services/stockService';
import clientService from '../../services/clientService';
import { extractErrorMessage } from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import { exportToCSV } from '../../utils/csvExport';
import { formatIndianPhone } from '../../utils/phoneUtils';
import { Plus, Trash2, Package, Building, Calendar, MapPin, Download } from 'lucide-react';

export default function WorkerList() {
  const { user, isAdmin, isSupervisor, isManager } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');

  // Assign Stock Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  const [godowns, setGodowns] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);

  // Retail Godowns: Materials can only be issued to workers from Retail Godowns
  const retailGodowns = useMemo(() => {
    return (godowns || []).filter(
      (g) => (g.type || '').toUpperCase() === 'RETAIL' || (g.type || '').toUpperCase() === 'RELATIVE'
    );
  }, [godowns]);

  const [godownStockMap, setGodownStockMap] = useState({});
  const [loadingGodownStock, setLoadingGodownStock] = useState(false);

  const [assignForm, setAssignForm] = useState({
    worker_id: '',
    client_id: '',
    start_date: '',
    end_date: '',
    work_title: '',
    work_location: '',
    source_godown_id: '',
    remarks: '',
    supervisor_signature: '',
    items: [{ product_id: '', quantity: '' }],
  });

  // Fetch Workers
  const fetchWorkers = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page,
        per_page: pagination.per_page,
        role: 'worker',
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;

      const res = await employeeService.getEmployees(params);
      setWorkers(res.data?.items || []);
      setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load workers.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, pagination.per_page]);

  useEffect(() => {
    fetchWorkers(1);
  }, [fetchWorkers]);

  // Load godowns, products & clients for assign modal
  useEffect(() => {
    async function loadSelectOptions() {
      try {
        const [gRes, pRes, cRes] = await Promise.all([
          godownService.getGodowns({ per_page: 100 }),
          productService.getProducts({ per_page: 100 }),
          clientService.getClients({ per_page: 200 }),
        ]);
        setGodowns(gRes.data?.items || []);
        setProducts(pRes.data?.items || []);
        setClients(cRes.data?.items || []);
      } catch (err) {
        console.error('Failed to load options', err);
      }
    }
    loadSelectOptions();
  }, []);

  // Live godown stock handler
  const handleGodownChange = async (godownId) => {
    setAssignForm(prev => ({ ...prev, source_godown_id: godownId }));
    if (!godownId) {
      setGodownStockMap({});
      return;
    }
    setLoadingGodownStock(true);
    try {
      const res = await stockService.getStock({ godown_id: godownId, per_page: 500 });
      const items = res.data?.items || res.items || [];
      const map = {};
      items.forEach(it => {
        const pId = it.product_id || it.product?.id;
        if (pId) {
          map[pId] = Number(it.quantity) || 0;
        }
      });
      setGodownStockMap(map);
    } catch (err) {
      console.error('Failed to fetch godown stock:', err);
      toast.error('Could not fetch live warehouse stock.');
    } finally {
      setLoadingGodownStock(false);
    }
  };

  const handleClientChange = (clientId) => {
    const selected = clients.find((c) => String(c.id) === String(clientId));
    setAssignForm((prev) => ({
      ...prev,
      client_id: clientId,
      work_location: selected?.location || prev.work_location || '',
      work_title: selected?.work_details || prev.work_title || '',
    }));
  };

  function handleOpenAssign(worker = null) {
    setSelectedWorker(worker);
    setAssignForm({
      worker_id: worker ? worker.id : '',
      client_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      work_title: '',
      work_location: '',
      source_godown_id: '',
      remarks: '',
      supervisor_signature: user?.name ? `${user.name} (Supervisor)` : 'Supervisor',
      items: [{ product_id: '', quantity: '' }],
    });
    setGodownStockMap({});
    setIsAssignModalOpen(true);
  }

  function handleAddItem() {
    setAssignForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: '' }],
    }));
  }

  function handleRemoveItem(index) {
    if (assignForm.items.length <= 1) return;
    setAssignForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function handleItemChange(index, field, value) {
    setAssignForm(prev => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, items: nextItems };
    });
  }

  async function handleSubmitAssign(e) {
    e.preventDefault();
    if (!assignForm.worker_id) {
      toast.warning('Please select a designated worker.');
      return;
    }
    if (!assignForm.client_id) {
      toast.warning('Please select a Client first before assigning materials.');
      return;
    }
    if (!assignForm.start_date || !assignForm.end_date) {
      toast.warning('Please select Start Date and End Date.');
      return;
    }
    if (new Date(assignForm.end_date) < new Date(assignForm.start_date)) {
      toast.warning('End Date cannot be earlier than Start Date.');
      return;
    }
    if (!assignForm.source_godown_id) {
      toast.warning('Please select a source Retail godown.');
      return;
    }
    if (!assignForm.work_title?.trim()) {
      toast.warning('Please enter the task / work title.');
      return;
    }
    if (!assignForm.remarks?.trim()) {
      toast.warning('Please enter the work description.');
      return;
    }

    if (!assignForm.items || assignForm.items.length === 0) {
      toast.warning('Please add at least one material.');
      return;
    }

    for (let i = 0; i < assignForm.items.length; i++) {
      const it = assignForm.items[i];
      if (!it.product_id) {
        toast.warning(`Please select a product for row #${i + 1}.`);
        return;
      }
      const qty = Number(it.quantity);
      if (!qty || qty <= 0) {
        toast.warning(`Please enter a valid quantity greater than zero for row #${i + 1}.`);
        return;
      }
      const available = godownStockMap[it.product_id] ?? 0;
      if (qty > available) {
        const prod = products.find(p => String(p.id) === String(it.product_id));
        const pName = prod ? prod.name : `Product #${it.product_id}`;
        toast.error(`Cannot issue ${qty} units of "${pName}". Only ${available} available in selected godown.`);
        return;
      }
    }

    setAssignLoading(true);
    try {
      const res = await workerStockService.createIssueRequest({
        worker_id: Number(assignForm.worker_id),
        client_id: Number(assignForm.client_id),
        start_date: assignForm.start_date,
        end_date: assignForm.end_date,
        work_title: assignForm.work_title.trim(),
        work_location: assignForm.work_location.trim(),
        source_godown_id: Number(assignForm.source_godown_id),
        remarks: assignForm.remarks.trim(),
        description: assignForm.remarks.trim(),
        supervisor_signature: assignForm.supervisor_signature || (user?.name ? `${user.name} (Supervisor)` : null),
        items: assignForm.items.map(it => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
        })),
      });

      const reqNumber = res.data?.request_number || 'Voucher';
      toast.success(`Work & material assignment ${reqNumber} submitted with ${assignForm.items.length} material(s)! Awaiting Manager approval.`);
      setIsAssignModalOpen(false);
      fetchWorkers(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to submit worker stock request.'));
    } finally {
      setAssignLoading(false);
    }
  }

  const handleExportCSV = () => {
    if (!workers || workers.length === 0) {
      toast.warning('No worker records to export.');
      return;
    }
    const headers = [
      { key: 'emp_id', label: 'Worker ID' },
      { key: 'date_joined', label: 'Date Joined' },
      { key: 'name', label: 'Worker Name' },
      { key: 'phone', label: 'Contact Phone' },
      { key: 'email', label: 'Email Address' },
      { key: 'department', label: 'Department' },
      { key: 'status', label: 'Status' },
    ];
    const data = workers.map((w) => ({
      emp_id: `EMP-${w.id}`,
      date_joined: w.created_at ? new Date(w.created_at).toLocaleDateString() : '',
      name: w.name,
      phone: formatIndianPhone(w.phone),
      email: w.email || '',
      department: w.department || 'Operations',
      status: w.is_active ? 'Active' : 'Inactive',
    }));
    exportToCSV('workers_export', headers, data);
  };

  const selectedClientObj = clients.find((c) => String(c.id) === String(assignForm.client_id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Workers"
        subtitle="Manage registered workers, track inventory on-site, and assign work & materials."
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
            {(isAdmin || isSupervisor) && !isManager && (
              <Button
                variant="primary"
                onClick={() => handleOpenAssign()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
              >
                <Package className="w-4 h-4 mr-1.5 inline" />
                Assign Work & Materials
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Input
              type="text"
              placeholder="Search by worker name, phone or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'active', label: 'Active Only' },
                { value: 'inactive', label: 'Inactive Only' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => fetchWorkers(pagination.current_page)} />
        ) : workers.length === 0 ? (
          <EmptyState
            title="No workers found"
            description={debouncedSearch ? 'Try clearing or modifying your search filters.' : 'No field workers are currently registered.'}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left w-24">Worker ID</th>
                    <th className="px-5 py-3 text-left">Date Joined</th>
                    <th className="px-5 py-3 text-left">Worker Name</th>
                    <th className="px-5 py-3 text-left">Contact Info</th>
                    <th className="px-5 py-3 text-left">Department</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workers.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3 font-mono font-semibold text-slate-800">
                        EMP-{w.id}
                      </td>
                      <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                        {w.created_at ? new Date(w.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          to={`/workers/${w.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition"
                        >
                          {w.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <div className="text-slate-800 font-medium">{formatIndianPhone(w.phone)}</div>
                        {w.email && <div className="text-slate-400 text-[11px]">{w.email}</div>}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-600">
                        {w.department || 'Operations'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={w.is_active ? 'success' : 'danger'}>
                          {w.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(isAdmin || isSupervisor) && !isManager && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenAssign(w)}
                              className="text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200 text-xs cursor-pointer"
                            >
                              Assign Stock
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => navigate(`/workers/${w.id}`)}
                            className="text-xs cursor-pointer"
                          >
                            Stock History
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.last_page > 1 && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <Pagination
                  currentPage={pagination.current_page}
                  totalPages={pagination.last_page}
                  onPageChange={(p) => fetchWorkers(p)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ASSIGN WORK & MATERIALS MODAL (Sequential Flow) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Work & Materials to Worker"
        subtitle="Maintain clear connection: Client → Work → Worker → Materials → Dates. Sent to Manager for approval."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmitAssign} className="space-y-4">
          
          {/* STEP 1: Select Worker & Client */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Designated Worker <span className="text-rose-500">*</span>
              </label>
              {selectedWorker ? (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 flex items-center justify-between">
                  <span>{selectedWorker.name} (EMP-{selectedWorker.id})</span>
                  <span className="text-[11px] text-slate-500 font-normal">{selectedWorker.email}</span>
                </div>
              ) : (
                <Select
                  value={assignForm.worker_id}
                  onChange={(e) => setAssignForm({ ...assignForm, worker_id: e.target.value })}
                  options={[
                    { value: '', label: 'Select Worker...' },
                    ...workers.map((w) => ({ value: w.id, label: `${w.name} (EMP-${w.id})` })),
                  ]}
                  required
                />
              )}
            </div>

            {/* Select Client First */}
            <div>
              <label className="text-xs font-semibold text-indigo-950 block mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 font-bold">
                  <Building className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Select Client First</span> <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] text-indigo-700">Required</span>
              </label>
              <Select
                value={assignForm.client_id}
                onChange={(e) => handleClientChange(e.target.value)}
                options={[
                  { value: '', label: 'Select Client Project...' },
                  ...clients.map((c) => ({
                    value: c.id,
                    label: `${c.name} — ${c.location || 'Site'} (${formatIndianPhone(c.contact_number) || 'No contact'})`,
                  })),
                ]}
                required
              />
            </div>
          </div>

          {selectedClientObj && (
            <div className="bg-indigo-50/70 rounded-lg p-2.5 border border-indigo-200 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-indigo-950">{selectedClientObj.name}</span>
                <span className="text-slate-600 ml-2">Phone: {formatIndianPhone(selectedClientObj.contact_number) || '—'}</span>
              </div>
              <div className="text-indigo-800 font-medium">
                Location: {selectedClientObj.location || '—'}
              </div>
            </div>
          )}

          {/* STEP 2: Start Date & End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Start Date</span> <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={assignForm.start_date}
                onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>End Date</span> <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={assignForm.end_date}
                onChange={(e) => setAssignForm({ ...assignForm, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* STEP 3: Source Retail Godown */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Source Retail Godown <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-amber-700 font-medium">Operational Retail Only</span>
            </div>
            <Select
              value={assignForm.source_godown_id}
              onChange={(e) => handleGodownChange(e.target.value)}
              options={[
                { value: '', label: 'Select Operational Retail Godown...' },
                ...retailGodowns.map((g) => ({
                  value: g.id,
                  label: `${g.name} [RETAIL] (${g.code || g.location || 'Site'})`,
                })),
              ]}
              required
            />
            {loadingGodownStock && (
              <p className="text-[11px] text-blue-600 mt-1 flex items-center gap-1">
                <Spinner size="xs" /> Checking warehouse stock levels...
              </p>
            )}
          </div>

          {/* STEP 4: Multiple Products List Section */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Package className="w-4 h-4 text-blue-600" />
                <span>Materials & Products to Issue ({assignForm.items.length})</span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            {/* Product Rows */}
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {assignForm.items.map((item, index) => {
                const selectedProd = products.find(p => String(p.id) === String(item.product_id));
                const availableQty = item.product_id && assignForm.source_godown_id ? (godownStockMap[item.product_id] ?? 0) : null;
                const unit = selectedProd?.unit || 'units';
                const exceedsStock = availableQty !== null && Number(item.quantity) > availableQty;

                return (
                  <div key={index} className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          {selectedProd ? selectedProd.name : `Product #${index + 1}`}
                        </span>
                      </div>
                      {assignForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="Remove product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                      <div className="md:col-span-2">
                        <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                          Select Product / Material <span className="text-rose-500">*</span>
                        </label>
                        <Select
                          value={item.product_id}
                          onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                          options={[
                            { value: '', label: 'Choose Material / Product...' },
                            ...products.map((p) => {
                              const stock = assignForm.source_godown_id ? (godownStockMap[p.id] ?? 0) : null;
                              return {
                                value: p.id,
                                label: `${p.name} (${p.code}) ${stock !== null ? `— Live: ${stock} ${p.unit}` : ''}`,
                              };
                            }),
                          ]}
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                          Quantity to Issue <span className="text-rose-500">*</span>
                        </label>
                        <Input
                          type="number"
                          min="0.01"
                          max={availableQty !== null ? availableQty : undefined}
                          step="any"
                          placeholder={availableQty !== null ? `Max ${availableQty}` : 'Qty'}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {item.product_id && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                        <span className={`font-semibold ${availableQty !== null && availableQty > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          Available in Retail Godown: <strong>{availableQty !== null ? availableQty : 'Select Godown'}</strong> {unit}
                        </span>

                        {exceedsStock && (
                          <span className="text-rose-600 font-bold text-[11px]">
                            ⚠️ Cannot exceed available godown stock ({availableQty} {unit})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 5: Task / Work Title & Work Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Task / Work Title <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Electrical wiring, Plumbing overhaul..."
                value={assignForm.work_title}
                onChange={(e) => setAssignForm({ ...assignForm, work_title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Work Site Location
              </label>
              <Input
                type="text"
                placeholder="e.g. Building 2, Floor 4..."
                value={assignForm.work_location}
                onChange={(e) => setAssignForm({ ...assignForm, work_location: e.target.value })}
              />
            </div>
          </div>

          {/* STEP 6: Assigned Task Work Description */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Assigned Task / Work Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="3"
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              placeholder="Describe clearly what task or work the assigned materials are being issued for (e.g. Pipeline maintenance at site B)..."
              value={assignForm.remarks}
              onChange={(e) => setAssignForm({ ...assignForm, remarks: e.target.value })}
              required
            />
          </div>

          {/* Supervisor Signature */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Supervisor Initial Sign-off Name
            </label>
            <Input
              type="text"
              placeholder="e.g. John Doe (Supervisor In-Charge)"
              value={assignForm.supervisor_signature}
              onChange={(e) => setAssignForm({ ...assignForm, supervisor_signature: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsAssignModalOpen(false)} disabled={assignLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={assignLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer">
              Submit Allocation Request ({assignForm.items.length} {assignForm.items.length === 1 ? 'Material' : 'Materials'})
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

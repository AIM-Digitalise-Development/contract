import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import workerStockService from '../../services/workerStockService';
import godownService from '../../services/godownService';
import productService from '../../services/productService';
import employeeService from '../../services/employeeService';
import stockService from '../../services/stockService';
import clientService from '../../services/clientService';
import { extractErrorMessage, extractItems } from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import MaterialIssueSlipModal from '../../components/workerStock/MaterialIssueSlipModal';
import { exportToCSV } from '../../utils/csvExport';
import { Printer, Plus, Trash2, PenTool, ShieldCheck, Building, Calendar, MapPin, Download } from 'lucide-react';
import {
  Package,
  ArrowRight,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  AlertCircle,
  UserCheck,
  ShieldAlert
} from '../../components/common/Icons';

export default function WorkerStockRequests() {
  const { user, isAdmin, isSupervisor, isManager } = useAuth();
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  // Reference data
  const [workers, setWorkers] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [godownStockMap, setGodownStockMap] = useState({});
  const [loadingGodownStock, setLoadingGodownStock] = useState(false);

  // Worker held stock for return modal
  const [workerHoldings, setWorkerHoldings] = useState([]);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  // Modals
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Printable Slip Modal
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlipRequest, setSelectedSlipRequest] = useState(null);

  const handleOpenSlip = (req) => {
    setSelectedSlipRequest(req);
    setSlipModalOpen(true);
  };

  // Issue Form State with Client & Multi-Product items support
  const [issueForm, setIssueForm] = useState({
    worker_id: '',
    client_id: '',
    start_date: '',
    end_date: '',
    work_title: '',
    work_location: '',
    godown_id: '',
    remarks: '',
    supervisor_signature: '',
    items: [
      { product_id: '', quantity: '' },
    ],
  });

  // Return Form State
  const [returnForm, setReturnForm] = useState({
    worker_id: '',
    godown_id: '',
    product_id: '',
    quantity: '',
    remarks: '',
  });

  // Approval / Rejection modal state
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    action: 'approve',
    request: null,
    reasonOrRemarks: '',
    signature: '',
    confirmedCheck: false,
    loading: false,
  });

  // Load Reference Data on mount
  useEffect(() => {
    let isMounted = true;
    async function loadRefData() {
      try {
        const [empRes, gRes, pRes, cRes] = await Promise.all([
          employeeService.getEmployees({ role: 'worker', is_active: 1, per_page: 100 }).catch(() => ({ data: [] })),
          godownService.getGodowns({ is_active: 1, per_page: 100 }).catch(() => ({ data: [] })),
          productService.getProducts({ is_active: 1, per_page: 200 }).catch(() => ({ data: [] })),
          clientService.getClients({ per_page: 200 }).catch(() => ({ data: [] })),
        ]);

        if (isMounted) {
          const empList = extractItems(empRes);
          const workerList = empList.filter(e => {
            const roleSlug = e.role?.slug || e.role_name || e.role || '';
            return roleSlug.toLowerCase() === 'worker';
          });
          setWorkers(workerList.length ? workerList : empList);
          setGodowns(extractItems(gRes));
          setProducts(extractItems(pRes));
          setClients(extractItems(cRes));
        }
      } catch (err) {
        console.error('Failed to load reference metadata:', err);
      }
    }
    loadRefData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.request_type = typeFilter;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await workerStockService.getRequests(params);
      setRequests(extractItems(res));
    } catch (err) {
      console.error('Failed to load requests:', err);
      toast.error('Failed to load worker stock requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, debouncedSearch]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // When worker is selected in return form, fetch their current holdings
  const handleReturnWorkerChange = async (workerId) => {
    setReturnForm(prev => ({ ...prev, worker_id: workerId, product_id: '', quantity: '' }));
    if (!workerId) {
      setWorkerHoldings([]);
      return;
    }

    setLoadingHoldings(true);
    try {
      const res = await workerStockService.getWorkerStock(workerId);
      const holdings = extractItems(res).filter(h => parseFloat(h.current_balance || h.quantity || 0) > 0);
      setWorkerHoldings(holdings);
    } catch (err) {
      console.error('Failed to fetch worker holdings:', err);
      setWorkerHoldings([]);
    } finally {
      setLoadingHoldings(false);
    }
  };

  // Fetch live godown stock for issue modal
  const handleIssueGodownChange = async (godownId) => {
    setIssueForm(prev => ({ ...prev, godown_id: godownId }));
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

  // Handle Client selection in issue form
  const handleIssueClientChange = (clientId) => {
    const selected = clients.find((c) => String(c.id) === String(clientId));
    setIssueForm((prev) => ({
      ...prev,
      client_id: clientId,
      work_location: selected?.location || prev.work_location || '',
      work_title: selected?.work_details || prev.work_title || '',
    }));
  };

  const handleOpenNewIssue = () => {
    setIssueForm({
      worker_id: '',
      client_id: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      work_title: '',
      work_location: '',
      godown_id: '',
      remarks: '',
      supervisor_signature: user?.name ? `${user.name} (Supervisor)` : 'Supervisor',
      items: [{ product_id: '', quantity: '' }],
    });
    setGodownStockMap({});
    setIssueModalOpen(true);
  };

  // Helper functions for dynamic multi-product issue rows
  const handleAddIssueItem = () => {
    setIssueForm(prev => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: '' }],
    }));
  };

  const handleRemoveIssueItem = (index) => {
    if (issueForm.items.length <= 1) return;
    setIssueForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleIssueItemChange = (index, field, value) => {
    setIssueForm(prev => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, items: nextItems };
    });
  };

  // Submit Issue Request (Client -> Work -> Worker -> Materials -> Dates)
  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (!issueForm.worker_id) {
      toast.error('Please select a designated worker.');
      return;
    }
    if (!issueForm.client_id) {
      toast.error('Please select a Client first before assigning materials.');
      return;
    }
    if (!issueForm.start_date || !issueForm.end_date) {
      toast.error('Please select Start Date and End Date.');
      return;
    }
    if (new Date(issueForm.end_date) < new Date(issueForm.start_date)) {
      toast.error('End Date cannot be earlier than Start Date.');
      return;
    }
    if (!issueForm.godown_id) {
      toast.error('Please select a source Retail godown.');
      return;
    }
    if (!issueForm.work_title?.trim()) {
      toast.error('Please enter the task / work title.');
      return;
    }
    if (!issueForm.remarks.trim()) {
      toast.error('Assigned task / work description is required.');
      return;
    }

    if (!issueForm.items || issueForm.items.length === 0) {
      toast.error('Please add at least one product.');
      return;
    }

    for (let i = 0; i < issueForm.items.length; i++) {
      const it = issueForm.items[i];
      if (!it.product_id) {
        toast.error(`Please select a product for line #${i + 1}.`);
        return;
      }
      const qty = parseFloat(it.quantity);
      if (!qty || qty <= 0) {
        toast.error(`Please enter a valid positive quantity for line #${i + 1}.`);
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

    setFormSubmitting(true);
    try {
      const res = await workerStockService.createIssueRequest({
        worker_id: parseInt(issueForm.worker_id, 10),
        client_id: parseInt(issueForm.client_id, 10),
        start_date: issueForm.start_date,
        end_date: issueForm.end_date,
        work_title: issueForm.work_title.trim(),
        work_location: issueForm.work_location.trim(),
        source_godown_id: parseInt(issueForm.godown_id, 10),
        godown_id: parseInt(issueForm.godown_id, 10),
        remarks: issueForm.remarks.trim(),
        description: issueForm.remarks.trim(),
        supervisor_signature: issueForm.supervisor_signature || (user?.name ? `${user.name} (Supervisor)` : null),
        items: issueForm.items.map(it => ({
          product_id: parseInt(it.product_id, 10),
          quantity: parseFloat(it.quantity),
        })),
      });

      const reqNum = res.data?.request_number || 'Voucher';
      toast.success(`Worker issue request ${reqNum} submitted (${issueForm.items.length} material(s)) and awaiting Manager approval.`);
      setIssueModalOpen(false);
      fetchRequests();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to submit issue request.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Submit Return Request
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnForm.worker_id || !returnForm.godown_id || !returnForm.product_id || !returnForm.quantity) {
      toast.error('Please complete all required fields.');
      return;
    }

    const qty = parseFloat(returnForm.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid return quantity.');
      return;
    }

    setFormSubmitting(true);
    try {
      await workerStockService.createReturnRequest({
        worker_id: parseInt(returnForm.worker_id, 10),
        godown_id: parseInt(returnForm.godown_id, 10),
        product_id: parseInt(returnForm.product_id, 10),
        quantity: qty,
        remarks: returnForm.remarks.trim(),
      });

      toast.success('Worker return request submitted successfully.');
      setReturnModalOpen(false);
      setReturnForm({
        worker_id: '',
        godown_id: '',
        product_id: '',
        quantity: '',
        remarks: '',
      });
      fetchRequests();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to submit return request.'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Manager Approval Confirmation with Signature
  const handleActionConfirm = async () => {
    const { action, request, reasonOrRemarks, signature, confirmedCheck } = actionModal;
    if (!request) return;

    if (action === 'reject' && !reasonOrRemarks.trim()) {
      toast.error('Please provide a mandatory reason for rejection.');
      return;
    }

    if (action === 'approve') {
      if (!signature.trim()) {
        toast.error('Official Manager signature is required to authorize documentation.');
        return;
      }
      if (!confirmedCheck) {
        toast.error('Please check the verification checkbox to authorize approval.');
        return;
      }
    }

    setActionModal(prev => ({ ...prev, loading: true }));
    try {
      if (action === 'approve') {
        const payload = {
          manager_signature: signature.trim(),
          remarks: reasonOrRemarks.trim() || undefined,
        };
        await workerStockService.approveRequest(request.id, payload);
        toast.success(`Request #${request.request_number || request.id} officially approved with Manager signature.`);
      } else {
        await workerStockService.rejectRequest(request.id, reasonOrRemarks.trim());
        toast.success(`Request #${request.request_number || request.id} has been rejected.`);
      }

      setActionModal({
        isOpen: false,
        action: 'approve',
        request: null,
        reasonOrRemarks: '',
        signature: '',
        confirmedCheck: false,
        loading: false,
      });
      fetchRequests();
    } catch (err) {
      toast.error(extractErrorMessage(err, `Failed to ${action} request.`));
      setActionModal(prev => ({ ...prev, loading: false }));
    }
  };

  const isSelfRequest = (req) => {
    const requesterId = req.requested_by_id || req.created_by || req.requested_by?.id;
    return user && user.id && requesterId === user.id;
  };

  const safeRequests = Array.isArray(requests) ? requests : [];
  const safeWorkers = Array.isArray(workers) ? workers : [];
  const safeProducts = Array.isArray(products) ? products : [];
  const safeRetailGodowns = Array.isArray(godowns)
    ? godowns.filter(g => (g.type || '').toUpperCase() === 'RETAIL' || (g.type || '').toUpperCase() === 'RELATIVE')
    : [];
  const safeWorkerHoldings = Array.isArray(workerHoldings) ? workerHoldings : [];

  const selectedClientObj = clients.find((c) => String(c.id) === String(issueForm.client_id));

  const handleExportCSV = () => {
    if (!safeRequests || safeRequests.length === 0) {
      toast.warning('No movement requests to export.');
      return;
    }
    const headers = [
      { key: 'voucher_id', label: 'Voucher ID' },
      { key: 'date', label: 'Date' },
      { key: 'type', label: 'Movement Type' },
      { key: 'client', label: 'Client' },
      { key: 'work_title', label: 'Project Scope' },
      { key: 'worker', label: 'Worker' },
      { key: 'godown', label: 'Godown' },
      { key: 'materials', label: 'Products & Materials' },
      { key: 'status', label: 'Status' },
      { key: 'remarks', label: 'Description' },
    ];
    const data = safeRequests.map((req) => {
      const cleanVoucher = String(req.request_number || req.id).replace(/^#+/, '');
      const dateStr = req.requested_at ? new Date(req.requested_at).toLocaleDateString() : (req.created_at ? new Date(req.created_at).toLocaleDateString() : '');
      const typeUpper = (req.type || req.request_type || '').toUpperCase();
      const isIssue = typeUpper === 'ISSUE' || typeUpper === 'GODOWN_TO_WORKER';
      let materialsStr = '';
      if (Array.isArray(req.items) && req.items.length > 0) {
        materialsStr = req.items.map(it => `${it.product?.name || 'Product'}: ${it.quantity} ${it.product?.unit || 'units'}`).join('; ');
      } else {
        materialsStr = `${req.product?.name || 'Product'}: ${req.quantity || 0} ${req.product?.unit || 'units'}`;
      }
      return {
        voucher_id: cleanVoucher,
        date: dateStr,
        type: isIssue ? 'Issue (Godown → Worker)' : 'Return (Worker → Godown)',
        client: req.client?.name || 'Internal / Direct',
        work_title: req.work_title || '',
        worker: req.worker?.name || req.worker_name || 'Worker',
        godown: req.source_godown?.name || req.godown?.name || req.godown_name || '-',
        materials: materialsStr,
        status: req.status || '',
        remarks: req.remarks || req.description || '',
      };
    });
    exportToCSV('worker_stock_requests_export', headers, data);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Requests & Work Handover"
        subtitle="Review, approve, and track work & material allocations between retail warehouses and field workers."
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
              <>
                <Button
                  variant="primary"
                  onClick={handleOpenNewIssue}
                  className="bg-corporate-blue hover:bg-corporate-blue-dark flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Issue Stock to Worker
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReturnForm({
                      worker_id: '',
                      godown_id: '',
                      product_id: '',
                      quantity: '',
                      remarks: '',
                    });
                    setWorkerHoldings([]);
                    setReturnModalOpen(true);
                  }}
                  className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Return Stock
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by worker, client, request #, product, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-corporate-blue focus:border-corporate-blue"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-corporate-blue focus:border-corporate-blue bg-white"
          >
            <option value="">All Movement Types</option>
            <option value="ISSUE">Issue (Godown → Worker)</option>
            <option value="RETURN">Return (Worker → Godown)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-corporate-blue focus:border-corporate-blue bg-white"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading requests...</div>
        ) : safeRequests.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No stock movement requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Voucher ID</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Movement Type</th>
                  <th className="px-5 py-3 text-left">Client & Project</th>
                  <th className="px-5 py-3 text-left">Worker</th>
                  <th className="px-5 py-3 text-left">Godown</th>
                  <th className="px-5 py-3 text-left">Products & Materials</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {safeRequests.map((req) => {
                  const cleanVoucher = String(req.request_number || req.id).replace(/^#+/, '');
                  const dateStr = req.requested_at ? new Date(req.requested_at).toLocaleDateString() : (req.created_at ? new Date(req.created_at).toLocaleDateString() : '—');
                  const typeUpper = (req.type || req.request_type || '').toUpperCase();
                  const isIssue = typeUpper === 'ISSUE' || typeUpper === 'GODOWN_TO_WORKER';
                  const statusUpper = (req.status || '').toUpperCase();
                  const isPending = statusUpper === 'PENDING';
                  const isApproved = statusUpper === 'APPROVED';
                  const isRejected = statusUpper === 'REJECTED';
                  const self = isSelfRequest(req);

                  const clientName = req.client?.name || null;
                  const workTitle = req.work_title || null;
                  const godownName = req.source_godown?.name || req.godown?.name || req.godown_name || '-';
                  const workerName = req.worker?.name || req.worker_name || 'Worker';

                  return (
                    <tr key={req.id} className="hover:bg-gray-50/80 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-blue-700 whitespace-nowrap">
                        {cleanVoucher}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isIssue ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isIssue ? 'Issue (Godown → Worker)' : 'Return (Worker → Godown)'}
                        </span>
                      </td>

                      {/* Client & Project */}
                      <td className="px-5 py-3.5 max-w-[180px]">
                        {clientName ? (
                          <div>
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 truncate">
                              <Building className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="truncate">{clientName}</span>
                            </span>
                            {workTitle && (
                              <div className="text-[10px] text-slate-500 truncate mt-0.5" title={workTitle}>
                                {workTitle}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Internal / Direct</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {workerName}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {godownName}
                      </td>
                      <td className="px-5 py-3.5">
                        {Array.isArray(req.items) && req.items.length > 1 ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <Package className="w-3.5 h-3.5" />
                              {req.items.length} Products
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-gray-900">{req.product?.name || req.product_name || 'Material'}</div>
                            <div className="text-xs text-gray-500 font-mono">
                              {req.quantity} {req.product?.unit || req.unit || 'units'}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5">
                        {isPending && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            Pending Approval
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Approved
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            Rejected
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right space-x-2">
                        {isPending && (isAdmin || isManager) && (
                          <button
                            onClick={() => setActionModal({
                              isOpen: true,
                              action: 'approve',
                              request: req,
                              reasonOrRemarks: '',
                              signature: user?.name ? `${user.name} (Manager)` : 'Manager Approval',
                              confirmedCheck: false,
                              loading: false,
                            })}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approve
                          </button>
                        )}
                        {isApproved && isIssue && (
                          <button
                            onClick={() => handleOpenSlip(req)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded text-xs font-semibold cursor-pointer shadow-xs inline-flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Slip
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

      {/* Modal: New Issue Request */}
      {issueModalOpen && (
        <Modal
          isOpen={issueModalOpen}
          onClose={() => setIssueModalOpen(false)}
          title="Issue Materials to Worker (Godown → Worker)"
          subtitle="Maintain clear connection: Client → Work → Worker → Materials → Dates. Sent to Manager for approval."
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleIssueSubmit} className="space-y-4">
            {/* STEP 1: Select Worker & Client */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Designated Worker <span className="text-red-500">*</span>
                </label>
                <select
                  value={issueForm.worker_id}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, worker_id: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-corporate-blue focus:border-corporate-blue"
                >
                  <option value="">-- Choose Worker --</option>
                  {safeWorkers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.department ? `(${w.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-indigo-950 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold">
                    <Building className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Select Client First</span> <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[10px] text-indigo-700">Required</span>
                </label>
                <select
                  value={issueForm.client_id}
                  onChange={(e) => handleIssueClientChange(e.target.value)}
                  required
                  className="w-full border border-indigo-300 rounded-md p-2 text-xs focus:ring-corporate-blue focus:border-corporate-blue bg-indigo-50/30"
                >
                  <option value="">-- Choose Client Project --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.location || 'Site'} ({c.contact_number || 'No phone'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedClientObj && (
              <div className="bg-indigo-50/70 rounded-lg p-2.5 border border-indigo-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-indigo-950">{selectedClientObj.name}</span>
                  <span className="text-slate-600 ml-2">Phone: {selectedClientObj.contact_number || '—'}</span>
                </div>
                <div className="text-indigo-800 font-medium">
                  Location: {selectedClientObj.location || '—'}
                </div>
              </div>
            )}

            {/* STEP 2: Start Date & End Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Start Date</span> <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={issueForm.start_date}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-md p-1.5 text-xs focus:ring-corporate-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>End Date</span> <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={issueForm.end_date}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, end_date: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-md p-1.5 text-xs focus:ring-corporate-blue"
                />
              </div>
            </div>

            {/* STEP 3: Source Retail Godown */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Source Retail Godown <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-amber-700 font-medium">Operational Retail Only</span>
              </div>
              <select
                value={issueForm.godown_id}
                onChange={(e) => handleIssueGodownChange(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-corporate-blue focus:border-corporate-blue"
              >
                <option value="">-- Choose Operational Retail Godown --</option>
                {safeRetailGodowns.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} [RETAIL] ({g.location || g.code || 'Site'})
                  </option>
                ))}
              </select>
              {loadingGodownStock && (
                <p className="text-[11px] text-blue-600 mt-1 animate-pulse">Checking live godown stock...</p>
              )}
            </div>

            {/* Multi-Product Items List */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/70 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  Products & Materials to Issue ({issueForm.items.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddIssueItem}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Product</span>
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {issueForm.items.map((it, idx) => {
                  const selectedProduct = safeProducts.find(p => String(p.id) === String(it.product_id));
                  const availableStock = (issueForm.godown_id && it.product_id) ? (godownStockMap[it.product_id] ?? 0) : null;
                  const isExceeding = availableStock !== null && Number(it.quantity) > availableStock;

                  return (
                    <div key={idx} className="flex items-start gap-2 bg-white p-2.5 rounded-md border border-slate-200 shadow-xs">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0 mt-1">
                        {idx + 1}
                      </span>

                      <div className="flex-1 min-w-[200px]">
                        <select
                          value={it.product_id}
                          onChange={(e) => handleIssueItemChange(idx, 'product_id', e.target.value)}
                          required
                          className="w-full border border-gray-300 rounded p-1.5 text-xs focus:ring-corporate-blue focus:border-corporate-blue"
                        >
                          <option value="">-- Choose Product / Material --</option>
                          {safeProducts.map((p) => {
                            const avail = issueForm.godown_id ? (godownStockMap[p.id] ?? 0) : null;
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku || p.code || '—'}) {avail !== null ? `— Live: ${avail} ${p.unit}` : `- ${p.unit}`}
                              </option>
                            );
                          })}
                        </select>
                        {it.product_id && (
                          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                            <span className="text-slate-500">Available in Godown:</span>
                            <span className={`font-bold ${availableStock !== null && availableStock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {availableStock !== null ? `${availableStock} ${selectedProduct?.unit || ''}` : 'Select Godown'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="w-32 shrink-0">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={availableStock !== null ? availableStock : undefined}
                          value={it.quantity}
                          onChange={(e) => handleIssueItemChange(idx, 'quantity', e.target.value)}
                          placeholder="Qty to Issue"
                          required
                          className={`w-full border rounded p-1.5 text-xs focus:ring-corporate-blue focus:border-corporate-blue ${
                            isExceeding ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold' : 'border-gray-300'
                          }`}
                        />
                      </div>

                      {issueForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveIssueItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer mt-0.5"
                          title="Remove product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 4: Task / Work Title & Work Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Task / Work Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Electrical wiring, Plumbing overhaul..."
                  value={issueForm.work_title}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, work_title: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-corporate-blue focus:border-corporate-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Work Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Building 2, Floor 4..."
                  value={issueForm.work_location}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, work_location: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-corporate-blue focus:border-corporate-blue"
                />
              </div>
            </div>

            {/* STEP 5: Assigned Task / Work Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Assigned Task / Work Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={issueForm.remarks}
                onChange={(e) => setIssueForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Describe the task or work assigned (e.g. Tools and fasteners for site assembly / pipeline repair at sector 4)..."
                className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-corporate-blue focus:border-corporate-blue"
                rows="2"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Supervisor Initial Sign-off Name
              </label>
              <input
                type="text"
                value={issueForm.supervisor_signature}
                onChange={(e) => setIssueForm(prev => ({ ...prev, supervisor_signature: e.target.value }))}
                placeholder="e.g. John Doe (Supervisor In-Charge)"
                className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-corporate-blue focus:border-corporate-blue"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="secondary" onClick={() => setIssueModalOpen(false)} disabled={formSubmitting}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={formSubmitting} className="bg-corporate-blue">
                Submit Issue Request ({issueForm.items.length} Materials)
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: New Return Request */}
      {returnModalOpen && (
        <Modal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          title="Return Materials from Worker (Worker → Godown)"
        >
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-md text-xs text-emerald-800">
              Select the worker to see their active physical holdings. Once approved by the Operations Manager, the stock will be credited back into the selected godown.
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Worker <span className="text-red-500">*</span>
              </label>
              <select
                value={returnForm.worker_id}
                onChange={(e) => handleReturnWorkerChange(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-corporate-blue focus:border-corporate-blue"
              >
                <option value="">-- Choose Worker --</option>
                {safeWorkers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.department ? `(${w.department})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {returnForm.worker_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product to Return <span className="text-red-500">*</span>
                </label>
                {loadingHoldings ? (
                  <p className="text-xs text-gray-500 py-2">Loading worker inventory...</p>
                ) : safeWorkerHoldings.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded border border-amber-200">
                    This worker currently has no active stock holdings recorded.
                  </p>
                ) : (
                  <select
                    value={returnForm.product_id}
                    onChange={(e) => setReturnForm(prev => ({ ...prev, product_id: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-corporate-blue focus:border-corporate-blue"
                  >
                    <option value="">-- Select Material Held by Worker --</option>
                    {safeWorkerHoldings.map((h) => {
                      const pid = h.product_id || h.item_id || h.product?.id;
                      const pname = h.product?.name || h.item?.name || h.product_name || 'Product';
                      const pbal = h.current_balance || h.quantity || 0;
                      const punit = h.product?.unit || h.item?.unit || h.unit || 'units';
                      return (
                        <option key={pid} value={pid}>
                          {pname} (Holding: {pbal} {punit})
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Destination Retail Godown <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-purple-700 font-medium">Worker → Retail Godown</span>
              </div>
              <select
                value={returnForm.godown_id}
                onChange={(e) => setReturnForm(prev => ({ ...prev, godown_id: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-corporate-blue focus:border-corporate-blue"
              >
                <option value="">-- Choose Destination Retail Godown --</option>
                {safeRetailGodowns.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} [RETAIL] ({g.location || g.code || 'Site'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantity to Return <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={returnForm.quantity}
                onChange={(e) => setReturnForm(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="Enter quantity"
                required
                className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-corporate-blue focus:border-corporate-blue"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason / Description
              </label>
              <textarea
                value={returnForm.remarks}
                onChange={(e) => setReturnForm(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Excess stock returned from job site..."
                className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-corporate-blue focus:border-corporate-blue"
                rows="2"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <Button variant="secondary" onClick={() => setReturnModalOpen(false)} disabled={formSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={formSubmitting}
                disabled={workerHoldings.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Submit Return Request
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Approve / Reject Action */}
      {actionModal.isOpen && actionModal.request && (
        <Modal
          isOpen={actionModal.isOpen}
          onClose={() => setActionModal({ isOpen: false, action: 'approve', request: null, reasonOrRemarks: '', signature: '', confirmedCheck: false, loading: false })}
          title={
            actionModal.action === 'approve'
              ? (actionModal.request.type === 'ISSUE' ? 'Manager Review & Documentation Sign-off' : 'Authorize Worker Stock Movement')
              : 'Reject Worker Stock Request'
          }
          maxWidth={actionModal.action === 'approve' && actionModal.request.type === 'ISSUE' ? 'max-w-2xl' : 'max-w-lg'}
        >
          {actionModal.action === 'approve' && actionModal.request.type === 'ISSUE' ? (
            (() => {
              const req = actionModal.request;
              const itemsList = Array.isArray(req.items) && req.items.length > 0
                ? req.items
                : [{
                    id: 1,
                    product: req.product,
                    quantity: req.quantity,
                    remarks: req.remarks,
                  }];

              return (
                <div className="space-y-4">
                  {/* Summary Details */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold block">Designated Worker</span>
                      <span className="font-bold text-slate-900">{req.worker?.name || 'Worker'} (EMP-{req.worker?.id || '—'})</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block">Source Godown</span>
                      <span className="font-bold text-slate-900">{req.source_godown?.name || 'Godown'}</span>
                    </div>
                    {req.client?.name && (
                      <div>
                        <span className="text-slate-500 font-semibold block">Client / Project</span>
                        <span className="font-bold text-indigo-900">{req.client.name}</span>
                      </div>
                    )}
                    {req.work_location && (
                      <div>
                        <span className="text-slate-500 font-semibold block">Location</span>
                        <span className="font-bold text-slate-900">{req.work_location}</span>
                      </div>
                    )}
                    <div className="col-span-2 border-t border-slate-200 pt-2">
                      <span className="text-slate-500 font-semibold block">Assigned Work Task / Purpose</span>
                      <span className="text-slate-700 italic">{req.remarks || req.description || 'General site allocation'}</span>
                    </div>
                  </div>

                  {/* Multi-Product Listing Table */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                        Listing of Allocated Products ({itemsList.length})
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-500">
                        Voucher #{req.request_number || req.id}
                      </span>
                    </div>
                    <div className="border border-slate-300 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                            <th className="py-2 px-2.5 w-10 text-center">#</th>
                            <th className="py-2 px-2.5">Product Name</th>
                            <th className="py-2 px-2.5">Code</th>
                            <th className="py-2 px-2.5 text-right">Quantity</th>
                            <th className="py-2 px-2.5">Unit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {itemsList.map((it, idx) => (
                            <tr key={it.id || idx}>
                              <td className="py-2 px-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="py-2 px-2.5 font-bold text-slate-900">{it.product?.name || 'Product'}</td>
                              <td className="py-2 px-2.5 font-mono text-slate-600">{it.product?.code || '—'}</td>
                              <td className="py-2 px-2.5 text-right font-black text-blue-800">{it.quantity}</td>
                              <td className="py-2 px-2.5 uppercase text-slate-600">{it.product?.unit || 'units'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Manager Signature & Confirmation Checkbox */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3.5 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id="actionMgrConfirmCheck"
                        checked={actionModal.confirmedCheck}
                        onChange={(e) => setActionModal(prev => ({ ...prev, confirmedCheck: e.target.checked }))}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 mt-0.5 cursor-pointer"
                      />
                      <label htmlFor="actionMgrConfirmCheck" className="text-xs font-semibold text-emerald-950 cursor-pointer select-none leading-relaxed">
                        Yes, I have verified the listing of all products above and officially authorize this material allocation documentation.
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Manager Official Signature / Authorization Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={actionModal.signature}
                        onChange={(e) => setActionModal(prev => ({ ...prev, signature: e.target.value }))}
                        placeholder="e.g. Jane Smith (Manager Digital Sign-off)"
                        className="w-full text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Manager Approval Notes (Optional)
                    </label>
                    <textarea
                      value={actionModal.reasonOrRemarks}
                      onChange={(e) => setActionModal(prev => ({ ...prev, reasonOrRemarks: e.target.value }))}
                      placeholder="Enter any reference notes or instructions for supervisor/worker..."
                      className="w-full border border-gray-300 rounded-md p-2 text-xs focus:ring-corporate-blue focus:border-corporate-blue"
                      rows="2"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t">
                    <Button
                      variant="secondary"
                      onClick={() => setActionModal({ isOpen: false, action: 'approve', request: null, reasonOrRemarks: '', signature: '', confirmedCheck: false, loading: false })}
                      disabled={actionModal.loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleActionConfirm}
                      disabled={actionModal.loading || !actionModal.confirmedCheck || !actionModal.signature?.trim()}
                      loading={actionModal.loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs cursor-pointer disabled:opacity-50"
                    >
                      Sign & Authorize Documentation
                    </Button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="space-y-4">
              {actionModal.action === 'approve' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
                  <p className="font-semibold mb-1">Inventory Balance Movement Confirmation:</p>
                  <p>
                    Approving will deduct {actionModal.request.quantity} from Worker "{actionModal.request.worker?.name || 'Worker'}" and credit it back to Godown "{actionModal.request.source_godown?.name || actionModal.request.godown?.name || 'Godown'}".
                  </p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900">
                  <p className="font-semibold mb-1">Rejection Notice:</p>
                  <p>Rejecting will cancel this stock movement request. Please enter a mandatory reason.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {actionModal.action === 'approve' ? 'Approval Notes (Optional)' : 'Rejection Reason (Required)'}
                  {actionModal.action === 'reject' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={actionModal.reasonOrRemarks}
                  onChange={(e) => setActionModal(prev => ({ ...prev, reasonOrRemarks: e.target.value }))}
                  placeholder={actionModal.action === 'approve' ? 'Any approval comments...' : 'Reason for rejection...'}
                  className="w-full border border-gray-300 rounded-md p-2.5 text-sm focus:ring-corporate-blue focus:border-corporate-blue"
                  rows="3"
                  required={actionModal.action === 'reject'}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <Button
                  variant="secondary"
                  onClick={() => setActionModal({ isOpen: false, action: 'approve', request: null, reasonOrRemarks: '', signature: '', confirmedCheck: false, loading: false })}
                  disabled={actionModal.loading}
                >
                  Cancel
                </Button>
                <Button
                  variant={actionModal.action === 'approve' ? 'primary' : 'danger'}
                  onClick={handleActionConfirm}
                  loading={actionModal.loading}
                  className={actionModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                >
                  {actionModal.action === 'approve' ? 'Confirm Approval' : 'Reject Request'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal: Material Issue Documentation Print Slip */}
      <MaterialIssueSlipModal
        isOpen={slipModalOpen}
        onClose={() => {
          setSlipModalOpen(false);
          setSelectedSlipRequest(null);
        }}
        request={selectedSlipRequest}
        onComplete={() => fetchRequests()}
      />
    </div>
  );
}

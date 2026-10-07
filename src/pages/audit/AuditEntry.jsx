import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import clientService from '../../services/clientService';
import employeeService from '../../services/employeeService';
import productService from '../../services/productService';
import { extractErrorMessage } from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import MaterialIssueSlipModal from '../../components/workerStock/MaterialIssueSlipModal';
import { exportToCSV } from '../../utils/csvExport';
import {
  FileText,
  Search,
  Filter,
  Calendar,
  User,
  Briefcase,
  MapPin,
  Package,
  Printer,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Layers,
  Download,
  Hammer,
} from 'lucide-react';

export default function AuditEntry() {
  const { user, isAdmin, isSupervisor, isManager } = useAuth();
  const toast = useToast();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });

  // Summary KPIs
  const [summary, setSummary] = useState({
    total_clients: 0,
    total_assignments: 0,
    total_approved_assignments: 0,
    total_materials_issued: 0,
    total_materials_used: 0,
    total_materials_returned: 0,
  });

  // Reference options for dropdowns
  const [clientOptions, setClientOptions] = useState([]);
  const [workerOptions, setWorkerOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);

  // Multi-Filter States
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedWorker, setSelectedWorker] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Receipt Slip Modal
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlipRequest, setSelectedSlipRequest] = useState(null);

  // Load dropdown lists once
  useEffect(() => {
    async function loadFilterDropdowns() {
      try {
        const [cRes, wRes, pRes, sRes] = await Promise.allSettled([
          clientService.getClients({ per_page: 200 }),
          employeeService.getEmployees({ role: 'worker', per_page: 200 }),
          productService.getProducts({ per_page: 200 }),
          clientService.getAuditSummary(),
        ]);

        if (cRes.status === 'fulfilled') {
          setClientOptions(cRes.value.data?.items || cRes.value.data || []);
        }
        if (wRes.status === 'fulfilled') {
          setWorkerOptions(wRes.value.data?.items || wRes.value.data || []);
        }
        if (pRes.status === 'fulfilled') {
          setProductOptions(pRes.value.data?.items || pRes.value.data || []);
        }
        if (sRes.status === 'fulfilled') {
          setSummary(sRes.value.data || {});
        }
      } catch (err) {
        console.error('Failed to load filter reference options:', err);
      }
    }
    loadFilterDropdowns();
  }, []);

  // Fetch Audit Ledger records
  const fetchAuditRecords = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await clientService.getAuditLedger({
        page,
        per_page: 10,
        search: debouncedSearch || undefined,
        client_id: selectedClient || undefined,
        worker_id: selectedWorker || undefined,
        product_id: selectedProduct || undefined,
        location: selectedLocation || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });

      setRecords(res.data?.items || []);
      setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load audit records.'));
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    selectedClient,
    selectedWorker,
    selectedProduct,
    selectedLocation,
    statusFilter,
    typeFilter,
    dateFrom,
    dateTo,
  ]);

  useEffect(() => {
    fetchAuditRecords(1);
  }, [fetchAuditRecords]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedClient('');
    setSelectedWorker('');
    setSelectedProduct('');
    setSelectedLocation('');
    setStatusFilter('');
    setTypeFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = Boolean(
    search ||
    selectedClient ||
    selectedWorker ||
    selectedProduct ||
    selectedLocation ||
    statusFilter ||
    typeFilter ||
    dateFrom ||
    dateTo
  );

  const totalLoadedAmountSpent = useMemo(() => {
    if (!Array.isArray(records)) return 0;
    return records.reduce((sum, r) => {
      let amount = 0;
      if (Array.isArray(r?.items) && r.items.length > 0) {
        amount = r.items.reduce((s, it) => s + (Number(it?.quantity || 0) * Number(it?.product?.purchase_rate || 0)), 0);
      } else if (r?.product) {
        amount = Number(r.quantity || 0) * Number(r.product?.purchase_rate || 0);
      }
      return sum + amount;
    }, 0);
  }, [records]);

  // Fix Export to CSV: Uses exportToCSV utility, respects currently applied filters, no '#' bugs
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      let exportItems = records;
      try {
        const res = await clientService.getAuditLedger({
          per_page: 2000,
          search: debouncedSearch || undefined,
          client_id: selectedClient || undefined,
          worker_id: selectedWorker || undefined,
          product_id: selectedProduct || undefined,
          location: selectedLocation || undefined,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        });
        if (res?.data?.items && res.data.items.length > 0) {
          exportItems = res.data.items;
        } else if (Array.isArray(res?.items) && res.items.length > 0) {
          exportItems = res.items;
        }
      } catch (e) {
        console.warn('Fallback to currently loaded records for CSV export:', e);
      }

      if (!exportItems || exportItems.length === 0) {
        toast.warning('No audit records to export with current filters.');
        setExporting(false);
        return;
      }

      const headers = [
        { key: 'voucher_id', label: 'Voucher ID' },
        { key: 'date', label: 'Date' },
        { key: 'client', label: 'Client' },
        { key: 'location', label: 'Work Location' },
        { key: 'worker', label: 'Worker' },
        { key: 'work_scope', label: 'Work Scope / Project' },
        { key: 'start_date', label: 'Start Date' },
        { key: 'end_date', label: 'End Date' },
        { key: 'type', label: 'Movement Type' },
        { key: 'materials', label: 'Materials Assigned' },
        { key: 'amount_spent', label: 'Amount Spent (₹)' },
        { key: 'status', label: 'Status' },
        { key: 'approved_by', label: 'Approved By' },
        { key: 'remarks', label: 'Remarks / Details' },
      ];

      const csvData = exportItems.map((r) => {
        const cleanId = String(r.request_number || r.id).replace(/^#+/, '');
        const dateStr = r.requested_at ? new Date(r.requested_at).toLocaleDateString() : (r.created_at ? new Date(r.created_at).toLocaleDateString() : '');
        
        let materialsList = '';
        let amountSpent = 0;
        if (Array.isArray(r.items) && r.items.length > 0) {
          materialsList = r.items.map((it) => `${it.product?.name || 'Product'}: ${it.quantity} ${it.product?.unit || 'units'}`).join('; ');
          amountSpent = r.items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.product?.purchase_rate || 0)), 0);
        } else if (r.product) {
          materialsList = `${r.product.name}: ${r.quantity} ${r.product.unit || 'units'}`;
          amountSpent = Number(r.quantity || 0) * Number(r.product?.purchase_rate || 0);
        } else {
          materialsList = `${r.quantity || 0} units`;
        }

        return {
          voucher_id: cleanId,
          date: dateStr,
          client: r.client?.name || 'General Project',
          location: r.work_location || r.client?.location || '',
          worker: r.worker?.name || '',
          work_scope: r.work_title || '',
          start_date: r.start_date || '',
          end_date: r.end_date || '',
          type: r.type || '',
          materials: materialsList,
          amount_spent: amountSpent > 0 ? `₹${amountSpent.toFixed(2)}` : '₹0.00',
          status: r.status || '',
          approved_by: r.approved_by?.name || '',
          remarks: r.remarks || r.description || '',
        };
      });

      exportToCSV('Audit_Ledger_Export', headers, csvData);
      toast.success(`Successfully exported ${exportItems.length} audit records to CSV.`);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      toast.error('Failed to generate CSV export.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Entry & Client Work Ledger"
        description="Complete operational trace of client work assignments, workers deployed, materials issued, consumed on site, and returned to warehouse."
      >
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            onClick={handleExportCSV} 
            loading={exporting}
            className="text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()} className="text-xs">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print Ledger
          </Button>
        </div>
      </PageHeader>

      {/* KPI Metric Summary Strip with Professional Dashboard Colors */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Client Projects - Blue */}
        <div className="bg-gradient-to-br from-blue-50/90 via-blue-50/30 to-white p-3.5 rounded-xl border border-blue-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Client Projects</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-black text-blue-950 tracking-tight">
              {summary.total_clients || 0}
            </div>
          </div>
          <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
            <span>Active Enterprise Sites</span>
          </div>
        </div>

        {/* 2. Work Assignments - Indigo */}
        <div className="bg-gradient-to-br from-indigo-50/90 via-indigo-50/30 to-white p-3.5 rounded-xl border border-indigo-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">Work Assignments</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-black text-indigo-950 tracking-tight">
              {summary.total_assignments || 0}
            </div>
          </div>
          <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
            <span>Dispatched Job Orders</span>
          </div>
        </div>

        {/* 3. Approved Orders - Emerald */}
        <div className="bg-gradient-to-br from-emerald-50/90 via-emerald-50/30 to-white p-3.5 rounded-xl border border-emerald-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">Approved Orders</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-black text-emerald-800 tracking-tight">
              {summary.total_approved_assignments || 0}
            </div>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <span>Vouchers Signed & Live</span>
          </div>
        </div>

        {/* 4. Issued Materials - Cyan */}
        <div className="bg-gradient-to-br from-cyan-50/90 via-cyan-50/30 to-white p-3.5 rounded-xl border border-cyan-200/80 shadow-xs hover:shadow-md hover:border-cyan-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-900">Issued Materials</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-700">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-black text-cyan-950 tracking-tight">
              {Number(summary.total_materials_issued || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-cyan-700 font-semibold flex items-center gap-1">
            <span>Units Dispatched to Field</span>
          </div>
        </div>

        {/* 5. Consumed on Site - Amber */}
        <div className="bg-gradient-to-br from-amber-50/90 via-amber-50/30 to-white p-3.5 rounded-xl border border-amber-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Consumed on Site</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Hammer className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-black text-amber-900 tracking-tight">
              {Number(summary.total_materials_used || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-amber-700 font-semibold flex items-center gap-1">
            <span>Used in Execution</span>
          </div>
        </div>

        {/* 6. Returned to Godown - Purple */}
        <div className="bg-gradient-to-br from-purple-50/90 via-purple-50/30 to-white p-3.5 rounded-xl border border-purple-200/80 shadow-xs hover:shadow-md hover:border-purple-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-900">Returned to Godown</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-2xl font-black text-purple-950 tracking-tight">
              {Number(summary.total_materials_returned || 0).toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-purple-700 font-semibold flex items-center gap-1">
            <span>Restocked to Warehouse</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        {/* First Row of Filters: Search, Client, Worker, Product */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client, work, voucher, worker..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full border border-slate-200 rounded-lg py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-pointer"
            >
              <option value="">All Clients</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.location ? `(${c.location})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="w-full border border-slate-200 rounded-lg py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-pointer"
            >
              <option value="">All Workers</option>
              {workerOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (EMP-{w.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full border border-slate-200 rounded-lg py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-pointer"
            >
              <option value="">All Materials / SKUs</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.code}]
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Second Row of Filters: Location, Dates, Status, Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 border-t border-slate-100">
          {/* Location Search */}
          <div className="relative">
            <MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              placeholder="Filter by Site Location..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          {/* Date Range: From */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-slate-400 font-medium shrink-0">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-transparent text-slate-800 focus:outline-none text-xs cursor-pointer"
            />
          </div>

          {/* Date Range: To */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-slate-400 font-medium shrink-0">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-transparent text-slate-800 focus:outline-none text-xs cursor-pointer"
            />
          </div>

          {/* Status & Movement Type */}
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-1/2 border border-slate-200 rounded-lg py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-1/2 border border-slate-200 rounded-lg py-2 px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-white cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="ISSUE">Issue Order</option>
              <option value="RETURN">Return Order</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2 py-1 text-xs text-rose-600 hover:text-rose-800 font-medium whitespace-nowrap cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Audit Records Table */}
      {/* Rule: Serial Number / ID -> Date -> Other Information; No '#' symbol */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Complete Work & Material Audit Trace ({pagination.total} Records)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              Page Spend: ₹{totalLoadedAmountSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500">Live Transactional Log</span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={() => fetchAuditRecords(pagination.current_page)} />
          </div>
        ) : records.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No audit entries matched"
              description="Try broadening your search query or reset filter selections to view the complete history."
              actionLabel={hasActiveFilters ? 'Clear All Filters' : undefined}
              onAction={handleResetFilters}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Voucher ID</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Client & Location</th>
                  <th className="px-5 py-3.5">Worker Deployed</th>
                  <th className="px-5 py-3.5">Work / Project Scope</th>
                  <th className="px-5 py-3.5">Schedule Period</th>
                  <th className="px-5 py-3.5">Materials Assigned</th>
                  <th className="px-5 py-3.5 text-right">Amount Spent (₹)</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Receipt Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => {
                  const cleanVoucher = String(r.request_number || r.id).replace(/^#+/, '');
                  const isIssue = r.type === 'ISSUE';

                  let rowAmountSpent = 0;
                  if (Array.isArray(r.items) && r.items.length > 0) {
                    rowAmountSpent = r.items.reduce((sum, it) => sum + (Number(it.quantity || 0) * Number(it.product?.purchase_rate || 0)), 0);
                  } else if (r.product) {
                    rowAmountSpent = Number(r.quantity || 0) * Number(r.product?.purchase_rate || 0);
                  }

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Voucher ID (No '#' symbol) */}
                      <td className="px-5 py-3.5 align-top font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {cleanVoucher}
                      </td>

                      {/* 2. Date (Date strictly 2nd column) */}
                      <td className="px-5 py-3.5 align-top text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {r.requested_at ? new Date(r.requested_at).toLocaleDateString() : (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {r.requested_at ? new Date(r.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </td>

                      {/* 3. Client & Location */}
                      <td className="px-5 py-3.5 align-top">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{r.client?.name || 'General Project'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{r.work_location || r.client?.location || 'Main Site'}</span>
                        </div>
                        {r.client?.contact_number && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Ph: {r.client.contact_number}
                          </div>
                        )}
                      </td>

                      {/* 4. Worker */}
                      <td className="px-5 py-3.5 align-top">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{r.worker?.name || '—'}</span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          EMP-{r.worker?.id || '—'}
                        </div>
                      </td>

                      {/* 5. Work Scope & Description */}
                      <td className="px-5 py-3.5 align-top max-w-xs">
                        <div className="font-bold text-slate-800">
                          {r.work_title || (isIssue ? 'Material Issue Order' : 'Material Return Order')}
                        </div>
                        <p className="text-slate-600 text-xs mt-1 line-clamp-2">
                          {r.remarks || r.description || 'Materials dispatched for scheduled site work.'}
                        </p>
                      </td>

                      {/* 6. Period: Start Date -> End Date */}
                      <td className="px-5 py-3.5 align-top whitespace-nowrap">
                        {r.start_date || r.end_date ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[11px] text-slate-700 font-medium">
                              <Calendar className="w-3 h-3 text-blue-500 shrink-0" />
                              <span>{r.start_date || 'Start'}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                              <span>{r.end_date || 'Ongoing'}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Order: {cleanVoucher}
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400 text-xs">
                            {r.requested_at ? new Date(r.requested_at).toLocaleDateString() : '—'}
                          </div>
                        )}
                      </td>

                      {/* 7. Materials Assigned */}
                      <td className="px-5 py-3.5 align-top">
                        <div className="space-y-1">
                          {Array.isArray(r.items) && r.items.length > 0 ? (
                            r.items.map((it, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-medium text-slate-800">{it.product?.name || `Product #${it.product_id}`}</span>
                                <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                  {it.quantity} {it.product?.unit || 'units'}
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-slate-800">{r.product?.name || 'Material'}</span>
                              <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                {r.quantity} {r.product?.unit || 'units'}
                              </span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 pt-0.5">
                            From: {r.source_godown?.name || 'Retail Warehouse'}
                          </div>
                        </div>
                      </td>

                      {/* 8. Amount Spent in Work */}
                      <td className="px-5 py-3.5 align-top text-right whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 text-sm">
                          ₹{rowAmountSpent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {rowAmountSpent > 0 ? 'Material Cost' : '—'}
                        </div>
                      </td>

                      {/* 9. Status */}
                      <td className="px-5 py-3.5 align-top text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            r.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'PENDING'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.approved_by && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            By {r.approved_by?.name || 'Manager'}
                          </div>
                        )}
                      </td>

                      {/* 9. Actions */}
                      <td className="px-5 py-3.5 align-top text-right">
                        <button
                          onClick={() => {
                            setSelectedSlipRequest(r);
                            setSlipModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition cursor-pointer"
                          title="View Official Material Voucher Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Voucher</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
              onPageChange={(page) => fetchAuditRecords(page)}
            />
          </div>
        )}
      </div>

      {/* Official Voucher Receipt Modal */}
      {slipModalOpen && selectedSlipRequest && (
        <MaterialIssueSlipModal
          isOpen={slipModalOpen}
          onClose={() => setSlipModalOpen(false)}
          request={selectedSlipRequest}
        />
      )}
    </div>
  );
}

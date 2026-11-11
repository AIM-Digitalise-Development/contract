import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import clientService from '../../services/clientService';
import employeeService from '../../services/employeeService';
import productService from '../../services/productService';
import godownService from '../../services/godownService';
import stockService from '../../services/stockService';
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
  Trash2,
  Boxes,
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  BookOpen,
  Eye,
  CheckCheck,
} from 'lucide-react';

export default function AuditEntry() {
  const { user, isAdmin, isSupervisor, isManager } = useAuth();
  const toast = useToast();

  // Top-Level Tab Mode: 'inventory' (Closing Stock & Transaction Audit) vs 'work_trace' (Client & Worker Material Trace)
  const [activeAuditTab, setActiveAuditTab] = useState('inventory');

  // =========================================================================
  // SECTION 1: INVENTORY & CLOSING STOCK TRANSACTION AUDIT STATE (PART 3C)
  // =========================================================================
  const [invLoading, setInvLoading] = useState(true);
  const [invError, setInvError] = useState('');
  const [invTransactions, setInvTransactions] = useState([]);
  const [invSummary, setInvSummary] = useState({
    total_transactions: 0,
    total_stock_in: 0,
    total_stock_out: 0,
    net_adjustments: 0,
  });
  const [invPagination, setInvPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 15 });
  const [invPerPage, setInvPerPage] = useState(15);
  const [invPage, setInvPage] = useState(1);
  const [isExportingInv, setIsExportingInv] = useState(false);

  // Filters for Inventory Transaction Audit
  const [invPeriod, setInvPeriod] = useState(''); // '' | 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom'
  const [invStartDate, setInvStartDate] = useState('');
  const [invEndDate, setInvEndDate] = useState('');
  const [invSearch, setInvSearch] = useState('');
  const debouncedInvSearch = useDebounce(invSearch, 300);
  const [invProductFilter, setInvProductFilter] = useState('');
  const [invCategoryFilter, setInvCategoryFilter] = useState('');
  const [invTypeFilter, setInvTypeFilter] = useState('');
  const [invStatusFilter, setInvStatusFilter] = useState('');
  const [invGodownFilter, setInvGodownFilter] = useState('');

  // Single Product Lifecycle Audit Ledger Modal
  const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
  const [selectedProductForLedger, setSelectedProductForLedger] = useState(null);
  const [productLedgerData, setProductLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Reference options
  const [godownOptions, setGodownOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [clientOptions, setClientOptions] = useState([]);
  const [workerOptions, setWorkerOptions] = useState([]);

  // Compute distinct categories
  const categoryOptions = useMemo(() => {
    const set = new Set();
    (productOptions || []).forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [productOptions]);

  // =========================================================================
  // SECTION 2: CLIENT WORK & MATERIAL VOUCHER TRACE STATE (PRESERVED INTACT)
  // =========================================================================
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });
  const [perPage, setPerPage] = useState(10);

  const [summary, setSummary] = useState({
    total_clients: 0,
    total_assignments: 0,
    total_approved_assignments: 0,
    total_materials_issued: 0,
    total_materials_used: 0,
    total_materials_returned: 0,
  });

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

  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlipRequest, setSelectedSlipRequest] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Load dropdown references once
  useEffect(() => {
    async function loadDropdowns() {
      try {
        const [gRes, pRes, cRes, wRes, sRes] = await Promise.allSettled([
          godownService.getGodowns({ per_page: 200 }),
          productService.getProducts({ per_page: 500 }),
          clientService.getClients({ per_page: 200 }),
          employeeService.getEmployees({ role: 'worker', per_page: 200 }),
          clientService.getAuditSummary(),
        ]);

        if (gRes.status === 'fulfilled') setGodownOptions(gRes.value.data?.items || gRes.value.data || []);
        if (pRes.status === 'fulfilled') setProductOptions(pRes.value.data?.items || pRes.value.data || []);
        if (cRes.status === 'fulfilled') setClientOptions(cRes.value.data?.items || cRes.value.data || []);
        if (wRes.status === 'fulfilled') setWorkerOptions(wRes.value.data?.items || wRes.value.data || []);
        if (sRes.status === 'fulfilled') setSummary(sRes.value.data || {});
      } catch (err) {
        console.error('Failed to load filter dropdowns:', err);
      }
    }
    loadDropdowns();
  }, []);

  // Fetch Inventory Transaction History (Part 3C)
  const fetchInventoryTransactions = useCallback(async (page = 1, currentPerPage = invPerPage) => {
    setInvLoading(true);
    setInvError('');
    try {
      const params = {
        page,
        per_page: currentPerPage,
        period: invPeriod || undefined,
        search: debouncedInvSearch || undefined,
        product_id: invProductFilter || undefined,
        category: invCategoryFilter || undefined,
        type: invTypeFilter || undefined,
        godown_id: invGodownFilter || undefined,
      };

      if (invPeriod === 'custom') {
        if (invStartDate) params.start_date = invStartDate;
        if (invEndDate) params.end_date = invEndDate;
      }

      const res = await stockService.getAuditTransactions(params);
      const data = res?.data || res || {};

      setInvTransactions(data.items || []);
      setInvSummary(data.summary || {
        total_transactions: 0,
        total_stock_in: 0,
        total_stock_out: 0,
        net_adjustments: 0,
      });
      setInvPagination(data.pagination || { current_page: 1, last_page: 1, total: 0, per_page: currentPerPage });
    } catch (err) {
      setInvError(extractErrorMessage(err, 'Failed to load inventory audit transactions.'));
    } finally {
      setInvLoading(false);
    }
  }, [invPeriod, invStartDate, invEndDate, debouncedInvSearch, invProductFilter, invCategoryFilter, invTypeFilter, invGodownFilter, invPerPage]);

  useEffect(() => {
    if (activeAuditTab === 'inventory') {
      fetchInventoryTransactions(invPage, invPerPage);
    }
  }, [activeAuditTab, invPage, invPerPage, fetchInventoryTransactions]);

  // Fetch Client & Worker Voucher Trace Records
  const fetchAuditRecords = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await clientService.getAuditLedger({
        page,
        per_page: perPage,
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

      const data = res?.data || res;
      setRecords(data?.items || []);
      setPagination(data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: perPage });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load audit trace records.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedClient, selectedWorker, selectedProduct, selectedLocation, statusFilter, typeFilter, dateFrom, dateTo, perPage]);

  useEffect(() => {
    if (activeAuditTab === 'work_trace') {
      fetchAuditRecords(1);
    }
  }, [activeAuditTab, fetchAuditRecords]);

  // Open Product Lifecycle Audit Ledger Modal
  const handleOpenProductLedger = async (product) => {
    setSelectedProductForLedger(product);
    setLedgerModalOpen(true);
    setLedgerLoading(true);
    try {
      const params = {};
      if (invPeriod) params.period = invPeriod;
      if (invPeriod === 'custom') {
        if (invStartDate) params.start_date = invStartDate;
        if (invEndDate) params.end_date = invEndDate;
      }
      if (invGodownFilter) params.godown_id = invGodownFilter;

      const res = await stockService.getClosingStockProductLedger(product.product_id || product.id, params);
      setProductLedgerData(res?.data || res);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to load product audit ledger.'));
    } finally {
      setLedgerLoading(false);
    }
  };

  // Delete Audit Entry (Worker request)
  const handleDeleteAuditEntry = async (record) => {
    const cleanId = String(record.request_number || record.id).replace(/^#+/, '');
    if (!window.confirm(`Are you sure you want to delete Audit Entry ${cleanId}? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(record.id);
      await clientService.deleteAuditEntry(record.id);
      toast.success(`Audit Entry ${cleanId} deleted successfully.`);
      fetchAuditRecords(pagination.current_page || 1);
      try {
        const sRes = await clientService.getAuditSummary();
        setSummary(sRes.data || {});
      } catch (err) {
        // silent
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete audit entry.'));
    } finally {
      setDeletingId(null);
    }
  };

  // Export Complete Audit Transaction History as CSV (Part 3D #12)
  const handleExportInventoryCSV = async () => {
    setIsExportingInv(true);
    try {
      const params = {
        page: 1,
        per_page: 5000,
        period: invPeriod || undefined,
        search: debouncedInvSearch || undefined,
        product_id: invProductFilter || undefined,
        category: invCategoryFilter || undefined,
        type: invTypeFilter || undefined,
        godown_id: invGodownFilter || undefined,
      };
      if (invPeriod === 'custom') {
        if (invStartDate) params.start_date = invStartDate;
        if (invEndDate) params.end_date = invEndDate;
      }

      const res = await stockService.getAuditTransactions(params);
      const data = res?.data || res || {};
      const exportItems = data.items || [];

      if (exportItems.length === 0) {
        toast.warning('No inventory transactions match current filters to export.');
        return;
      }

      exportToCSV({
        filename: `Inventory_Audit_Transaction_History_${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { label: 'Transaction Date', key: 'date_formatted' },
          { label: 'Transaction ID', key: 'transaction_id' },
          { label: 'Product SKU', key: 'product_sku' },
          { label: 'Product Name', key: 'product_name' },
          { label: 'Category', key: 'category' },
          { label: 'Unit', key: 'unit' },
          { label: 'Transaction Type', key: 'type' },
          { label: 'Reference Number', key: 'reference_number' },
          { label: 'Quantity In', key: 'quantity_in' },
          { label: 'Quantity Out', key: 'quantity_out' },
          { label: 'Adjustments', key: 'adjustments' },
          { label: 'Running Balance', key: 'running_balance' },
          { label: 'Transaction Status', key: 'status' },
          { label: 'Warehouse', format: (item) => item.godown?.name || '—' },
          { label: 'Created By', key: 'created_by' },
          { label: 'Remarks', key: 'remarks' },
        ],
        data: exportItems,
      });

      toast.success(`Exported ${exportItems.length} inventory transaction records to CSV.`);
    } catch (err) {
      console.error('Failed to export inventory audit CSV:', err);
      toast.error('Failed to generate CSV export.');
    } finally {
      setIsExportingInv(false);
    }
  };

  // Export Work Trace CSV (Preserved)
  const handleExportWorkTraceCSV = async () => {
    setExporting(true);
    try {
      const res = await clientService.getAuditLedger({
        page: 1,
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

      const exportItems = res.data?.items || res.items || [];
      if (exportItems.length === 0) {
        toast.warning('No work trace records to export.');
        return;
      }

      exportToCSV({
        filename: `Work_Material_Trace_Audit_${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { label: 'Voucher ID', format: (r) => String(r.request_number || r.id).replace(/^#+/, '') },
          { label: 'Date', format: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : '' },
          { label: 'Client', format: (r) => r.client?.name || 'General Project' },
          { label: 'Location', format: (r) => r.work_location || r.client?.location || '' },
          { label: 'Worker Deployed', format: (r) => r.worker?.name || '' },
          { label: 'Work Title', key: 'work_title' },
          { label: 'Status', key: 'status' },
          { label: 'Materials Assigned', format: (r) => Array.isArray(r.items) ? r.items.map(it => `${it.product?.name}: ${it.quantity}`).join('; ') : '' },
        ],
        data: exportItems,
      });

      toast.success(`Exported ${exportItems.length} records to CSV.`);
    } catch (err) {
      toast.error('Failed to export work trace CSV.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Entry & Inventory Audit Ledger"
        description="Comprehensive inventory transaction auditing, product-wise closing stock verification, and client work material lifecycle."
      >
        <div className="flex items-center gap-2">
          {activeAuditTab === 'inventory' ? (
            <Button
              variant="secondary"
              onClick={handleExportInventoryCSV}
              loading={isExportingInv}
              className="text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Audit CSV
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={handleExportWorkTraceCSV}
              loading={exporting}
              className="text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Work Trace CSV
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()} className="text-xs">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print
          </Button>
        </div>
      </PageHeader>

      {/* Top Audit Mode Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveAuditTab('inventory')}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeAuditTab === 'inventory'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Closing Stock & Inventory Transaction Audit</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAuditTab('work_trace')}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeAuditTab === 'work_trace'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Client Projects & Material Voucher Trace</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: INVENTORY & CLOSING STOCK TRANSACTION AUDIT (PART 3C)          */}
      {/* ===================================================================== */}
      {activeAuditTab === 'inventory' && (
        <div className="space-y-5">
          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Transactions</p>
                <p className="text-2xl font-black text-slate-900 mt-1 font-mono">{invSummary.total_transactions}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Posted movements</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Boxes className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Total Stock In</p>
                <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">+{Number(invSummary.total_stock_in || 0).toLocaleString()}</p>
                <p className="text-[11px] text-emerald-600/70 mt-0.5">Procured / transferred in</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <ArrowDownLeft className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Total Stock Out</p>
                <p className="text-2xl font-black text-rose-700 mt-1 font-mono">-{Number(invSummary.total_stock_out || 0).toLocaleString()}</p>
                <p className="text-[11px] text-rose-600/70 mt-0.5">Issued / transferred out</p>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Net Adjustments</p>
                <p className="text-2xl font-black text-purple-900 mt-1 font-mono">
                  {Number(invSummary.net_adjustments || 0) >= 0 ? `+${Number(invSummary.net_adjustments || 0).toLocaleString()}` : Number(invSummary.net_adjustments || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-purple-600/70 mt-0.5">Audits & physical sync</p>
              </div>
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <RotateCcw className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Inventory Transaction Filters
                </span>
              </div>

              {/* Quick Period Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: '', label: 'All History' },
                  { id: 'today', label: 'Today' },
                  { id: 'this_week', label: 'This Week' },
                  { id: 'this_month', label: 'This Month' },
                  { id: 'this_year', label: 'This Year' },
                  { id: 'custom', label: 'Custom Range' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setInvPeriod(p.id);
                      setInvPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      invPeriod === p.id
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Selectors Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              <Input
                placeholder="Search SKU, name, or ref..."
                value={invSearch}
                onChange={(e) => {
                  setInvSearch(e.target.value);
                  setInvPage(1);
                }}
              />

              <Select
                value={invProductFilter}
                onChange={(e) => {
                  setInvProductFilter(e.target.value);
                  setInvPage(1);
                }}
                placeholder="All Products (SKU)"
                options={[
                  { value: '', label: 'All Products (SKU)' },
                  ...productOptions.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` }))
                ]}
              />

              <Select
                value={invCategoryFilter}
                onChange={(e) => {
                  setInvCategoryFilter(e.target.value);
                  setInvPage(1);
                }}
                placeholder="All Categories"
                options={[
                  { value: '', label: 'All Categories' },
                  ...categoryOptions.map(c => ({ value: c, label: c }))
                ]}
              />

              <Select
                value={invTypeFilter}
                onChange={(e) => {
                  setInvTypeFilter(e.target.value);
                  setInvPage(1);
                }}
                placeholder="All Transaction Types"
                options={[
                  { value: '', label: 'All Transaction Types' },
                  { value: 'OPENING_STOCK', label: 'Opening Stock' },
                  { value: 'STOCK_ENTRY', label: 'Stock Procurement (Entry)' },
                  { value: 'TRANSFER_IN', label: 'Transfer In' },
                  { value: 'TRANSFER_OUT', label: 'Transfer Out' },
                  { value: 'GODOWN_TO_WORKER', label: 'Godown → Worker' },
                  { value: 'WORKER_TO_GODOWN', label: 'Worker → Godown' },
                  { value: 'WORKER_USAGE', label: 'Worker Site Usage' },
                  { value: 'ADJUSTMENT', label: 'Stock Adjustment' },
                ]}
              />

              <Select
                value={invGodownFilter}
                onChange={(e) => {
                  setInvGodownFilter(e.target.value);
                  setInvPage(1);
                }}
                placeholder="All Warehouses"
                options={[
                  { value: '', label: 'All Warehouses' },
                  ...godownOptions.map(g => ({ value: g.id, label: `${g.name} (${g.type})` }))
                ]}
              />
            </div>

            {invPeriod === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                <div className="w-48">
                  <Input
                    type="date"
                    label="Start Date"
                    value={invStartDate}
                    onChange={(e) => setInvStartDate(e.target.value)}
                  />
                </div>
                <div className="w-48">
                  <Input
                    type="date"
                    label="End Date"
                    value={invEndDate}
                    onChange={(e) => setInvEndDate(e.target.value)}
                  />
                </div>
                <div className="pt-5">
                  <Button
                    size="sm"
                    onClick={() => fetchInventoryTransactions(1, invPerPage)}
                    className="h-9 text-xs"
                  >
                    Apply Range
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Transaction History Table with Running Balance */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Complete Inventory Audit History ({invPagination.total} Movements)
                </h4>
              </div>
              <div className="text-xs text-slate-500">
                Sorted chronologically with strict per-product running balance tracking
              </div>
            </div>

            {invLoading ? (
              <div className="p-12 flex justify-center">
                <Spinner size="lg" className="text-blue-600" />
              </div>
            ) : invError ? (
              <div className="p-6">
                <ErrorState message={invError} onRetry={() => fetchInventoryTransactions(invPage, invPerPage)} />
              </div>
            ) : invTransactions.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No inventory movements found"
                  description="No stock transactions match your selected period or filters."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3.5">Date & Time</th>
                      <th className="px-4 py-3.5">Transaction ID</th>
                      <th className="px-4 py-3.5">Product SKU</th>
                      <th className="px-4 py-3.5">Product Name</th>
                      <th className="px-3 py-3.5">Type</th>
                      <th className="px-4 py-3.5">Reference No.</th>
                      <th className="px-4 py-3.5 text-right">Qty In (+)</th>
                      <th className="px-4 py-3.5 text-right">Qty Out (-)</th>
                      <th className="px-4 py-3.5 text-right">Adjustment</th>
                      <th className="px-4 py-3.5 text-right font-bold text-blue-700">Running Balance</th>
                      <th className="px-3 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5">Created By</th>
                      <th className="px-4 py-3.5 text-right">Ledger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {tx.date_formatted}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-slate-900">
                          {tx.transaction_id}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-semibold text-blue-600">
                          {tx.product_sku}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-900">
                          {tx.product_name}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            tx.type === 'STOCK_ENTRY' || tx.type === 'OPENING_STOCK'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tx.type === 'GODOWN_TO_WORKER' || tx.type === 'TRANSFER_OUT' || tx.type === 'WORKER_USAGE'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : tx.type === 'ADJUSTMENT'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                          {tx.reference_number || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {tx.quantity_in > 0 ? (
                            <span className="font-mono font-bold text-emerald-600">
                              +{Number(tx.quantity_in).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {tx.quantity_out > 0 ? (
                            <span className="font-mono font-bold text-rose-600">
                              -{Number(tx.quantity_out).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {tx.adjustments !== 0 ? (
                            <span className="font-mono font-bold text-purple-700">
                              {tx.adjustments > 0 ? `+${Number(tx.adjustments).toLocaleString()}` : Number(tx.adjustments).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap bg-blue-50/20">
                          <span className="font-mono font-black text-sm text-blue-700">
                            {Number(tx.running_balance).toLocaleString()}
                          </span>{' '}
                          <span className="text-[10px] text-slate-400 uppercase">{tx.unit}</span>
                        </td>
                        <td className="px-3 py-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            POSTED
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                          {tx.created_by}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenProductLedger(tx)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Ledger
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {invPagination.total > 0 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Showing page {invPagination.current_page} of {invPagination.last_page} ({invPagination.total} total items)
                </div>
                <Pagination
                  currentPage={invPagination.current_page}
                  totalPages={invPagination.last_page}
                  onPageChange={(p) => setInvPage(p)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: CLIENT WORK & MATERIAL VOUCHER TRACE (PRESERVED INTACT)        */}
      {/* ===================================================================== */}
      {activeAuditTab === 'work_trace' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Clients</span>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">{summary.total_clients || 0}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Total Work Scope</span>
              <div className="text-xl font-black text-blue-900 mt-1 font-mono">{summary.total_assignments || 0}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Approved Orders</span>
              <div className="text-xl font-black text-emerald-900 mt-1 font-mono">{summary.total_approved_assignments || 0}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Materials Issued</span>
              <div className="text-xl font-black text-indigo-900 mt-1 font-mono">{Number(summary.total_materials_issued || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Materials Used</span>
              <div className="text-xl font-black text-amber-900 mt-1 font-mono">{Number(summary.total_materials_used || 0).toLocaleString()}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider">Returned to Godown</span>
              <div className="text-xl font-black text-teal-900 mt-1 font-mono">{Number(summary.total_materials_returned || 0).toLocaleString()}</div>
            </div>
          </div>

          {/* Work Trace Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Input
                placeholder="Search voucher, client, or worker..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                placeholder="All Clients"
                options={[
                  { value: '', label: 'All Clients' },
                  ...clientOptions.map((c) => ({ value: c.id, label: `${c.name} (${c.location})` })),
                ]}
              />
              <Select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                placeholder="All Workers"
                options={[
                  { value: '', label: 'All Workers' },
                  ...workerOptions.map((w) => ({ value: w.id, label: `${w.name} (EMP-${w.id})` })),
                ]}
              />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                placeholder="All Statuses"
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'PENDING', label: 'Pending Approval' },
                  { value: 'APPROVED', label: 'Approved & Active' },
                  { value: 'REJECTED', label: 'Rejected' },
                ]}
              />
            </div>
          </div>

          {/* Work Trace Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                COMPLETE WORK & MATERIAL AUDIT TRACE ({pagination.total} RECORDS)
              </span>
            </div>

            {loading ? (
              <div className="p-12 flex justify-center">
                <Spinner size="lg" className="text-blue-600" />
              </div>
            ) : error ? (
              <div className="p-6">
                <ErrorState message={error} onRetry={() => fetchAuditRecords(pagination.current_page || 1)} />
              </div>
            ) : records.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No audit records found"
                  description="No client work orders match your search parameters."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-5 py-3.5">Voucher ID</th>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Client & Location</th>
                      <th className="px-5 py-3.5">Worker Deployed</th>
                      <th className="px-5 py-3.5">Work / Scope</th>
                      <th className="px-5 py-3.5">Materials Assigned</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((r) => {
                      const cleanVoucherId = String(r.request_number || r.id).replace(/^#+/, '');
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-900">
                            {cleanVoucherId}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900">{r.client?.name || 'General Project'}</div>
                            <div className="text-[11px] text-slate-400">{r.work_location || r.client?.location || '—'}</div>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-800">
                            {r.worker?.name || 'Unassigned'}
                          </td>
                          <td className="px-5 py-3.5 text-slate-700">
                            {r.work_title || '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            {Array.isArray(r.items) && r.items.length > 0 ? (
                              <div className="space-y-1">
                                {r.items.map((it, idx) => (
                                  <div key={idx} className="text-[11px]">
                                    <span className="font-medium text-slate-900">{it.product?.name || 'Item'}:</span>{' '}
                                    <span className="font-mono text-blue-700 font-bold">{it.quantity} {it.product?.unit}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono">0 items</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center whitespace-nowrap">
                            <Badge variant={r.status}>{r.status}</Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedSlipRequest(r);
                                  setSlipModalOpen(true);
                                }}
                                className="text-xs"
                              >
                                View Slip
                              </Button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAuditEntry(r)}
                                  disabled={deletingId === r.id}
                                  title="Delete Record"
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer border border-transparent hover:border-rose-200 disabled:opacity-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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

            {pagination.total > 0 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Showing page {pagination.current_page} of {pagination.last_page} ({pagination.total} records)
                </div>
                <Pagination
                  currentPage={pagination.current_page}
                  totalPages={pagination.last_page}
                  onPageChange={(p) => fetchAuditRecords(p)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Lifecycle Audit Ledger Modal */}
      <Modal
        isOpen={ledgerModalOpen}
        onClose={() => {
          setLedgerModalOpen(false);
          setSelectedProductForLedger(null);
          setProductLedgerData(null);
        }}
        title={`Inventory Audit Ledger: ${selectedProductForLedger?.product_name || selectedProductForLedger?.name || ''} [${selectedProductForLedger?.product_sku || selectedProductForLedger?.code || ''}]`}
      >
        {ledgerLoading ? (
          <div className="p-10 flex justify-center">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : productLedgerData ? (
          <div className="space-y-4">
            {/* Product Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">Opening Stock</span>
                <div className="text-base font-black font-mono text-purple-900 mt-0.5">
                  {Number(productLedgerData.metrics?.opening_stock || 0).toLocaleString()} {productLedgerData.product?.unit}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Total Inbound</span>
                <div className="text-base font-black font-mono text-emerald-700 mt-0.5">
                  +{Number(productLedgerData.metrics?.total_inbound || 0).toLocaleString()} {productLedgerData.product?.unit}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-rose-600 uppercase">Total Outbound</span>
                <div className="text-base font-black font-mono text-rose-700 mt-0.5">
                  -{Number(productLedgerData.metrics?.total_outbound || 0).toLocaleString()} {productLedgerData.product?.unit}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase">Calculated Closing</span>
                <div className="text-base font-black font-mono text-blue-700 mt-0.5">
                  {Number(productLedgerData.metrics?.closing_stock || 0).toLocaleString()} {productLedgerData.product?.unit}
                </div>
              </div>
            </div>

            {/* Chronological Movements Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[50vh] overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Ref</th>
                    <th className="px-3 py-2 text-right">In (+)</th>
                    <th className="px-3 py-2 text-right">Out (-)</th>
                    <th className="px-3 py-2 text-right font-bold text-blue-700">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productLedgerData.transactions?.map((tx, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600 font-mono text-[11px]">{tx.date_formatted}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-500 text-[11px]">{tx.reference || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                        {tx.inbound_qty > 0 ? `+${tx.inbound_qty}` : '0'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-rose-600">
                        {tx.outbound_qty > 0 ? `-${tx.outbound_qty}` : '0'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-black text-blue-700 bg-blue-50/20">
                        {tx.running_balance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
              <span>{productLedgerData.transactions?.length || 0} chronological movement(s) recorded</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setLedgerModalOpen(false);
                  setSelectedProductForLedger(null);
                  setProductLedgerData(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400">
            No transaction records available for this product.
          </div>
        )}
      </Modal>

      {/* Slip Modal */}
      {slipModalOpen && selectedSlipRequest && (
        <MaterialIssueSlipModal
          isOpen={slipModalOpen}
          onClose={() => {
            setSlipModalOpen(false);
            setSelectedSlipRequest(null);
          }}
          request={selectedSlipRequest}
        />
      )}
    </div>
  );
}

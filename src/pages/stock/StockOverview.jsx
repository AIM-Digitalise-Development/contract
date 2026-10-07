import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import stockService from '../../services/stockService';
import godownService from '../../services/godownService';
import productService from '../../services/productService';
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
import { 
  ClipboardCheck, 
  Boxes, 
  Warehouse, 
  Users, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Hammer, 
  Briefcase, 
  MapPin, 
  Calendar,
  Download
} from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';

export default function StockOverview() {
  const { user } = useAuth();
  const toast = useToast();

  // Tab 1: entries ('Stock List Approval')
  // Tab 2: stock ('Available Stock')
  // Tab 3: godown_transactions ('Godown Transaction')
  // Tab 4: worker_transactions ('Worker Transaction')
  const [activeTab, setActiveTab] = useState('entries');

  // Data states
  const [stockItems, setStockItems] = useState([]);
  const [entries, setEntries] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });

  // Filter dropdown options
  const [godownOptions, setGodownOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);

  // Selected filters
  const [godownFilter, setGodownFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Quick Approve Modal for pending entries
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedEntryToApprove, setSelectedEntryToApprove] = useState(null);
  const [approvingEntry, setApprovingEntry] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState('');

  // Reject Modal for pending entries
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedEntryToReject, setSelectedEntryToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingEntry, setRejectingEntry] = useState(false);

  // Stock Entry Request Modal
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [entryFormData, setEntryFormData] = useState({
    godown_id: '',
    product_id: '',
    quantity: '',
    internal_location: '',
    remarks: '',
  });

  const optionsLoadedRef = useRef(false);

  // Load dropdown options once
  useEffect(() => {
    if (optionsLoadedRef.current) return;
    async function loadOptions() {
      try {
        const [gRes, pRes] = await Promise.all([
          godownService.getGodowns({ per_page: 100 }),
          productService.getProducts({ per_page: 100 }),
        ]);
        setGodownOptions(gRes.data?.items || []);
        setProductOptions(pRes.data?.items || []);
        optionsLoadedRef.current = true;
      } catch {
        // Options loading fallback
      }
    }
    loadOptions();
  }, []);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'stock') {
        const res = await stockService.getStock({
          page,
          per_page: 10,
          godown_id: godownFilter || undefined,
          product_id: productFilter || undefined,
          search: debouncedSearch || undefined,
        });
        setStockItems(res.data?.items || []);
        setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
      } else if (activeTab === 'entries') {
        const res = await stockService.getStockEntries({
          page,
          per_page: 10,
          godown_id: godownFilter || undefined,
          product_id: productFilter || undefined,
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
        });
        setEntries(res.data?.items || []);
        setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
      } else if (activeTab === 'godown_transactions') {
        const res = await stockService.getTransactions({
          page,
          per_page: 10,
          category: 'godown',
          godown_id: godownFilter || undefined,
          product_id: productFilter || undefined,
        });
        setTransactions(res.data?.items || []);
        setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
      } else if (activeTab === 'worker_transactions') {
        const res = await stockService.getTransactions({
          page,
          per_page: 10,
          category: 'worker',
          godown_id: godownFilter || undefined,
          product_id: productFilter || undefined,
        });
        setTransactions(res.data?.items || []);
        setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch inventory data.'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, godownFilter, productFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleOpenApproveModal = (entry) => {
    setSelectedEntryToApprove(entry);
    setApproveRemarks('');
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedEntryToApprove) return;

    setApprovingEntry(true);
    try {
      await stockService.approveStockEntry(selectedEntryToApprove.id, approveRemarks);
      // Clean display without #
      const cleanEntryNum = String(selectedEntryToApprove.entry_number || selectedEntryToApprove.id).replace(/^#+/, '');
      toast.success(`Stock Entry ${cleanEntryNum} approved by ${user?.name || 'Staff'} (ID: ${user?.id}). Stock ledger updated.`);
      setIsApproveModalOpen(false);
      setSelectedEntryToApprove(null);
      setApproveRemarks('');
      fetchData(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to approve stock entry.'));
    } finally {
      setApprovingEntry(false);
    }
  };

  const handleOpenRejectModal = (entry) => {
    setSelectedEntryToReject(entry);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedEntryToReject) return;
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason.');
      return;
    }

    setRejectingEntry(true);
    try {
      await stockService.rejectStockEntry(selectedEntryToReject.id, rejectReason.trim());
      const cleanEntryNum = String(selectedEntryToReject.entry_number || selectedEntryToReject.id).replace(/^#+/, '');
      toast.success(`Stock Entry ${cleanEntryNum} rejected.`);
      setIsRejectModalOpen(false);
      setSelectedEntryToReject(null);
      setRejectReason('');
      fetchData(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to reject stock entry.'));
    } finally {
      setRejectingEntry(false);
    }
  };

  const handleOpenEntryModal = () => {
    setEntryFormData({
      godown_id: godownOptions[0]?.id || '',
      product_id: productOptions[0]?.id || '',
      quantity: '',
      internal_location: '',
      remarks: '',
    });
    setIsEntryModalOpen(true);
  };

  const handleSubmitEntry = async (e) => {
    e.preventDefault();
    if (!entryFormData.godown_id || !entryFormData.product_id || !entryFormData.quantity) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setSubmittingEntry(true);
    try {
      await stockService.createStockEntry({
        godown_id: Number(entryFormData.godown_id),
        product_id: Number(entryFormData.product_id),
        quantity: Number(entryFormData.quantity),
        internal_location: entryFormData.internal_location || undefined,
        remarks: entryFormData.remarks || undefined,
      });

      toast.success('Stock entry submitted and awaiting supervisor approval.');
      setIsEntryModalOpen(false);
      setActiveTab('entries');
      fetchData(1);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to submit stock entry.'));
    } finally {
      setSubmittingEntry(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      if (activeTab === 'entries') {
        let exportData = entries;
        try {
          const res = await stockService.getStockEntries({
            per_page: 2000,
            godown_id: godownFilter || undefined,
            product_id: productFilter || undefined,
            status: statusFilter || undefined,
            search: debouncedSearch || undefined,
          });
          if (res?.data?.items && res.data.items.length > 0) {
            exportData = res.data.items;
          }
        } catch (e) {
          console.warn('Fallback to current page entries for CSV:', e);
        }

        if (!exportData || exportData.length === 0) {
          toast.warning('No stock entry records found to export with currently applied filters.');
          return;
        }

        exportToCSV({
          filename: `Stock_List_Approval_${new Date().toISOString().slice(0, 10)}.csv`,
          columns: [
            { label: 'Entry ID', format: (e) => String(e.entry_number || e.id).replace(/^#+/, '') },
            { label: 'Date', format: (e) => (e.created_at ? new Date(e.created_at).toLocaleDateString() : '—') },
            { label: 'Product', format: (e) => e.product?.name || 'Product' },
            { label: 'Godown', format: (e) => e.godown?.name || 'Godown' },
            { label: 'Location', format: (e) => e.internal_location || '—' },
            { label: 'Quantity', format: (e) => `${e.quantity} ${e.product?.unit || ''}` },
            { label: 'Requester', format: (e) => e.requester?.name || 'Staff' },
            { label: 'Status', key: 'status' },
            { label: 'Approver', format: (e) => e.approver?.name || '—' },
          ],
          data: exportData,
        });
        toast.success(`Exported ${exportData.length} filtered stock entry records.`);
      } else if (activeTab === 'stock') {
        let exportData = stockItems;
        try {
          const res = await stockService.getStock({
            per_page: 2000,
            godown_id: godownFilter || undefined,
            product_id: productFilter || undefined,
            search: debouncedSearch || undefined,
          });
          if (res?.data?.items && res.data.items.length > 0) {
            exportData = res.data.items;
          }
        } catch (e) {
          console.warn('Fallback to current page stock items for CSV:', e);
        }

        if (!exportData || exportData.length === 0) {
          toast.warning('No available stock records found to export with currently applied filters.');
          return;
        }

        exportToCSV({
          filename: `Available_Stock_${new Date().toISOString().slice(0, 10)}.csv`,
          columns: [
            { label: 'Product', format: (s) => s.product?.name || 'Product' },
            { label: 'Code', format: (s) => s.product?.code || '—' },
            { label: 'Godown', format: (s) => s.godown?.name || 'Godown' },
            { label: 'Godown Type', format: (s) => s.godown?.type || '—' },
            { label: 'Available Stock', key: 'quantity' },
            { label: 'Unit', format: (s) => s.product?.unit || 'units' },
            { label: 'Last Movement', format: (s) => (s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—') },
          ],
          data: exportData,
        });
        toast.success(`Exported ${exportData.length} filtered available stock records.`);
      } else if (activeTab === 'godown_transactions') {
        let exportData = transactions;
        try {
          const res = await stockService.getTransactions({
            per_page: 2000,
            category: 'godown',
            godown_id: godownFilter || undefined,
            product_id: productFilter || undefined,
          });
          if (res?.data?.items && res.data.items.length > 0) {
            exportData = res.data.items;
          }
        } catch (e) {
          console.warn('Fallback to current page godown transactions for CSV:', e);
        }

        if (!exportData || exportData.length === 0) {
          toast.warning('No godown transactions found to export with currently applied filters.');
          return;
        }

        exportToCSV({
          filename: `Godown_Transactions_${new Date().toISOString().slice(0, 10)}.csv`,
          columns: [
            { label: 'Transfer ID', format: (t) => String(t.reference_number || t.id).replace(/^#+/, '') },
            { label: 'Date', format: (t) => (t.created_at ? new Date(t.created_at).toLocaleDateString() : '—') },
            { label: 'Movement Type', key: 'type' },
            { label: 'Godown', format: (t) => t.godown?.name || 'Godown' },
            { label: 'Product', format: (t) => t.product?.name || 'Product' },
            { label: 'Quantity', key: 'quantity' },
            { label: 'Balance Before', key: 'balance_before' },
            { label: 'Balance After', key: 'balance_after' },
            { label: 'Logged By', format: (t) => t.created_by?.name || 'System' },
            { label: 'Remarks', format: (t) => t.remarks || '—' },
          ],
          data: exportData,
        });
        toast.success(`Exported ${exportData.length} filtered godown transaction records.`);
      } else if (activeTab === 'worker_transactions') {
        let exportData = transactions;
        try {
          const res = await stockService.getTransactions({
            per_page: 2000,
            category: 'worker',
            godown_id: godownFilter || undefined,
            product_id: productFilter || undefined,
          });
          if (res?.data?.items && res.data.items.length > 0) {
            exportData = res.data.items;
          }
        } catch (e) {
          console.warn('Fallback to current page worker transactions for CSV:', e);
        }

        if (!exportData || exportData.length === 0) {
          toast.warning('No worker transactions found to export with currently applied filters.');
          return;
        }

        exportToCSV({
          filename: `Worker_Transactions_${new Date().toISOString().slice(0, 10)}.csv`,
          columns: [
            { label: 'Transfer ID', format: (t) => String(t.reference_number || t.id).replace(/^#+/, '') },
            { label: 'Date', format: (t) => (t.created_at ? new Date(t.created_at).toLocaleDateString() : '—') },
            { label: 'Movement Type', key: 'type' },
            { label: 'Worker', format: (t) => t.worker?.name || 'Worker' },
            { label: 'Client / Project', format: (t) => t.client?.name || 'Project' },
            { label: 'Product', format: (t) => t.product?.name || 'Product' },
            { label: 'Quantity', key: 'quantity' },
            { label: 'Warehouse / Logged By', format: (t) => t.godown?.name || t.created_by?.name || 'Staff' },
          ],
          data: exportData,
        });
        toast.success(`Exported ${exportData.length} filtered worker transaction records.`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to export CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Procurement & Ledger"
        description="Inspect stock requests requiring approval, view available godown stocks, and track godown or worker transactions."
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
          <Button onClick={handleOpenEntryModal} className="bg-blue-600 hover:bg-blue-700 text-white">
            + New Stock Entry Request
          </Button>
        </div>
      </PageHeader>

      {/* Clean Tabs without numbers */}
      <div className="flex border-b border-slate-200 gap-1 bg-white px-2 pt-2 rounded-t-xl border-t border-x">
        <button
          onClick={() => setActiveTab('entries')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'entries'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Stock List Approval
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'stock'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Available Stock
        </button>
        <button
          onClick={() => setActiveTab('godown_transactions')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'godown_transactions'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Warehouse className="w-4 h-4" />
          Godown Transaction
        </button>
        <button
          onClick={() => setActiveTab('worker_transactions')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'worker_transactions'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Worker Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={godownFilter}
          onChange={(e) => setGodownFilter(e.target.value)}
          placeholder="All Godowns"
          options={godownOptions.map((g) => ({ value: g.id, label: `${g.name} (${g.type})` }))}
        />
        <Select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          placeholder="All Products"
          options={productOptions.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
        />
        {activeTab === 'entries' && (
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Statuses"
            options={[
              { value: 'PENDING', label: 'PENDING' },
              { value: 'APPROVED', label: 'APPROVED' },
              { value: 'REJECTED', label: 'REJECTED' },
            ]}
          />
        )}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={() => fetchData(pagination.current_page)} />
          </div>
        ) : activeTab === 'entries' ? (
          /* TAB 1: STOCK LIST APPROVAL */
          /* Rule: Serial Number / ID -> Date -> Other Information */
          entries.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No stock entry requests requiring approval"
                description="All submitted procurement stock entries have been processed."
                actionLabel="+ Create Stock Entry Request"
                onAction={handleOpenEntryModal}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Entry ID</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-5 py-3.5">Godown</th>
                    <th className="px-5 py-3.5">Location</th>
                    <th className="px-5 py-3.5 text-right">Quantity</th>
                    <th className="px-5 py-3.5">Requester</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Approver</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => {
                    const cleanEntryId = String(entry.entry_number || entry.id).replace(/^#+/, '');
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-900">
                          {cleanEntryId}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                          {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900">{entry.product?.name}</td>
                        <td className="px-5 py-3.5 text-slate-800">{entry.godown?.name}</td>
                        <td className="px-5 py-3.5 text-slate-500">{entry.internal_location || '—'}</td>
                        <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                          {entry.quantity} {entry.product?.unit}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{entry.requester?.name || 'Staff'}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={entry.status}>
                            {entry.status}
                          </Badge>
                          {entry.status === 'REJECTED' && entry.rejection_reason && (
                            <div className="text-[11px] text-rose-600 mt-1 italic">
                              Reason: {entry.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {entry.approver?.name || entry.approver_name ? (
                            <div>
                              <span className="font-semibold text-slate-800">
                                {entry.approver?.name || entry.approver_name}
                              </span>
                              <span className="block text-[11px] text-blue-600 font-mono">
                                ID: {entry.approver?.id || entry.approver_id}
                              </span>
                            </div>
                          ) : entry.status === 'PENDING' ? (
                            <span className="text-amber-600 font-medium">Pending Review</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {entry.status === 'PENDING' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="success"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
                                onClick={() => handleOpenApproveModal(entry)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                                onClick={() => handleOpenRejectModal(entry)}
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'stock' ? (
          /* TAB 2: AVAILABLE STOCK */
          stockItems.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No approved stock found"
                description="No stock entries have been approved yet for this selection."
                actionLabel="+ Create Stock Entry Request"
                onAction={handleOpenEntryModal}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-5 py-3.5">Code</th>
                    <th className="px-5 py-3.5">Godown</th>
                    <th className="px-5 py-3.5">Godown Type</th>
                    <th className="px-5 py-3.5 text-right">Available Stock</th>
                    <th className="px-5 py-3.5 text-right">Last Movement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-900">{item.product?.name}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-blue-600">{item.product?.code}</td>
                      <td className="px-5 py-3.5 text-slate-800">{item.godown?.name}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={item.godown?.type === 'PRIMARY' ? 'primary' : 'retail'}>
                          {item.godown?.type}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-bold text-sm text-emerald-700">
                          {Number(item.quantity).toLocaleString()}
                        </span>{' '}
                        <span className="text-slate-500">{item.product?.unit}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-500">
                        {item.updated_at ? new Date(item.updated_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === 'godown_transactions' ? (
          /* TAB 3: GODOWN TRANSACTION */
          /* Rule: Transfer -> Date -> Other Information; No '#' symbol */
          transactions.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No godown transactions recorded" description="No godown ledger movements have taken place yet." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Transfer</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Movement Type</th>
                    <th className="px-5 py-3.5">Transfer Route</th>
                    <th className="px-5 py-3.5">Godown Type Flow</th>
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-5 py-3.5 text-right">Movement Qty</th>
                    <th className="px-5 py-3.5 text-right">Balance Before &rarr; After</th>
                    <th className="px-5 py-3.5">Logged By</th>
                    <th className="px-5 py-3.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const cleanRef = String(tx.reference_number || tx.id).replace(/^#+/, '');
                    const isEntry = tx.type === 'STOCK_ENTRY';
                    const isIn = tx.type === 'TRANSFER_IN' || isEntry;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-900">
                          {cleanRef}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isEntry
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tx.type === 'TRANSFER_IN'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {isIn ? (
                              <ArrowDownLeft className="w-3 h-3" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" />
                            )}
                            {isEntry ? 'STOCK ENTRY' : tx.type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {isEntry ? (
                            <div className="flex items-center gap-1.5 font-medium text-slate-800">
                              <span className="text-slate-400">Direct Inward &rarr;</span>
                              <span className="font-semibold text-slate-900">{tx.godown?.name || 'Central Godown'}</span>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                <span className="text-slate-900">{tx.source_godown?.name || tx.godown?.name || 'G1'}</span>
                                <span className="text-slate-400">&rarr;</span>
                                <span className="text-slate-900">{tx.destination_godown?.name || 'G2'}</span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Recorded at: <span className="font-medium text-slate-700">{tx.godown?.name}</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {isEntry ? (
                            <Badge variant={tx.godown?.type === 'PRIMARY' ? 'primary' : 'retail'} size="sm">
                              {tx.godown?.type || 'PRIMARY'} Godown
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Badge variant={tx.source_godown?.type === 'PRIMARY' ? 'primary' : 'retail'} size="sm">
                                {tx.source_godown?.type || 'PRIMARY'}
                              </Badge>
                              <span className="text-slate-400 text-xs font-bold">&rarr;</span>
                              <Badge variant={tx.destination_godown?.type === 'PRIMARY' ? 'primary' : 'retail'} size="sm">
                                {tx.destination_godown?.type || 'RETAIL'}
                              </Badge>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-900">{tx.product?.name}</div>
                          <div className="font-mono text-[10px] text-blue-600">{tx.product?.code}</div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold whitespace-nowrap">
                          <span className={tx.type === 'TRANSFER_OUT' ? 'text-amber-700' : 'text-emerald-700'}>
                            {tx.type === 'TRANSFER_OUT' ? `-${tx.quantity}` : `+${tx.quantity}`} {tx.product?.unit || 'units'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                          {tx.balance_before} &rarr; <span className="font-semibold text-slate-900">{tx.balance_after}</span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                          {tx.created_by?.name || 'System Admin'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate text-[11px]">
                          {tx.remarks || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* TAB 4: WORKER TRANSACTION */
          /* Rule: Transfer -> Date -> Other Information; No '#' symbol */
          transactions.length === 0 ? (
            <div className="p-6">
              <EmptyState 
                title="No worker transactions recorded" 
                description="No stock movements (issued to workers, returned, or consumed) have been logged yet." 
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Transfer</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Movement Type</th>
                    <th className="px-5 py-3.5">Worker</th>
                    <th className="px-5 py-3.5">Client & Work Details</th>
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-5 py-3.5 text-right">Quantity</th>
                    <th className="px-5 py-3.5">Warehouse / Logged By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const cleanRef = String(tx.reference_number || tx.id).replace(/^#+/, '');
                    const isIssued = tx.type === 'GODOWN_TO_WORKER';
                    const isUsed = tx.type === 'WORKER_USAGE';
                    const isReturned = tx.type === 'WORKER_TO_GODOWN';

                    const workerName = tx.worker?.name || (tx.remarks?.match(/by\s+([^:]+):/)?.[1]) || 'Assigned Worker';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-900">
                          {cleanRef}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                          {tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isIssued
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : isUsed
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {isIssued && <ArrowDownLeft className="w-3 h-3" />}
                            {isUsed && <Hammer className="w-3 h-3" />}
                            {isReturned && <ArrowUpRight className="w-3 h-3" />}
                            {isIssued ? 'Stock Issued' : isUsed ? 'Stock Used' : isReturned ? 'Stock Returned' : tx.type}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{workerName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 max-w-xs">
                          {tx.client ? (
                            <div>
                              <div className="font-bold text-slate-800 flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-blue-600" />
                                <span>{tx.client.name}</span>
                              </div>
                              {tx.work_title && (
                                <div className="text-[11px] text-slate-600 font-medium">
                                  {tx.work_title}
                                </div>
                              )}
                              {tx.work_location && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                                  <MapPin className="w-2.5 h-2.5 text-rose-500" />
                                  <span>{tx.work_location}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Direct / Internal Work</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-900">{tx.product?.name}</td>
                        <td className="px-5 py-3.5 text-right font-bold">
                          <span className={isUsed ? 'text-amber-700' : isIssued ? 'text-blue-700' : 'text-purple-700'}>
                            {isIssued ? `+${tx.quantity}` : `-${tx.quantity}`}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <div className="font-medium text-slate-800">{tx.godown?.name || 'Retail Godown'}</div>
                          <div className="text-[11px] text-slate-400">By: {tx.created_by?.name || 'Authorized'}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="p-4 border-t border-slate-200">
            <Pagination
              currentPage={pagination.current_page}
              totalPages={pagination.last_page}
              totalItems={pagination.total}
              onPageChange={(page) => fetchData(page)}
            />
          </div>
        )}
      </div>

      {/* Stock Entry Request Modal */}
      <Modal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        title="Create Stock Entry Request"
      >
        <form onSubmit={handleSubmitEntry} className="space-y-4">
          <Select
            label="Target Godown *"
            value={entryFormData.godown_id}
            onChange={(e) => setEntryFormData({ ...entryFormData, godown_id: e.target.value })}
            options={godownOptions.map((g) => ({
              value: g.id,
              label: `${g.name} (${g.type} Godown)`,
            }))}
            required
          />

          <Select
            label="Product SKU *"
            value={entryFormData.product_id}
            onChange={(e) => setEntryFormData({ ...entryFormData, product_id: e.target.value })}
            options={productOptions.map((p) => ({
              value: p.id,
              label: `${p.name} [${p.code}] - (${p.unit})`,
            }))}
            required
          />

          <Input
            label="Received Quantity *"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 50"
            value={entryFormData.quantity}
            onChange={(e) => setEntryFormData({ ...entryFormData, quantity: e.target.value })}
            required
          />

          <Input
            label="Internal Shelf / Bay Location"
            placeholder="e.g. Aisle 3, Rack B"
            value={entryFormData.internal_location}
            onChange={(e) => setEntryFormData({ ...entryFormData, internal_location: e.target.value })}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Procurement Notes / Batch Details
            </label>
            <textarea
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              rows={2}
              placeholder="e.g. Received from Supplier PO #4092, batch quality verified."
              value={entryFormData.remarks}
              onChange={(e) => setEntryFormData({ ...entryFormData, remarks: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEntryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submittingEntry}>
              Submit for Approval
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Approve Modal */}
      <Modal
        isOpen={isApproveModalOpen}
        onClose={() => {
          setIsApproveModalOpen(false);
          setSelectedEntryToApprove(null);
        }}
        title="Approve Stock Entry Request"
      >
        {selectedEntryToApprove && (
          <form onSubmit={handleConfirmApprove} className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm mb-2">
                <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                <span>Verify Stock Procurement Entry</span>
              </div>
              <div className="flex justify-between py-1 border-b border-emerald-100">
                <span className="text-emerald-800">Entry Reference:</span>
                <span className="font-mono font-bold text-emerald-950">
                  {String(selectedEntryToApprove.entry_number || selectedEntryToApprove.id).replace(/^#+/, '')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-emerald-100">
                <span className="text-emerald-800">Product:</span>
                <span className="font-semibold text-emerald-950">{selectedEntryToApprove.product?.name} ({selectedEntryToApprove.product?.code})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-emerald-100">
                <span className="text-emerald-800">Quantity to Add:</span>
                <span className="font-bold text-emerald-700 text-sm">
                  +{selectedEntryToApprove.quantity} {selectedEntryToApprove.product?.unit}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-emerald-100">
                <span className="text-emerald-800">Target Godown:</span>
                <span className="font-semibold text-emerald-950">
                  {selectedEntryToApprove.godown?.name} ({selectedEntryToApprove.godown?.type || 'PRIMARY'})
                </span>
              </div>
              {selectedEntryToApprove.internal_location && (
                <div className="flex justify-between py-1">
                  <span className="text-emerald-800">Internal Bay / Rack:</span>
                  <span className="font-medium text-emerald-950">{selectedEntryToApprove.internal_location}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Approval Remarks / Inspection Note (Optional)
              </label>
              <textarea
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                rows={2}
                placeholder="e.g. Physical inventory counted and matches invoice."
                value={approveRemarks}
                onChange={(e) => setApproveRemarks(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsApproveModalOpen(false);
                  setSelectedEntryToApprove(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="success" 
                loading={approvingEntry}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Confirm Approval & Update Ledger
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false);
          setSelectedEntryToReject(null);
        }}
        title="Reject Stock Entry Request"
      >
        {selectedEntryToReject && (
          <form onSubmit={handleConfirmReject} className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs space-y-2 text-rose-900">
              <p className="font-semibold">Rejection Confirmation</p>
              <p className="text-rose-800 text-[11px]">
                Rejecting Entry <span className="font-mono font-bold">{String(selectedEntryToReject.entry_number || selectedEntryToReject.id).replace(/^#+/, '')}</span> ({selectedEntryToReject.quantity} {selectedEntryToReject.product?.unit} of {selectedEntryToReject.product?.name}).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
                rows={3}
                placeholder="Explain why this request is being rejected (e.g. quantity discrepancy, damaged goods, wrong godown)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setSelectedEntryToReject(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="danger" 
                loading={rejectingEntry}
              >
                Reject Request
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import stockService from '../../services/stockService';
import openingStockService from '../../services/openingStockService';
import godownService from '../../services/godownService';
import productService from '../../services/productService';
import { extractErrorMessage } from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import SearchableProductSelect from '../../components/common/SearchableProductSelect';
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
  Download,
  History,
  Trash2,
  PackageCheck,
  BarChart3,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Eye,
  EyeOff,
  Image as ImageIcon,
  ExternalLink,
  Search,
} from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';

export default function StockOverview() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();

  // Tab 1: entries ('Stock List Approval')
  // Tab 2: stock ('Available Stock')
  // Tab 3: godown_transactions ('Godown Transaction')
  // Tab 4: worker_transactions ('Worker Transaction')
  // Tab 5: closing_stock ('Closing Stock') - NEW
  const [activeTab, setActiveTab] = useState('entries');

  // General Data states
  const [stockItems, setStockItems] = useState([]);
  const [entries, setEntries] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });
  const [perPage, setPerPage] = useState(10);

  // Filter dropdown options
  const [godownOptions, setGodownOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);

  // Selected filters for standard tabs
  const [godownFilter, setGodownFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // ==========================================
  // CLOSING STOCK STATE
  // ==========================================
  const [closingPeriod, setClosingPeriod] = useState('today'); // 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom'
  const [closingStartDate, setClosingStartDate] = useState('');
  const [closingEndDate, setClosingEndDate] = useState('');
  const [closingGodownFilter, setClosingGodownFilter] = useState('');
  const [closingSearch, setClosingSearch] = useState('');
  const debouncedClosingSearch = useDebounce(closingSearch, 300);
  const [closingPerPage, setClosingPerPage] = useState(10);
  const [closingPage, setClosingPage] = useState(1);
  const [closingSortBy, setClosingSortBy] = useState('product_name');
  const [closingSortOrder, setClosingSortOrder] = useState('asc');

  const [closingData, setClosingData] = useState({
    label: "Today's Closing Stock",
    period_info: {},
    summary: {
      total_opening_stock: 0,
      total_inbound_stock: 0,
      total_outbound_stock: 0,
      total_closing_stock: 0,
      total_products: 0,
      zero_stock_products: 0,
      low_stock_products: 0,
    },
    items: [],
    pagination: { current_page: 1, last_page: 1, total: 0, per_page: 10 },
  });
  const [closingLoading, setClosingLoading] = useState(false);
  const [closingError, setClosingError] = useState('');

  // Closing Stock Detailed Ledger Modal State
  const [closingLedgerModalOpen, setClosingLedgerModalOpen] = useState(false);
  const [selectedClosingProduct, setSelectedClosingProduct] = useState(null);
  const [closingLedgerData, setClosingLedgerData] = useState(null);
  const [closingLedgerLoading, setClosingLedgerLoading] = useState(false);

  // Quick Approve Modal for pending entries
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedEntryToApprove, setSelectedEntryToApprove] = useState(null);
  const [approvingEntry, setApprovingEntry] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState('');

  // Reject Modal for pending entries
  // Image Upload & View states for Stock Procurement
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isViewImageModalOpen, setIsViewImageModalOpen] = useState(false);
  const [viewingImageEntry, setViewingImageEntry] = useState(null);

  const [closingCategoryFilter, setClosingCategoryFilter] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedEntryToReject, setSelectedEntryToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingEntry, setRejectingEntry] = useState(false);

  // Stock Entry Request Modal
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryProductSearch, setEntryProductSearch] = useState('');
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [entryFormData, setEntryFormData] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    godown_id: '',
    product_id: '',
    quantity: '',
    internal_location: '',
    remarks: '',
  });

  const [deletingEntryId, setDeletingEntryId] = useState(null);

  // Centralized Product Stock Ledger & Calculation Modal (Available Stock Tab)
  const [selectedProductForLedger, setSelectedProductForLedger] = useState(null);
  const [productLedgerModalOpen, setProductLedgerModalOpen] = useState(false);
  const [productLedgerData, setProductLedgerData] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const categoryOptions = useMemo(() => {
    const set = new Set();
    (productOptions || []).forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [productOptions]);

  const optionsLoadedRef = useRef(false);

  // Load dropdown options once
  useEffect(() => {
    if (optionsLoadedRef.current) return;
    async function loadOptions() {
      try {
        const [gRes, pRes] = await Promise.all([
          godownService.getGodowns({ per_page: 100 }),
          productService.getProducts({ per_page: 500 }),
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

  // Fetch Data for Standard Tabs
  const fetchData = useCallback(async (page = 1, currentPerPage = perPage) => {
    if (activeTab === 'closing_stock') return; // Handled separately
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'stock') {
        const res = await stockService.getStock({
          page,
          per_page: currentPerPage,
          godown_id: godownFilter || undefined,
          product_id: productFilter || undefined,
          search: debouncedSearch || undefined,
        });
        setStockItems(res.data?.items || []);
        setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: currentPerPage });
      } else if (activeTab === 'entries') {
        const res = await stockService.getStockEntries({
          page,
          per_page: currentPerPage,
          godown_id: godownFilter || undefined,
          product_id: productFilter || undefined,
          status: statusFilter || undefined,
          search: debouncedSearch || undefined,
        });
        setEntries(res.data?.items || []);
        setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: currentPerPage });
      } else if (activeTab === 'godown_transactions') {
        const res = await stockService.getTransactions({
          page,
          per_page: currentPerPage,
          category: 'godown',
          godown_id: godownFilter || undefined,
          product_id: productFilter || undefined,
        });
        setTransactions(res.data?.items || []);
        setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: currentPerPage });
      } else if (activeTab === 'worker_transactions') {
        const res = await stockService.getTransactions({
          page,
          per_page: currentPerPage,
          category: 'worker',
          godown_id: godownFilter || undefined,
          product_id: productFilter || undefined,
        });
        setTransactions(res.data?.items || []);
        setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: currentPerPage });
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch inventory data.'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, godownFilter, productFilter, statusFilter, debouncedSearch, perPage]);

  // Fetch Closing Stock Data
  const fetchClosingStock = useCallback(async (page = closingPage, currentPerPage = closingPerPage) => {
    setClosingLoading(true);
    setClosingError('');
    try {
      const params = {
        period: closingPeriod,
        page,
        per_page: currentPerPage,
        godown_id: closingGodownFilter || undefined,
        category: closingCategoryFilter || undefined,
        search: debouncedClosingSearch || undefined,
        sort_by: closingSortBy,
        sort_order: closingSortOrder,
      };
      if (closingPeriod === 'custom') {
        if (closingStartDate) params.start_date = closingStartDate;
        if (closingEndDate) params.end_date = closingEndDate;
      }
      const res = await stockService.getClosingStock(params);
      if (res.data) {
        setClosingData(res.data);
      }
    } catch (err) {
      setClosingError(extractErrorMessage(err, 'Failed to fetch closing stock report.'));
    } finally {
      setClosingLoading(false);
    }
  }, [
    closingPeriod,
    closingStartDate,
    closingEndDate,
    closingGodownFilter,
    debouncedClosingSearch,
    closingSortBy,
    closingSortOrder,
    closingPage,
    closingPerPage,
  ]);

  // Trigger data load on tab change or filters change
  useEffect(() => {
    if (activeTab === 'closing_stock') {
      fetchClosingStock(1, closingPerPage);
    } else {
      fetchData(1, perPage);
    }
  }, [activeTab, fetchData, fetchClosingStock]);

  // Open Product Ledger Modal for Closing Stock Tab
  const handleOpenClosingProductLedger = async (product) => {
    setSelectedClosingProduct(product);
    setClosingLedgerModalOpen(true);
    setClosingLedgerLoading(true);
    try {
      const params = {
        period: closingPeriod,
        godown_id: closingGodownFilter || undefined,
      };
      if (closingPeriod === 'custom') {
        if (closingStartDate) params.start_date = closingStartDate;
        if (closingEndDate) params.end_date = closingEndDate;
      }
      const res = await stockService.getClosingStockProductLedger(product.product_id || product.id, params);
      setClosingLedgerData(res.data || null);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to load detailed product ledger.'));
    } finally {
      setClosingLedgerLoading(false);
    }
  };

  const handleOpenProductLedger = async (product, godown = null) => {
    setSelectedProductForLedger({ product, godown });
    setProductLedgerModalOpen(true);
    setLedgerLoading(true);
    try {
      const res = await openingStockService.getProductLedger(product.id, godown?.id || null);
      setProductLedgerData(res.data || null);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to calculate product stock ledger.'));
    } finally {
      setLedgerLoading(false);
    }
  };

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
      const cleanEntryNum = String(selectedEntryToApprove.entry_number || selectedEntryToApprove.id).replace(/^#+/, '');
      toast.success(`Stock Entry ${cleanEntryNum} approved by ${user?.name || 'Staff'} (ID: ${user?.id}). Stock ledger updated.`);
      setIsApproveModalOpen(false);
      setSelectedEntryToApprove(null);
      setApproveRemarks('');
      fetchData(pagination.current_page, perPage);
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
      fetchData(pagination.current_page, perPage);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to reject stock entry.'));
    } finally {
      setRejectingEntry(false);
    }
  };

  const handleDeleteStockEntry = async (entry) => {
    const cleanEntryNum = String(entry.entry_number || entry.id).replace(/^#+/, '');
    if (!window.confirm(`Are you sure you want to delete Stock Procurement Entry ${cleanEntryNum}? This action cannot be undone.`)) {
      return;
    }

    setDeletingEntryId(entry.id);
    try {
      await stockService.deleteStockEntry(entry.id);
      toast.success(`Stock Entry ${cleanEntryNum} deleted successfully.`);
      fetchData(pagination.current_page || 1, perPage);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete stock entry.'));
    } finally {
      setDeletingEntryId(null);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      toast.error('Invalid image format. Supported formats: JPG, JPEG, PNG, WEBP.');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size exceeds 5MB limit. Please upload a smaller image.');
      e.target.value = '';
      return;
    }

    setSelectedImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

    const filteredEntryProducts = useMemo(() => {
    if (!entryProductSearch.trim()) return productOptions;
    const term = entryProductSearch.toLowerCase().trim();
    return productOptions.filter(
      (p) =>
        (p.code && p.code.toLowerCase().includes(term)) ||
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term))
    );
  }, [productOptions, entryProductSearch]);

  const handleOpenEntryModal = () => {
    setEntryFormData({
      entry_date: new Date().toISOString().split('T')[0],
      godown_id: godownOptions[0]?.id || '',
      product_id: productOptions[0]?.id || '',
      quantity: '',
      internal_location: '',
      remarks: '',
    });
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setEntryProductSearch('');
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
      const formData = new FormData();
      if (entryFormData.entry_date) {
        formData.append('entry_date', entryFormData.entry_date);
      }
      formData.append('godown_id', entryFormData.godown_id);
      formData.append('product_id', entryFormData.product_id);
      formData.append('quantity', entryFormData.quantity);
      if (entryFormData.internal_location) {
        formData.append('internal_location', entryFormData.internal_location.trim());
      }
      if (entryFormData.remarks) {
        formData.append('remarks', entryFormData.remarks.trim());
      }
      if (selectedImageFile) {
        formData.append('image', selectedImageFile);
      }

      await stockService.createStockEntry(formData);

      toast.success('Stock entry submitted and awaiting supervisor approval.');
      setIsEntryModalOpen(false);
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      setActiveTab('entries');
      fetchData(1, perPage);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to submit stock entry.'));
    } finally {
      setSubmittingEntry(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      if (activeTab === 'closing_stock') {
        let exportData = closingData.items || [];
        try {
          const params = {
            period: closingPeriod,
            per_page: 2000,
            godown_id: closingGodownFilter || undefined,
            category: closingCategoryFilter || undefined,
            search: debouncedClosingSearch || undefined,
            sort_by: closingSortBy,
            sort_order: closingSortOrder,
          };
          if (closingPeriod === 'custom') {
            if (closingStartDate) params.start_date = closingStartDate;
            if (closingEndDate) params.end_date = closingEndDate;
          }
          const res = await stockService.getClosingStock(params);
          if (res?.data?.items && res.data.items.length > 0) {
            exportData = res.data.items;
          }
        } catch (e) {
          console.warn('Fallback to current page for Closing Stock CSV:', e);
        }

        if (!exportData || exportData.length === 0) {
          toast.warning('No closing stock records found to export.');
          return;
        }

        exportToCSV({
          filename: `Closing_Stock_${closingPeriod}_${new Date().toISOString().slice(0, 10)}.csv`,
          columns: [
            { label: 'Product SKU', key: 'product_code' },
            { label: 'Product Name', key: 'product_name' },
            { label: 'Category', key: 'category' },
            { label: 'Unit', key: 'unit' },
            { label: 'Opening Stock', key: 'opening_qty' },
            { label: 'Total Stock In', key: 'inbound_qty' },
            { label: 'Total Stock Out', key: 'outbound_qty' },
            { label: 'Adjustments', key: 'adjustments_qty' },
            { label: 'Closing Stock', key: 'closing_qty' },
            { label: 'Last Transaction Date', key: 'last_transaction_formatted' },
            { label: 'Reporting Date', format: () => closingData.label || 'Today' },
            { 
              label: 'Stock Status', 
              format: (item) => {
                if (item.closing_qty <= 0) return 'OUT OF STOCK';
                if (item.closing_qty <= item.min_stock_alert) return 'LOW STOCK';
                return 'IN STOCK';
              }
            },
          ],
          data: exportData,
        });
        toast.success(`Exported ${exportData.length} closing stock records for ${closingData.label || closingPeriod}.`);
      } else if (activeTab === 'entries') {
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
            { label: 'Date', format: (e) => e.entry_date_formatted || (e.entry_date ? new Date(e.entry_date).toLocaleDateString() : (e.created_at ? new Date(e.created_at).toLocaleDateString() : '—')) },
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
        description="Inspect stock requests requiring approval, view available godown stocks, track transaction ledgers, and analyze closing stock balances."
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

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 gap-1 bg-white px-2 pt-2 rounded-t-xl border-t border-x overflow-x-auto">
        <button
          onClick={() => setActiveTab('entries')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
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
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'worker_transactions'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Worker Transaction
        </button>
        <button
          onClick={() => setActiveTab('closing_stock')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'closing_stock'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <PackageCheck className="w-4 h-4 text-blue-600" />
          <span>Closing Stock</span>
          <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.2 rounded font-semibold">New</span>
        </button>
      </div>

      {/* Filters for Standard Tabs (1-4) */}
      {activeTab !== 'closing_stock' && (
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
          <SearchableProductSelect
            products={productOptions}
            value={productFilter}
            onChange={(selectedId) => setProductFilter(selectedId)}
            placeholder="All Products (Search SKU / Name)"
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
      )}

      {/* ===================================================================== */}
      {/* TAB 5: CLOSING STOCK MODULE                                           */}
      {/* ===================================================================== */}
      {activeTab === 'closing_stock' && (
        <div className="space-y-5">
          {/* Period Filter Header & Controls */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {closingData.label || "Closing Stock Summary"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Accurate balance calculated strictly from inventory movements: Closing = Opening + Inbound - Outbound
                  </p>
                </div>
              </div>

              {/* Date Filter Quick Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[
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
                      setClosingPeriod(p.id);
                      setClosingPage(1);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      closingPeriod === p.id
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range & Filter Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
              <Input
                placeholder="Search SKU or name..."
                value={closingSearch}
                onChange={(e) => {
                  setClosingSearch(e.target.value);
                  setClosingPage(1);
                }}
              />
              <Select
                value={closingCategoryFilter}
                onChange={(e) => {
                  setClosingCategoryFilter(e.target.value);
                  setClosingPage(1);
                }}
                placeholder="All Categories"
                options={[
                  { value: '', label: 'All Categories' },
                  ...categoryOptions.map(c => ({ value: c, label: c }))
                ]}
              />
              <Select
                value={closingGodownFilter}
                onChange={(e) => {
                  setClosingGodownFilter(e.target.value);
                  setClosingPage(1);
                }}
                placeholder="All Warehouses (Consolidated)"
                options={godownOptions.map((g) => ({ value: g.id, label: `${g.name} (${g.type})` }))}
              />
              {closingPeriod === 'custom' ? (
                <>
                  <Input
                    type="date"
                    label="Start Date"
                    value={closingStartDate}
                    onChange={(e) => setClosingStartDate(e.target.value)}
                  />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        type="date"
                        label="End Date"
                        value={closingEndDate}
                        onChange={(e) => setClosingEndDate(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => fetchClosingStock(1, closingPerPage)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
                    >
                      Apply
                    </Button>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2 flex items-center justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fetchClosingStock(closingPage, closingPerPage)}
                    loading={closingLoading}
                    className="text-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Refresh Calculation
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* 7 KPI Dashboard Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {/* 1. Total Opening Stock */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-purple-700 text-xs font-bold">
                <span>Total Opening</span>
                <Boxes className="w-4 h-4 text-purple-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-black text-purple-950 font-mono">
                  {Number(closingData.summary?.total_opening_stock || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-purple-600 font-medium">Prior to period</div>
              </div>
            </div>

            {/* 2. Total Inbound Stock */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-emerald-700 text-xs font-bold">
                <span>Total Inbound</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-black text-emerald-950 font-mono">
                  +{Number(closingData.summary?.total_inbound_stock || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-600 font-medium">Procured / returned</div>
              </div>
            </div>

            {/* 3. Total Outbound Stock */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-amber-800 text-xs font-bold">
                <span>Total Outbound</span>
                <ArrowUpRight className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-black text-amber-950 font-mono">
                  -{Number(closingData.summary?.total_outbound_stock || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-amber-700 font-medium">Issued / consumed</div>
              </div>
            </div>

            {/* 4. Total Closing Stock (Prominent Highlight) */}
            <div className="bg-blue-600 text-white rounded-xl p-3.5 flex flex-col justify-between shadow-sm col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-blue-100 text-xs font-bold">
                <span>Total Closing</span>
                <PackageCheck className="w-4 h-4 text-white" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-black font-mono">
                  {Number(closingData.summary?.total_closing_stock || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-blue-200 font-medium">Net available balance</div>
              </div>
            </div>

            {/* 5. Total Products */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-700 text-xs font-bold">
                <span>Total Items</span>
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-black text-slate-900 font-mono">
                  {closingData.summary?.total_products || 0}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Catalog SKUs</div>
              </div>
            </div>

            {/* 6. Products with Zero Stock */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-700 text-xs font-bold">
                <span>Zero Stock</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-black text-amber-700 font-mono">
                  {closingData.summary?.zero_stock_products || 0}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">Needs reorder</div>
              </div>
            </div>

            {/* 7. Products with Low Stock */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-rose-700 text-xs font-bold">
                <span>Low Stock</span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl font-black text-rose-950 font-mono">
                  {closingData.summary?.low_stock_products || 0}
                </div>
                <div className="text-[10px] text-rose-600 font-medium">Below alert limit</div>
              </div>
            </div>
          </div>

          {/* Product-Wise Daily Closing Stock Summary Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Daily Closing Stock Transactions ({closingData.pagination?.total || 0} Products)
                </h4>
              </div>
              <div className="text-xs text-slate-500">
                Formula: <span className="font-semibold text-slate-800">Closing = Opening + Inbound - Outbound</span>
              </div>
            </div>

            {closingLoading ? (
              <div className="p-12 flex justify-center">
                <Spinner size="lg" className="text-blue-600" />
              </div>
            ) : closingError ? (
              <div className="p-6">
                <ErrorState message={closingError} onRetry={() => fetchClosingStock(closingPage, closingPerPage)} />
              </div>
            ) : !closingData.items || closingData.items.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No products found"
                  description="No products match the selected period or warehouse filter."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3.5">Product SKU</th>
                      <th className="px-4 py-3.5">Product Name</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-3 py-3.5">Unit</th>
                      <th className="px-4 py-3.5 text-right">Opening Stock</th>
                      <th className="px-4 py-3.5 text-right">Total Stock In</th>
                      <th className="px-4 py-3.5 text-right">Total Stock Out</th>
                      <th className="px-4 py-3.5 text-right">Adjustments</th>
                      <th className="px-4 py-3.5 text-right">Closing Stock</th>
                      <th className="px-4 py-3.5">Last Transaction Date</th>
                      <th className="px-3 py-3.5 text-center">Status</th>
                      <th className="px-4 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {closingData.items.map((item) => {
                      const isZero = item.closing_qty <= 0;
                      const isLow = item.closing_qty > 0 && item.closing_qty <= item.min_stock_alert;

                      return (
                        <tr key={item.product_id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3.5 font-mono text-xs font-semibold text-blue-600">
                            {item.product_code}
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-900">
                            {item.product_name}
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 font-medium">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700">
                              {item.category || 'General'}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 text-slate-600 uppercase font-medium">
                            {item.unit}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-medium text-purple-900">
                            {Number(item.opening_qty).toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            {item.inbound_qty > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                +{Number(item.inbound_qty).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            {item.outbound_qty > 0 ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                -{Number(item.outbound_qty).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            {item.adjustments_qty !== 0 ? (
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                                item.adjustments_qty > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {item.adjustments_qty > 0 ? `+${Number(item.adjustments_qty).toLocaleString()}` : Number(item.adjustments_qty).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className={`text-sm font-black font-mono ${
                              isZero ? 'text-slate-400' : isLow ? 'text-rose-700' : 'text-blue-700'
                            }`}>
                              {Number(item.closing_qty).toLocaleString()}
                            </span>{' '}
                            <span className="text-[10px] text-slate-400 uppercase">{item.unit}</span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {item.last_transaction_formatted || '—'}
                          </td>
                          <td className="px-5 py-3.5 text-center whitespace-nowrap">
                            {isZero ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                In Stock
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenClosingProductLedger(item)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md transition cursor-pointer"
                              title="Inspect Detailed Stock Ledger for this Period"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>View Ledger</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Closing Stock Pagination */}
            <Pagination
              currentPage={closingData.pagination?.current_page || 1}
              lastPage={closingData.pagination?.last_page || 1}
              total={closingData.pagination?.total || 0}
              perPage={closingPerPage}
              onPageChange={(page) => {
                setClosingPage(page);
                fetchClosingStock(page, closingPerPage);
              }}
              onPerPageChange={(newPerPage) => {
                setClosingPerPage(newPerPage);
                setClosingPage(1);
                fetchClosingStock(1, newPerPage);
              }}
              perPageOptions={[10, 25, 50, 100, 'All']}
            />
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TABS 1-4: STANDARD MODULES                                            */}
      {/* ===================================================================== */}
      {activeTab !== 'closing_stock' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <Spinner size="lg" className="text-blue-600" />
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState message={error} onRetry={() => fetchData(pagination.current_page, perPage)} />
            </div>
          ) : activeTab === 'entries' ? (
            /* TAB 1: STOCK LIST APPROVAL */
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
                            <div className="font-medium text-slate-900">
                              {entry.entry_date_formatted || (entry.entry_date ? new Date(entry.entry_date).toLocaleDateString() : (entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '—'))}
                            </div>
                            {entry.entry_date && entry.created_at && entry.entry_date !== entry.created_at.slice(0, 10) && (
                              <span className="text-[10px] text-amber-600 font-semibold block">
                                (Backdated)
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-900">{entry.product?.name}</td>
                          <td className="px-5 py-3.5 text-slate-800">{entry.godown?.name}</td>
                          <td className="px-5 py-3.5 text-slate-500">{entry.internal_location || '—'}</td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                            {entry.quantity} {entry.product?.unit}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">{entry.requester?.name || 'Staff'}</td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Badge variant={entry.status}>
                                {entry.status}
                              </Badge>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStockEntry(entry)}
                                  disabled={deletingEntryId === entry.id}
                                  title="Delete Stock Entry"
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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
                                {entry.image_url ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingImageEntry(entry);
                                      setIsViewImageModalOpen(true);
                                    }}
                                    title="View attached image"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled
                                    title="No image available"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-md opacity-60 cursor-not-allowed"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>No Image</span>
                                  </button>
                                )}
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
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStockEntry(entry)}
                                    disabled={deletingEntryId === entry.id}
                                    title="Delete Stock Entry"
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer border border-transparent hover:border-rose-200 disabled:opacity-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                {entry.image_url ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingImageEntry(entry);
                                      setIsViewImageModalOpen(true);
                                    }}
                                    title="View attached image"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled
                                    title="No image available"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-md opacity-60 cursor-not-allowed"
                                  >
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>No Image</span>
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStockEntry(entry)}
                                    disabled={deletingEntryId === entry.id}
                                    title="Delete Stock Entry"
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer border border-transparent hover:border-rose-200 disabled:opacity-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
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
                      <th className="px-5 py-3.5 text-right">Stock Ledger</th>
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
                        <td className="px-5 py-3.5 text-right text-slate-500 whitespace-nowrap">
                          {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenProductLedger(item.product, item.godown)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md transition cursor-pointer"
                            title="Inspect Stock Calculation & Date-Wise History"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Ledger</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === 'godown_transactions' ? (
            /* TAB 3: GODOWN TRANSACTION */
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
                      const isIn = tx.type === 'STOCK_ENTRY' || tx.type === 'TRANSFER_IN' || tx.type === 'OPENING_STOCK';
                      const isOpening = tx.type === 'OPENING_STOCK';
                      const isEntry = tx.type === 'STOCK_ENTRY';

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-900">
                            {cleanRef}
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                            {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isOpening
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : isEntry
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
                              {isOpening ? 'OPENING STOCK' : isEntry ? 'STOCK ENTRY' : tx.type}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {isOpening ? (
                              <div className="flex items-center gap-1.5 font-medium text-purple-900">
                                <span className="text-purple-500 font-semibold">Baseline Opening &rarr;</span>
                                <span className="font-bold text-slate-900">{tx.godown?.name || 'Godown'}</span>
                              </div>
                            ) : isEntry ? (
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

          {/* Standard Tabs Pagination */}
          <Pagination
            currentPage={pagination.current_page}
            lastPage={pagination.last_page}
            total={pagination.total}
            perPage={perPage}
            onPageChange={(page) => fetchData(page, perPage)}
            onPerPageChange={(newPerPage) => {
              setPerPage(newPerPage);
              fetchData(1, newPerPage);
            }}
            perPageOptions={[10, 25, 50, 100, 'All']}
          />
        </div>
      )}

      {/* Stock Entry Request Modal */}
      <Modal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        title="Create Stock Entry Request"
      >
        <form onSubmit={handleSubmitEntry} className="space-y-4">
          <Input
            label="Procurement Date *"
            type="date"
            value={entryFormData.entry_date}
            onChange={(e) => setEntryFormData({ ...entryFormData, entry_date: e.target.value })}
            required
            helperText="Specify the actual date when stock was procured (backdating supported)"
          />

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

          <SearchableProductSelect
            label="Product SKU"
            products={productOptions}
            value={entryFormData.product_id}
            onChange={(selectedId) => setEntryFormData({ ...entryFormData, product_id: selectedId })}
            required
            placeholder="Type 's' or SKU code to filter products dynamically..."
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
                <span className="text-emerald-800">Procurement Date:</span>
                <span className="font-semibold text-emerald-950">
                  {selectedEntryToApprove.entry_date_formatted || (selectedEntryToApprove.entry_date ? new Date(selectedEntryToApprove.entry_date).toLocaleDateString() : (selectedEntryToApprove.created_at ? new Date(selectedEntryToApprove.created_at).toLocaleDateString() : '—'))}
                  {selectedEntryToApprove.entry_date && selectedEntryToApprove.created_at && selectedEntryToApprove.entry_date !== selectedEntryToApprove.created_at.slice(0, 10) && (
                    <span className="ml-1.5 text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded font-medium">Backdated</span>
                  )}
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

      {/* ===================================================================== */}
      {/* CLOSING STOCK DETAILED PRODUCT LEDGER MODAL                           */}
      {/* ===================================================================== */}
      {closingLedgerModalOpen && (
        <Modal
          isOpen={closingLedgerModalOpen}
          onClose={() => setClosingLedgerModalOpen(false)}
          title="Product Closing Stock Ledger & Period Movement Details"
          size="4xl"
        >
          <div className="space-y-5 p-1">
            {/* Header info */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">
                    {closingLedgerData?.product?.name || selectedClosingProduct?.product_name}
                  </h3>
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    {closingLedgerData?.product?.code || selectedClosingProduct?.product_code}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                  <span>Unit: <strong className="text-slate-800 uppercase">{closingLedgerData?.product?.unit || selectedClosingProduct?.unit || 'PCS'}</strong></span>
                  <span>&bull;</span>
                  <span>Period: <strong className="text-blue-700">{closingLedgerData?.period_info?.formatted_label || closingData.label}</strong></span>
                  {closingGodownFilter && (
                    <>
                      <span>&bull;</span>
                      <span>Filtered Godown: <strong>{godownOptions.find(g => String(g.id) === String(closingGodownFilter))?.name || 'Selected'}</strong></span>
                    </>
                  )}
                </div>
              </div>

              {closingLedgerData?.metrics && (
                <div className="text-right">
                  <div className="text-xs text-slate-500">Period Closing Balance</div>
                  <div className="text-2xl font-black text-blue-700 font-mono">
                    {Number(closingLedgerData.metrics.closing_stock || 0).toLocaleString()}{' '}
                    <span className="text-xs font-bold text-slate-500">{closingLedgerData.product?.unit}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 4 Calculation KPI Cards for Modal */}
            {closingLedgerData?.metrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/60">
                  <div className="text-[11px] font-bold uppercase text-purple-700 tracking-wider">Opening Stock</div>
                  <div className="text-lg font-black text-purple-950 font-mono mt-0.5">
                    {Number(closingLedgerData.metrics.opening_stock || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-purple-600">Balance prior to period</div>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                  <div className="text-[11px] font-bold uppercase text-emerald-700 tracking-wider">Inbound Stock (+)</div>
                  <div className="text-lg font-black text-emerald-950 font-mono mt-0.5">
                    +{Number(closingLedgerData.metrics.total_inbound || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-600">Total received in period</div>
                </div>

                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
                  <div className="text-[11px] font-bold uppercase text-rose-700 tracking-wider">Outbound Stock (-)</div>
                  <div className="text-lg font-black text-rose-950 font-mono mt-0.5">
                    -{Number(closingLedgerData.metrics.total_outbound || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-rose-600">Total issued in period</div>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60">
                  <div className="text-[11px] font-bold uppercase text-blue-700 tracking-wider">Closing Stock (=)</div>
                  <div className="text-lg font-black text-blue-950 font-mono mt-0.5">
                    {Number(closingLedgerData.metrics.closing_stock || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-blue-600">Opening + Inbound - Outbound</div>
                </div>
              </div>
            )}

            {/* Detailed Ledger Transactions Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Transaction Movement Ledger During Period
                </h4>
                <div className="text-[11px] text-slate-400">Strict chronological entry audit</div>
              </div>

              {closingLedgerLoading ? (
                <div className="p-8 text-center"><Spinner size="md" /></div>
              ) : !closingLedgerData?.transactions || closingLedgerData.transactions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                  No inventory movements recorded for this product during the selected period.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 border-b border-slate-200 uppercase font-semibold text-slate-600 text-[10px] sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2">Date & Time</th>
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2">Movement Type</th>
                        <th className="px-3 py-2 text-right">Inbound (+)</th>
                        <th className="px-3 py-2 text-right">Outbound (-)</th>
                        <th className="px-3 py-2 text-right">Running Balance</th>
                        <th className="px-3 py-2">Warehouse</th>
                        <th className="px-3 py-2">Logged By & Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {closingLedgerData.transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2 font-mono whitespace-nowrap text-slate-800">
                            {tx.date_formatted}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                            {tx.reference}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              tx.type === 'OPENING_STOCK'
                                ? 'bg-purple-100 text-purple-800'
                                : tx.inbound_qty > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {tx.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700 whitespace-nowrap font-mono">
                            {tx.inbound_qty > 0 ? `+${Number(tx.inbound_qty).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-rose-700 whitespace-nowrap font-mono">
                            {tx.outbound_qty > 0 ? `-${Number(tx.outbound_qty).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-black text-slate-900 whitespace-nowrap font-mono">
                            {Number(tx.running_balance).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                            {tx.godown?.name || 'Central Godown'}
                          </td>
                          <td className="px-3 py-2 text-slate-500 max-w-xs truncate text-[11px]">
                            <span className="font-medium text-slate-700">{tx.created_by}:</span> {tx.remarks}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setClosingLedgerModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Centralized Product Inventory History & Calculation Modal (Available Stock Tab) */}
      {productLedgerModalOpen && (
        <Modal
          isOpen={productLedgerModalOpen}
          onClose={() => setProductLedgerModalOpen(false)}
          title="Product Inventory History & Centralized Stock Ledger"
          size="4xl"
        >
          <div className="space-y-5 p-1">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">
                    {productLedgerData?.product?.name || selectedProductForLedger?.product?.name}
                  </h3>
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    {productLedgerData?.product?.code || selectedProductForLedger?.product?.code}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Unit: <strong className="text-slate-700 uppercase">{productLedgerData?.product?.unit || selectedProductForLedger?.product?.unit || 'PCS'}</strong>
                  {selectedProductForLedger?.godown && (
                    <span> &bull; Filtered Warehouse: <strong>{selectedProductForLedger.godown.name}</strong></span>
                  )}
                </div>
              </div>

              {productLedgerData && (
                <div className="text-right">
                  <div className="text-xs text-slate-500">Closing Balance</div>
                  <div className="text-2xl font-black text-emerald-700 font-mono">
                    {Number(productLedgerData.summary?.actual_closing_stock || 0).toLocaleString()}{' '}
                    <span className="text-xs font-bold text-slate-500">{productLedgerData.product?.unit}</span>
                  </div>
                </div>
              )}
            </div>

            {productLedgerData && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/60">
                  <div className="text-[11px] font-bold uppercase text-purple-700 tracking-wider">A. Opening Stock</div>
                  <div className="text-lg font-black text-purple-900 font-mono mt-0.5">
                    {Number(productLedgerData.summary?.opening_stock || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-purple-600">Baseline setup quantity</div>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
                  <div className="text-[11px] font-bold uppercase text-emerald-700 tracking-wider">B. Total Inbound (+)</div>
                  <div className="text-lg font-black text-emerald-900 font-mono mt-0.5">
                    +{Number(productLedgerData.summary?.total_inbound || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-600">Procurement & returns</div>
                </div>

                <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
                  <div className="text-[11px] font-bold uppercase text-rose-700 tracking-wider">C. Total Outbound (-)</div>
                  <div className="text-lg font-black text-rose-900 font-mono mt-0.5">
                    -{Number(productLedgerData.summary?.total_outbound || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-rose-600">Issued to workers/site</div>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60">
                  <div className="text-[11px] font-bold uppercase text-blue-700 tracking-wider">Closing Stock (=)</div>
                  <div className="text-lg font-black text-blue-900 font-mono mt-0.5">
                    {Number(productLedgerData.summary?.calculated_closing_stock || 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-blue-600">Opening + Inbound - Outbound</div>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Date-Wise Inventory Movement & Running Balance
                </h4>
                <div className="text-[11px] text-slate-400">Chronological transaction record</div>
              </div>

              {ledgerLoading ? (
                <div className="p-8 text-center"><Spinner size="md" /></div>
              ) : !productLedgerData?.ledger || productLedgerData.ledger.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                  No inventory transactions recorded yet for this product.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 border-b border-slate-200 uppercase font-semibold text-slate-600 text-[10px] sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Transaction Type</th>
                        <th className="px-3 py-2 text-right">Inbound (+)</th>
                        <th className="px-3 py-2 text-right">Outbound (-)</th>
                        <th className="px-3 py-2 text-right">Running Balance</th>
                        <th className="px-3 py-2">Godown / Location</th>
                        <th className="px-3 py-2">Logged By & Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productLedgerData.ledger.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-2 font-mono whitespace-nowrap text-slate-800">
                            {row.date_formatted}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              row.category === 'OPENING_STOCK'
                                ? 'bg-purple-100 text-purple-800'
                                : row.category === 'INBOUND'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {row.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-700 whitespace-nowrap font-mono">
                            {row.inbound > 0 ? `+${Number(row.inbound).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-rose-700 whitespace-nowrap font-mono">
                            {row.outbound > 0 ? `-${Number(row.outbound).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-black text-slate-900 whitespace-nowrap font-mono">
                            {Number(row.running_balance).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                            {row.godown?.name || 'Warehouse'}
                          </td>
                          <td className="px-3 py-2 text-slate-500 max-w-xs truncate">
                            {row.remarks || 'Stock movement recorded'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button variant="secondary" onClick={() => setProductLedgerModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Procurement Image Modal */}
      <Modal
        isOpen={isViewImageModalOpen}
        onClose={() => {
          setIsViewImageModalOpen(false);
          setViewingImageEntry(null);
        }}
        title={`Procurement Document: ${viewingImageEntry?.entry_number || ''}`}
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-700 grid grid-cols-2 gap-2">
            <div>
              <span className="font-semibold text-slate-500">Product:</span> {viewingImageEntry?.product?.name || '—'}
            </div>
            <div>
              <span className="font-semibold text-slate-500">Quantity:</span> {viewingImageEntry?.quantity} {viewingImageEntry?.product?.unit || 'PCS'}
            </div>
            <div>
              <span className="font-semibold text-slate-500">Godown:</span> {viewingImageEntry?.godown?.name || '—'}
            </div>
            <div>
              <span className="font-semibold text-slate-500">Requester:</span> {viewingImageEntry?.requester?.name || 'Staff'}
            </div>
          </div>

          <div className="flex justify-center bg-slate-900/5 rounded-xl p-2 border border-slate-200 overflow-hidden min-h-[220px] items-center">
            {viewingImageEntry?.image_url ? (
              <img
                src={viewingImageEntry.image_url}
                alt="Procurement Document"
                className="max-h-[65vh] w-auto object-contain rounded shadow-xs"
              />
            ) : (
              <div className="text-center p-8 text-slate-400">
                <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">No image available</p>
                <p className="text-xs">No receipt or picture was attached to this procurement entry.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            {viewingImageEntry?.image_url ? (
              <a
                href={viewingImageEntry.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Open original in new tab
              </a>
            ) : <span />}
            <Button
              variant="secondary"
              onClick={() => {
                setIsViewImageModalOpen(false);
                setViewingImageEntry(null);
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

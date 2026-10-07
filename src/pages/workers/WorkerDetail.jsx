import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
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
import EmptyState from '../../components/common/EmptyState';
import ErrorState from '../../components/common/ErrorState';
import MaterialIssueSlipModal from '../../components/workerStock/MaterialIssueSlipModal';
import { exportToCSV } from '../../utils/csvExport';
import { formatIndianPhone } from '../../utils/phoneUtils';
import {
  Plus,
  Trash2,
  Package,
  Printer,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  User,
  RotateCcw,
  Hammer,
  Image as ImageIcon,
  FileText,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Building,
  Calendar,
  MapPin,
  Search,
  Filter,
  X,
  Briefcase,
  Download,
} from 'lucide-react';

export default function WorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isSupervisor, isManager } = useAuth();
  const toast = useToast();

  const [worker, setWorker] = useState(null);
  const [currentStock, setCurrentStock] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [lifecycleStats, setLifecycleStats] = useState({
    total_issued: 0,
    total_used: 0,
    total_returned: 0,
    remaining: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [godowns, setGodowns] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);

  // Retail Godowns: Materials can only be issued from or returned to Retail Godowns
  const retailGodowns = useMemo(() => {
    return (godowns || []).filter(
      (g) => (g.type || '').toUpperCase() === 'RETAIL' || (g.type || '').toUpperCase() === 'RELATIVE'
    );
  }, [godowns]);

  // Live Godown Stock Map: { [productId]: availableQty }
  const [godownStockMap, setGodownStockMap] = useState({});
  const [loadingGodownStock, setLoadingGodownStock] = useState(false);

  // 1. Assign Stock Modal (Client -> Work -> Worker -> Materials -> Dates)
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignForm, setAssignForm] = useState({
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

  // 2. Return Stock Modal
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnForm, setReturnForm] = useState({
    product_id: '',
    source_godown_id: '',
    quantity: '',
    remarks: '',
  });

  // 3. Stock Used in Project Modal
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageForm, setUsageForm] = useState({
    client_id: '',
    product_id: '',
    project_name: '',
    location: '',
    quantity: '',
    purpose: '',
  });
  const [usagePhoto, setUsagePhoto] = useState(null);
  const [usagePhotoPreview, setUsagePhotoPreview] = useState(null);

  // 4. Material Issue Slip Modal (Receipt)
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipRequest, setSlipRequest] = useState(null);

  // 5. Stock History Filters
  const [historyFilters, setHistoryFilters] = useState({
    client_id: '',
    movement_type: '',
    product_id: '',
    start_date: '',
    end_date: '',
    search: '',
  });

  // Direct Stock Usage against Current Active Work
  const [directUsageModal, setDirectUsageModal] = useState({
    isOpen: false,
    mat: null,
    quantity: '',
    purpose: '',
  });

  // Fetch all worker data
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [workerRes, stockRes, txRes, reqRes, statsRes] = await Promise.allSettled([
        employeeService.getEmployee(id),
        workerStockService.getWorkerStock(id, { per_page: 200 }),
        workerStockService.getWorkerTransactions(id, { per_page: 200 }),
        workerStockService.getRequests({ worker_id: id, per_page: 100 }),
        workerStockService.getWorkerLifecycleStats(id),
      ]);

      if (workerRes.status === 'fulfilled') {
        setWorker(workerRes.value?.data?.item || workerRes.value?.data || null);
      } else {
        throw new Error('Failed to load worker details.');
      }

      if (stockRes.status === 'fulfilled') {
        const stockData = stockRes.value?.data?.items || stockRes.value?.data || [];
        setCurrentStock(Array.isArray(stockData) ? stockData : []);
      }

      if (txRes.status === 'fulfilled') {
        const txData = txRes.value?.data?.items || txRes.value?.data || [];
        setTransactions(Array.isArray(txData) ? txData : []);
      }

      if (reqRes.status === 'fulfilled') {
        const reqData = reqRes.value?.data?.items || reqRes.value?.data || [];
        const allReqs = Array.isArray(reqData) ? reqData : [];
        setPendingRequests(allReqs.filter((r) => (r.status || '').toUpperCase() === 'PENDING'));
        setApprovedRequests(allReqs.filter((r) => (r.status || '').toUpperCase() === 'APPROVED'));
      }

      if (statsRes.status === 'fulfilled') {
        const statsData = statsRes.value?.data || {};
        setLifecycleStats({
          total_issued: Number(statsData.total_issued) || 0,
          total_used: Number(statsData.total_used) || 0,
          total_returned: Number(statsData.total_returned) || 0,
          remaining: Number(statsData.remaining) || 0,
        });
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load worker details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Load godowns, products & clients options
  useEffect(() => {
    async function loadOptions() {
      try {
        const [gRes, pRes, cRes] = await Promise.all([
          godownService.getGodowns({ per_page: 100 }),
          productService.getProducts({ per_page: 200 }),
          clientService.getClients({ per_page: 200 }),
        ]);
        setGodowns(gRes.data?.items || gRes.data || []);
        setProducts(pRes.data?.items || pRes.data || []);
        setClients(cRes.data?.items || cRes.data || []);
      } catch (err) {
        console.error('Failed to load options:', err);
      }
    }
    loadOptions();
  }, []);

  // Fetch live godown stock whenever source_godown_id changes in Assign modal
  const handleAssignGodownChange = async (godownId) => {
    setAssignForm((prev) => ({ ...prev, source_godown_id: godownId }));
    if (!godownId) {
      setGodownStockMap({});
      return;
    }
    setLoadingGodownStock(true);
    try {
      const res = await stockService.getStock({ godown_id: godownId, per_page: 500 });
      const items = res.data?.items || res.items || [];
      const map = {};
      items.forEach((item) => {
        const pId = item.product_id || item.product?.id;
        if (pId) {
          map[pId] = Number(item.quantity) || 0;
        }
      });
      setGodownStockMap(map);
    } catch (err) {
      console.error('Failed to fetch live godown stock:', err);
      toast.error('Could not fetch live stock for selected godown.');
    } finally {
      setLoadingGodownStock(false);
    }
  };

  // Client Selection Change in Assign Form
  const handleAssignClientChange = (clientId) => {
    const selected = clients.find((c) => String(c.id) === String(clientId));
    setAssignForm((prev) => ({
      ...prev,
      client_id: clientId,
      work_location: selected?.location || prev.work_location || '',
      work_title: selected?.work_details || prev.work_title || '',
    }));
  };

  // Assign items helpers
  function handleAddAssignItem() {
    setAssignForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: '', quantity: '' }],
    }));
  }

  function handleRemoveAssignItem(index) {
    if (assignForm.items.length <= 1) return;
    setAssignForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function handleAssignItemChange(index, field, value) {
    setAssignForm((prev) => {
      const next = [...prev.items];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, items: next };
    });
  }

  function openAssignModal() {
    setAssignForm({
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
    setIsAssignOpen(true);
  }

  // Submit assignment linking Client -> Work -> Worker -> Materials -> Dates
  async function handleAssignSubmit(e) {
    e.preventDefault();

    if (!assignForm.client_id) {
      toast.warning('Please select the Client first before assigning materials.');
      return;
    }
    if (!assignForm.start_date) {
      toast.warning('Please select the Start Date.');
      return;
    }
    if (!assignForm.end_date) {
      toast.warning('Please select the End Date.');
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
    if (!assignForm.work_title.trim()) {
      toast.warning('Please assign the task/work title to the worker.');
      return;
    }
    if (!assignForm.remarks.trim()) {
      toast.warning('Please add the required work description.');
      return;
    }

    // Validation for every material item
    for (let i = 0; i < assignForm.items.length; i++) {
      const it = assignForm.items[i];
      if (!it.product_id) {
        toast.warning(`Please select a product for material row #${i + 1}.`);
        return;
      }
      const qty = Number(it.quantity);
      if (!qty || qty <= 0) {
        toast.warning(`Please enter a valid quantity for material row #${i + 1}.`);
        return;
      }
      const available = godownStockMap[it.product_id] ?? 0;
      if (qty > available) {
        const prod = products.find((p) => String(p.id) === String(it.product_id));
        const pName = prod ? prod.name : `Product #${it.product_id}`;
        toast.error(`Cannot issue ${qty} units of "${pName}". Only ${available} available in selected Retail Godown.`);
        return;
      }
    }

    setAssignLoading(true);
    try {
      const res = await workerStockService.createIssueRequest({
        worker_id: Number(id),
        client_id: Number(assignForm.client_id),
        start_date: assignForm.start_date,
        end_date: assignForm.end_date,
        work_title: assignForm.work_title.trim(),
        work_location: assignForm.work_location.trim(),
        source_godown_id: Number(assignForm.source_godown_id),
        remarks: assignForm.remarks.trim(),
        description: assignForm.remarks.trim(),
        supervisor_signature: assignForm.supervisor_signature || (user?.name ? `${user.name} (Supervisor)` : 'Supervisor'),
        items: assignForm.items.map((it) => ({
          product_id: Number(it.product_id),
          quantity: Number(it.quantity),
        })),
      });

      const reqNumber = res?.data?.request_number || 'Voucher';
      toast.success(
        `Work & material assignment ${reqNumber} submitted successfully! Awaiting Manager approval.`
      );
      setIsAssignOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to submit assignment.'));
    } finally {
      setAssignLoading(false);
    }
  }

  // Return Modal helpers
  function openReturnModal(preselectedProductId = '') {
    setReturnForm({
      product_id: preselectedProductId ? String(preselectedProductId) : '',
      source_godown_id: '',
      quantity: '',
      remarks: '',
    });
    setIsReturnOpen(true);
  }

  const selectedReturnStock = useMemo(() => {
    return currentStock.find((s) => String(s.product_id || s.product?.id) === String(returnForm.product_id));
  }, [currentStock, returnForm.product_id]);

  const maxReturnAvailable = selectedReturnStock ? Number(selectedReturnStock.quantity) || 0 : 0;
  const isReturnExceeding = Number(returnForm.quantity) > maxReturnAvailable;

  // Submit direct stock return to godown
  async function handleReturnSubmit(e) {
    e.preventDefault();

    if (!returnForm.product_id) {
      toast.warning('Please select the material to return.');
      return;
    }
    if (!returnForm.source_godown_id) {
      toast.warning('Please select the destination Retail godown.');
      return;
    }
    const qty = Number(returnForm.quantity);
    if (!qty || qty <= 0) {
      toast.warning('Please enter a valid return quantity.');
      return;
    }
    if (qty > maxReturnAvailable) {
      toast.error(`Cannot return ${qty} units. The employee only holds ${maxReturnAvailable} units!`);
      return;
    }

    setReturnLoading(true);
    try {
      await workerStockService.returnStock({
        worker_id: Number(id),
        product_id: Number(returnForm.product_id),
        source_godown_id: Number(returnForm.source_godown_id),
        quantity: qty,
        remarks: returnForm.remarks.trim() || 'Returned unused stock from employee to godown',
        direct: true,
      });

      toast.success(
        `Successfully returned ${qty} unit(s) of "${selectedReturnStock?.product?.name || 'material'}" to godown! Stock added back to inventory.`
      );
      setIsReturnOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to process stock return.'));
    } finally {
      setReturnLoading(false);
    }
  }

  // Open "Stock Used in Project" Modal
  function openUsageModal(preselectedProductId = '') {
    setUsageForm({
      client_id: '',
      product_id: preselectedProductId ? String(preselectedProductId) : '',
      project_name: '',
      location: '',
      quantity: '',
      purpose: '',
    });
    setUsagePhoto(null);
    setUsagePhotoPreview(null);
    setIsUsageOpen(true);
  }

  const selectedUsageStock = useMemo(() => {
    return currentStock.find((s) => String(s.product_id || s.product?.id) === String(usageForm.product_id));
  }, [currentStock, usageForm.product_id]);

  const maxUsageAvailable = selectedUsageStock ? Number(selectedUsageStock.quantity) || 0 : 0;
  const usageQuantityNum = Number(usageForm.quantity) || 0;
  const remainingAfterUsage = maxUsageAvailable - usageQuantityNum;
  const isUsageExceeding = usageQuantityNum > maxUsageAvailable;

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.warning('Selected image exceeds 10MB limit.');
        return;
      }
      setUsagePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUsagePhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  function removeUsagePhoto() {
    setUsagePhoto(null);
    setUsagePhotoPreview(null);
  }

  // Submit Stock Used in Project
  async function handleUsageSubmit(e) {
    e.preventDefault();

    if (!usageForm.product_id) {
      toast.warning('Please select the stock/material that was used.');
      return;
    }
    if (!usageForm.project_name.trim()) {
      toast.warning('Please enter the project or task name.');
      return;
    }
    if (!usageQuantityNum || usageQuantityNum <= 0) {
      toast.warning('Please enter a valid quantity used.');
      return;
    }
    if (usageQuantityNum > maxUsageAvailable) {
      toast.error(`Quantity used (${usageQuantityNum}) cannot exceed currently held stock (${maxUsageAvailable}).`);
      return;
    }

    setUsageLoading(true);
    try {
      const formData = new FormData();
      formData.append('worker_id', String(id));
      formData.append('product_id', String(usageForm.product_id));
      formData.append('project_name', usageForm.project_name.trim());
      formData.append('quantity', String(usageQuantityNum));
      if (usageForm.client_id) {
        formData.append('client_id', String(usageForm.client_id));
      }
      if (usageForm.location.trim()) {
        formData.append('location', usageForm.location.trim());
      }
      if (usageForm.purpose.trim()) {
        formData.append('purpose', usageForm.purpose.trim());
      }
      if (usagePhoto) {
        formData.append('photo', usagePhoto);
      }

      await workerStockService.recordUsage(formData);

      toast.success(
        `Recorded ${usageQuantityNum} unit(s) of "${selectedUsageStock?.product?.name || 'material'}" used on "${usageForm.project_name}". Remaining: ${remainingAfterUsage} units.`
      );
      setIsUsageOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to record stock usage.'));
    } finally {
      setUsageLoading(false);
    }
  }

  // Automatically determine the worker's current active work assignment from live data
  const activeWorkAssignment = useMemo(() => {
    const approvedIssues = (approvedRequests || []).filter(
      (r) => (r.type || '').toUpperCase() === 'ISSUE' || !r.type
    );
    if (!approvedIssues.length) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Look for active date window or most recent assignment
    const ongoing = approvedIssues.find((r) => {
      if (!r.start_date) return false;
      const s = new Date(r.start_date);
      const e = r.end_date ? new Date(r.end_date) : null;
      if (e) {
        return now >= s && now <= e;
      }
      return now >= s;
    });

    return ongoing || approvedIssues[0];
  }, [approvedRequests]);

  // Assigned materials under the current active work with live calculation
  const activeMaterials = useMemo(() => {
    if (!activeWorkAssignment) return [];

    let items = [];
    if (Array.isArray(activeWorkAssignment.items) && activeWorkAssignment.items.length > 0) {
      items = activeWorkAssignment.items;
    } else if (activeWorkAssignment.product || activeWorkAssignment.product_id) {
      items = [{
        product_id: activeWorkAssignment.product_id,
        product: activeWorkAssignment.product,
        quantity: activeWorkAssignment.quantity,
      }];
    }

    return items.map((it) => {
      const pId = it.product_id || it.product?.id;
      const stockHolding = currentStock.find((s) => String(s.product_id || s.product?.id) === String(pId));

      const issued = Number(it.quantity || stockHolding?.total_issued || 0);
      const used = Number(stockHolding?.total_used || 0);
      const returned = Number(stockHolding?.total_returned || 0);
      const remaining = stockHolding ? Number(stockHolding.quantity) : Math.max(0, issued - used - returned);
      const unit = it.product?.unit || stockHolding?.product?.unit || 'units';

      return {
        product_id: pId,
        product: it.product || stockHolding?.product,
        issued,
        used,
        returned,
        remaining,
        unit,
      };
    });
  }, [activeWorkAssignment, currentStock]);

  const handleOpenDirectUsage = (mat) => {
    setDirectUsageModal({
      isOpen: true,
      mat,
      quantity: '',
      purpose: `Site consumption for ${activeWorkAssignment?.work_title || 'client assignment'}`,
    });
  };

  const handleDirectUsageSubmit = async (e) => {
    e.preventDefault();
    if (!directUsageModal.mat) return;
    const qty = Number(directUsageModal.quantity);
    if (!qty || qty <= 0) {
      toast.warning('Please enter a valid quantity consumed.');
      return;
    }
    if (qty > directUsageModal.mat.remaining) {
      toast.error(`Cannot record usage of ${qty} units. Worker currently holds only ${directUsageModal.mat.remaining} units.`);
      return;
    }

    setUsageLoading(true);
    try {
      const formData = new FormData();
      formData.append('worker_id', String(id));
      formData.append('product_id', String(directUsageModal.mat.product_id));
      formData.append('project_name', activeWorkAssignment?.work_title || 'Client Project');
      formData.append('quantity', String(qty));
      if (activeWorkAssignment?.client_id) {
        formData.append('client_id', String(activeWorkAssignment.client_id));
      }
      if (activeWorkAssignment?.id) {
        formData.append('worker_stock_request_id', String(activeWorkAssignment.id));
      }
      if (activeWorkAssignment?.work_location) {
        formData.append('location', activeWorkAssignment.work_location);
      }
      formData.append('purpose', directUsageModal.purpose || `Consumed on site for ${activeWorkAssignment?.work_title}`);

      await workerStockService.recordUsage(formData);

      const rem = directUsageModal.mat.remaining - qty;
      toast.success(
        `Successfully recorded ${qty} ${directUsageModal.mat.unit} used on "${activeWorkAssignment?.work_title}". Remaining with worker: ${rem} ${directUsageModal.mat.unit}.`
      );
      setDirectUsageModal({ isOpen: false, mat: null, quantity: '', purpose: '' });
      fetchAll();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to record stock usage.'));
    } finally {
      setUsageLoading(false);
    }
  };

  // Filtered Stock & Work History Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Client filter
      if (historyFilters.client_id) {
        const txClientId = tx.client_id || tx.client?.id || tx.worker_stock_request?.client_id;
        if (String(txClientId) !== String(historyFilters.client_id)) {
          return false;
        }
      }

      // 2. Movement Type filter
      if (historyFilters.movement_type) {
        const typeUpper = (tx.type || '').toUpperCase();
        if (historyFilters.movement_type === 'ISSUED') {
          if (!typeUpper.includes('GODOWN_TO_WORKER') && !typeUpper.includes('ISSUE')) return false;
        } else if (historyFilters.movement_type === 'USED') {
          if (!typeUpper.includes('WORKER_USAGE') && !typeUpper.includes('CONSUMED')) return false;
        } else if (historyFilters.movement_type === 'RETURNED') {
          if (!typeUpper.includes('WORKER_TO_GODOWN') && !typeUpper.includes('RETURN')) return false;
        }
      }

      // 3. Product filter
      if (historyFilters.product_id) {
        const pId = tx.product_id || tx.product?.id;
        if (String(pId) !== String(historyFilters.product_id)) {
          return false;
        }
      }

      // 4. Start Date
      if (historyFilters.start_date) {
        const txDate = tx.created_at ? tx.created_at.split('T')[0] : '';
        const reqStart = tx.worker_stock_request?.start_date ? tx.worker_stock_request.start_date.split('T')[0] : '';
        if ((txDate && txDate < historyFilters.start_date) && (!reqStart || reqStart < historyFilters.start_date)) {
          return false;
        }
      }

      // 5. End Date
      if (historyFilters.end_date) {
        const txDate = tx.created_at ? tx.created_at.split('T')[0] : '';
        const reqEnd = tx.worker_stock_request?.end_date ? tx.worker_stock_request.end_date.split('T')[0] : '';
        if ((txDate && txDate > historyFilters.end_date) && (!reqEnd || reqEnd > historyFilters.end_date)) {
          return false;
        }
      }

      // 6. Free text search
      if (historyFilters.search) {
        const q = historyFilters.search.toLowerCase();
        const clientName = (tx.client?.name || tx.worker_stock_request?.client?.name || '').toLowerCase();
        const workTitle = (tx.worker_stock_request?.work_title || '').toLowerCase();
        const location = (tx.worker_stock_request?.work_location || tx.location || tx.client?.location || '').toLowerCase();
        const remarks = (tx.remarks || '').toLowerCase();
        const prodName = (tx.product?.name || '').toLowerCase();
        if (
          !clientName.includes(q) &&
          !workTitle.includes(q) &&
          !location.includes(q) &&
          !remarks.includes(q) &&
          !prodName.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, historyFilters]);

  // Filtered Summary Stats
  const historyStats = useMemo(() => {
    let issued = 0;
    let used = 0;
    let returned = 0;
    const clientSet = new Set();

    filteredTransactions.forEach((tx) => {
      const typeUpper = (tx.type || '').toUpperCase();
      const qty = Number(tx.quantity) || 0;
      const cName = tx.client?.name || tx.worker_stock_request?.client?.name;
      if (cName) clientSet.add(cName);

      if (typeUpper.includes('GODOWN_TO_WORKER') || typeUpper.includes('ISSUE')) {
        issued += qty;
      } else if (typeUpper.includes('WORKER_USAGE') || typeUpper.includes('CONSUMED')) {
        used += qty;
      } else if (typeUpper.includes('WORKER_TO_GODOWN') || typeUpper.includes('RETURN')) {
        returned += qty;
      }
    });

    return {
      count: filteredTransactions.length,
      issued,
      used,
      returned,
      clientCount: clientSet.size,
    };
  }, [filteredTransactions]);

  const handleExportCurrentStock = () => {
    if (!currentStock || currentStock.length === 0) {
      toast.warning('No currently held stock to export.');
      return;
    }
    const headers = [
      { key: 'product', label: 'Product / Material' },
      { key: 'code', label: 'SKU / Code' },
      { key: 'total_issued', label: 'Total Issued' },
      { key: 'used', label: 'Used in Project' },
      { key: 'returned', label: 'Returned' },
      { key: 'remaining', label: 'Remaining Available' },
      { key: 'unit', label: 'Unit' },
    ];
    const data = currentStock.map((s) => ({
      product: s.product?.name || '',
      code: s.product?.code || '',
      total_issued: Number(s.total_issued ?? s.quantity) || 0,
      used: Number(s.total_used) || 0,
      returned: Number(s.total_returned) || 0,
      remaining: Number(s.quantity) || 0,
      unit: s.product?.unit || 'units',
    }));
    exportToCSV(`worker_${worker?.name || id}_current_stock`, headers, data);
  };

  const handleExportHistory = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) {
      toast.warning('No stock history records match active filters.');
      return;
    }
    const headers = [
      { key: 'voucher_id', label: 'Voucher ID' },
      { key: 'date', label: 'Date' },
      { key: 'client', label: 'Client' },
      { key: 'location', label: 'Work Location' },
      { key: 'work_title', label: 'Work / Task Details' },
      { key: 'type', label: 'Movement Type' },
      { key: 'product', label: 'Material / Product' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unit', label: 'Unit' },
      { key: 'remarks', label: 'Remarks / Notes' },
    ];
    const data = filteredTransactions.map((tx) => {
      const typeUpper = (tx.type || '').toUpperCase();
      const isIssue = typeUpper.includes('GODOWN_TO_WORKER') || typeUpper.includes('ISSUE');
      const isReturn = typeUpper.includes('WORKER_TO_GODOWN') || typeUpper.includes('RETURN');
      const isUsage = typeUpper.includes('WORKER_USAGE') || typeUpper.includes('CONSUMED');
      const typeLabel = isIssue ? 'Stock Issued' : isReturn ? 'Stock Returned' : isUsage ? 'Stock Used' : tx.type;
      const cleanVoucher = String(tx.worker_stock_request?.request_number || tx.reference_number || tx.id).replace(/^#+/, '');
      const req = tx.worker_stock_request || {};
      const clientObj = tx.client || req.client || null;

      return {
        voucher_id: cleanVoucher,
        date: tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '',
        client: clientObj?.name || 'Direct / Internal Work',
        location: req.work_location || tx.location || clientObj?.location || '',
        work_title: req.work_title || tx.remarks || 'Standard assignment',
        type: typeLabel,
        product: tx.product?.name || 'Material',
        quantity: isReturn ? `-${tx.quantity}` : isUsage ? `-${tx.quantity}` : `+${tx.quantity}`,
        unit: tx.product?.unit || 'units',
        remarks: tx.remarks || '',
      };
    });
    exportToCSV(`worker_${worker?.name || id}_stock_history`, headers, data);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !worker) {
    return <ErrorState message={error || 'Worker not found.'} onRetry={fetchAll} />;
  }

  const canManage = (isAdmin || isSupervisor) && !isManager;
  const selectedAssignClient = clients.find((c) => String(c.id) === String(assignForm.client_id));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={worker.name}
        subtitle={`Worker Profile • EMP-${worker.id} • ${worker.email} • ${formatIndianPhone(worker.phone)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/workers')}>
              Back to Workers
            </Button>

            {canManage && (
              <Button
                variant="primary"
                onClick={openAssignModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
              >
                <Package className="w-4 h-4 mr-1.5 inline" />
                Assign Work & Materials
              </Button>
            )}

            {canManage && currentStock.length > 0 && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => openReturnModal()}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5 inline text-indigo-600" />
                  Return Stock
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => openUsageModal()}
                  className="border-amber-200 text-amber-800 hover:bg-amber-50 font-semibold cursor-pointer"
                >
                  <Hammer className="w-4 h-4 mr-1.5 inline text-amber-600" />
                  Stock Used in Project
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* LIFECYCLE STATUS SUMMARY BAR: Issued -> Used -> Returned -> Remaining */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Employee Stock Lifecycle Tracking
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Client Work → Issued Stock → Consumed on Site → Returned Stock → Balance
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Issued Stock */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-blue-800 text-xs font-bold uppercase tracking-wider">
              <span>Issued Stock</span>
              <ArrowDownLeft className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-black text-blue-900 mt-1">
              {lifecycleStats.total_issued.toLocaleString()}
            </div>
            <div className="text-[11px] text-blue-700/80 mt-0.5">Total units issued</div>
          </div>

          {/* 2. Used in Project */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider">
              <span>Used in Project</span>
              <Hammer className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-900 mt-1">
              {lifecycleStats.total_used.toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-700/80 mt-0.5">Consumed on tasks/jobs</div>
          </div>

          {/* 3. Returned to Godown */}
          <div className="bg-purple-50/70 border border-purple-200 rounded-lg p-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-purple-800 text-xs font-bold uppercase tracking-wider">
              <span>Returned to Godown</span>
              <RotateCcw className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-purple-900 mt-1">
              {lifecycleStats.total_returned.toLocaleString()}
            </div>
            <div className="text-[11px] text-purple-700/80 mt-0.5">Returned to warehouse</div>
          </div>

          {/* 4. Remaining with Employee */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase tracking-wider">
              <span>Remaining Stock</span>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900 mt-1">
              {lifecycleStats.remaining.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-700/80 mt-0.5">Live currently held balance</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TOP SECTION: 2 Summary Cards (Pending / Approved Allocations) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Summary Box: Pending Approval Requests */}
        <div className="bg-white rounded-xl border border-amber-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Pending Work & Stock Requests
              </span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-200/80 text-amber-900">
              {pendingRequests.length} Pending
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto max-h-56 divide-y divide-slate-100">
            {pendingRequests.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                No pending allocation requests for this worker.
              </div>
            ) : (
              pendingRequests.map((req) => {
                const count = Array.isArray(req.items) && req.items.length > 0 ? req.items.length : 1;
                return (
                  <div key={req.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/60 rounded px-1.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700">{req.request_number || `#${req.id}`}</span>
                        {req.client?.name && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Building className="w-2.5 h-2.5" />
                            {req.client.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-slate-800 mt-0.5">
                        {req.work_title || `${count} Product${count > 1 ? 's' : ''}`}
                      </div>
                      {req.remarks && (
                        <div className="text-[10px] text-slate-500 italic truncate max-w-xs">
                          "{req.remarks}"
                        </div>
                      )}
                    </div>
                    <Badge variant="warning">Awaiting Manager</Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Summary Box: Approved Allocations / View Receipts */}
        <div className="bg-white rounded-xl border border-emerald-200 shadow-xs overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                Approved Work & Material Receipts
              </span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-200/80 text-emerald-900">
              {approvedRequests.length} Approved
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto max-h-56 divide-y divide-slate-100">
            {approvedRequests.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                No approved allocations or generated receipts yet.
              </div>
            ) : (
              approvedRequests.map((req) => {
                const count = Array.isArray(req.items) && req.items.length > 0 ? req.items.length : 1;
                return (
                  <div key={req.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50/60 rounded px-1.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-800">{req.request_number || `#${req.id}`}</span>
                        {req.client?.name && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Building className="w-2.5 h-2.5" />
                            {req.client.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-slate-800 mt-0.5">
                        {req.work_title || `${count} Product${count > 1 ? 's' : ''}`}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Approved on {req.approved_at ? new Date(req.approved_at).toLocaleDateString() : 'Recent'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSlipRequest(req);
                        setSlipModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md transition shadow-xs cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      View Receipt
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CURRENT ACTIVE WORK ASSIGNMENT & STOCK CONSUMPTION (LIVE DATA) */}
      {/* ========================================================================= */}
      {activeWorkAssignment ? (
        <div className="bg-white rounded-xl border border-blue-200 shadow-xs overflow-hidden space-y-0">
          <div className="px-5 py-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-white border-b border-blue-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                    Current Active Work Assignment
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Live Active Work
                  </span>
                </div>
                <p className="text-[11px] text-blue-800/80">
                  Automatically determined based on worker's live active assignment. No dropdown selection required.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-blue-900 bg-blue-100/70 px-2.5 py-1 rounded-md">
                Voucher: {String(activeWorkAssignment.request_number || activeWorkAssignment.id).replace(/^#+/, '')}
              </span>
            </div>
          </div>

          {/* Active Work Details Grid */}
          <div className="p-4 bg-white border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Client */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                <Briefcase className="w-3 h-3 text-blue-600" />
                <span>Client Account</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {activeWorkAssignment.client?.name || 'Direct Project'}
              </div>
              {activeWorkAssignment.client?.contact_number && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Ph: {formatIndianPhone(activeWorkAssignment.client.contact_number)}
                </div>
              )}
            </div>

            {/* Work Scope */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                <Hammer className="w-3 h-3 text-amber-600" />
                <span>Assigned Work / Task</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {activeWorkAssignment.work_title || 'General Execution'}
              </div>
              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={activeWorkAssignment.remarks}>
                {activeWorkAssignment.remarks || 'Standard scheduled work'}
              </div>
            </div>

            {/* Location */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3 text-rose-500" />
                <span>Work Site Location</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {activeWorkAssignment.work_location || activeWorkAssignment.client?.location || 'Site Location'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                From: {activeWorkAssignment.source_godown?.name || 'Retail Warehouse'}
              </div>
            </div>

            {/* Dates */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-indigo-600" />
                <span>Assignment Schedule</span>
              </div>
              <div className="font-bold text-slate-900 text-sm">
                {activeWorkAssignment.start_date ? new Date(activeWorkAssignment.start_date).toLocaleDateString() : 'Active'} → {activeWorkAssignment.end_date ? new Date(activeWorkAssignment.end_date).toLocaleDateString() : 'Ongoing'}
              </div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                Live Deployment
              </div>
            </div>
          </div>

          {/* Materials Assigned & Stock Consumption for this Work */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Materials Assigned & Live Stock Usage
                </h4>
                <p className="text-[11px] text-slate-500">
                  Enter quantity used directly against this active work. Remaining balance updates automatically.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Material / Product</th>
                    <th className="px-4 py-2.5 text-right">Issued</th>
                    <th className="px-4 py-2.5 text-right text-amber-700">Used</th>
                    <th className="px-4 py-2.5 text-right text-purple-700">Returned</th>
                    <th className="px-4 py-2.5 text-right text-emerald-700 font-bold">Remaining with Worker</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeMaterials.map((mat, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{mat.product?.name || 'Material'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{mat.product?.code || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        {mat.issued} {mat.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-700">
                        {mat.used} {mat.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-purple-700">
                        {mat.returned} {mat.unit}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-black text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {mat.remaining} {mat.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {mat.remaining > 0 && canManage && (
                            <>
                              <button
                                onClick={() => handleOpenDirectUsage(mat)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded shadow-2xs transition cursor-pointer"
                                title="Record stock consumed on this work"
                              >
                                <Hammer className="w-3.5 h-3.5" />
                                <span>Record Stock Used</span>
                              </button>
                              <button
                                onClick={() => openReturnModal(mat.product_id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded transition cursor-pointer"
                                title="Return unused materials back to Retail Godown"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Return to Godown</span>
                              </button>
                            </>
                          )}
                          {mat.remaining > 0 && (
                            <span className="text-[10px] text-slate-400 italic hidden sm:inline">
                              (Under Worker Custody)
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
          No currently active assignment recorded for {worker.name}. Assign work and materials above to initiate live deployment.
        </div>
      )}

      {/* ========================================================================= */}
      {/* Current Worker Stock Holdings Table */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            <span>Currently Held Stock ({currentStock.length} Items)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCurrentStock}
              className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </Button>
            <span className="text-xs text-slate-500">Live Balances with Worker</span>
          </div>
        </div>

        {currentStock.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            No stock currently assigned to this worker.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Product / Material</th>
                  <th className="px-5 py-3 text-left">Code / SKU</th>
                  <th className="px-5 py-3 text-right">Total Issued</th>
                  <th className="px-5 py-3 text-right text-amber-700">Used in Project</th>
                  <th className="px-5 py-3 text-right text-purple-700">Returned</th>
                  <th className="px-5 py-3 text-right text-emerald-700 font-bold">Remaining Available</th>
                  <th className="px-5 py-3 text-left">Unit</th>
                  {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentStock.map((s, i) => {
                  const pId = s.product_id || s.product?.id;
                  const issued = Number(s.total_issued ?? s.quantity) || 0;
                  const used = Number(s.total_used) || 0;
                  const returned = Number(s.total_returned) || 0;
                  const remaining = Number(s.quantity) || 0;

                  return (
                    <tr key={s.id || i} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3 font-bold text-slate-900">{s.product?.name || '—'}</td>
                      <td className="px-5 py-3 font-mono text-slate-500">{s.product?.code || '—'}</td>
                      <td className="px-5 py-3 text-right font-medium text-slate-700">{issued}</td>
                      <td className="px-5 py-3 text-right font-semibold text-amber-700">{used}</td>
                      <td className="px-5 py-3 text-right font-semibold text-purple-700">{returned}</td>
                      <td className="px-5 py-3 text-right font-black text-emerald-700 text-sm">
                        {remaining}
                      </td>
                      <td className="px-5 py-3 uppercase text-slate-500 text-[11px] font-medium">
                        {s.product?.unit || 'units'}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {remaining > 0 && (
                              <>
                                <button
                                  onClick={() => openReturnModal(pId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded transition cursor-pointer"
                                  title="Return unused stock back to godown"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Return</span>
                                </button>
                                <button
                                  onClick={() => openUsageModal(pId)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded transition cursor-pointer"
                                  title="Record stock consumed on client project"
                                >
                                  <Hammer className="w-3 h-3" />
                                  <span>Used in Project</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. EMPLOYEE STOCK & WORK HISTORY SECTION WITH MULTI-FILTERS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-3">
        {/* Section Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Employee Stock & Work History
              </h3>
              <p className="text-[11px] text-slate-500">
                Complete trace of which client {worker.name} worked for, what work was performed, when, and materials issued, used, or returned.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportHistory}
              className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV
            </Button>
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
              {filteredTransactions.length} Movement Records Found
            </span>
          </div>
        </div>

        {/* Dynamic Filter Bar */}
        <div className="px-5 pt-1 pb-3 border-b border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
            {/* Filter 1: Client */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                Client
              </label>
              <select
                value={historyFilters.client_id}
                onChange={(e) => setHistoryFilters({ ...historyFilters, client_id: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.location ? `(${c.location})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 2: Movement Type */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                Movement Type
              </label>
              <select
                value={historyFilters.movement_type}
                onChange={(e) => setHistoryFilters({ ...historyFilters, movement_type: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Types (Issue, Use, Return)</option>
                <option value="ISSUED">Stock Issued (+)</option>
                <option value="USED">Stock Used (-)</option>
                <option value="RETURNED">Stock Returned (-)</option>
              </select>
            </div>

            {/* Filter 3: Material / Product */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                Material / Product
              </label>
              <select
                value={historyFilters.product_id}
                onChange={(e) => setHistoryFilters({ ...historyFilters, product_id: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Materials</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter 4: Start Date */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={historyFilters.start_date}
                onChange={(e) => setHistoryFilters({ ...historyFilters, start_date: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Filter 5: End Date */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                End Date
              </label>
              <input
                type="date"
                value={historyFilters.end_date}
                onChange={(e) => setHistoryFilters({ ...historyFilters, end_date: e.target.value })}
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Filter 6: Search & Reset */}
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                Work / Location / Search
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Search work..."
                  value={historyFilters.search}
                  onChange={(e) => setHistoryFilters({ ...historyFilters, search: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {(historyFilters.client_id ||
                  historyFilters.movement_type ||
                  historyFilters.product_id ||
                  historyFilters.start_date ||
                  historyFilters.end_date ||
                  historyFilters.search) && (
                  <button
                    type="button"
                    onClick={() =>
                      setHistoryFilters({
                        client_id: '',
                        movement_type: '',
                        product_id: '',
                        start_date: '',
                        end_date: '',
                        search: '',
                      })
                    }
                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Reset All Filters"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter Summary Metrics Pill Row */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
            <span className="font-semibold text-slate-700">Filter Totals:</span>
            <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
              <ArrowDownLeft className="w-3 h-3" /> Issued: +{historyStats.issued}
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded">
              <Hammer className="w-3 h-3" /> Used: -{historyStats.used}
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-100/60 px-2 py-0.5 rounded">
              <RotateCcw className="w-3 h-3" /> Returned: -{historyStats.returned}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
              <Building className="w-3 h-3 text-slate-500" /> Clients: {historyStats.clientCount}
            </span>
          </div>
        </div>

        {/* Detailed History Table */}
        {/* Rule: Serial Number / ID -> Date -> Other Information; No '#' symbol */}
        {filteredTransactions.length === 0 ? (
          <EmptyState
            title="No Matching History Records"
            description="No stock movements or work assignments match the selected filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Voucher ID</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Client & Location</th>
                  <th className="px-4 py-3 text-left">Work / Task Details</th>
                  <th className="px-4 py-3 text-left">Movement Type</th>
                  <th className="px-4 py-3 text-left">Material / Product</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-left">Warehouse / Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((tx, i) => {
                  const typeUpper = (tx.type || '').toUpperCase();
                  const isIssue = typeUpper.includes('GODOWN_TO_WORKER') || typeUpper.includes('ISSUE');
                  const isReturn = typeUpper.includes('WORKER_TO_GODOWN') || typeUpper.includes('RETURN');
                  const isUsage = typeUpper.includes('WORKER_USAGE') || typeUpper.includes('CONSUMED');

                  const req = tx.worker_stock_request || {};
                  const clientObj = tx.client || req.client || null;
                  const clientName = clientObj?.name || (tx.remarks && tx.remarks.includes('Client:') ? 'Client Project' : null);
                  const clientLocation = req.work_location || tx.location || clientObj?.location || '—';
                  const workTitle = req.work_title || (isUsage ? tx.remarks?.split('for')?.[1]?.trim() : null) || 'General Work';
                  const startDate = req.start_date ? new Date(req.start_date).toLocaleDateString() : null;
                  const endDate = req.end_date ? new Date(req.end_date).toLocaleDateString() : null;

                  const cleanVoucher = String(req.request_number || tx.reference_number || tx.id).replace(/^#+/, '');

                  return (
                    <tr key={tx.id || i} className="hover:bg-slate-50/80 transition">
                      {/* 1. Voucher ID */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {cleanVoucher}
                      </td>

                      {/* 2. Date (Date strictly second column) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '—'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {tx.created_at ? new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                        {startDate && endDate && (
                          <div className="text-[10px] text-indigo-700 font-medium flex items-center gap-1 mt-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {startDate} → {endDate}
                          </div>
                        )}
                      </td>

                      {/* 2. Client & Location */}
                      <td className="px-4 py-3 max-w-[180px]">
                        {clientName ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 truncate">
                              <Building className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span className="truncate">{clientName}</span>
                            </span>
                            <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">{clientLocation}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Direct / Internal Work</span>
                        )}
                      </td>

                      {/* 3. Work Details & Description */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="font-bold text-slate-900 truncate" title={workTitle}>
                          {workTitle}
                        </div>
                        <div className="text-[11px] text-slate-600 line-clamp-2 italic" title={tx.remarks}>
                          "{tx.remarks || 'Standard assignment'}"
                        </div>
                      </td>

                      {/* 4. Movement Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isIssue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
                            <ArrowDownLeft className="w-3 h-3" />
                            Stock Issued
                          </span>
                        )}
                        {isReturn && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800">
                            <RotateCcw className="w-3 h-3" />
                            Stock Returned
                          </span>
                        )}
                        {isUsage && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                            <Hammer className="w-3 h-3" />
                            Stock Used
                          </span>
                        )}
                        {!isIssue && !isReturn && !isUsage && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {tx.type}
                          </span>
                        )}
                      </td>

                      {/* 5. Material / Product */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{tx.product?.name || 'Material'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{tx.product?.code || '—'}</div>
                      </td>

                      {/* 6. Quantity */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span
                          className={`font-black text-sm ${
                            isReturn
                              ? 'text-purple-700'
                              : isUsage
                              ? 'text-amber-700'
                              : 'text-blue-700'
                          }`}
                        >
                          {isReturn ? `-${tx.quantity}` : isUsage ? `-${tx.quantity}` : `+${tx.quantity}`}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1 uppercase">
                          {tx.product?.unit || 'units'}
                        </span>
                      </td>

                      {/* 7. Warehouse / Custody */}
                      <td className="px-4 py-3 text-[11px] whitespace-nowrap">
                        <div className="text-slate-700 font-medium">{tx.godown?.name || 'On-Site Warehouse'}</div>
                        <div className="text-[10px] text-slate-500">By: {tx.creator?.name || 'Authorized'}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. ASSIGN WORK & MATERIALS MODAL (Sequential Flow 1 -> 6) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAssignOpen}
        onClose={() => setIsAssignOpen(false)}
        title={`Assign Work & Materials to ${worker.name}`}
        subtitle="Maintain clear connection: Client → Work → Worker → Materials → Dates. Sent to Manager for approval."
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          
          {/* STEP 1: Select the Client First */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                  1
                </span>
                <span>Select Client (Required First)</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-indigo-700 font-medium">Step 1 of 6</span>
            </div>

            <Select
              value={assignForm.client_id}
              onChange={(e) => handleAssignClientChange(e.target.value)}
              options={[
                { value: '', label: 'Select Client / Work Project...' },
                ...clients.map((c) => ({
                  value: c.id,
                  label: `${c.name} — ${c.location || 'Location N/A'} (${c.contact_number || 'No contact'})`,
                })),
              ]}
              required
            />

            {selectedAssignClient && (
              <div className="bg-white rounded-lg p-2.5 border border-indigo-200 text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Client Name</span>
                  <span className="font-bold text-slate-800">{selectedAssignClient.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact Number</span>
                  <span className="font-medium text-slate-700">{selectedAssignClient.contact_number || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Location</span>
                  <span className="font-medium text-slate-700">{selectedAssignClient.location || '—'}</span>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2 & 3: Select Start Date & End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Step 2: Start Date */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                  2
                </span>
                <span>Start Date</span> <span className="text-rose-500">*</span>
              </label>
              <Input
                type="date"
                value={assignForm.start_date}
                onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                required
              />
            </div>

            {/* Step 3: End Date */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                  3
                </span>
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

          {/* STEP 4: Select Source Retail Godown & Materials / Products */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center">
                  4
                </span>
                <span>Select & Assign Required Materials / Products</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-amber-700 font-semibold">Retail Godown Only</span>
            </div>

            {/* Source Retail Godown */}
            <div>
              <Select
                value={assignForm.source_godown_id}
                onChange={(e) => handleAssignGodownChange(e.target.value)}
                options={[
                  { value: '', label: 'Select Source Operational Retail Godown...' },
                  ...retailGodowns.map((g) => ({
                    value: g.id,
                    label: `${g.name} [RETAIL] (${g.code || g.location || 'Site'})`,
                  })),
                ]}
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Central Primary Godowns cannot issue directly to workers. Materials are strictly issued from Retail Godowns.
              </p>
              {loadingGodownStock && (
                <p className="text-[11px] text-blue-600 mt-1 flex items-center gap-1 animate-pulse">
                  <Spinner size="xs" /> Fetching live retail godown stock...
                </p>
              )}
            </div>

            {/* Multi-Product Materials Rows */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase">
                  Materials to Issue ({assignForm.items.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddAssignItem}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-md transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Another Material
                </button>
              </div>

              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {assignForm.items.map((item, index) => {
                  const selectedProd = products.find((p) => String(p.id) === String(item.product_id));
                  const availableQty = item.product_id && assignForm.source_godown_id ? (godownStockMap[item.product_id] ?? 0) : null;
                  const unit = selectedProd?.unit || 'units';
                  const exceedsStock = availableQty !== null && Number(item.quantity) > availableQty;

                  return (
                    <div
                      key={index}
                      className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800">
                            {selectedProd ? selectedProd.name : `Material Item #${index + 1}`}
                          </span>
                        </div>
                        {assignForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAssignItem(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Remove product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
                        {/* Product Selection */}
                        <div className="md:col-span-2">
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                            Select Material / Product <span className="text-rose-500">*</span>
                          </label>
                          <Select
                            value={item.product_id}
                            onChange={(e) => handleAssignItemChange(index, 'product_id', e.target.value)}
                            options={[
                              { value: '', label: 'Choose Material / Product...' },
                              ...products.map((p) => {
                                const stock = assignForm.source_godown_id ? (godownStockMap[p.id] ?? 0) : null;
                                return {
                                  value: p.id,
                                  label: `${p.name} (${p.code}) ${stock !== null ? `— Live Stock: ${stock} ${p.unit}` : ''}`,
                                };
                              }),
                            ]}
                            required
                          />
                        </div>

                        {/* Quantity */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                            Quantity <span className="text-rose-500">*</span>
                          </label>
                          <Input
                            type="number"
                            min="0.01"
                            max={availableQty !== null ? availableQty : undefined}
                            step="any"
                            placeholder={availableQty !== null ? `Max ${availableQty}` : 'Qty'}
                            value={item.quantity}
                            onChange={(e) => handleAssignItemChange(index, 'quantity', e.target.value)}
                            className={exceedsStock ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold' : ''}
                            required
                          />
                        </div>
                      </div>

                      {/* Live Godown Available Stock Display */}
                      {item.product_id && (
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span
                            className={`font-semibold ${
                              availableQty !== null && availableQty > 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            Available in Retail Godown: <strong>{availableQty !== null ? availableQty : 'Select Godown'}</strong> {unit}
                          </span>

                          {exceedsStock && (
                            <span className="text-rose-600 font-bold text-[11px]">
                              ⚠️ Cannot exceed live godown stock ({availableQty} {unit})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 5: Assign the Task / Work to the Worker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                  5
                </span>
                <span>Task / Work Title</span> <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Electrical wiring, Plumbing overhaul, Tile installation..."
                value={assignForm.work_title}
                onChange={(e) => setAssignForm({ ...assignForm, work_title: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Client / Work Site Location
              </label>
              <Input
                type="text"
                placeholder="e.g. Building 4, Floor 2, Site Address..."
                value={assignForm.work_location}
                onChange={(e) => setAssignForm({ ...assignForm, work_location: e.target.value })}
              />
            </div>
          </div>

          {/* STEP 6: Add the Required Work Description */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                6
              </span>
              <span>Work Description & Details</span> <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="3"
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              placeholder="Provide full description of the work and why these materials are issued (e.g. Assigned to carry out the initial wiring and cable trunking for client office)..."
              value={assignForm.remarks}
              onChange={(e) => setAssignForm({ ...assignForm, remarks: e.target.value })}
              required
            />
          </div>

          {/* Supervisor Signature */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Supervisor Sign-off Name
            </label>
            <Input
              type="text"
              value={assignForm.supervisor_signature}
              onChange={(e) => setAssignForm({ ...assignForm, supervisor_signature: e.target.value })}
              placeholder="e.g. John Doe (Supervisor)"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsAssignOpen(false)} disabled={assignLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={assignLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
            >
              Submit for Manager Approval ({assignForm.items.length} Materials)
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 2. RETURN STOCK MODAL - Real-time stock restoration to Godown */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isReturnOpen}
        onClose={() => setIsReturnOpen(false)}
        title={`Return Stock to Godown from ${worker.name}`}
        subtitle="Return unused or extra materials back to warehouse inventory. Quantity will be immediately credited back to the Retail godown."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500">Employee:</span>
              <strong className="ml-1 text-slate-800">{worker.name}</strong>
              <span className="ml-2 font-mono text-slate-500">(EMP-{worker.id})</span>
            </div>
            <span className="text-slate-500 font-medium">Department: {worker.department || 'Operations'}</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Select Material to Return <span className="text-rose-500">*</span>
            </label>
            <Select
              value={returnForm.product_id}
              onChange={(e) => setReturnForm({ ...returnForm, product_id: e.target.value })}
              options={[
                { value: '', label: 'Select Held Material...' },
                ...currentStock.map((s) => ({
                  value: s.product_id || s.product?.id,
                  label: `${s.product?.name} (${s.product?.code || '—'}) — Held: ${s.quantity} ${s.product?.unit || 'units'}`,
                })),
              ]}
              required
            />
          </div>

          {returnForm.product_id && (
            <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
              <span className="text-blue-900 font-semibold">Live Quantity Currently Held:</span>
              <span className="font-black text-blue-800 text-sm">
                {maxReturnAvailable} {selectedReturnStock?.product?.unit || 'units'}
              </span>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Quantity to Return <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              min="0.01"
              max={maxReturnAvailable > 0 ? maxReturnAvailable : undefined}
              step="any"
              placeholder={maxReturnAvailable > 0 ? `Max ${maxReturnAvailable}` : 'Enter return quantity'}
              value={returnForm.quantity}
              onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })}
              className={isReturnExceeding ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold' : ''}
              required
            />
            {isReturnExceeding && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1">
                ⚠️ Return quantity cannot exceed employee's currently held stock ({maxReturnAvailable})!
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Destination Retail Godown <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-purple-700 font-medium">Worker → Retail Godown</span>
            </div>
            <Select
              value={returnForm.source_godown_id}
              onChange={(e) => setReturnForm({ ...returnForm, source_godown_id: e.target.value })}
              options={[
                { value: '', label: 'Select Destination Retail Godown...' },
                ...retailGodowns.map((g) => ({
                  value: g.id,
                  label: `${g.name} [RETAIL] (${g.location || g.code || 'Site'})`,
                })),
              ]}
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Primary Godowns cannot receive worker returns. Returned stock will immediately increase the available balance of the selected Retail Godown.
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Description / Reason for Return <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="2"
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              placeholder="e.g. Project completed, unused 8 bags of cement returned back to warehouse inventory..."
              value={returnForm.remarks}
              onChange={(e) => setReturnForm({ ...returnForm, remarks: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsReturnOpen(false)} disabled={returnLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={returnLoading}
              disabled={isReturnExceeding || !returnForm.quantity}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 mr-1.5 inline" />
              Submit Return to Godown
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. STOCK USED IN PROJECT MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isUsageOpen}
        onClose={() => setIsUsageOpen(false)}
        title={`Record Stock Used in Project — ${worker.name}`}
        subtitle="Record materials consumed on a client project. Stock will be deducted from employee holdings."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleUsageSubmit} className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500">Employee:</span>
              <strong className="ml-1 text-slate-800">{worker.name}</strong>
              <span className="ml-2 font-mono text-slate-500">(EMP-{worker.id})</span>
            </div>
            <span className="text-amber-800 font-semibold bg-amber-100/70 px-2 py-0.5 rounded">
              Material Consumption
            </span>
          </div>

          {/* Client link */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Client / Project
            </label>
            <Select
              value={usageForm.client_id}
              onChange={(e) => {
                const cId = e.target.value;
                const c = clients.find((item) => String(item.id) === String(cId));
                setUsageForm({
                  ...usageForm,
                  client_id: cId,
                  project_name: c?.work_details || usageForm.project_name || '',
                  location: c?.location || usageForm.location || '',
                });
              }}
              options={[
                { value: '', label: 'Select Client Project (Optional)...' },
                ...clients.map((c) => ({
                  value: c.id,
                  label: `${c.name} — ${c.location || 'Site'}`,
                })),
              ]}
            />
          </div>

          {/* Project / Task Name */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Project / Task <span className="text-rose-500">*</span>
            </label>
            <Input
              type="text"
              placeholder="e.g. Sector 4 Pipeline Repair / Warehouse Flooring"
              value={usageForm.project_name}
              onChange={(e) => setUsageForm({ ...usageForm, project_name: e.target.value })}
              required
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Work Location
            </label>
            <Input
              type="text"
              placeholder="e.g. Site Address or Floor"
              value={usageForm.location}
              onChange={(e) => setUsageForm({ ...usageForm, location: e.target.value })}
            />
          </div>

          {/* Stock / Material (Only currently issued/held) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Stock / Material <span className="text-rose-500">*</span>
            </label>
            <Select
              value={usageForm.product_id}
              onChange={(e) => setUsageForm({ ...usageForm, product_id: e.target.value })}
              options={[
                { value: '', label: 'Select Currently Issued Material...' },
                ...currentStock.map((s) => ({
                  value: s.product_id || s.product?.id,
                  label: `${s.product?.name} (${s.product?.code || '—'}) — Held: ${s.quantity} ${s.product?.unit || 'units'}`,
                })),
              ]}
              required
            />
          </div>

          {/* Live Holding & Dynamic Calculation */}
          {usageForm.product_id && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-amber-900 font-semibold">Available / Currently Held:</span>
                <span className="font-bold text-amber-950 text-sm">
                  {maxUsageAvailable} {selectedUsageStock?.product?.unit || 'units'}
                </span>
              </div>

              {usageQuantityNum > 0 && (
                <div className="flex items-center justify-between pt-1.5 border-t border-amber-200/80">
                  <span className="font-semibold text-slate-700">Remaining After Usage:</span>
                  <span
                    className={`font-black text-sm ${
                      remainingAfterUsage >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {remainingAfterUsage} {selectedUsageStock?.product?.unit || 'units'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quantity Used */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Quantity Used <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              min="0.01"
              max={maxUsageAvailable > 0 ? maxUsageAvailable : undefined}
              step="any"
              placeholder={maxUsageAvailable > 0 ? `Max ${maxUsageAvailable}` : 'Quantity consumed'}
              value={usageForm.quantity}
              onChange={(e) => setUsageForm({ ...usageForm, quantity: e.target.value })}
              className={isUsageExceeding ? 'border-rose-500 bg-rose-50 text-rose-700 font-bold' : ''}
              required
            />
            {isUsageExceeding && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1">
                ⚠️ Quantity used cannot exceed currently held stock ({maxUsageAvailable})!
              </p>
            )}
          </div>

          {/* Description / Purpose */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Description / Purpose <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows="2"
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
              placeholder="Explain clearly what the material was used for (e.g. Used for installing cable conduit on 2nd floor)..."
              value={usageForm.purpose}
              onChange={(e) => setUsageForm({ ...usageForm, purpose: e.target.value })}
              required
            />
          </div>

          {/* Optional Work Evidence Photo */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Work Photo / Evidence <span className="text-slate-400 font-normal">(Optional)</span></span>
              </label>
              {usagePhoto && (
                <button
                  type="button"
                  onClick={removeUsagePhoto}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>

            {!usagePhotoPreview ? (
              <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="space-y-1 text-slate-500 text-xs">
                  <ImageIcon className="w-6 h-6 mx-auto text-slate-400" />
                  <p className="font-medium text-slate-700">Click to upload work photo or evidence</p>
                  <p className="text-[11px] text-slate-400">PNG, JPG, JPEG up to 10MB (Optional)</p>
                </div>
              </div>
            ) : (
              <div className="relative border border-slate-200 rounded-lg overflow-hidden max-h-40 bg-slate-900 flex items-center justify-center">
                <img
                  src={usagePhotoPreview}
                  alt="Work evidence preview"
                  className="max-h-40 object-contain mx-auto"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsUsageOpen(false)} disabled={usageLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={usageLoading}
              disabled={isUsageExceeding || !usageQuantityNum}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer"
            >
              <Hammer className="w-4 h-4 mr-1.5 inline" />
              Record Consumption
            </Button>
          </div>
        </form>
      </Modal>

      {/* Direct Stock Usage Modal for Active Work */}
      <Modal
        isOpen={directUsageModal.isOpen}
        onClose={() => setDirectUsageModal({ isOpen: false, mat: null, quantity: '', purpose: '' })}
        title={`Record Stock Consumed on Work — ${activeWorkAssignment?.work_title || 'Active Project'}`}
        subtitle="Deduct material consumed directly from worker custody on this active work assignment."
        maxWidth="max-w-md"
      >
        {directUsageModal.mat && (
          <form onSubmit={handleDirectUsageSubmit} className="space-y-4">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Client Project:</span>
                <span className="font-bold text-slate-900">{activeWorkAssignment?.client?.name || 'Direct Project'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Work:</span>
                <span className="font-semibold text-slate-800">{activeWorkAssignment?.work_title || 'General Execution'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Site Location:</span>
                <span className="font-medium text-slate-800">{activeWorkAssignment?.work_location || 'Site'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">Selected Material:</span>
                <span className="font-bold text-blue-700">{directUsageModal.mat.product?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Currently with Worker:</span>
                <span className="font-black text-emerald-700">{directUsageModal.mat.remaining} {directUsageModal.mat.unit}</span>
              </div>
            </div>

            {/* Quantity Used with Live Balance Calculation */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Quantity Consumed / Used <span className="text-rose-500">*</span>
              </label>
              <Input
                type="number"
                min="0.01"
                max={directUsageModal.mat.remaining}
                step="any"
                placeholder={`Max ${directUsageModal.mat.remaining}`}
                value={directUsageModal.quantity}
                onChange={(e) => setDirectUsageModal({ ...directUsageModal, quantity: e.target.value })}
                required
              />
              {/* Automatic live calculation preview */}
              {Number(directUsageModal.quantity) > 0 && (
                <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Automatic Calculation:</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {directUsageModal.mat.remaining} held − {Number(directUsageModal.quantity)} used = {Math.max(0, directUsageModal.mat.remaining - Number(directUsageModal.quantity))} remaining
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Usage Notes / Remarks
              </label>
              <textarea
                rows={2}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                value={directUsageModal.purpose}
                onChange={(e) => setDirectUsageModal({ ...directUsageModal, purpose: e.target.value })}
                placeholder="e.g. Consumed for pipeline joint sealing"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDirectUsageModal({ isOpen: false, mat: null, quantity: '', purpose: '' })}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={usageLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
                <Hammer className="w-3.5 h-3.5 mr-1" />
                Record Stock Consumed
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Printable Material Issue Slip Modal */}
      <MaterialIssueSlipModal
        isOpen={slipModalOpen}
        onClose={() => {
          setSlipModalOpen(false);
          setSlipRequest(null);
        }}
        request={slipRequest}
      />
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import openingStockService from '../../services/openingStockService';
import godownService from '../../services/godownService';
import { extractErrorMessage } from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import { exportToCSV } from '../../utils/csvExport';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  Layers,
  Warehouse,
  Boxes,
  Calendar,
  User,
  ShieldCheck,
  RefreshCw,
  Search,
  ArrowRight,
  Info,
} from 'lucide-react';

export default function OpeningStockManagement() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [importRecord, setImportRecord] = useState(null);
  const [godowns, setGodowns] = useState([]);
  const [selectedGodownId, setSelectedGodownId] = useState('');

  // Upload & Validation state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileBase64, setFileBase64] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [confirming, setConfirming] = useState(false);

  // History state for confirmed view
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPagination, setHistoryPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  // 1. Load Initial Status
  const loadStatus = async () => {
    setPageLoading(true);
    try {
      const res = await openingStockService.getStatus();
      const statusData = res.data || {};
      setIsInitialized(Boolean(statusData.is_initialized));
      setImportRecord(statusData.import_record || null);

      const activeGodowns = statusData.godowns || [];
      setGodowns(activeGodowns);

      if (activeGodowns.length > 0) {
        // Default to Primary Godown if available, else first godown
        const primary = activeGodowns.find((g) => g.type === 'PRIMARY');
        setSelectedGodownId(primary ? String(primary.id) : String(activeGodowns[0].id));
      }

      if (statusData.is_initialized) {
        loadHistory(1);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to load opening stock status.'));
    } finally {
      setPageLoading(false);
    }
  };

  const loadHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await openingStockService.getHistory({ page, per_page: 15, search: historySearch || undefined });
      setHistoryItems(res.data?.items || []);
      setHistoryPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0 });
    } catch (err) {
      console.error('Failed to load opening stock history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // 2. Download Predefined Excel Template
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          Date: '01-11-2026',
          'Product Code': 'PRD001',
          'Product Title': 'Keyboard',
          Description: 'Wireless keyboard',
          Unit: 'PCS',
          Quantity: 100,
        },
        {
          Date: '01-11-2026',
          'Product Code': 'PRD002',
          'Product Title': 'Mouse',
          Description: 'Optical mouse',
          Unit: 'PCS',
          Quantity: 50,
        },
        {
          Date: '01-11-2026',
          'Product Code': 'PRD003',
          'Product Title': 'Monitor',
          Description: '24-inch LED monitor',
          Unit: 'PCS',
          Quantity: 25,
        },
        {
          Date: '01-11-2026',
          'Product Code': 'PRD004',
          'Product Title': 'Printer Paper',
          Description: 'A4 paper bundle',
          Unit: 'BOX',
          Quantity: 40,
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData, {
        header: ['Date', 'Product Code', 'Product Title', 'Description', 'Unit', 'Quantity'],
      });

      // Auto-fit column widths
      worksheet['!cols'] = [
        { wch: 14 }, // Date
        { wch: 16 }, // Product Code
        { wch: 24 }, // Product Title
        { wch: 28 }, // Description
        { wch: 10 }, // Unit
        { wch: 12 }, // Quantity
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Opening Stock');
      XLSX.writeFile(workbook, 'Opening_Stock_Template.xlsx');

      toast.success('Opening Stock Excel template downloaded successfully.');
    } catch (err) {
      toast.error('Failed to generate Excel template: ' + err.message);
    }
  };

  // 3. Handle File Upload & Parsing
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedGodownId) {
      toast.error('Please select a Target Godown first.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      toast.error('Please upload an Excel spreadsheet (.xlsx, .xls) or CSV file.');
      return;
    }

    setParsing(true);
    setUploadedFile(file);

    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

        if (jsonRows.length === 0) {
          toast.error('Uploaded file appears to be empty. Please verify the file content.');
          setParsing(false);
          return;
        }

        // Convert base64 for archiving
        const base64String = btoa(
          new Uint8Array(data).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
        );
        setFileBase64(base64String);

        // Normalize keys
        const normalizedRows = jsonRows.map((r) => {
          const keys = Object.keys(r);
          const getVal = (candidates) => {
            for (const c of candidates) {
              const matched = keys.find((k) => k.trim().toLowerCase() === c.toLowerCase());
              if (matched) return r[matched];
            }
            return '';
          };

          return {
            date: getVal(['date', 'opening date', 'effective date']),
            product_code: getVal(['product code', 'code', 'sku', 'sku code', 'product_code']),
            product_title: getVal(['product title', 'title', 'product name', 'name', 'product_title']),
            description: getVal(['description', 'desc', 'product description']),
            unit: getVal(['unit', 'uom', 'measurement unit']),
            quantity: getVal(['quantity', 'qty', 'opening stock', 'stock']),
          };
        });

        // Send to server validation
        const valRes = await openingStockService.validateRows(normalizedRows, Number(selectedGodownId));
        setValidationResult(valRes.data || null);

        if (valRes.data?.invalid_count > 0) {
          toast.warning(
            `Found ${valRes.data.invalid_count} row(s) with validation issues. Review the error table below.`
          );
        } else {
          toast.success(
            `Successfully validated ${valRes.data?.valid_count} opening stock rows. Ready to confirm.`
          );
        }
      } catch (err) {
        toast.error('Failed to parse Excel file: ' + (err.message || 'Unknown error'));
        setValidationResult(null);
      } finally {
        setParsing(false);
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file from disk.');
      setParsing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleResetUpload = () => {
    setUploadedFile(null);
    setFileBase64(null);
    setValidationResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 4. Confirm & Finalize Import
  const handleConfirmImport = async () => {
    if (!validationResult || validationResult.invalid_count > 0) {
      toast.error('Cannot import opening stock with pending validation errors. Please correct your Excel file.');
      return;
    }

    const totalSKUs = validationResult.valid_count;
    const totalQty = validationResult.total_quantity;
    const targetGodownName = validationResult.target_godown?.name || 'Selected Warehouse';

    const confirmMsg = `Are you sure you want to finalize Opening Stock for ${totalSKUs} products (${totalQty.toLocaleString()} total units) into ${targetGodownName}?\n\nNOTE: Opening Stock is a permanent ONE-TIME operation. Once confirmed, it will lock the baseline inventory and cannot be re-imported.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setConfirming(true);
    try {
      const res = await openingStockService.importOpeningStock({
        rows: validationResult.rows,
        godown_id: Number(selectedGodownId),
        file_name: uploadedFile?.name || 'Opening_Stock.xlsx',
        file_base64: fileBase64,
      });

      toast.success(
        res.message || 'Opening stock import confirmed successfully! System inventory baseline initialized.'
      );
      handleResetUpload();
      loadStatus();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to finalize opening stock import.'));
    } finally {
      setConfirming(false);
    }
  };

  // 5. Export confirmed records to CSV
  const handleExportHistory = () => {
    if (!historyItems || historyItems.length === 0) {
      toast.warning('No opening stock items to export.');
      return;
    }

    exportToCSV({
      filename: `Opening_Stock_Baseline_${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { label: 'Effective Date', format: (item) => item.effective_date || '' },
        { label: 'Product Code', key: 'product_code' },
        { label: 'Product Title', key: 'product_title' },
        { label: 'Description', format: (item) => item.description || '' },
        { label: 'Unit', key: 'unit' },
        { label: 'Quantity', key: 'quantity' },
        { label: 'Godown', format: (item) => item.import?.godown?.name || '' },
        { label: 'Initialized By', format: (item) => item.import?.importer?.name || 'Admin' },
        { label: 'Reference Number', format: (item) => item.import?.import_number || '' },
      ],
      data: historyItems,
    });
  };

  if (pageLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Opening Stock Management"
        description="Establish enterprise baseline physical inventory through verified Excel import. One-time setup operation."
      >
        <div className="flex items-center gap-2">
          {!isInitialized && (
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download Excel Template
            </Button>
          )}
          {isInitialized && (
            <Button
              variant="outline"
              onClick={handleExportHistory}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export Baseline CSV
            </Button>
          )}
        </div>
      </PageHeader>

      {/* STATE 1: ALREADY FINALIZED & LOCKED (ONE-TIME RULE ENFORCED) */}
      {isInitialized ? (
        <div className="space-y-6">
          {/* Permanent Locked Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-emerald-600 text-white rounded-lg shrink-0 mt-0.5">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-emerald-900">
                    Opening Stock Initialized & Locked
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-200 text-emerald-900 border border-emerald-300">
                    <Lock className="w-3 h-3" /> One-Time Operation Finalized
                  </span>
                </div>
                <p className="text-sm text-emerald-800 mt-1 leading-relaxed">
                  The initial physical inventory has been permanently recorded as the opening balance baseline for all subsequent procurement, warehouse transfers, and site work allocations. Direct re-importing is disabled to ensure immutable inventory auditing.
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-emerald-950 flex-wrap">
                  <span>Batch Ref: <strong className="font-mono">{importRecord?.import_number || 'N/A'}</strong></span>
                  <span>Target Hub: <strong>{importRecord?.godown?.name || 'Primary Godown'}</strong></span>
                  <span>Effective Date: <strong>{importRecord?.effective_date || 'N/A'}</strong></span>
                  <span>Imported By: <strong>{importRecord?.importer?.name || 'Administrator'}</strong></span>
                  <span>Source File: <strong>{importRecord?.file_name || 'Opening_Stock.xlsx'}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Opening SKUs</span>
                <Boxes className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {importRecord?.total_skus || historyPagination.total || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Catalog items initialized</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Quantity</span>
                <Layers className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {Number(importRecord?.total_quantity || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Total physical units recorded</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Target Warehouse</span>
                <Warehouse className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-lg font-bold text-slate-900 truncate">
                {importRecord?.godown?.name || 'Main Warehouse'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Location of opening stock</div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Audit Trace</span>
                <Calendar className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-base font-bold text-slate-900">
                {importRecord?.created_at ? new Date(importRecord.created_at).toLocaleDateString() : 'Confirmed'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Recorded by {importRecord?.importer?.name || 'Admin'}</div>
            </div>
          </div>

          {/* Confirmed Opening Stock Items Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                <h4 className="font-bold text-slate-800 text-sm">Baseline Inventory Ledger ({historyPagination.total})</h4>
              </div>
              <div className="w-full sm:w-64">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search SKU or Title..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadHistory(1);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="p-8 text-center"><Spinner size="md" /></div>
            ) : historyItems.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">No records match your search query.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500 text-[11px]">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Effective Date</th>
                      <th className="px-4 py-3">SKU / Code</th>
                      <th className="px-4 py-3">Product Title</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Opening Quantity</th>
                      <th className="px-4 py-3">Godown Hub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                          {(historyPagination.current_page - 1) * 15 + index + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                          {item.effective_date}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {item.product_code}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {item.product_title}
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                          {item.description || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700">
                            {item.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                          {Number(item.quantity).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {item.import?.godown?.name || 'Primary Godown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STATE 2: NOT INITIALIZED YET - ACTIVE IMPORT WORKFLOW */
        <div className="space-y-6">
          {/* Guidance Banner */}
          <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 bg-blue-600 text-white rounded-lg shrink-0 mt-0.5">
                <Info className="w-5 h-5" />
              </div>
              <div className="flex-1 text-xs text-blue-900 space-y-1">
                <h4 className="font-bold text-sm text-blue-950">One-Time Physical Opening Stock Import</h4>
                <p className="leading-relaxed">
                  Before using the software for everyday procurement and field assignments, upload your existing warehouse inventory once through the standard Excel template. The system will automatically register any new product SKUs and initialize the double-entry stock ledger.
                </p>
                <div className="pt-1 flex items-center gap-3 font-semibold text-blue-800 flex-wrap">
                  <span>1. Download Excel template</span>
                  <span>&bull;</span>
                  <span>2. Fill physical stock quantities</span>
                  <span>&bull;</span>
                  <span>3. Upload & preview validation</span>
                  <span>&bull;</span>
                  <span>4. Confirm atomic initialization</span>
                </div>
              </div>
            </div>
          </div>

          {/* Setup Form: Select Godown & Upload File */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Target Godown */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Target Warehouse / Godown <span className="text-rose-500">*</span>
                </label>
                {godowns.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    No active godowns found. Please configure a Primary Godown in{' '}
                    <a href="/master-entry?tab=godown" className="underline font-bold text-amber-900">
                      Master Entry
                    </a>{' '}
                    first before initializing opening stock.
                  </div>
                ) : (
                  <Select
                    name="godown_id"
                    value={selectedGodownId}
                    onChange={(e) => setSelectedGodownId(e.target.value)}
                    options={godowns.map((g) => ({
                      value: String(g.id),
                      label: `${g.name} (${g.type === 'PRIMARY' ? 'Primary Hub' : 'Retail'})`,
                    }))}
                  />
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  Physical warehouse location where this opening stock currently resides.
                </p>
              </div>

              {/* Template Download Reference */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-xs text-slate-800">Need the Standard Template?</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Pre-formatted columns: Date, Product Code, Title, Description, Unit, Quantity.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="shrink-0 bg-white"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Get Template
                </Button>
              </div>
            </div>

            {/* Drag and Drop File Upload Area */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Upload Physical Inventory Spreadsheet (.xlsx / .xls) <span className="text-rose-500">*</span>
              </label>

              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  uploadedFile
                    ? 'border-emerald-400 bg-emerald-50/20'
                    : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="excel-file-input"
                />

                {parsing ? (
                  <div className="space-y-2">
                    <Spinner size="md" />
                    <div className="text-xs font-semibold text-slate-600">
                      Reading spreadsheet and running validation rules...
                    </div>
                  </div>
                ) : uploadedFile ? (
                  <div className="space-y-3">
                    <div className="inline-flex p-3 bg-emerald-100 text-emerald-700 rounded-full">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800">{uploadedFile.name}</div>
                      <div className="text-xs text-slate-500">
                        {(uploadedFile.size / 1024).toFixed(1)} KB &bull; Loaded ready for confirmation
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleResetUpload}
                        className="text-xs"
                      >
                        Choose Different File
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label htmlFor="excel-file-input" className="cursor-pointer block space-y-2">
                    <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-full">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-sm font-bold text-slate-800">
                      Click to browse or drag & drop your Excel file here
                    </div>
                    <div className="text-xs text-slate-400">
                      Supports Microsoft Excel (.xlsx, .xls) and CSV files
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Validation & Preview Section */}
          {validationResult && (
            <div className="space-y-4">
              {/* Validation Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-xs text-slate-500 font-semibold uppercase">Total Rows</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {validationResult.total_rows}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-xs text-emerald-600 font-semibold uppercase">Valid Records</div>
                  <div className="text-xl font-black text-emerald-700 mt-1">
                    {validationResult.valid_count}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-xs text-rose-600 font-semibold uppercase">Errors Detected</div>
                  <div className="text-xl font-black text-rose-700 mt-1">
                    {validationResult.invalid_count}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-xs text-blue-600 font-semibold uppercase">Total Quantity</div>
                  <div className="text-xl font-black text-blue-700 mt-1">
                    {Number(validationResult.total_quantity).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Error Box if any errors */}
              {validationResult.invalid_count > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Validation Errors in Uploaded File ({validationResult.errors.length})</span>
                  </div>
                  <p className="text-xs text-rose-700">
                    The following errors must be corrected in your Excel file before opening stock can be imported:
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pt-1">
                    {validationResult.errors.map((err, i) => (
                      <div
                        key={i}
                        className="bg-white/80 p-2 rounded border border-rose-200 text-xs flex items-center justify-between gap-2"
                      >
                        <div>
                          <strong className="text-rose-900 font-mono">Row {err.row}:</strong>{' '}
                          <span className="text-slate-700 font-semibold">[{err.product_code}] {err.product_title}</span> —{' '}
                          <span className="text-rose-700">{err.message}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 shrink-0">
                          Row {err.row}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Preview Data ({validationResult.rows.length} Rows)
                    </h4>
                  </div>
                  <div className="text-xs text-slate-500">
                    Target: <strong className="text-slate-800">{validationResult.target_godown?.name}</strong>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 border-b border-slate-200 uppercase font-semibold text-slate-500 text-[11px] sticky top-0 z-10">
                      <tr>
                        <th className="px-3.5 py-2.5">Row #</th>
                        <th className="px-3.5 py-2.5">Status</th>
                        <th className="px-3.5 py-2.5">Effective Date</th>
                        <th className="px-3.5 py-2.5">Product Code</th>
                        <th className="px-3.5 py-2.5">Product Title</th>
                        <th className="px-3.5 py-2.5">Description</th>
                        <th className="px-3.5 py-2.5">Unit</th>
                        <th className="px-3.5 py-2.5 text-right">Quantity</th>
                        <th className="px-3.5 py-2.5">Catalog Match</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validationResult.rows.map((row) => {
                        const isErr = row.status === 'INVALID';
                        return (
                          <tr
                            key={row.row_number}
                            className={`transition-colors ${isErr ? 'bg-rose-50/50 hover:bg-rose-50' : 'hover:bg-slate-50/70'}`}
                          >
                            <td className="px-3.5 py-2 font-mono text-[11px] text-slate-400">
                              {row.row_number}
                            </td>
                            <td className="px-3.5 py-2 whitespace-nowrap">
                              {isErr ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                  <XCircle className="w-3 h-3 text-rose-600" /> Error
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Valid
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2 font-mono whitespace-nowrap">{row.date}</td>
                            <td className="px-3.5 py-2 font-mono font-bold text-blue-700 whitespace-nowrap">
                              {row.product_code}
                            </td>
                            <td className="px-3.5 py-2 font-semibold text-slate-900">
                              {row.product_title}
                            </td>
                            <td className="px-3.5 py-2 text-slate-500 max-w-xs truncate">
                              {row.description || '—'}
                            </td>
                            <td className="px-3.5 py-2 font-bold uppercase">{row.unit}</td>
                            <td className={`px-3.5 py-2 text-right font-black whitespace-nowrap ${isErr ? 'text-rose-600' : 'text-slate-900'}`}>
                              {Number(row.quantity).toLocaleString()}
                            </td>
                            <td className="px-3.5 py-2 whitespace-nowrap">
                              {row.exists_in_master ? (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Existing Product
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  + New SKU (Will Create)
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Final Submission Action Bar */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    {validationResult.invalid_count === 0 ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        All {validationResult.valid_count} records passed validation. Ready to initialize opening stock.
                      </span>
                    ) : (
                      <span className="text-rose-700 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        Fix {validationResult.invalid_count} error(s) before proceeding.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleResetUpload} disabled={confirming}>
                      Cancel / Reset
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleConfirmImport}
                      disabled={confirming || validationResult.invalid_count > 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs cursor-pointer"
                    >
                      {confirming ? (
                        <>
                          <Spinner size="sm" className="mr-1.5" /> Finalizing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm & Initialize Opening Stock
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

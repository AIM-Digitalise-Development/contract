import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import productService from '../../services/productService';
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
import { Download, Calculator } from 'lucide-react';

const UNIT_OPTIONS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'kg', label: 'Kilograms (kg)' },
  { value: 'ltr', label: 'Liters (ltr)' },
  { value: 'box', label: 'Boxes (box)' },
  { value: 'bags', label: 'Bags (bags)' },
  { value: 'mtr', label: 'Meters (mtr)' },
  { value: 'ton', label: 'Metric Ton (ton)' },
  { value: 'units', label: 'Units (units)' },
  { value: 'pack', label: 'Packs (pack)' },
  { value: 'roll', label: 'Rolls (roll)' },
  { value: 'set', label: 'Sets (set)' },
];

export default function ProductList({ embedded = false }) {
  const { isAdmin, isManager } = useAuth();
  const toast = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Requirements 24 & 25: Unit-Wise Price vs Total/Bulk Price
  const [pricingMode, setPricingMode] = useState('unit'); // 'unit' | 'bulk'
  const [pricingQuantity, setPricingQuantity] = useState('100');
  const [unitWisePrice, setUnitWisePrice] = useState('');
  const [bulkTotalPrice, setBulkTotalPrice] = useState('');
  const [isExporting, setIsExporting] = useState(false);


  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    unit: 'pcs',
    procurement_from: '',
    procurement_date: '',
    purchase_rate: '',
    min_stock_alert: '',
    status: 'ACTIVE',
  });

  // Delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await productService.getProducts({
        page,
        per_page: 10,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      });
      setProducts(res.data?.items || []);
      setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load products.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchProducts(1);
  }, [fetchProducts]);

  const handleOpenCreate = () => {
    setFormMode('create');
    setSelectedProduct(null);
    setPricingMode('unit');
    setPricingQuantity('100');
    setUnitWisePrice('');
    setBulkTotalPrice('');
    setFormData({
      name: '',
      code: '',
      description: '',
      unit: 'pcs',
      procurement_from: '',
      procurement_date: '',
      purchase_rate: '',
      min_stock_alert: '',
      status: 'ACTIVE',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p) => {
    setFormMode('edit');
    setSelectedProduct(p);
    setPricingMode('unit');
    setPricingQuantity('100');
    setUnitWisePrice(p.purchase_rate ? String(p.purchase_rate) : '');
    const calculatedTotal = p.purchase_rate ? (Number(p.purchase_rate) * 100).toFixed(2) : '';
    setBulkTotalPrice(calculatedTotal);
    setFormData({
      name: p.name || '',
      code: p.code || '',
      description: p.description || '',
      unit: p.unit || 'pcs',
      procurement_from: p.procurement_from || '',
      procurement_date: p.procurement_date || '',
      purchase_rate: p.purchase_rate ? String(p.purchase_rate) : '',
      min_stock_alert: p.min_stock_alert ? String(p.min_stock_alert) : '',
      status: p.status || 'ACTIVE',
    });
    setIsFormOpen(true);
  };

  // Pricing calculation sync
  const handleUnitRateChange = (rateVal, qtyVal = pricingQuantity) => {
    setUnitWisePrice(rateVal);
    const rate = parseFloat(rateVal) || 0;
    const qty = parseFloat(qtyVal) || 0;
    const total = (rate * qty).toFixed(2);
    setBulkTotalPrice(total);
    setFormData(prev => ({ ...prev, purchase_rate: rateVal }));
  };

  const handleBulkTotalChange = (totalVal, qtyVal = pricingQuantity) => {
    setBulkTotalPrice(totalVal);
    const total = parseFloat(totalVal) || 0;
    const qty = parseFloat(qtyVal) || 0;
    const calculatedUnitRate = qty > 0 ? (total / qty).toFixed(2) : '0';
    setUnitWisePrice(calculatedUnitRate);
    setFormData(prev => ({ ...prev, purchase_rate: calculatedUnitRate }));
  };

  const handlePricingQuantityChange = (qtyVal) => {
    setPricingQuantity(qtyVal);
    if (pricingMode === 'unit') {
      const rate = parseFloat(unitWisePrice) || 0;
      const qty = parseFloat(qtyVal) || 0;
      setBulkTotalPrice((rate * qty).toFixed(2));
    } else {
      const total = parseFloat(bulkTotalPrice) || 0;
      const qty = parseFloat(qtyVal) || 0;
      const calculatedUnitRate = qty > 0 ? (total / qty).toFixed(2) : '0';
      setUnitWisePrice(calculatedUnitRate);
      setFormData(prev => ({ ...prev, purchase_rate: calculatedUnitRate }));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
        unit: formData.unit,
        procurement_from: formData.procurement_from || undefined,
        procurement_date: formData.procurement_date || undefined,
        purchase_rate: formData.purchase_rate ? parseFloat(formData.purchase_rate) : undefined,
        min_stock_alert: formData.min_stock_alert ? parseFloat(formData.min_stock_alert) : undefined,
        status: formData.status,
      };

      if (formMode === 'create') {
        await productService.createProduct(payload);
        toast.success('Product created successfully.');
      } else {
        await productService.updateProduct(selectedProduct.id, payload);
        toast.success('Product updated successfully.');
      }
      setIsFormOpen(false);
      fetchProducts(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to save product.'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      await productService.deleteProduct(productToDelete.id);
      toast.success(`Product "${productToDelete.name}" deleted.`);
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
      fetchProducts(pagination.current_page);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to delete product.'));
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      let exportData = products;
      try {
        const res = await productService.getProducts({
          per_page: 2000,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
        });
        if (res?.data?.items && res.data.items.length > 0) {
          exportData = res.data.items;
        }
      } catch (e) {
        console.warn('Fallback to loaded page products for CSV export:', e);
      }

      if (!exportData || exportData.length === 0) {
        toast.warning('No product records found to export with currently applied filters.');
        return;
      }

      exportToCSV({
        filename: `Product_Catalog_${new Date().toISOString().slice(0, 10)}.csv`,
        columns: [
          { label: 'SKU / Code', key: 'code' },
          { label: 'Procurement Date', format: (p) => p.procurement_date || '—' },
          { label: 'Product Name', key: 'name' },
          { label: 'Measurement Unit', key: 'unit' },
          { label: 'Purchase Rate (₹)', format: (p) => (p.purchase_rate ? `₹${Number(p.purchase_rate).toFixed(2)}` : '—') },
          { label: 'Procurement Source', format: (p) => p.procurement_from || '—' },
          { label: 'Min Stock Alert', format: (p) => (p.min_stock_alert ? `${p.min_stock_alert} ${p.unit}` : '0') },
          { label: 'Status', key: 'status' },
          { label: 'Description', format: (p) => p.description || '' },
        ],
        data: exportData,
      });
      toast.success(`Exported ${exportData.length} filtered product records.`);
    } catch (err) {
      toast.error(err.message || 'Failed to export CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      {!embedded ? (
        <PageHeader
          title="Products Catalog"
          description="Manage product definitions, procurement pricing calculations, SKUs, and stock reminder alerts."
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
            {(isAdmin || isManager) && (
              <Button onClick={handleOpenCreate}>
                + Add Product
              </Button>
            )}
          </div>
        </PageHeader>
      ) : (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Product Directory</h2>
            <p className="text-xs text-slate-500">Manage master product catalog, units, rate of purchase, and reorder levels.</p>
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
            {(isAdmin || isManager) && (
              <Button onClick={handleOpenCreate} size="sm">
                + Add Product
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Input
            placeholder="Search by product name, SKU, procurement source, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All Statuses"
            options={[
              { value: 'ACTIVE', label: 'ACTIVE' },
              { value: 'INACTIVE', label: 'INACTIVE' },
            ]}
          />
        </div>
      </div>

      {/* Products Table - Order Standard: ID/Code -> Date -> Other Information */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={() => fetchProducts(pagination.current_page)} />
          </div>
        ) : products.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No products found"
              description="Get started by adding items to the central product catalog."
              actionLabel={isAdmin || isManager ? "+ Add Product" : undefined}
              onAction={isAdmin || isManager ? handleOpenCreate : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-3.5 whitespace-nowrap">SKU / Code</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap">Procurement Date</th>
                  <th className="px-4 py-3.5 min-w-[200px]">Product Name</th>
                  <th className="px-3.5 py-3.5 whitespace-nowrap text-center">Unit</th>
                  <th className="px-3.5 py-3.5 text-right whitespace-nowrap">Rate of Purchase</th>
                  <th className="px-4 py-3.5 min-w-[150px]">Procurement Source</th>
                  <th className="px-3.5 py-3.5 text-right whitespace-nowrap">Min Alert</th>
                  <th className="px-3.5 py-3.5 text-center whitespace-nowrap">Status</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const cleanCode = String(p.code || p.id).replace(/^#+/, '');
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3.5 py-3.5 font-mono text-xs text-blue-600 font-semibold whitespace-nowrap">
                        {cleanCode}
                      </td>
                      <td className="px-3.5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {p.procurement_date || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{p.name}</div>
                        {p.description && (
                          <div className="text-xs text-slate-400 truncate max-w-sm">{p.description}</div>
                        )}
                      </td>
                      <td className="px-3.5 py-3.5 text-xs font-semibold text-slate-700 uppercase whitespace-nowrap text-center">
                        {p.unit}
                      </td>
                      <td className="px-3.5 py-3.5 text-right text-xs font-semibold text-slate-900 whitespace-nowrap">
                        {p.purchase_rate !== null && p.purchase_rate !== undefined ? (
                          <span className="font-mono">
                            ₹{Number(p.purchase_rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {p.unit || 'unit'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-700">
                        {p.procurement_from || '—'}
                      </td>
                      <td className="px-3.5 py-3.5 text-right whitespace-nowrap text-xs">
                        {p.min_stock_alert ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {p.min_stock_alert} {p.unit}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-3.5 text-center whitespace-nowrap">
                        <Badge variant={p.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {isAdmin ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => handleOpenEdit(p)}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setProductToDelete(p);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">View only</span>
                        )}
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
          onPageChange={fetchProducts}
        />
      </div>

      {/* Product Form Modal with Rate of Purchase Dual Pricing (Requirements 24 & 25) */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={formMode === 'create' ? 'Add New Product' : 'Edit Product'}
        subtitle="Catalog specifications, procurement rate pricing, and inventory thresholds."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Product Name"
              name="name"
              required
              placeholder="e.g. Rice, Safety Helmet"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              label="Code / SKU"
              name="code"
              required
              placeholder="e.g. PRD-RICE-001"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Measurement Unit"
              name="unit"
              required
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={UNIT_OPTIONS}
            />
            <Select
              label="Status"
              name="status"
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'INACTIVE', label: 'INACTIVE' },
              ]}
            />
          </div>

          {/* Procurement Information */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Procurement Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Procurement From"
                name="procurement_from"
                placeholder="e.g. Apex Industrial Supplies"
                value={formData.procurement_from}
                onChange={(e) => setFormData({ ...formData, procurement_from: e.target.value })}
              />
              <Input
                type="date"
                label="Procurement Date"
                name="procurement_date"
                value={formData.procurement_date}
                onChange={(e) => setFormData({ ...formData, procurement_date: e.target.value })}
              />
            </div>
          </div>

          {/* Pricing Section (Requirements 24 & 25: Unit-Wise Price vs Total/Bulk Price) */}
          <div className="pt-2 border-t border-slate-100 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-blue-600" />
                <span>Rate of Purchase Calculation</span>
              </h4>
              <span className="text-[11px] font-semibold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Unit: {formData.unit}
              </span>
            </div>

            {/* Rate Type Selector Tabs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPricingMode('unit')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  pricingMode === 'unit'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Option 1: Unit-Wise Price
              </button>
              <button
                type="button"
                onClick={() => setPricingMode('bulk')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  pricingMode === 'bulk'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Option 2: Total / Bulk Price
              </button>
            </div>

            {pricingMode === 'unit' ? (
              /* Option 1: Unit-Wise Price */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Unit Price (₹ / {formData.unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 60"
                      value={unitWisePrice}
                      onChange={(e) => handleUnitRateChange(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Quantity ({formData.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="e.g. 100"
                      value={pricingQuantity}
                      onChange={(e) => handlePricingQuantityChange(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
                {/* Live Formula Display */}
                <div className="p-2 rounded bg-blue-50/80 border border-blue-200 text-xs text-blue-900 font-mono flex items-center justify-between">
                  <span>Calculation: {pricingQuantity || 0} {formData.unit} × ₹{unitWisePrice || 0}/{formData.unit}</span>
                  <span className="font-bold text-blue-950">= ₹{bulkTotalPrice || 0} Total</span>
                </div>
              </div>
            ) : (
              /* Option 2: Total / Bulk Price */
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Total Purchase Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 10000"
                      value={bulkTotalPrice}
                      onChange={(e) => handleBulkTotalChange(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Complete Quantity ({formData.unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="e.g. 100"
                      value={pricingQuantity}
                      onChange={(e) => handlePricingQuantityChange(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      required
                    />
                  </div>
                </div>
                {/* Live Formula Display */}
                <div className="p-2 rounded bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-900 font-mono flex items-center justify-between">
                  <span>Calculation: ₹{bulkTotalPrice || 0} ÷ {pricingQuantity || 1} {formData.unit}</span>
                  <span className="font-bold text-emerald-950">= ₹{unitWisePrice || 0} / {formData.unit}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              type="number"
              step="1"
              min="0"
              label="Minimum Stock Reminder Alert"
              name="min_stock_alert"
              placeholder="e.g. 20"
              value={formData.min_stock_alert}
              onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
            />
            <Input
              label="Description (Optional)"
              name="description"
              placeholder="Optional notes or specifications"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={formLoading}>
              {formMode === 'create' ? 'Create Product' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Product"
        message={`Are you sure you want to delete "${productToDelete?.name}"? Items with ledger entries will be archived.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

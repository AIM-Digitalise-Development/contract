import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useDebounce from '../../hooks/useDebounce';
import transferService from '../../services/transferService';
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
import { exportToCSV } from '../../utils/csvExport';
import { Download } from 'lucide-react';

export default function TransferList() {
  const { user } = useAuth();
  const toast = useToast();

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 10 });

  // Dropdown lists
  const [primaryGodowns, setPrimaryGodowns] = useState([]);
  const [retailGodowns, setRetailGodowns] = useState([]);
  const [products, setProducts] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [destFilter, setDestFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);


  // Create Transfer Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    source_godown_id: '',
    destination_godown_id: '',
    quantity: '',
    remarks: '',
  });

  useEffect(() => {
    async function loadDropdowns() {
      try {
        const [gRes, pRes] = await Promise.all([
          godownService.getGodowns({ per_page: 100 }),
          productService.getProducts({ per_page: 100 }),
        ]);

        const allGodowns = gRes.data?.items || [];
        setPrimaryGodowns(allGodowns.filter((g) => g.type === 'PRIMARY'));
        setRetailGodowns(allGodowns.filter((g) => g.type === 'RETAIL' || g.type === 'RELATIVE'));
        setProducts(pRes.data?.items || []);
      } catch {
        // Fallback
      }
    }
    loadDropdowns();
  }, []);

  const fetchTransfers = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await transferService.getTransfers({
        page,
        per_page: 10,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        source_godown_id: sourceFilter || undefined,
        destination_godown_id: destFilter || undefined,
      });
      setTransfers(res.data?.items || []);
      setPagination(res.data?.pagination || { current_page: 1, last_page: 1, total: 0, per_page: 10 });
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load transfer requests.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, sourceFilter, destFilter]);

  useEffect(() => {
    fetchTransfers(1);
  }, [fetchTransfers]);

  const handleOpenCreate = () => {
    setFormData({
      product_id: products[0]?.id || '',
      source_godown_id: primaryGodowns[0]?.id || '',
      destination_godown_id: retailGodowns[0]?.id || '',
      quantity: '',
      remarks: '',
    });
    setIsModalOpen(true);
  };

  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    if (!formData.product_id || !formData.source_godown_id || !formData.destination_godown_id || !formData.quantity) {
      toast.error('Please complete all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      await transferService.createTransfer({
        product_id: Number(formData.product_id),
        source_godown_id: Number(formData.source_godown_id),
        destination_godown_id: Number(formData.destination_godown_id),
        quantity: Number(formData.quantity),
        remarks: formData.remarks || undefined,
      });

      toast.success('Transfer request submitted and awaiting supervisor approval.');
      setIsModalOpen(false);
      fetchTransfers(1);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to create transfer request.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      let exportData = transfers;
      try {
        const res = await transferService.getTransfers({
          per_page: 2000,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          source_godown_id: sourceFilter || undefined,
          destination_godown_id: destFilter || undefined,
        });
        if (res?.data?.items && res.data.items.length > 0) {
          exportData = res.data.items;
        }
      } catch (e) {
        console.warn('Fallback to loaded page transfers for CSV export:', e);
      }

      if (!exportData || exportData.length === 0) {
        toast.warning('No transfer records found to export with currently applied filters.');
        return;
      }

      const headers = [
        { key: 'transfer_id', label: 'Transfer ID' },
        { key: 'date', label: 'Date' },
        { key: 'product', label: 'Product' },
        { key: 'source', label: 'Source (Primary)' },
        { key: 'destination', label: 'Destination (Retail)' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'unit', label: 'Unit' },
        { key: 'requester', label: 'Requester' },
        { key: 'status', label: 'Status' },
        { key: 'remarks', label: 'Remarks' },
      ];
      const data = exportData.map((t) => ({
        transfer_id: String(t.transfer_number || t.id).replace(/^#+/, ''),
        date: t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
        product: t.product?.name || '',
        source: t.source_godown?.name || '',
        destination: t.destination_godown?.name || '',
        quantity: t.quantity || 0,
        unit: t.product?.unit || '',
        requester: t.requester?.name || '',
        status: t.status || '',
        remarks: t.remarks || '',
      }));

      exportToCSV('stock_transfers_export', headers, data);
      toast.success(`Exported ${exportData.length} filtered transfer records.`);
    } catch (err) {
      toast.error(err.message || 'Failed to export CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Stock Transfers"
        description="Transfer inventory from Primary central hubs to Retail regional distribution godowns."
      >
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExportCSV}
            loading={isExporting}
            className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-200"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV
          </Button>
          <Button onClick={handleOpenCreate}>
            + New Transfer Request
          </Button>
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Input
          placeholder="Search by transfer # or remarks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
        <Select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          placeholder="All Primary Sources"
          options={primaryGodowns.map((g) => ({ value: g.id, label: g.name }))}
        />
        <Select
          value={destFilter}
          onChange={(e) => setDestFilter(e.target.value)}
          placeholder="All Retail Destinations"
          options={retailGodowns.map((g) => ({ value: g.id, label: g.name }))}
        />
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Spinner size="lg" className="text-blue-600" />
          </div>
        ) : error ? (
          <div className="p-6">
            <ErrorState message={error} onRetry={() => fetchTransfers(pagination.current_page)} />
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No transfers found"
              description="No transfer requests match the selected filters."
              actionLabel="+ New Transfer Request"
              onAction={handleOpenCreate}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Transfer ID</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Product</th>
                  <th className="px-6 py-3.5">Source (Primary)</th>
                  <th className="px-6 py-3.5">Destination (Retail)</th>
                  <th className="px-6 py-3.5 text-right">Quantity</th>
                  <th className="px-6 py-3.5">Requester</th>
                  <th className="px-6 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map((t) => {
                  const cleanTransferId = String(t.transfer_number || t.id).replace(/^#+/, '');
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">{cleanTransferId}</td>
                      <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">{t.product?.name}</td>
                      <td className="px-6 py-4 text-slate-700">{t.source_godown?.name}</td>
                      <td className="px-6 py-4 text-slate-700">{t.destination_godown?.name}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        {t.quantity} <span className="text-xs text-slate-500 font-normal">{t.product?.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">{t.requester?.name || 'Worker'}</td>
                      <td className="px-6 py-4">
                        <Badge variant={t.status}>
                          {t.status}
                        </Badge>
                        {t.status === 'REJECTED' && t.rejection_reason && (
                          <div className="text-[11px] text-rose-600 mt-1 italic">
                            Reason: {t.rejection_reason}
                          </div>
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
          lastPage={pagination.last_page}
          total={pagination.total}
          perPage={pagination.per_page}
          onPageChange={fetchTransfers}
        />
      </div>

      {/* New Transfer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Stock Transfer Request"
        subtitle="Transfer goods from a primary godown to a retail godown."
      >
        <form onSubmit={handleSubmitTransfer} className="space-y-4">
          <Select
            label="Product"
            name="product_id"
            required
            value={formData.product_id}
            onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
            options={products.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.code})`,
            }))}
          />

          <Select
            label="Source Primary Godown"
            name="source_godown_id"
            required
            value={formData.source_godown_id}
            onChange={(e) => setFormData({ ...formData, source_godown_id: e.target.value })}
            options={primaryGodowns.map((g) => ({
              value: g.id,
              label: `${g.name} [PRIMARY]`,
            }))}
            helperText="Transfers can strictly originate from PRIMARY godowns only."
          />

          <Select
            label="Destination Retail Godown"
            name="destination_godown_id"
            required
            value={formData.destination_godown_id}
            onChange={(e) => setFormData({ ...formData, destination_godown_id: e.target.value })}
            options={retailGodowns.map((g) => ({
              value: g.id,
              label: `${g.name} [RETAIL]`,
            }))}
            helperText="Transfers can strictly deliver to RETAIL godowns only."
          />

          <Input
            label="Transfer Quantity"
            name="quantity"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="e.g. 50"
            value={formData.quantity}
            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
          />

          <Input
            label="Remarks / Dispatch Notes"
            name="remarks"
            placeholder="e.g. Truck dispatch ref #4401"
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
          />

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 leading-relaxed">
            <strong>Safety Verification:</strong> When a supervisor approves this request, the backend executes an atomic transaction with row locking to ensure source inventory availability and eliminate negative stock risk.
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Submit Transfer Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

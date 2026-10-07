import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import transferService from '../../services/transferService';
import workerStockService from '../../services/workerStockService';
import { extractErrorMessage, extractItems } from '../../services/api';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import MaterialIssueSlipModal from '../../components/workerStock/MaterialIssueSlipModal';
import { exportToCSV } from '../../utils/csvExport';
import { formatIndianPhone } from '../../utils/phoneUtils';
import {
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeftRight,
  UserCheck,
  Package,
  FileText,
  Clock,
  ShieldAlert,
  Building,
  Calendar,
} from 'lucide-react';
import { Download } from 'lucide-react';

export default function ApprovalCenter({ initialTab = 'worker_stock' }) {
  const { user, isAdmin, isSupervisor, isManager } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState(initialTab || 'worker_stock');
  const [loading, setLoading] = useState(false);

  // Lists
  const [transfers, setTransfers] = useState([]);
  const [workerRequests, setWorkerRequests] = useState([]);

  // Counts for tabs
  const [pendingCounts, setPendingCounts] = useState({
    transfers: 0,
    worker_stock: 0,
  });

  // Modals state
  const [approvalModal, setApprovalModal] = useState({
    isOpen: false,
    type: null, // 'transfer' | 'worker_stock'
    item: null,
    remarks: '',
    signature: '',
    confirmedCheck: false,
    loading: false,
  });

  const [rejectionModal, setRejectionModal] = useState({
    isOpen: false,
    type: null, // 'transfer' | 'worker_stock'
    item: null,
    reason: '',
    loading: false,
  });

  // Printable Slip state
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [slipRequest, setSlipRequest] = useState(null);

  // Fetch Pending Items
  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const [trRes, wsRes] = await Promise.allSettled([
        transferService.getTransfers({ status: 'PENDING', per_page: 100 }),
        workerStockService.getRequests({ status: 'PENDING', per_page: 100 }),
      ]);

      const trItems = trRes.status === 'fulfilled' ? extractItems(trRes.value) : [];
      const wsItems = wsRes.status === 'fulfilled' ? extractItems(wsRes.value) : [];

      setTransfers(trItems);
      setWorkerRequests(wsItems);

      setPendingCounts({
        transfers: trItems.length,
        worker_stock: wsItems.length,
      });
    } catch (err) {
      console.error('Failed to load pending queue:', err);
      toast.error('Failed to refresh approval queue.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Handle Approve Action
  const handleApproveConfirm = async () => {
    const { type, item, remarks } = approvalModal;
    if (!item) return;

    setApprovalModal((prev) => ({ ...prev, loading: true }));
    try {
      if (type === 'transfer') {
        await transferService.approveTransfer(item.id, remarks);
        const cleanTrNum = String(item.transfer_number || item.id).replace(/^#+/, '');
        toast.success(`Transfer ${cleanTrNum} approved successfully.`);
      } else if (type === 'worker_stock') {
        const signature =
          approvalModal.signature?.trim() ||
          (user?.name ? `${user.name} (Manager Sign-off)` : 'Manager Sign-off');
        const res = await workerStockService.approveRequest(item.id, {
          manager_signature: signature,
          remarks: remarks,
        });
        const cleanReqNum = String(item.request_number || item.id).replace(/^#+/, '');
        toast.success(`Worker Stock Request ${cleanReqNum} approved and documentation signed!`);
        // Open printable slip modal for approved issue request with freshly signed data
        const approvedItem = res.data || { ...item, status: 'APPROVED', manager_signature: signature };
        setSlipRequest(approvedItem);
        setSlipModalOpen(true);
      }
      setApprovalModal({
        isOpen: false,
        type: null,
        item: null,
        remarks: '',
        signature: '',
        confirmedCheck: false,
        loading: false,
      });
      fetchApprovals();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to approve request.');
      toast.error(msg);
      setApprovalModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Handle Reject Action
  const handleRejectConfirm = async () => {
    const { type, item, reason } = rejectionModal;
    if (!item) return;

    if (!reason.trim()) {
      toast.error('Please specify a rejection reason.');
      return;
    }

    setRejectionModal((prev) => ({ ...prev, loading: true }));
    try {
      if (type === 'transfer') {
        await transferService.rejectTransfer(item.id, reason);
        const cleanTrNum = String(item.transfer_number || item.id).replace(/^#+/, '');
        toast.success(`Transfer ${cleanTrNum} rejected.`);
      } else if (type === 'worker_stock') {
        await workerStockService.rejectRequest(item.id, reason);
        const cleanReqNum = String(item.request_number || item.id).replace(/^#+/, '');
        toast.success(`Worker Stock Request ${cleanReqNum} rejected.`);
      }
      setRejectionModal({ isOpen: false, type: null, item: null, reason: '', loading: false });
      fetchApprovals();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to reject request.');
      toast.error(msg);
      setRejectionModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const safeTransfers = Array.isArray(transfers) ? transfers : [];
  const safeWorkerRequests = Array.isArray(workerRequests) ? workerRequests : [];

  const isSelfRequest = (item) => {
    const requesterId = item.requested_by?.id || item.created_by_id || item.user_id || item.requester_id;
    return Boolean(requesterId && requesterId === user?.id);
  };

  // CSV Export for active pending approvals
  const handleExportCSV = () => {
    try {
      if (activeTab === 'worker_stock') {
        if (!safeWorkerRequests || safeWorkerRequests.length === 0) {
          toast.warning('No pending worker stock requests found to export.');
          return;
        }
        exportToCSV({
          filename: `Worker_Stock_Approvals_${new Date().toISOString().slice(0, 10)}.csv`,
          columns: [
            { label: 'Voucher ID', format: (r) => String(r.request_number || r.id).replace(/^#+/, '') },
            { label: 'Date', format: (r) => (r.requested_at ? new Date(r.requested_at).toLocaleDateString() : '—') },
            { label: 'Client', format: (r) => r.client?.name || 'General' },
            { label: 'Worker', format: (r) => r.worker?.name || 'Worker' },
            { label: 'Start Date', format: (r) => r.start_date || '—' },
            { label: 'End Date', format: (r) => r.end_date || '—' },
            { label: 'Source Godown', format: (r) => r.source_godown?.name || 'Retail Godown' },
            {
              label: 'Materials',
              format: (r) =>
                Array.isArray(r.items) && r.items.length > 0
                  ? r.items.map((i) => `${i.product?.name || 'Material'} (${i.quantity})`).join('; ')
                  : `${r.product?.name || 'Material'} (${r.quantity})`,
            },
            { label: 'Requested By', format: (r) => r.requested_by?.name || 'Supervisor' },
            { label: 'Status', key: 'status' },
          ],
          data: safeWorkerRequests,
        });
        toast.success(`Exported ${safeWorkerRequests.length} pending worker approvals.`);
      } else {
        if (!safeTransfers || safeTransfers.length === 0) {
          toast.warning('No pending godown transfers found to export.');
          return;
        }
        exportToCSV({
          filename: `Godown_Transfer_Approvals_${new Date().toISOString().slice(0, 10)}.csv`,
          columns: [
            { label: 'Transfer ID', format: (t) => String(t.transfer_number || t.id).replace(/^#+/, '') },
            { label: 'Date', format: (t) => (t.created_at ? new Date(t.created_at).toLocaleDateString() : '—') },
            { label: 'Source Godown', format: (t) => t.source_godown?.name || 'Primary Godown' },
            { label: 'Destination Godown', format: (t) => t.destination_godown?.name || 'Retail Godown' },
            { label: 'Product', format: (t) => t.product?.name || 'Product' },
            { label: 'Quantity', key: 'quantity' },
            { label: 'Requested By', format: (t) => t.requested_by?.name || t.requester?.name || 'Staff' },
            { label: 'Status', key: 'status' },
          ],
          data: safeTransfers,
        });
        toast.success(`Exported ${safeTransfers.length} pending transfer approvals.`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to export CSV.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        subtitle="Review, verify, and authorize pending worker material allocations and inter-godown transfers."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleExportCSV} className="text-xs font-semibold cursor-pointer">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={fetchApprovals} loading={loading}>
              Refresh Queue
            </Button>
          </div>
        }
      />

      {/* Info notice about stock entry approvals being handled in Stock Procurement */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-center justify-between text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong>Note:</strong> Stock inward entry requests are managed and approved under{' '}
            <strong className="underline">Stock Procurement → Stock List Approval</strong>.
          </span>
        </div>
      </div>

      {/* Tab Navigation: Worker Stock Allocations & Godown Transfers */}
      <div className="flex border-b border-gray-200 bg-white px-4 pt-2 rounded-t-lg shadow-xs">
        <button
          onClick={() => setActiveTab('worker_stock')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'worker_stock'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Worker Stock Allocations</span>
          {pendingCounts.worker_stock > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-semibold">
              {pendingCounts.worker_stock}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-all cursor-pointer ${
            activeTab === 'transfers'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>Godown Transfers</span>
          {pendingCounts.transfers > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-semibold">
              {pendingCounts.transfers}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Worker Stock Allocations */}
      {activeTab === 'worker_stock' && (
        <div className="bg-white rounded-b-lg shadow-xs border border-t-0 border-gray-200 overflow-hidden">
          {safeWorkerRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-900">All clear!</p>
              <p className="text-sm">There are no pending worker stock allocation requests awaiting authorization.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left">Voucher ID</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Client Project</th>
                    <th className="px-5 py-3 text-left">Worker</th>
                    <th className="px-5 py-3 text-left">Materials & Quantity</th>
                    <th className="px-5 py-3 text-left">Source Warehouse</th>
                    <th className="px-5 py-3 text-left">Requested By</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {safeWorkerRequests.map((req) => {
                    const self = isSelfRequest(req);
                    const cleanReqId = String(req.request_number || req.id).replace(/^#+/, '');
                    const hasItems = Array.isArray(req.items) && req.items.length > 0;
                    return (
                      <tr key={req.id} className="hover:bg-gray-50/70">
                        <td className="px-5 py-3.5 font-mono font-medium text-blue-700 text-xs">
                          {cleanReqId}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap text-xs">
                          {req.requested_at ? new Date(req.requested_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          {req.client ? (
                            <div>
                              <span className="font-semibold text-gray-900 flex items-center gap-1">
                                <Building className="w-3 h-3 text-indigo-600" />
                                {req.client.name}
                              </span>
                              <span className="text-xs text-gray-500 block">
                                {req.work_location || req.client.location || 'Site Location'}
                              </span>
                              {(req.start_date || req.end_date) && (
                                <span className="text-[11px] text-indigo-700 font-medium flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-3 h-3 text-indigo-500" />
                                  {req.start_date || '—'} → {req.end_date || '—'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Direct Allocation</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-gray-900">{req.worker?.name || 'Worker'}</span>
                          <span className="text-xs text-gray-500 block">
                            EMP-{req.worker?.id || '—'} • {formatIndianPhone(req.worker?.phone)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {hasItems ? (
                            <div className="space-y-0.5">
                              <span className="inline-block bg-blue-50 text-blue-800 text-xs px-2 py-0.5 rounded font-semibold border border-blue-200">
                                {req.items.length} Products Assigned
                              </span>
                              <div className="text-xs text-gray-600 truncate max-w-xs" title={req.items.map(i => `${i.product?.name}: ${i.quantity}`).join(', ')}>
                                {req.items.map(i => `${i.product?.name || 'Item'} (${i.quantity})`).join(', ')}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="font-medium text-gray-900">{req.product?.name || 'Material'}</span>
                              <span className="text-xs text-gray-700 block font-bold text-blue-900">
                                {req.quantity} {req.product?.unit || 'units'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-700">
                          <span className="font-medium">{req.source_godown?.name || 'Retail Godown'}</span>
                          <span className="text-[11px] text-gray-400 block">{req.source_godown?.location}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <span className="text-gray-900 font-medium">{req.requested_by?.name || req.requester?.name || 'Supervisor'}</span>
                          {self && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                              (You)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {self ? (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded inline-flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Self-Approval Blocked
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                setApprovalModal({
                                  isOpen: true,
                                  type: 'worker_stock',
                                  item: req,
                                  remarks: '',
                                  signature: user?.name ? `${user.name} (Approved)` : '',
                                  confirmedCheck: false,
                                  loading: false,
                                })
                              }
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setRejectionModal({
                                isOpen: true,
                                type: 'worker_stock',
                                item: req,
                                reason: '',
                                loading: false,
                              })
                            }
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold transition cursor-pointer"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Godown Transfers */}
      {activeTab === 'transfers' && (
        <div className="bg-white rounded-b-lg shadow-xs border border-t-0 border-gray-200 overflow-hidden">
          {safeTransfers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-900">All clear!</p>
              <p className="text-sm">There are no pending stock transfer requests awaiting approval.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left">Transfer ID</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Origin → Destination</th>
                    <th className="px-5 py-3 text-left">Product</th>
                    <th className="px-5 py-3 text-left">Quantity</th>
                    <th className="px-5 py-3 text-left">Requested By</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {safeTransfers.map((tr) => {
                    const self = isSelfRequest(tr);
                    const cleanTransferId = String(tr.transfer_number || tr.id).replace(/^#+/, '');
                    return (
                      <tr key={tr.id} className="hover:bg-gray-50/70">
                        <td className="px-5 py-3.5 font-mono font-medium text-blue-700 text-xs">
                          {cleanTransferId}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap text-xs">
                          {tr.created_at ? new Date(tr.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="font-semibold text-gray-900">{tr.source_godown?.name || 'Primary'}</span>
                            <ArrowRight className="w-3 h-3 text-gray-400" />
                            <span className="font-semibold text-gray-900">{tr.destination_godown?.name || 'Retail'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs font-medium text-gray-900">
                          {tr.product?.name || `Product #${tr.product_id}`}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-bold text-blue-900">
                          {tr.quantity} {tr.product?.unit || 'units'}
                        </td>
                        <td className="px-5 py-3.5 text-xs">
                          <span className="text-gray-900 font-medium">{tr.requester?.name || tr.requested_by?.name || 'Staff'}</span>
                          {self && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
                              (You)
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {self ? (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded inline-flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Self-Approval Blocked
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                setApprovalModal({
                                  isOpen: true,
                                  type: 'transfer',
                                  item: tr,
                                  remarks: '',
                                  loading: false,
                                })
                              }
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setRejectionModal({
                                isOpen: true,
                                type: 'transfer',
                                item: tr,
                                reason: '',
                                loading: false,
                              })
                            }
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold transition cursor-pointer"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Approve Modal with Manager Sign-off & Warnings */}
      <Modal
        isOpen={approvalModal.isOpen}
        onClose={() => setApprovalModal((prev) => ({ ...prev, isOpen: false }))}
        title={
          approvalModal.type === 'worker_stock'
            ? 'Authorize Worker Stock Allocation'
            : 'Approve Warehouse Stock Transfer'
        }
        subtitle="Verification & digital authorization lifecycle"
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Permanent Inventory Transaction</p>
              <p className="mt-0.5">
                Approving this request will immediately deduct items from the warehouse inventory and assign custody.
              </p>
            </div>
          </div>

          {approvalModal.type === 'worker_stock' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Manager / Authorizer Sign-off Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={approvalModal.signature}
                onChange={(e) => setApprovalModal((prev) => ({ ...prev, signature: e.target.value }))}
                placeholder="e.g. John Doe (Manager Operations)"
                className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Approval Notes / Remarks</label>
            <textarea
              rows={2}
              value={approvalModal.remarks}
              onChange={(e) => setApprovalModal((prev) => ({ ...prev, remarks: e.target.value }))}
              placeholder="Optional remarks regarding this handover..."
              className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setApprovalModal((prev) => ({ ...prev, isOpen: false }))}
              disabled={approvalModal.loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApproveConfirm}
              loading={approvalModal.loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Confirm & Authorize
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        isOpen={rejectionModal.isOpen}
        onClose={() => setRejectionModal((prev) => ({ ...prev, isOpen: false }))}
        title="Reject Inventory Request"
        subtitle="Mandatory written reason required"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={rejectionModal.reason}
              onChange={(e) => setRejectionModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Specify clear justification for rejecting this request..."
              className="w-full border border-gray-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRejectionModal((prev) => ({ ...prev, isOpen: false }))}
              disabled={rejectionModal.loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleRejectConfirm}
              loading={rejectionModal.loading}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Material Issue Slip Modal (Voucher printable / downloadable) */}
      <MaterialIssueSlipModal
        isOpen={slipModalOpen}
        onClose={() => setSlipModalOpen(false)}
        request={slipRequest}
      />
    </div>
  );
}

import React, { useState } from 'react';
import {
  Printer,
  X,
  CheckCircle,
  Package,
  User,
  MapPin,
  FileText,
  PenTool,
  ShieldCheck,
  Clock,
  Building,
  Calendar,
  Download,
} from 'lucide-react';
import Button from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import workerStockService from '../../services/workerStockService';
import { extractErrorMessage } from '../../services/api';
import { formatIndianPhone } from '../../utils/phoneUtils';

export default function MaterialIssueSlipModal({ isOpen, onClose, request: initialRequest, onComplete }) {
  const { user, isAdmin, isSupervisor } = useAuth();
  const toast = useToast();

  const [request, setRequest] = useState(initialRequest);
  const [signing, setSigning] = useState(false);
  const [supervisorSig, setSupervisorSig] = useState(user?.name ? `${user.name} (In-Charge)` : 'Supervisor In-Charge');
  const [confirmedCheck, setConfirmedCheck] = useState(false);

  // Sync state if initialRequest prop changes
  React.useEffect(() => {
    setRequest(initialRequest);
    if (user?.name) {
      setSupervisorSig(`${user.name} (In-Charge)`);
    }
  }, [initialRequest, user]);

  if (!isOpen || !request) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSignDocumentation = async () => {
    if (!confirmedCheck) {
      toast.warning('Please check the confirmation box to authorize documentation completion.');
      return;
    }
    if (!supervisorSig.trim()) {
      toast.warning('Please enter your signature / confirmation name.');
      return;
    }

    setSigning(true);
    try {
      const res = await workerStockService.signDocumentation(request.id, supervisorSig.trim());
      const updated = res.data || res;
      setRequest(updated);
      toast.success('Documentation successfully signed and finalized!');
      if (onComplete) {
        onComplete(updated);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to sign documentation.'));
    } finally {
      setSigning(false);
    }
  };

  const cleanReqNum = String(request.request_number || `REQ-${request.id}`).replace(/^#+/, '');
  const workerName = request.worker?.name || request.worker_name || 'Worker';
  const workerId = request.worker?.id ? `EMP-${request.worker.id}` : '—';
  const workerPhone = formatIndianPhone(request.worker?.phone);

  const clientName = request.client?.name || request.client_name || null;
  const clientPhone = formatIndianPhone(request.client?.contact_number);
  const clientLocation = request.work_location || request.client?.location || null;
  const workTitle = request.work_title || null;
  const startDate = request.start_date ? new Date(request.start_date).toLocaleDateString() : null;
  const endDate = request.end_date ? new Date(request.end_date).toLocaleDateString() : null;

  const godownName = request.source_godown?.name || request.godown?.name || 'Retail Warehouse';
  const godownLocation = request.source_godown?.location || 'Operational Site';

  const taskDescription = request.description || request.remarks || 'Standard site operations and material handover.';
  const supervisorRequester = request.requested_by?.name || request.requester?.name || 'Supervisor';
  const supervisorDate = request.requested_at ? new Date(request.requested_at).toLocaleDateString() : new Date().toLocaleDateString();

  const managerName = request.approved_by?.name || request.approver?.name || 'Manager';
  const managerSignature = request.manager_signature || `${managerName} (Approved)`;
  const managerDate = request.manager_signed_at 
    ? new Date(request.manager_signed_at).toLocaleDateString() 
    : request.approved_at ? new Date(request.approved_at).toLocaleDateString() : 'Approved';

  const isCompleted = Boolean(request.is_documentation_completed || request.documentation_completed_at || request.supervisor_signed_at);
  const completedDate = request.documentation_completed_at || request.supervisor_signed_at 
    ? new Date(request.documentation_completed_at || request.supervisor_signed_at).toLocaleDateString() 
    : null;

  // Handle items list: multiple products or single legacy product
  const items = Array.isArray(request.items) && request.items.length > 0 
    ? request.items 
    : [{
        id: 'legacy',
        product: request.product || { name: request.product_name || 'Material', code: request.product_code || '—', unit: request.unit || 'units', purchase_rate: request.purchase_rate || 0 },
        quantity: request.quantity || 1,
      }];

  // Financial Value calculations (Requirements 26 & 27)
  const grandTotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.product?.purchase_rate) || 0;
    return sum + (qty * rate);
  }, 0);

  const canSign = (isAdmin || isSupervisor) && !isCompleted && request.status === 'APPROVED';

  const handleDownload = () => {
    const slipElement = document.getElementById('printable-slip');
    if (!slipElement) return;
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Material Issue Slip ${cleanReqNum}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; background: #fff; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; }
    th { background: #f8fafc; text-transform: uppercase; font-size: 10px; color: #475569; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .bold { font-weight: bold; }
    .border-b { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
  </style>
</head>
<body>
  ${slipElement.innerHTML}
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Material_Issue_Slip_${cleanReqNum.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Material Issue Slip downloaded successfully.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Sticky Header with Always-Visible Close Button */}
        <div className="print:hidden flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <h2 className="text-xs sm:text-sm font-bold tracking-tight">Material Issue Receipt Slip</h2>
              <div className="text-[10px] text-slate-300 font-mono">Voucher {cleanReqNum}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded transition shadow-xs cursor-pointer"
              title="Download Receipt"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded transition shadow-xs cursor-pointer"
              title="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close Receipt"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="overflow-y-auto flex-1 p-3.5 sm:p-4 space-y-3 bg-white text-slate-800">
          
          {/* Supervisor / Admin In-Charge Sign-off Banner (hidden in print) */}
          {canSign && (
            <div className="print:hidden bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <PenTool className="w-3.5 h-3.5 text-amber-600" />
                <span>In-Charge Sign-off Required</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-tight">
                Manager has approved. Enter your sign-off name to finalize documentation.
              </p>
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={supervisorSig}
                  onChange={(e) => setSupervisorSig(e.target.value)}
                  placeholder="In-Charge Signature Name"
                  className="w-full text-xs px-2.5 py-1 border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmedCheck}
                      onChange={(e) => setConfirmedCheck(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-emerald-600"
                    />
                    <span>I confirm final handover</span>
                  </label>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSignDocumentation}
                    disabled={signing || !confirmedCheck}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] py-0.5 px-2.5 h-7 cursor-pointer"
                  >
                    <ShieldCheck className="w-3 h-3 mr-1 inline" />
                    <span>{signing ? 'Saving...' : 'Sign & Complete'}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Printable Official Receipt Slip Container */}
          <div id="printable-slip" className="border border-slate-300 rounded-lg p-3 sm:p-4 bg-white space-y-3 text-xs shadow-xs">
            
            {/* Header: Receipt Title & Status */}
            <div className="border-b border-slate-300 pb-2 flex items-start justify-between">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">
                  Contract Inventory Management
                </span>
                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  MATERIAL ISSUE SLIP
                </h1>
                <div className="text-[10px] text-slate-500 font-mono">
                  Ref: <span className="font-bold text-slate-800">{cleanReqNum}</span>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                  isCompleted ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}>
                  <CheckCircle className="w-3 h-3" />
                  <span>{isCompleted ? 'COMPLETED' : 'APPROVED'}</span>
                </span>
                <div className="text-[10px] text-slate-500 mt-1">
                  Date: {completedDate || managerDate}
                </div>
              </div>
            </div>

            {/* Client & Work Order Box */}
            {clientName ? (
              <div className="bg-indigo-50/70 border border-indigo-200 rounded p-2 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950 uppercase text-[10px] flex items-center gap-1">
                    <Building className="w-3 h-3 text-indigo-600" />
                    <span>Client: {clientName} {clientPhone && clientPhone !== '—' ? `(${clientPhone})` : ''}</span>
                  </span>
                  {(startDate || endDate) && (
                    <span className="text-[10px] text-indigo-700 font-semibold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-indigo-500" />
                      {startDate || '—'} → {endDate || '—'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-700 pt-0.5 border-t border-indigo-100">
                  <div>
                    <span className="text-slate-500">Work / Task:</span>{' '}
                    <span className="font-bold text-slate-900">{workTitle || 'Site Assignment'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Site Location:</span>{' '}
                    <span className="font-bold text-slate-900">{clientLocation || 'On-Site Client Location'}</span>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Compact 2-Column Info: Worker & Godown */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {/* Employee Box */}
              <div className="bg-slate-50 p-2 rounded border border-slate-200 space-y-0.5">
                <div className="font-bold text-slate-500 uppercase text-[9px] flex items-center gap-1">
                  <User className="w-3 h-3 text-blue-600" />
                  <span>Assigned Worker</span>
                </div>
                <div className="font-bold text-slate-900 truncate">{workerName}</div>
                <div className="text-[10px] text-slate-500">ID: {workerId} {workerPhone !== '—' ? `• ${workerPhone}` : ''}</div>
              </div>

              {/* Godown Box */}
              <div className="bg-slate-50 p-2 rounded border border-slate-200 space-y-0.5">
                <div className="font-bold text-slate-500 uppercase text-[9px] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  <span>Source Warehouse</span>
                </div>
                <div className="font-bold text-slate-900 truncate">{godownName}</div>
                <div className="text-[10px] text-slate-500 truncate">{godownLocation}</div>
              </div>
            </div>

            {/* Requirements 26 & 27: Financial Value Table (Material, Quantity, Unit, Unit Price, Total) */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3 text-blue-600" />
                  <span>Materials Issued & Financial Valuation ({items.length})</span>
                </span>
                <span className="font-normal text-slate-400">Warehouse Handover</span>
              </div>

              <div className="border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 text-[10px] uppercase">
                    <tr>
                      <th className="py-1.5 px-2 w-7 text-center">#</th>
                      <th className="py-1.5 px-2">Material / Product</th>
                      <th className="py-1.5 px-2 text-right">Quantity</th>
                      <th className="py-1.5 px-2">Unit</th>
                      <th className="py-1.5 px-2 text-right">Unit Price</th>
                      <th className="py-1.5 px-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => {
                      const prod = item.product || {};
                      const unit = prod.unit || 'units';
                      const qty = Number(item.quantity) || 0;
                      const unitPrice = Number(prod.purchase_rate) || 0;
                      const itemTotal = qty * unitPrice;
                      return (
                        <tr key={item.id || index} className="hover:bg-slate-50/60">
                          <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[10px]">{index + 1}</td>
                          <td className="py-1.5 px-2 font-bold text-slate-900">
                            <div>{prod.name || 'Product'}</div>
                            {prod.code && <div className="text-[10px] font-mono text-slate-400">{prod.code}</div>}
                          </td>
                          <td className="py-1.5 px-2 text-right font-black text-slate-900 whitespace-nowrap">
                            {qty}
                          </td>
                          <td className="py-1.5 px-2 text-slate-600 uppercase text-[10px]">
                            {unit}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-slate-700 whitespace-nowrap">
                            ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-1.5 px-2 text-right font-black text-blue-900 whitespace-nowrap">
                            ₹{itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50/90 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={5} className="py-2 px-2 text-right text-slate-700 uppercase text-[10px] tracking-wider">
                        Total Amount:
                      </td>
                      <td className="py-2 px-2 text-right text-xs font-black text-emerald-800 whitespace-nowrap">
                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Compact Work Description Box */}
            <div className="bg-blue-50/50 border border-blue-200 rounded p-2 text-[11px]">
              <span className="font-bold text-blue-900 uppercase text-[9px] block mb-0.5">
                Description / Assigned Task & Work Description
              </span>
              <p className="text-slate-700 leading-snug font-medium italic">
                "{taskDescription}"
              </p>
            </div>

            {/* Compact 3-Column Signatures */}
            <div className="border-t border-slate-200 pt-2 space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">
                Digital Sign-off & Chain of Custody
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                {/* 1. Supervisor */}
                <div className="border border-slate-200 rounded p-1.5 bg-slate-50/60">
                  <div className="font-semibold text-slate-500 text-[9px] uppercase">1. Assigned By</div>
                  <div className="h-6 flex items-center justify-center font-serif italic font-bold text-slate-800 text-xs truncate px-1">
                    {request.supervisor_signature || supervisorRequester}
                  </div>
                  <div className="border-t border-slate-200 pt-0.5 text-slate-600 font-medium truncate">
                    {supervisorRequester}
                  </div>
                  <div className="text-[8px] text-slate-400">{supervisorDate}</div>
                </div>

                {/* 2. Manager Approval */}
                <div className="border border-emerald-200 rounded p-1.5 bg-emerald-50/40">
                  <div className="font-semibold text-emerald-800 text-[9px] uppercase flex items-center justify-center gap-0.5">
                    <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                    <span>2. Manager Approval</span>
                  </div>
                  <div className="h-6 flex items-center justify-center font-serif italic font-black text-emerald-900 text-xs truncate px-1">
                    {managerSignature}
                  </div>
                  <div className="border-t border-emerald-200 pt-0.5 text-emerald-800 font-bold truncate">
                    {managerName}
                  </div>
                  <div className="text-[8px] text-slate-400">{managerDate}</div>
                </div>

                {/* 3. In-Charge Final Signoff */}
                <div className="border border-slate-200 rounded p-1.5 bg-slate-50/60">
                  <div className="font-semibold text-slate-500 text-[9px] uppercase">3. In-Charge Verification</div>
                  <div className="h-6 flex items-center justify-center font-serif italic font-bold text-blue-900 text-xs truncate px-1">
                    {isCompleted ? (request.supervisor_signature || 'Verified') : 'Pending'}
                  </div>
                  <div className="border-t border-slate-200 pt-0.5 text-slate-600 font-medium truncate">
                    {request.supervisor_signed_by?.name || (isCompleted ? (user?.name || 'In-Charge') : 'Pending')}
                  </div>
                  <div className="text-[8px] text-slate-400">{completedDate || 'Awaiting sign-off'}</div>
                </div>
              </div>
            </div>

            {/* Worker Receipt Acknowledgment footer */}
            <div className="border-t border-dashed border-slate-200 pt-1.5 flex justify-between items-center text-[10px] text-slate-500">
              <span>Worker Receipt: Received in good condition ({workerName})</span>
              <span className="font-mono text-[9px]">Receipt {cleanReqNum}</span>
            </div>
          </div>
        </div>

        {/* Sticky Modal Bottom Bar (hidden in print) */}
        <div className="print:hidden px-4 py-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            {isCompleted ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Fully Completed
              </span>
            ) : (
              <span className="text-amber-700 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Manager Approved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} className="text-xs h-7.5 px-3">
              Close
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="text-xs h-7.5 px-3 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Slip</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7.5 px-3 flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Global Print Styles Injection */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-slip, #printable-slip * {
            visibility: visible;
          }
          #printable-slip {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 12px !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>
    </div>
  );
}

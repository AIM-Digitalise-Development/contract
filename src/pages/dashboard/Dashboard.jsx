import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import godownService from '../../services/godownService';
import productService from '../../services/productService';
import stockService from '../../services/stockService';
import transferService from '../../services/transferService';
import workerStockService from '../../services/workerStockService';
import employeeService from '../../services/employeeService';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import Button from '../../components/common/Button';
import {
  Building2,
  Store,
  Users,
  Layers,
  Briefcase,
  Clock,
  ArrowRight,
  TrendingUp,
  Package,
  Calendar
} from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin, isSupervisor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    primaryGodowns: 0,
    retailGodowns: 0,
    totalProducts: 0,
    totalStockUnits: 0,
    totalWorkers: 0,
    totalWorkerStockHoldings: 0,
    pendingEntries: 0,
    pendingTransfers: 0,
    pendingWorkerAllocations: 0,
  });
  const [recentEntries, setRecentEntries] = useState([]);
  const [recentTransfers, setRecentTransfers] = useState([]);
  const [recentWorkerRequests, setRecentWorkerRequests] = useState([]);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [
          godownsRes,
          productsRes,
          stockRes,
          entriesRes,
          transfersRes,
          workerRes,
          workerStockRes,
          wsRequestsRes,
        ] = await Promise.allSettled([
          godownService.getGodowns({ per_page: 100 }),
          productService.getProducts({ per_page: 100 }),
          stockService.getStock({ per_page: 100 }),
          stockService.getStockEntries({ per_page: 10 }),
          transferService.getTransfers({ per_page: 10 }),
          employeeService.getEmployees({ role: 'worker', per_page: 100 }),
          workerStockService.getWorkerStocks({ per_page: 100 }),
          workerStockService.getRequests({ per_page: 10 }),
        ]);

        const godowns = godownsRes.status === 'fulfilled' ? godownsRes.value.data?.items || [] : [];
        const products = productsRes.status === 'fulfilled' ? productsRes.value.data?.items || [] : [];
        const stocks = stockRes.status === 'fulfilled' ? stockRes.value.data?.items || [] : [];
        const entries = entriesRes.status === 'fulfilled' ? entriesRes.value.data?.items || [] : [];
        const transfers = transfersRes.status === 'fulfilled' ? transfersRes.value.data?.items || [] : [];
        const workers = workerRes.status === 'fulfilled' ? workerRes.value.data?.items || [] : [];
        const workerStocks = workerStockRes.status === 'fulfilled' ? workerStockRes.value.data?.items || [] : [];
        const wsRequests = wsRequestsRes.status === 'fulfilled' ? wsRequestsRes.value.data?.items || [] : [];

        const primaryCount = godowns.filter((g) => g.type === 'PRIMARY').length;
        const retailCount = godowns.filter((g) => g.type === 'RETAIL' || g.type === 'RELATIVE').length;
        const totalUnits = stocks.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        const totalWorkerUnits = workerStocks.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

        const pendingE = entries.filter((e) => e.status === 'PENDING').length;
        const pendingT = transfers.filter((t) => t.status === 'PENDING').length;
        const pendingWS = wsRequests.filter((w) => w.status === 'PENDING').length;

        setStats({
          primaryGodowns: primaryCount,
          retailGodowns: retailCount,
          totalProducts: products.length,
          totalStockUnits: totalUnits,
          totalWorkers: workers.length,
          totalWorkerStockHoldings: totalWorkerUnits,
          pendingEntries: pendingE,
          pendingTransfers: pendingT,
          pendingWorkerAllocations: pendingWS,
        });

        setRecentEntries(entries.slice(0, 5));
        setRecentTransfers(transfers.slice(0, 5));
        setRecentWorkerRequests(wsRequests.slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const totalPending = stats.pendingEntries + stats.pendingTransfers + stats.pendingWorkerAllocations;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Operations Hub"
        subtitle={`Welcome back, ${user?.name || 'Administrator'}. Enterprise warehouse, client assignments, and worker stock overview.`}
        action={
          <div className="flex items-center gap-2">
            <Link to="/workers">
              <Button variant="secondary" size="sm" className="cursor-pointer">
                <Users className="w-4 h-4 mr-1.5" />
                Worker Directory
              </Button>
            </Link>
            {(isAdmin || isSupervisor) && (
              <Link to="/approvals">
                <Button variant="primary" size="sm" className="cursor-pointer bg-blue-600 hover:bg-blue-700">
                  Approval Center ({totalPending})
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Metric Cards Grid - Enhanced Professional Colors */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* 1. Primary Godown - Refined Corporate Blue */}
        <div className="bg-gradient-to-br from-blue-50/90 via-blue-50/30 to-white p-4 rounded-xl border border-blue-200/80 shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900">Primary Godown</span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-blue-950 tracking-tight">
              {loading ? '...' : stats.primaryGodowns}
            </div>
          </div>
          <div className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
            <span>Central Inbound Hubs</span>
          </div>
        </div>

        {/* 2. Retail Godown - Professional Indigo */}
        <div className="bg-gradient-to-br from-indigo-50/90 via-indigo-50/30 to-white p-4 rounded-xl border border-indigo-200/80 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">Retail Godown</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-indigo-950 tracking-tight">
              {loading ? '...' : stats.retailGodowns}
            </div>
          </div>
          <div className="text-[11px] text-indigo-700 font-semibold flex items-center gap-1">
            <span>Site Retail Depots</span>
          </div>
        </div>

        {/* 3. Active Workflows / Workers - Elegant Purple */}
        <div className="bg-gradient-to-br from-purple-50/90 via-purple-50/30 to-white p-4 rounded-xl border border-purple-200/80 shadow-xs hover:shadow-md hover:border-purple-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-900">Active Workflows</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-purple-950 tracking-tight">
              {loading ? '...' : stats.totalWorkers}
            </div>
          </div>
          <div className="text-[11px] text-purple-700 font-semibold flex items-center gap-1">
            <span>Active Field Workers</span>
          </div>
        </div>

        {/* 4. Godown Stocks You Need - Vitalizing Emerald */}
        <div className="bg-gradient-to-br from-emerald-50/90 via-emerald-50/30 to-white p-4 rounded-xl border border-emerald-200/80 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">Godown Stocks You Need</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-emerald-700 tracking-tight">
              {loading ? '...' : stats.totalStockUnits.toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <span>Available in Warehouses</span>
          </div>
        </div>

        {/* 5. Work Stocks You Need - Modern Teal */}
        <div className="bg-gradient-to-br from-teal-50/90 via-teal-50/30 to-white p-4 rounded-xl border border-teal-200/80 shadow-xs hover:shadow-md hover:border-teal-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-900">Work Stocks You Need</span>
            <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-teal-800 tracking-tight">
              {loading ? '...' : stats.totalWorkerStockHoldings.toLocaleString()}
            </div>
          </div>
          <div className="text-[11px] text-teal-700 font-semibold flex items-center gap-1">
            <span>Active Worker Holdings</span>
          </div>
        </div>

        {/* 6. Pending Approvals - Crisp Warm Amber */}
        <div className="bg-gradient-to-br from-amber-50/90 via-amber-50/30 to-white p-4 rounded-xl border border-amber-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all duration-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Pending Approvals</span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-amber-700 tracking-tight">
              {loading ? '...' : totalPending}
            </div>
          </div>
          <div className="text-[11px] text-amber-800 font-semibold flex items-center gap-1">
            <span>Awaiting Review</span>
          </div>
        </div>
      </div>

      {/* Supervisor/Admin Alert for Pending Approvals */}
      {(isAdmin || isSupervisor) && totalPending > 0 && (
        <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 flex items-center justify-between flex-wrap gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
              <Clock className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-950">
                Action Required: {totalPending} inventory requests awaiting supervisor/manager review
              </div>
              <div className="text-xs text-amber-800 mt-0.5">
                {stats.pendingEntries} stock entry submissions, {stats.pendingTransfers} inter-godown transfers, and {stats.pendingWorkerAllocations} worker stock requests pending verification.
              </div>
            </div>
          </div>
          <Link to="/approvals">
            <Button size="sm" variant="primary" className="bg-amber-600 hover:bg-amber-700 cursor-pointer">
              Open Approval Center &rarr;
            </Button>
          </Link>
        </div>
      )}

      {/* Three-column activity tables (Applied Rule: ID -> Date -> Other Information, no # symbol) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Recent Stock Entries */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent Inbound Entries</h2>
            <Link to="/stock" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Spinner size="md" className="text-blue-600" />
              </div>
            ) : recentEntries.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No recent stock entry requests</div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Entry ID</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 font-medium text-slate-900 font-mono">
                        {(e.entry_number || `ENTRY-${e.id}`).replace(/^#/, '')}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {e.created_at ? new Date(e.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2.5 truncate max-w-[120px]" title={e.product?.name}>
                        {e.product?.name || `Product ${e.product_id}`}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{e.quantity}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Badge variant={e.status} size="xs">
                          {e.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 2. Recent Transfers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent Transfers</h2>
            <Link to="/transfers" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Spinner size="md" className="text-blue-600" />
              </div>
            ) : recentTransfers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No recent transfers</div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Transfer ID</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Movement</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 font-medium text-slate-900 font-mono">
                        {(t.transfer_number || `TR-${t.id}`).replace(/^#/, '')}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2.5 truncate max-w-[130px]">
                        <span className="text-slate-900 font-medium">{t.source_godown?.name}</span>
                        <span className="text-slate-400 mx-1">&rarr;</span>
                        <span className="text-slate-700">{t.destination_godown?.name}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{t.quantity}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Badge variant={t.status} size="xs">
                          {t.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 3. Recent Worker Stock Allocations */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Worker Allocations</h2>
            <Link to="/worker-stock" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Spinner size="md" className="text-blue-600" />
              </div>
            ) : recentWorkerRequests.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No recent worker stock requests</div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2.5">Voucher ID</th>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Worker</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentWorkerRequests.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 font-medium text-slate-900 font-mono">
                        {(w.request_number || `REQ-${w.id}`).replace(/^#/, '')}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                        {w.created_at ? new Date(w.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 truncate max-w-[120px]">
                        {w.worker?.name || 'Worker'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{w.quantity}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Badge variant={w.status} size="xs">
                          {w.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

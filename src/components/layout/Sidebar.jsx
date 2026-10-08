import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import stockService from '../../services/stockService';
import transferService from '../../services/transferService';
import workerStockService from '../../services/workerStockService';

export default function Sidebar({ isOpen, onClose }) {
  const { isAdmin, isSupervisor, isManager } = useAuth();
  const [pendingTotal, setPendingTotal] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadPendingCount() {
      if (!isAdmin && !isSupervisor && !isManager) return;
      try {
        const [seRes, trRes, wsRes] = await Promise.allSettled([
          stockService.getStockEntries({ status: 'PENDING', per_page: 1 }),
          transferService.getTransfers({ status: 'PENDING', per_page: 1 }),
          workerStockService.getRequests({ status: 'PENDING', per_page: 1 }),
        ]);

        const seCount = seRes.status === 'fulfilled' ? seRes.value.data?.pagination?.total || 0 : 0;
        const trCount = trRes.status === 'fulfilled' ? trRes.value.data?.pagination?.total || 0 : 0;
        const wsCount = wsRes.status === 'fulfilled' ? wsRes.value.data?.pagination?.total || 0 : 0;

        if (isMounted) {
          setPendingTotal(seCount + trCount + wsCount);
        }
      } catch {
        // silent
      }
    }

    loadPendingCount();
    const interval = setInterval(loadPendingCount, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdmin, isSupervisor, isManager]);

  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      show: true,
    },
    {
      name: 'Master Entry',
      path: '/master-entry',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
      show: true,
    },
    {
      name: 'Stock Procurement',
      path: '/stock',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      show: true,
    },
    {
      name: 'Stock Transfer',
      path: '/transfers',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      show: true,
    },
    {
      name: 'Approvals',
      path: '/approvals',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      show: isAdmin || isSupervisor || isManager,
      badge: pendingTotal > 0 ? pendingTotal : null,
      highlight: pendingTotal > 0,
    },
    {
      name: 'Stock Assign',
      path: '/workers',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      show: true,
    },
    {
      name: 'Audit Entry',
      path: '/audit-entry',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      show: true,
    },
    {
      name: 'Audit Trail',
      path: '/audit-logs',
      icon: (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      show: isAdmin,
    },
  ];

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col justify-between`}
      >
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Main Navigation
          </div>
          <nav className="space-y-1">
            {navItems
              .filter((item) => item.show)
              .map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : item.highlight
                        ? 'text-amber-700 bg-amber-50/70 hover:bg-amber-100/70'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="rounded-lg bg-blue-50/70 p-3 border border-blue-100 text-xs text-blue-900">
            <span className="font-semibold block mb-0.5">Inchworm Creational LLP</span>
            <span className="text-[11px] text-blue-700">Inventory Operations Portal</span>
          </div>
        </div>
      </aside>
    </>
  );
}

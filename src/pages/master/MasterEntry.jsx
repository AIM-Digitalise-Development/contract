import React from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import GodownList from '../godowns/GodownList';
import ProductList from '../products/ProductList';
import EmployeeList from '../employees/EmployeeList';
import ClientList from '../clients/ClientList';
import {
  Building2,
  Package,
  Users,
  Briefcase
} from 'lucide-react';

export default function MasterEntry() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'godown'; // Default to first tab (Godown)

  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  // Reorganized: Godown (1st), Product (2nd), Employee (3rd), Client Entry (Last)
  const tabs = [
    {
      key: 'godown',
      name: 'Godown Entry',
      shortName: 'Godown',
      description: 'Manage Primary hubs and Retail warehouses',
      icon: <Building2 className="w-5 h-5 shrink-0" />,
      activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border-emerald-600',
      activeIconBg: 'bg-emerald-700/90 text-white',
      activeBadge: 'bg-emerald-500/40 text-emerald-100',
      activeSubtext: 'text-emerald-100',
      hoverClass: 'hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-700',
      iconBg: 'bg-emerald-100 text-emerald-700',
      borderColor: 'border-emerald-200/80',
    },
    {
      key: 'product',
      name: 'Product Entry',
      shortName: 'Product',
      description: 'Define SKU inventory items and procurement info',
      icon: <Package className="w-5 h-5 shrink-0" />,
      activeClass: 'bg-amber-600 text-white shadow-md shadow-amber-600/25 border-amber-600',
      activeIconBg: 'bg-amber-700/90 text-white',
      activeBadge: 'bg-amber-500/40 text-amber-100',
      activeSubtext: 'text-amber-100',
      hoverClass: 'hover:border-amber-300 hover:bg-amber-50/40 text-slate-700',
      iconBg: 'bg-amber-100 text-amber-800',
      borderColor: 'border-amber-200/80',
    },
    {
      key: 'employee',
      name: 'Employee Entry',
      shortName: 'Employees',
      description: 'Configure admins, supervisors, and workers',
      icon: <Users className="w-5 h-5 shrink-0" />,
      activeClass: 'bg-purple-600 text-white shadow-md shadow-purple-600/25 border-purple-600',
      activeIconBg: 'bg-purple-700/90 text-white',
      activeBadge: 'bg-purple-500/40 text-purple-100',
      activeSubtext: 'text-purple-100',
      hoverClass: 'hover:border-purple-300 hover:bg-purple-50/40 text-slate-700',
      iconBg: 'bg-purple-100 text-purple-700',
      borderColor: 'border-purple-200/80',
    },
    {
      key: 'client',
      name: 'Client Entry',
      shortName: 'Clients',
      description: 'Manage clients, work sites, and project materials',
      icon: <Briefcase className="w-5 h-5 shrink-0" />,
      activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-600/25 border-blue-600',
      activeIconBg: 'bg-blue-700/90 text-white',
      activeBadge: 'bg-blue-500/40 text-blue-100',
      activeSubtext: 'text-blue-100',
      hoverClass: 'hover:border-blue-300 hover:bg-blue-50/40 text-slate-700',
      iconBg: 'bg-blue-100 text-blue-700',
      borderColor: 'border-blue-200/80',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Entry Management"
        description="Unified master record portal for enterprise godowns, product catalog, personnel directory, and client accounts."
      />

      {/* Tabs navigation bar with distinct professional colors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 border cursor-pointer ${
                isActive
                  ? tab.activeClass
                  : `bg-white ${tab.borderColor} ${tab.hoverClass} shadow-2xs`
              }`}
            >
              <div
                className={`p-2.5 rounded-lg shrink-0 transition-colors ${
                  isActive ? tab.activeIconBg : tab.iconBg
                }`}
              >
                {tab.icon}
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-sm leading-tight truncate">{tab.name}</span>
                  <span
                    className={`text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                      isActive ? tab.activeBadge : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.shortName}
                  </span>
                </div>
                <div
                  className={`text-xs mt-1 leading-snug line-clamp-1 ${
                    isActive ? tab.activeSubtext : 'text-slate-500'
                  }`}
                >
                  {tab.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
        {currentTab === 'godown' && <GodownList embedded={true} />}
        {currentTab === 'product' && <ProductList embedded={true} />}
        {currentTab === 'employee' && <EmployeeList embedded={true} />}
        {currentTab === 'client' && <ClientList embedded={true} />}
      </div>
    </div>
  );
}

# Contract Inventory & Godown Management System — React Frontend

A modern, responsive Single Page Application built with **React 19**, **Vite**, **Tailwind CSS 4**, **React Router 7**, and **Axios**.

---

## 🎨 Design Theme & System

- **Color Palette**: Clean White & Blue corporate business theme
  - Primary Action: `blue-600` / `blue-700`
  - Page Background: `slate-50`
  - Cards & Panels: `white` with subtle `slate-200` borders and `2xs` shadows
  - Badges: `emerald` (Active/Approved), `amber` (Pending), `rose` (Rejected/Inactive), `blue` (Primary/Admin), `indigo` (Relative/Supervisor)
- **Responsive Layout**:
  - Desktop: Collapsible sidebar navigation, high-density data tables, overview KPI metrics
  - Mobile & Tablet: Drawer slide-out navigation, stacked forms, responsive tables

---

## 🧭 Pages & Modules

- **Authentication**: Sign in with form validation, password visibility toggle, error banners, and demo auto-fill shortcuts
- **Dashboard**: Role-aware KPI summary cards, supervisor approval alert banners, and recent activity feeds
- **Godowns**: Overview of Primary & Relative storage facilities, type indicators, location, and on-hand inventory breakdown modal
- **Products**: Catalog management with SKUs, measurement units, and descriptions
- **Stock Ledger**:
  - *Approved Stock Overview*: Verified available on-hand quantities per godown and product
  - *Stock Entry Requests*: Queue of inbound submissions with requester, location, and approval state
  - *Transaction History*: Ledger audit showing previous balance, delta, and new balance
- **Transfers**: Inter-godown transfers from PRIMARY central hubs to RELATIVE regional distribution points
- **Supervisor Approval Center**: Dedicated review dashboard for approving or rejecting pending stock entries and transfers (rejections require mandatory reasons)
- **Staff & Workers**: Staff administration, role assignments, and supervisor-worker assignment configuration

---

## 🚀 Getting Started

### 1. Environment Configuration

Create `.env` in the root:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

### 2. Development Commands

```bash
# Start Vite development server
npm run dev

# Build production bundle
npm run build
```

---

## 🔑 Demo Access Accounts

Use the quick-fill buttons on the login screen or enter:

- **Admin**: `admin@contract.test` / `Password@123`
- **Supervisor**: `supervisor@contract.test` / `Password@123`
- **Worker**: `worker@contract.test` / `Password@123`

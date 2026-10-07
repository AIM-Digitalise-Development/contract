# Frontend Overview and User Experience Flow

## 1. System Summary
The frontend is a modern, high-performance Single Page Application built with React 19, Tailwind CSS 4, and Vite. Designed specifically for godown operators, inventory supervisors, and warehouse managers, it follows an elegant, clean White and Corporate Blue design language. The interface focuses on speed, clarity, instant feedback, and zero UI freezes.

---

## 2. Design System and Visual Standards

### Visual Language
* **Primary Palette:** Clean corporate navy blues, crisp slate neutrals, pure white container cards, and subtle border outlines.
* **Status Badges:** Distinct semantic colors for rapid visual scanning:
  * Primary Godown: Deep Blue
  * Relative Godown: Indigo
  * Approved / Active: Emerald Green
  * Pending / In Review: Amber / Warm Orange
  * Rejected / Inactive: Rose Red
* **Feedback Systems:** Floating toast notifications slide in to confirm successful saves, stock approvals, and system alerts without breaking user workflow.
* **Full-Width Responsive Cards & Zero-Scroll Layouts:** Content containers utilize widescreen responsive widths (up to 1920px) rather than restrictive narrow boxes. Data tables feature proportional column sizing, whitespace preservation (`whitespace-nowrap`), and compact padding so that wide multi-attribute tables (including procurement vendor, dates, purchase rates, and threshold alerts) render fully visible without requiring left-to-right horizontal scrolling.

---

## 3. Key Pages and User Navigation Flows

### 1. Authentication & Onboarding
* **Secure Sign-In:** Users log in using their registered work email and password.
* **Quick-Access Switcher:** Pre-configured buttons allow immediate testing as Admin, Supervisor, or Worker with automatic credential loading.
* **Persistent Session:** Login tokens and user profiles are stored securely in browser storage, restoring the session automatically on page refresh.

### 2. Executive Dashboard
* **KPI Metric Cards:** Instant high-level count of total active warehouses, product varieties, low-stock warnings, and pending approval queues.
* **Actionable Alert Banners:** Displays pending stock entry and transfer requests requiring immediate attention with direct links to the Approval Center.
* **Live Movement Feeds:** Split tables showing the most recent inbound goods and warehouse transfers.

### 3. Godowns (Warehouse Hub) & Active Stock Display
* **Warehouse Directory:** Searchable and filterable grid displaying all storage facilities with their warehouse code, street address, operational status, and capacity.
* **Primary vs. Relative Categorization:** Clear indicators distinguishing central mother hubs from regional branch godowns.
* **Inline Active Stock Metrics:** Directly displays live inventory status in the table for each godown:
  * Total active stock count with unit labeling.
  * Product variety count badge (e.g. `3 products`).
  * Instant product preview details with empty state indicators (`0 units (Empty)`).
* **Live Stock Breakdown Modal:** Clicking "Stock Info" opens an on-screen breakdown showing all products and exact quantities currently stored inside that specific building.
* **Add & Edit Modals:** Streamlined forms to register new warehouses or update facility parameters.

### 4. Product Catalog & Add Product Flow
* **Inventory Master:** Full catalog of all managed goods displaying product names, SKU codes, units of measurement, procurement sources, purchase rates, safety stock reminder thresholds, and active status.
* **Real-Time Search:** Debounced search bar filtering products by name, SKU code, procurement vendor, or description without lag.
* **Add & Edit Product Specifications:**
  * **Measurement Unit Dropdown:** Standardized selector with predefined industrial units (Pieces, Kilograms, Liters, Boxes, Bags, Meters, Metric Tons, Units, Packs, Rolls, Sets).
  * **Procurement From:** Captures the vendor, supplier, or contracting firm supplying the product.
  * **Procurement Date:** Date picker recording the official procurement transaction date.
  * **Rate of Purchase:** Unit pricing field for accurate inventory valuation.
  * **Minimum Stock Reminder Set:** Configurable threshold triggering proactive restock warnings and alerts.

### 5. Stock Overview and Transaction Ledger
* **Tab 1 - Approved Stock Overview:** Clean inventory table showing verified on-hand stock for each product in each godown, with instant visual indicators for low or exhausted stock.
* **Tab 2 - Stock Entry Requests:** Full history of inbound shipments arriving at the docks.
  * Displays the target godown, internal storage shelf or bin, quantity, and requester name.
  * **Approver Identification:** Shows the exact name and employee ID of the staff member who approved or rejected the entry.
  * **Quick Approval Action:** Allows authorized personnel to approve pending inbound shipments with a single click directly from the table.
* **Tab 3 - Immutable Transaction Ledger:** Complete audit trail of all inventory movements showing movement types, quantities moved, and before-and-after balances.

### 6. Inter-Warehouse Transfers
* **Transfer Dispatcher:** Dedicated interface for creating relocations between warehouses.
  * **Intelligent Dropdowns:** Automatically restricts source selection to Primary warehouses and destination selection to Relative warehouses, preventing user error.
* **Movement Status:** Tracks pending, approved, and rejected transfers with detailed timestamps.

### 7. Centralized Approval Center
* **Unified Queue:** A single review inbox where pending inbound stock entries and transfer requests can be processed.
* **Review & Verification Modal:** Displays product information, target warehouses, and quantities alongside an explicit "Approving As: [User Name] (ID: #[ID])" badge.
* **Mandatory Rejection Reasons:** If a shipment is rejected, the modal requires the reviewer to input an explanatory reason to keep team members informed.

### 8. Employee Directory & Team Structure
* **Staff Management:** View all employees, their contact details, roles, and account status.
* **Worker Delegation:** Supervisors can view and assign workers under their supervision.

---

## 4. Performance and Responsiveness Architecture

### In-Memory Client Caching
* Static and semi-static dropdown lists (such as warehouse lists, product options, and role lists) are retained in memory.
* When opening modals or switching between tabs, dropdown options load in zero milliseconds without making redundant network calls.
* Caches automatically invalidate whenever a user creates, edits, or deletes an item, ensuring data always stays accurate.

### Keystroke Debouncing
* All search boxes utilize an automated 300-millisecond debounce mechanism.
* As users type, the application waits until typing pauses before dispatching an API call, preventing request flooding and keeping the UI smooth and responsive.

### Instant Role Switching and Navigation
* Client-side routing allows immediate page transitions without full-page browser reloads.
* Access control protects sensitive administrative routes while maintaining seamless access for operational workflows.

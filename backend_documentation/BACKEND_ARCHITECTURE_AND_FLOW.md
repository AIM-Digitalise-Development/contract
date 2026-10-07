# Backend Overview and System Flow

## 1. System Summary
The backend is a robust Inventory and Godown Management REST API built using Laravel 12 on MySQL. It serves as the single source of truth for all storage locations (Godowns), products, stock ledgers, movement transactions, approvals, and employee hierarchy. Every action that affects stock balances is strictly tracked, audited, and safeguarded against race conditions or data loss.

---

## 2. Core Entities and Database Structure

### Users and Roles
* **Roles:** Three primary user roles exist: Admin, Supervisor, and Worker.
* **Hierarchy:** Supervisors can have multiple workers assigned under them. Admins have global administrative visibility across the entire enterprise.
* **Authentication:** Secure token-based authentication (Sanctum) where users log in with their email and password to receive a bearer token for all subsequent requests.

### Godowns (Warehouses) & Active Stock Aggregation
* **Types:** 
  * Primary Godowns: Large central receiving and mother hubs.
  * Relative Godowns: Regional or retail distribution branches.
* **Capacity and Details:** Each warehouse tracks total storage capacity, physical street address, operational status, and a unique identification code.
* **Active Stock Aggregations:** Each godown computes and delivers live on-hand inventory metrics:
  * **Total Active Stock:** Cumulative quantity of all physical goods currently stored inside the godown.
  * **Active Product Lines:** Count of distinct product varieties with available positive balances.
  * **Active Items Breakdown:** Detailed inventory list with product names, SKU codes, and unit counts.

### Products & Procurement Specifications
* **Product Catalog:** Each item contains an SKU or product code, product name, description, and operational status.
* **Measurement Units:** Standardized units of measurement managed across predefined units (Pieces, Kilograms, Liters, Boxes, Bags, Meters, Metric Tons, Units, Packs, Rolls, Sets).
* **Procurement Tracking:**
  * **Procurement From:** Vendor, supplier, or contracting firm from whom the product was sourced.
  * **Procurement Date:** Official date of procurement for batch and purchase tracking.
  * **Rate of Purchase:** Purchase cost per unit stored with two decimal places.
* **Minimum Stock Reminder Alert:** Dedicated minimum safety threshold configured per product. Automated triggers highlight low or critical stock levels across godowns.

### Stocks and Stock Transactions
* **Current On-Hand Balance:** The live quantity of each product currently stored inside a specific godown.
* **Transaction Ledger:** An immutable, write-only history of every quantity change. Every addition, subtraction, transfer in, and transfer out logs the exact balance before the movement, the quantity moved, and the balance after the movement.

### Stock Entries
* Inbound shipments entering a godown from outside vendors or manufacturers.
* Initiated by workers or staff on the floor and reviewed by authorized personnel before stock is officially credited.

### Stock Transfers
* Inter-warehouse relocations moving stock strictly from a Primary hub to a Relative branch.
* Follows a two-step dispatch and receipt lifecycle ensuring inventory is neither lost nor duplicated in transit.

### Audit Logs
* An automated record capturing every critical system event, including logins, warehouse modifications, product updates, user status adjustments, and approval or rejection decisions, tied to the exact user and timestamp.

---

## 3. Business Logic and System Flows

### Flow 1: Inbound Stock Entry Lifecycle
1. **Creation:** A worker receives physical goods at a godown dock. They submit a new Stock Entry request specifying the target warehouse, product, physical storage bin or aisle location, quantity received, and optional notes.
2. **Pending Queue:** The request enters the system in a Pending status. The inventory balance is not modified yet to prevent unverified stock from showing as available.
3. **Approval:** Any authorized team member inspects the request. Upon approval:
   * The database acquires a strict lock on the godown-product stock record.
   * The on-hand balance is increased by the exact incoming quantity.
   * A permanent ledger record is created noting the balance before and after.
   * The entry status changes to Approved, and the approver's full name and employee ID are permanently attached to the record.
   * An audit log event is fired.
4. **Rejection:** If goods are damaged or counts do not match, the reviewer rejects the entry with a mandatory written reason. No stock balance is touched.

### Flow 2: Inter-Warehouse Transfer Lifecycle
1. **Verification of Source Stock:** A transfer request is submitted to move products from a Primary warehouse to a Relative warehouse. The system validates that the source godown has sufficient on-hand balance.
2. **Atomic Dispatch & Transfer:** Once approved:
   * The source warehouse balance is decremented immediately.
   * The destination warehouse balance is incremented immediately.
   * Both ledger entries (deduction at source, addition at destination) are committed within a single database transaction. If any failure occurs, the entire operation is rolled back.
   * The transfer status updates to Approved with the reviewer's identity.

### Flow 3: Employee and Hierarchy Management
* Admins can onboard new staff, assign system roles, update profile details, or activate/deactivate accounts.
* Supervisors can view their assigned team of workers and track their inbound requests.

---

## 4. Performance and Architecture Optimizations
* **Zend OPcache:** Pre-compiles PHP scripts into shared memory, eliminating disk reads and file re-compilation on every request.
* **Multi-Worker Server:** Configured multi-threaded CLI server concurrency to handle parallel API requests without blocking.
* **File-Based State Management:** Replaced database session writes with lightweight file caches to eliminate unnecessary database traffic on stateless API calls.
* **Row-Level Locking:** Uses database-level locks on stock rows during approvals to prevent race conditions when multiple users transact simultaneously.
* **Global Error Normalization:** All API endpoints return a predictable, standardized response format containing a success indicator, a user-friendly message, an error code, and payload data.
* **Optimized Data Serializers:** Standardized JSON resources deliver flattened, formatted entity attributes (including procurement sources, dates, purchase rates, and threshold alerts) for instant single-pass table rendering without client-side query waterfalls.

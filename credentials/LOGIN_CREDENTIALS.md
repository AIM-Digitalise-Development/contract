# System Login Credentials & Access Directory

## 1. Application URLs
* **Frontend Web Application:** [http://localhost:5173](http://localhost:5173)
* **Backend REST API:** [http://127.0.0.1:8000/api/v1](http://127.0.0.1:8000/api/v1)

---

## 2. Default User Accounts

All pre-configured accounts share the standard password: `Password@123`

| User ID | Full Name | Email / Login ID | Password | System Role | Account Status |
| :---: | :--- | :--- | :--- | :---: | :---: |
| **1** | **System Admin** | `admin@contract.test` | `Password@123` | **Admin** | Active |
| **2** | **John Supervisor** | `supervisor@contract.test` | `Password@123` | **Supervisor** | Active |
| **3** | **Alice Worker** | `worker@contract.test` | `Password@123` | **Worker** | Active |
| **4** | **Bob Worker** | `worker2@contract.test` | `Password@123` | **Worker** | Active |

---

## 3. Role Permissions & Access Scopes

### 1. Administrator (`admin@contract.test`)
* Full unrestricted platform control.
* Add, edit, and deactivate godowns (warehouses) and products.
* Review, approve, and reject inbound stock entries and inter-warehouse transfers.
* View complete audit trails and inventory transaction ledgers.
* Manage employees: create new user profiles, assign roles, and configure supervisor-worker teams.

### 2. Supervisor (`supervisor@contract.test`)
* Operational warehouse oversight.
* View inventory levels and warehouse capacities across all locations.
* Review, approve, and reject inbound stock entry requests and stock transfers.
* Inspect supervisor-worker reporting lines and manage team tasks.

### 3. Worker (`worker@contract.test` / `worker2@contract.test`)
* Warehouse floor operations.
* Submit new Inbound Stock Entry requests upon receiving goods at docks.
* Review pending requests and approve stock entries directly with transparent approver logging.
* View approved on-hand inventory levels and warehouse stocks.

---

## 4. Frontend Quick Login Feature
On the frontend sign-in page ([http://localhost:5173/login](http://localhost:5173/login)), there are **1-Click Demo Buttons** below the login form:
* Clicking **"Admin Demo"** automatically enters `admin@contract.test` / `Password@123`.
* Clicking **"Supervisor Demo"** automatically enters `supervisor@contract.test` / `Password@123`.
* Clicking **"Worker Demo"** automatically enters `worker@contract.test` / `Password@123`.

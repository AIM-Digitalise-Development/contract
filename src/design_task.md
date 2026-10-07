# CONTRACT — GODOWN & INVENTORY MANAGEMENT SYSTEM

## React Frontend — Production-Ready Implementation Prompt

You are working on an existing React frontend project.

Project:

```text
front
```

Do NOT create another React project.

Backend is an existing Laravel API.

Backend API base URL:

```text
http://127.0.0.1:8000/api/v1
```

Environment:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Technology:

```text
React
Vite
Tailwind CSS
React Router
Axios
```

Use a professional white + blue business application design.

---

# 1. PRIMARY OBJECTIVE

Build the frontend for a professional Godown and Inventory Management System.

The frontend must support:

* Authentication
* Role/permission-based navigation
* Dashboard
* Employees
* Workers
* Godowns
* Products
* Current inventory
* Stock entry requests
* Godown transfers
* Worker stock
* Worker stock allocation requests
* Approval Center
* Transaction history
* Audit information
* Search/filter/pagination
* Responsive UI
* Loading/error/empty states
* Confirmation dialogs
* Toast notifications

The backend is authoritative.

The frontend must never independently calculate or modify authoritative inventory balances.

---

# 2. CRITICAL WORKER RULE

Workers are NOT application users.

Workers:

* do not log in
* do not have passwords
* do not have dashboards
* do not create requests
* do not approve requests
* do not directly manipulate inventory

Workers are employees who can physically hold stock.

The people using this React application are:

```text
Admin
Supervisor
Manager
Other authorized hierarchical users
```

Do NOT create:

```text
Worker Login
Worker Registration
Worker Password
Worker Authentication
```

---

# 3. EMPLOYEE AND USER DISTINCTION

The UI should distinguish:

```text
Application User
```

from:

```text
Worker / Employee
```

Example:

```text
Employees
├── Admin employee
├── Supervisor employee
├── Manager employee
└── Worker employee
```

Only employees who have application accounts can log into the system.

---

# 4. APPLICATION LAYOUT

Use a professional business dashboard.

Suggested:

```text
┌────────────────────────────────────────────────────┐
│ Logo / Contract        Search       User Profile  │
├───────────────┬────────────────────────────────────┤
│ Dashboard     │                                    │
│ Employees     │             Page Content           │
│ Workers       │                                    │
│ Godowns       │                                    │
│ Products      │                                    │
│ Inventory     │                                    │
│ Stock Entries │                                    │
│ Transfers     │                                    │
│ Approvals     │                                    │
│ Reports       │                                    │
│ Audit Logs    │                                    │
└───────────────┴────────────────────────────────────┘
```

Use:

* white background
* blue primary color
* slate/gray neutral colors
* green for approved/success
* amber for pending
* red for rejected/errors

Keep the UI professional rather than decorative.

---

# 5. ROUTING

Use React Router.

Protected routes:

```text
/login

/dashboard

/employees
/employees/:id

/workers
/workers/:id

/godowns
/godowns/:id

/products
/products/:id

/inventory
/inventory/transactions

/stock-entries
/transfers

/worker-stock
/worker-stock/requests

/approvals

/audit-logs
```

Routes should be permission-aware.

Do not rely only on frontend route protection for security.

Backend remains authoritative.

---

# 6. AUTHENTICATION

Create:

```text
AuthContext
authService
protected routes
```

Support:

```text
login
logout
current authenticated user
session/token handling
```

Axios should automatically attach authentication credentials/token as required by Laravel Sanctum architecture.

Handle:

```text
401
403
422
404
409
500
```

appropriately.

---

# 7. ROLE/PERMISSION BASED UI

Do not hard-code every page based only on role names.

Prefer permission checks.

Example:

```text
can("employee.create")
can("inventory.worker_stock.issue")
can("inventory.worker_stock.approve")
can("inventory.transfer.approve")
```

Navigation should hide functions the current user cannot perform.

Important:

Hiding a button is UX only.

The Laravel backend remains responsible for authorization.

---

# 8. EMPLOYEE MANAGEMENT

Create an employee management section.

Employee list:

```text
Employee ID
Name
Department
Designation
Status
System Access
Actions
```

Important distinction:

```text
Worker:
System Access = No
```

Supervisor:

```text
System Access = Yes
```

Admin:

```text
System Access = Yes
```

Do not display a worker as having login credentials.

---

# 9. WORKER MANAGEMENT

Create a dedicated Worker section.

Worker list:

```text
Worker ID
Worker Name
Department
Designation
Status
Current Stock
Actions
```

Worker details:

```text
Worker Profile
────────────────────────

Employee ID
Name
Department
Designation
Phone
Status
```

Then:

```text
Current Stock
────────────────────────

Product | Quantity | Unit
```

Then:

```text
Stock History
────────────────────────

Date
Transaction
Product
Quantity
Source/Destination
Status
Performed By
```

Then:

```text
Pending Requests
```

---

# 10. ASSIGN STOCK TO WORKER

Authorized users should have an action:

```text
Assign Stock
```

Example:

```text
Worker: Rahul Das

[ Assign Stock ]
```

Open modal/page:

```text
Assign Stock to Worker

Worker
[ Rahul Das ]

Source Godown
[ Relative Godown A ]

Product
[ Product X ]

Available Stock
185

Quantity
[ 10 ]

Remarks
[ Issued for field work ]

[ Cancel ] [ Submit Request ]
```

Do not allow negative or zero quantity.

Show available stock as informational data returned by backend.

Do not trust the displayed quantity for final approval.

---

# 11. VERY IMPORTANT — ASSIGN STOCK DOES NOT MEAN STOCK MOVES

When the authorized user submits:

```text
Assign 10 Product X to Rahul
```

the frontend must display:

```text
Request created successfully.
Waiting for approval.
```

The UI must NOT immediately show:

```text
Godown: 185 → 175
Rahul: 0 → 10
```

until the backend confirms approval.

The request status is:

```text
PENDING
```

---

# 12. WORKER STOCK REQUEST DETAILS

Display:

```text
Request #WR-000123

Worker:
Rahul Das (EMP-102)

Product:
Product X

Source:
Relative Godown A

Quantity:
10

Requested By:
Amit Kumar (ID: 15)

Requested At:
01 Oct 2026 15:30

Status:
PENDING
```

After approval:

```text
Approved By:
Raj Sharma (ID: 3)

Approved At:
01 Oct 2026 15:45
```

After rejection:

```text
Rejected By:
Raj Sharma (ID: 3)

Rejected At:
01 Oct 2026 15:45

Reason:
Insufficient authorization.
```

---

# 13. APPROVAL CENTER

Create one centralized:

```text
Approval Center
```

with categories/tabs:

```text
Stock Entries
Transfers
Worker Stock
```

Example:

```text
Approval Center

[ Stock Entries ] [ Transfers ] [ Worker Stock ]

Pending Worker Stock Requests: 12
```

Worker Stock table:

```text
Request
Worker
Product
Source
Quantity
Requested By
Requested At
Status
Actions
```

---

# 14. APPROVAL DETAILS

When an authorized approver opens a request:

```text
Worker Stock Allocation

Request #WR-000123

Worker
Rahul Das
EMP-102

Product
Product X

Source Godown
Relative Godown A

Quantity
10

Remarks
Issued for field work

Requested By
Amit Kumar
ID: 15

Requested At
01 Oct 2026 15:30

Status
PENDING
```

Actions:

```text
[ Approve ]
[ Reject ]
```

Only users with appropriate permissions should see these actions.

Workers never see them because workers do not log in.

---

# 15. APPROVAL CONFIRMATION

Before approving, display confirmation:

```text
Approve Worker Stock Allocation?

This will:

• Deduct 10 Product X from Relative Godown A
• Add 10 Product X to Rahul Das
• Create an inventory transaction
• Record you as the approver
• Create an audit record

[ Cancel ] [ Confirm Approval ]
```

Do not modify frontend quantities before API success.

---

# 16. REJECTION

Reject action must require a reason.

Modal:

```text
Reject Request

Reason
[________________________________]

[ Cancel ] [ Reject Request ]
```

Empty reason must not be accepted.

After success:

```text
Request rejected successfully.
```

Inventory remains unchanged.

---

# 17. APPROVAL DISPLAY

After approval:

```text
Status: APPROVED

Approved By:
Raj Sharma (ID: 3)

Approved At:
01 Oct 2026 15:45
```

After rejection:

```text
Status: REJECTED

Rejected By:
Raj Sharma (ID: 3)

Rejected At:
01 Oct 2026 15:45

Reason:
...
```

Never display only the person's name.

Display:

```text
Name + ID
```

where useful.

---

# 18. SELF-APPROVAL UX

If backend returns:

```text
SELF_APPROVAL_NOT_ALLOWED
```

show a clear message:

```text
You cannot approve a request that you created.
Another authorized approver must process this request.
```

Do not attempt to work around backend authorization.

---

# 19. STOCK ENTRY UI

Create stock entry request UI.

Example:

```text
Create Stock Entry

Godown
Product
Internal Location
Quantity
Remarks

[Submit Request]
```

After creation:

```text
PENDING
```

No inventory change is assumed until approval.

---

# 20. GODOWN TRANSFER UI

Create:

```text
Create Transfer
```

Fields:

```text
Source Godown
Destination Godown
Product
Quantity
Remarks
```

For the current business workflow:

```text
Primary → Relative
```

must be supported.

Display:

```text
Transfer Request #TR-000123
Status: PENDING
```

After approval, refresh inventory.

---

# 21. CURRENT INVENTORY

Create an inventory page.

Example:

```text
Inventory

Filters:
Godown
Product
Type
Search

------------------------------------------------
Godown            Product       Quantity
------------------------------------------------
Primary A         Product X     100
Relative A        Product X     175
Relative B        Product Y     80
```

Worker stock should be represented separately.

Example:

```text
Worker Stock

Worker        Product       Quantity
Rahul Das     Product X     10
Amit Das      Product Y     5
```

Do not mix worker and godown balances into one confusing table.

---

# 22. INVENTORY TRANSACTION HISTORY

Create:

```text
Inventory Transactions
```

Columns:

```text
Transaction ID
Date
Type
Product
Quantity
Source
Destination
Performed By
Reference
```

Example:

```text
TXN-000982
01 Oct 2026
GODOWN_TO_WORKER
Product X
10
Relative Godown A
Rahul Das
Raj Sharma
WR-000123
```

Clicking a transaction should show complete details.

---

# 23. WORKER STOCK HISTORY

Worker details should provide:

```text
Current Stock
```

and:

```text
Transaction History
```

Example:

```text
Rahul Das

Current Stock
--------------------------------
Product X       10
Product Y        5

History
--------------------------------
Date       Type                 Qty
Oct 1      Godown → Worker      +10
Oct 5      Worker → Godown       -4
```

Use clear positive/negative semantics.

---

# 24. WORKER RETURN UI

Design the frontend to support future:

```text
Return Stock
```

Example:

```text
Worker:
Rahul Das

Product:
Product X

Current Quantity:
10

Return Quantity:
4

Destination:
Relative Godown A
```

Do not implement assumptions that contradict backend rules.

If return approval is required, follow the same request/approval pattern.

---

# 25. GODOWN DETAILS

Godown page should show:

```text
Godown Information

Name
Code
Type
Address
Capacity
Status
```

Then:

```text
Current Inventory
```

Then:

```text
Transaction History
```

Then pending operations involving the godown where appropriate.

---

# 26. PRODUCT DETAILS

Product page:

```text
Product Information

SKU
Product Code
Name
Category
Unit
Status
```

Then:

```text
Inventory by Godown
```

and:

```text
Inventory held by Workers
```

and:

```text
Transaction History
```

---

# 27. DASHBOARD

Dashboard should show useful operational metrics.

Examples:

```text
Total Godowns
Total Products
Total Workers
Pending Approvals
Total Inventory Items
Worker Stock Items
```

Approval widgets:

```text
Pending Stock Entries
Pending Transfers
Pending Worker Allocations
```

Do not invent metrics that are not supported by the backend.

---

# 28. API ARCHITECTURE

Centralize Axios.

Recommended:

```text
src/services/api.js
```

Do not create random Axios instances throughout components.

Services:

```text
authService.js
employeeService.js
workerService.js
godownService.js
productService.js
inventoryService.js
stockEntryService.js
transferService.js
workerStockService.js
approvalService.js
auditService.js
```

Example:

```text
workerStockService.createRequest()
workerStockService.getWorkerStock()
workerStockService.getRequests()
workerStockService.approveRequest()
workerStockService.rejectRequest()
```

---

# 29. SUGGESTED FRONTEND STRUCTURE

Use:

```text
src/
├── assets/
│
├── components/
│   ├── common/
│   ├── layout/
│   ├── forms/
│   ├── tables/
│   ├── modals/
│   ├── dashboard/
│   ├── employees/
│   ├── workers/
│   ├── godowns/
│   ├── products/
│   ├── inventory/
│   ├── stockEntries/
│   ├── transfers/
│   ├── workerStock/
│   └── approvals/
│
├── pages/
│   ├── auth/
│   ├── dashboard/
│   ├── employees/
│   ├── workers/
│   ├── godowns/
│   ├── products/
│   ├── inventory/
│   ├── stockEntries/
│   ├── transfers/
│   ├── workerStock/
│   ├── approvals/
│   └── auditLogs/
│
├── layouts/
│   ├── AppLayout.jsx
│   └── AuthLayout.jsx
│
├── services/
│   ├── api.js
│   ├── authService.js
│   ├── employeeService.js
│   ├── workerService.js
│   ├── godownService.js
│   ├── productService.js
│   ├── inventoryService.js
│   ├── stockEntryService.js
│   ├── transferService.js
│   ├── workerStockService.js
│   ├── approvalService.js
│   └── auditService.js
│
├── context/
│   └── AuthContext.jsx
│
├── hooks/
├── utils/
├── constants/
├── routes/
├── App.jsx
├── main.jsx
└── index.css
```

Follow consistent naming.

Use PascalCase for React components.

Use camelCase for JavaScript functions/variables.

---

# 30. FORM VALIDATION

Use frontend validation for UX.

Validate:

```text
required fields
quantity > 0
valid product
valid worker
valid godown
valid remarks where required
rejection reason required
```

But remember:

> Backend validation is authoritative.

Do not assume frontend validation is security.

---

# 31. ERROR HANDLING

Centralize API error handling.

Map backend error codes such as:

```text
INSUFFICIENT_STOCK
APPROVAL_NOT_ALLOWED
SELF_APPROVAL_NOT_ALLOWED
REQUEST_ALREADY_PROCESSED
WORKER_INACTIVE
INVALID_STATUS_TRANSITION
```

to understandable UI messages.

Example:

```text
INSUFFICIENT_STOCK

Not enough stock is available in the selected godown.
Refresh the inventory and try again.
```

For validation:

```text
Please correct the highlighted fields.
```

Never display raw Laravel exception messages or stack traces.

---

# 32. LOADING STATES

Every API-dependent page must handle:

```text
loading
success
empty
error
```

Example:

```text
Loading inventory...
```

Empty:

```text
No inventory found.
```

Error:

```text
Unable to load inventory.
[Retry]
```

Do not leave blank screens.

---

# 33. TABLES

Tables must support:

* pagination
* search
* filters
* sorting where useful
* responsive behavior
* row actions
* loading state
* empty state

For mobile, use responsive tables/cards rather than allowing the entire page to overflow unnecessarily.

---

# 34. CONFIRMATION DIALOGS

Use confirmation dialogs for:

```text
Approve
Reject
Deactivate employee
Delete/configuration changes
Stock operations
```

Especially approval.

Approval should clearly tell the user that it will cause an actual inventory movement.

---

# 35. TOASTS / NOTIFICATIONS

Use consistent notifications.

Success:

```text
Worker stock request created successfully.
```

Approval:

```text
Worker stock request approved successfully.
Inventory has been updated.
```

Rejection:

```text
Worker stock request rejected.
```

Error:

```text
Unable to approve request.
Please refresh and try again.
```

---

# 36. IMPORTANT STOCK DISPLAY RULE

Before approval:

```text
PENDING
```

Do not represent requested quantity as actual inventory.

Use labels such as:

```text
Requested Quantity: 10
Current Stock: 185
```

After approval:

```text
Current Godown Stock: 175
Worker Stock: 10
```

This distinction must be visually obvious.

---

# 37. APPROVAL CENTER COUNTS

Dashboard/sidebar can show badges:

```text
Approvals
  Worker Stock  5
  Transfers      3
  Stock Entries  7
```

Only show categories the current user has permission to process.

---

# 38. REFRESH AFTER APPROVAL

After successful approval:

1. Update request status.
2. Refresh request list/details.
3. Refresh worker stock.
4. Refresh godown stock.
5. Refresh approval count.
6. Show success notification.

Do not manually guess the new quantity.

Fetch the authoritative values from Laravel.

---

# 39. SECURITY

Never:

* store passwords in frontend state
* trust frontend roles for authorization
* calculate authoritative inventory
* send new balance quantities to backend
* allow hidden UI controls to bypass backend authorization

The frontend is a client.

Laravel is authoritative.

---

# 40. TESTING

Add tests for important UI behavior.

Test:

### Authentication

* login
* logout
* protected route
* unauthorized redirect

### Permissions

* authorized user sees action
* unauthorized user does not see action
* worker is never treated as a login user

### Worker Stock

* assign form
* validation
* pending request
* approval modal
* rejection reason
* approved status
* rejected status
* approver information
* requester information

### Inventory

* godown inventory
* worker inventory
* transaction history
* refresh after approval

---

# 41. RESPONSIVE DESIGN

Support:

```text
Desktop
Tablet
Mobile
```

Desktop should provide:

```text
sidebar + content
```

Mobile should provide:

```text
compact header
drawer navigation
responsive cards/tables
```

Forms should remain usable on small screens.

---

# 42. VISUAL DESIGN

Use:

```text
Primary:
Blue

Background:
White / very light slate

Text:
Slate / dark gray

Success:
Green

Pending:
Amber

Rejected:
Red
```

Use consistent:

* border radius
* spacing
* typography
* button styles
* table styles
* form controls
* modal styles

Avoid excessive gradients, animations, glassmorphism, or decorative effects.

This is an enterprise inventory application.

Prioritize clarity and operational efficiency.

---

# 43. IMPORTANT BUSINESS WORKFLOW

The complete worker allocation UX must behave like this:

```text
Authorized User
      │
      ▼
Select Worker
      │
      ▼
Select Source Godown
      │
      ▼
Select Product
      │
      ▼
Enter Quantity
      │
      ▼
Submit
      │
      ▼
PENDING
      │
      ▼
Approval Center
      │
      ├───────────────┐
      ▼               ▼
   APPROVE          REJECT
      │               │
      ▼               ▼
Godown decreases    No movement
      │
      ▼
Worker stock increases
      │
      ▼
Transaction created
      │
      ▼
Audit created
```

---

# 44. UI MUST NOT ASSUME WORKER LOGIN

Do not create:

```text
Worker Dashboard
Worker Login
Worker Portal
Worker Authentication
```

Instead:

```text
Workers
    ↓
Worker Details
    ↓
Current Stock
    ↓
Assign Stock
    ↓
Pending/Approved/Rejected Requests
    ↓
Stock History
```

---

# 45. IMPLEMENTATION METHOD

Before making changes:

1. Inspect the existing React project.
2. Inspect package.json.
3. Inspect current components.
4. Inspect current routes.
5. Inspect current Tailwind configuration.
6. Inspect existing API service code.
7. Reuse good existing architecture.
8. Do not create a second React/Vite project.
9. Do not create Node/Express backend code.

Implement incrementally:

```text
Phase 1
Project cleanup
API client
Authentication
Layout
Routing

Phase 2
Dashboard

Phase 3
Employees
Workers

Phase 4
Godowns

Phase 5
Products
Inventory

Phase 6
Stock Entries

Phase 7
Transfers

Phase 8
Worker Stock

Phase 9
Approval Center

Phase 10
Transaction History
Audit Logs

Phase 11
Responsive polish
Error handling
Loading states

Phase 12
Tests
```

After every phase:

```text
npm run build
```

and run available tests.

Fix errors before moving to the next phase.

---

# 46. FINAL BUSINESS RULES

The frontend must respect these rules:

1. Workers never log in.
2. Workers cannot assign stock themselves.
3. Workers cannot approve.
4. Authorized users assign stock to workers.
5. Assignment initially creates a PENDING request.
6. Pending requests do not change actual inventory.
7. Authorized approvers approve/reject.
8. Approval causes actual stock movement.
9. Rejection causes no stock movement.
10. Requester and approver must be separately displayed.
11. Approver ID and name must be displayed after approval.
12. Rejector ID and name must be displayed after rejection.
13. Rejection requires a reason.
14. Worker stock and godown stock are separate balances.
15. Inventory values come from the backend.
16. Frontend never submits calculated new balances.
17. Every approved inventory movement has transaction history.
18. Every important operation has audit information.
19. UI permissions improve UX but never replace backend authorization.
20. Do not create worker authentication unless the business requirements explicitly change.

---

# 47. FINAL EXPECTATION

Build this as a professional enterprise inventory application.

Prioritize:

* clear workflows
* minimal user confusion
* consistent UI
* reusable components
* permission-aware navigation
* reliable API integration
* strong validation
* clear error messages
* responsive design
* inventory integrity
* auditability
* maintainability

Do not build a generic CRUD dashboard.

The application must clearly communicate the difference between:

```text
REQUESTED STOCK
```

and:

```text
ACTUAL STOCK
```

and between:

```text
REQUESTER
```

and:

```text
APPROVER
```

The final application should make it impossible for a normal worker to interact with the system because workers are not application users at all.

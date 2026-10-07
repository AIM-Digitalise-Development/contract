# Postman API Testing Guide (Contract ERP)

This guide contains ready-to-test APIs for testing both **Localhost** and the **Hostinger Live Server** (`https://nexgn.in/contract`).

---

## 1. Quick Health Check (Public GET — No Auth Required)

Use this endpoint to verify that your backend and web server are responding properly.

### Request
- **Method**: `GET`
- **Live URL**: `https://nexgn.in/contract/api/v1/ping`
- *(Local URL)*: `http://127.0.0.1:8000/api/v1/ping`
- *(Fallback if without root rewrite)*: `https://nexgn.in/contract/public/api/v1/ping`

### Headers
| Header | Value |
| :--- | :--- |
| `Accept` | `application/json` |

### Expected Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Contract ERP Backend API is live and operational!",
  "timestamp": "2026-10-07T06:30:15+00:00"
}
```

---

## 2. Authenticate & Obtain Bearer Token (POST)

Most ERP endpoints are protected with Laravel Sanctum and require a Bearer token.

### Request
- **Method**: `POST`
- **Live URL**: `https://nexgn.in/contract/api/v1/auth/login`
- *(Local URL)*: `http://127.0.0.1:8000/api/v1/auth/login`

### Headers
| Header | Value |
| :--- | :--- |
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |

### Body (`raw JSON`)
```json
{
  "email": "admin@contract.com",
  "password": "password"
}
```

### Expected Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Authenticated successfully.",
  "data": {
    "token": "1|q6aV8X...YOUR_SECRET_TOKEN...",
    "user": {
      "id": 1,
      "name": "Super Admin",
      "email": "admin@contract.com",
      "role": "admin"
    }
  }
}
```
> Copy the `"token"` string from the response to use in the following requests.

---

## 3. Get Authenticated User Profile (Protected GET)

### Request
- **Method**: `GET`
- **Live URL**: `https://nexgn.in/contract/api/v1/auth/me`
- *(Local URL)*: `http://127.0.0.1:8000/api/v1/auth/me`

### Headers
| Header | Value |
| :--- | :--- |
| `Accept` | `application/json` |
| `Authorization` | `Bearer YOUR_COPIED_TOKEN` |

### Expected Response (`200 OK`)
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "Super Admin",
    "email": "admin@contract.com",
    "role": "admin"
  }
}
```

---

## 4. Get Godown Master List (Protected GET)

### Request
- **Method**: `GET`
- **Live URL**: `https://nexgn.in/contract/api/v1/godowns`
- *(Local URL)*: `http://127.0.0.1:8000/api/v1/godowns`

### Headers
| Header | Value |
| :--- | :--- |
| `Accept` | `application/json` |
| `Authorization` | `Bearer YOUR_COPIED_TOKEN` |

### Expected Response (`200 OK`)
Returns the list of Primary and Retail Godowns.

---

## 5. Get Product Master List (Protected GET)

### Request
- **Method**: `GET`
- **Live URL**: `https://nexgn.in/contract/api/v1/products`
- *(Local URL)*: `http://127.0.0.1:8000/api/v1/products`

### Headers
| Header | Value |
| :--- | :--- |
| `Accept` | `application/json` |
| `Authorization` | `Bearer YOUR_COPIED_TOKEN` |

---

## 6. Get Client Master List (Protected GET)

### Request
- **Method**: `GET`
- **Live URL**: `https://nexgn.in/contract/api/v1/clients`
- *(Local URL)*: `http://127.0.0.1:8000/api/v1/clients`

### Headers
| Header | Value |
| :--- | :--- |
| `Accept` | `application/json` |
| `Authorization` | `Bearer YOUR_COPIED_TOKEN` |

---

## 7. Get Audit Work & Material Ledger (Protected GET)

### Request
- **Method**: `GET`
- **Live URL**: `https://nexgn.in/contract/api/v1/audit-entry/ledger`
- *(Local URL)*: `http://127.0.0.1:8000/api/v1/audit-entry/ledger`

### Headers
| Header | Value |
| :--- | :--- |
| `Accept` | `application/json` |
| `Authorization` | `Bearer YOUR_COPIED_TOKEN` |

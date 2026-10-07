# Vercel Deployment & CORS Login Fix Guide

## Problem Summary
When loading `https://contract-roan.vercel.app`, login failed with the following browser error:
```
Access to XMLHttpRequest at 'https://nexgn.in/contract/api/v1/auth/login' from origin 'https://contract-roan.vercel.app' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Why Did This Happen?
1. **Wrong URL in Vercel**: 
   - The environment variable in Vercel (`VITE_API_BASE_URL`) was set to:
     `https://nexgn.in/contract/api/v1` ❌ *(Subfolder path)*
   - Because that subfolder does not exist on your Hostinger server, it returns a `404 Not Found` without any CORS headers.

2. **The Correct Working Live URL**:
   - Your API is hosted on the **subdomain**:
     `https://contract-api.nexgn.in/api/v1` ✅ *(Subdomain path)*
   - This subdomain already has CORS enabled (`Access-Control-Allow-Origin: *`) and responds properly to all requests.

---

## Step-by-Step Fix (2 Steps)

### Step 1: Update Environment Variable in Vercel
1. Open your browser and go to your **Vercel Dashboard**.
2. Select your project: **`contract-roan`**.
3. Go to **Settings** → **Environment Variables** (from the left menu).
4. Locate the variable named **`VITE_API_BASE_URL`**.
5. Click the three dots (`...`) on the right side and click **Edit**.
6. Set the value to:
   ```
   https://contract-api.nexgn.in/api/v1
   ```
7. Click **Save**.

> **Note:** Alternatively, you can simply **Delete** the `VITE_API_BASE_URL` variable from Vercel completely. The code in `src/services/api.js` already uses `https://contract-api.nexgn.in/api/v1` as the default fallback.

---

### Step 2: Redeploy in Vercel
Because Vite embeds environment variables into the JavaScript files at build time, updating the variable requires a rebuild:

1. In your Vercel project, click the **Deployments** tab at the top.
2. Find the latest deployment at the very top of the list.
3. Click the three dots icon (`...`) on that deployment.
4. Click **Redeploy**.
5. When the prompt asks, leave "Use existing Build Cache" checked (or uncheck it) and click **Redeploy**.
6. Wait ~30–45 seconds until the status shows **Ready**.

---

### Step 3: Test Login
1. Open `https://contract-roan.vercel.app` in your browser.
2. Open DevTools (**F12** → **Network** tab) to verify requests go to:
   `https://contract-api.nexgn.in/api/v1/auth/login`
3. Enter your login credentials and sign in.
4. Login will succeed with 0 CORS errors.

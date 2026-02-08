# SANYAI Deployment Guide

This guide explains how to deploy the Sanyai application. The recommended approach is a **Split Deployment**:
*   **Frontend**: Vercel (Fast, global CDN for static assets).
*   **Backend**: Render or Railway (Supports persistent Node.js servers).

---

## 🚀 Option 1: The Recommended Stack

### Part A: Deploy Backend (Render)
Since the backend uses LangGraph and potentially long-running AI requests, it needs a proper server, not serverless functions.

1.  **Push your code to GitHub** (You already did this).
2.  Go to [Render.com](https://render.com/) and create a new **Web Service**.
3.  Connect your GitHub repository: `Rahul1816Mamidi/sanyai-tool`.
4.  **Configure Settings**:
    *   **Root Directory**: `server` (Important!)
    *   **Build Command**: `npm install`
    *   **Start Command**: `npm start`
    *   **Environment Variables** (Add these from your local `.env`):
        *   `HF_ACCESS_TOKEN`
        *   `SERP_API_KEY`
        *   `SUPABASE_URL`
        *   `SUPABASE_KEY`
5.  Click **Deploy**.
6.  Once live, copy your Backend URL (e.g., `https://sanyai-backend.onrender.com`).

### Part B: Deploy Frontend (Vercel)
1.  Go to [Vercel.com](https://vercel.com/) and click **Add New Project**.
2.  Import the same repository: `Rahul1816Mamidi/sanyai-tool`.
3.  **Configure Settings**:
    *   **Root Directory**: `client` (Click "Edit" next to Root Directory and select `client`).
    *   **Framework Preset**: Vite (Should detect automatically).
    *   **Environment Variables**:
        *   `VITE_API_URL`: Paste your Render Backend URL here (e.g., `https://sanyai-backend.onrender.com`).
4.  Click **Deploy**.

---

## 🛠️ Option 2: Full Stack on Railway (Simpler)

Railway can automatically detect the monorepo structure.

1.  Go to [Railway.app](https://railway.app/).
2.  Start a **New Project** -> **Deploy from GitHub**.
3.  Select your repo.
4.  Railway might try to deploy the root. You need to configure it to deploy two services:
    *   **Service 1 (Backend)**: Set Root Directory to `/server`. Add variables.
    *   **Service 2 (Frontend)**: Set Root Directory to `/client`. Add `VITE_API_URL` pointing to Service 1's domain.

---

## 🏡 Option 3: Self-Hosted on Coolify (Best for Control)

Coolify is an open-source & self-hostable alternative to Vercel/Netlify.

**Prerequisites**: A VPS (Virtual Private Server) from providers like Hetzner, DigitalOcean, or AWS EC2 with Coolify installed.

### Part A: Deploy Backend (Coolify)
1.  In your Coolify dashboard, create a new **Project** -> **New Resource** -> **Public Repository**.
2.  Enter your GitHub URL: `https://github.com/Rahul1816Mamidi/sanyai-tool`.
3.  **Configuration**:
    *   **Build Pack**: Dockerfile (We added a `Dockerfile` to `/server`).
    *   **Base Directory**: `/server`
    *   **Port**: 3000
    *   **Environment Variables**: Add your API keys (`SERP_API_KEY`, etc.).
4.  **Deploy**.
5.  Copy the generated URL (e.g., `https://api.yourdomain.com`).

### Part B: Deploy Frontend (Coolify)
1.  Add another **New Resource** -> **Public Repository**.
2.  Use the same GitHub URL.
3.  **Configuration**:
    *   **Build Pack**: Static Site (Nixpacks).
    *   **Base Directory**: `/client`
    *   **Build Command**: `npm install && npm run build`
    *   **Publish Directory**: `dist`
    *   **Environment Variables**:
        *   `VITE_API_URL`: Your Backend URL from Part A.
4.  **Deploy**.

---

## ✅ Post-Deployment Checks
1.  Open your Vercel frontend URL.
2.  Check if the "Smart Prompt" feature works (hits the backend).
3.  Check if "Web Search" works (hits backend + external APIs).
4.  If you get **CORS errors**:
    *   Go to `server/index.js`.
    *   Update `app.use(cors())` to explicitly allow your Vercel domain:
        ```javascript
        app.use(cors({
            origin: ["https://your-vercel-app.vercel.app", "http://localhost:5173"]
        }));
        ```
    *   Redeploy the backend.

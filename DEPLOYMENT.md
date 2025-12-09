# Deployment Guide for Cafe Ordering System

This guide covers how to deploy your Cafe Ordering System to production, ensuring authentication and other features work correctly.

## 1. Environment Variables

In production, you cannot rely on a local `.env` file in the same way. You must set these variables in your hosting provider's dashboard.

| Variable | Description | Production Value Example |
|----------|-------------|--------------------------|
| `PORT` | Backend server port | `4001` (or provided by host) |
| `TELEGRAM_BOT_TOKEN` | Your Telegram Bot Token | `123456:ABC-DEF...` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `GOCSPX-...` |
| `SESSION_SECRET` | Secret for session cookies | A long random string |
| `VITE_API_URL` | Frontend API URL | `https://your-backend-app.com` |

> **Important**: The frontend needs `VITE_API_URL` to know where to send requests. If you host frontend and backend separately (e.g., Vercel + Render), set this to your backend's URL.

## 2. Authentication Setup for Production

### Google OAuth
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services > Credentials**.
3. Edit your OAuth 2.0 Client ID.
4. **Authorized JavaScript origins**: Add your production frontend domain (e.g., `https://my-cafe-app.vercel.app`).
5. **Authorized redirect URIs**: Add your production backend callback URL (e.g., `https://my-cafe-backend.onrender.com/auth/google/callback`).

### Telegram Auth
- **Polling**: The current setup uses `polling: true`. This works fine for a single server instance. If you scale to multiple instances, you must switch to **Webhooks**.
- **Domain**: Ensure your Telegram Bot settings (via BotFather) allow your production domain if you use the Login Widget (we are using OTP/Phone, so this is less critical, but good practice).

## 3. Database Persistence (CRITICAL)

**Current State**: The application uses **In-Memory Storage** (variables in `index.js`).
- **Warning**: Every time you redeploy or the server restarts, **ALL DATA (Orders, Menu Edits, Users) WILL BE LOST**.
- **Recommendation**: Connect a real database like **MongoDB** or **PostgreSQL**.
  - The code already has placeholders for MongoDB. You just need to:
    1. Set `MONGO_URI` in env.
    2. Uncomment the MongoDB connection logic in `server/index.js`.

## 4. Hosting Options

## 4. Hosting Options

The most robust way to deploy this application is to separate the **Frontend** (Vite + React) and the **Backend** (Node.js + Express).

### Part 1: Backend Deployment (Required First)
Since the frontend needs the backend URL to function, deploy the backend first. **Render** or **Railway** are great choices for Node.js apps.

**Deploying to Render (Example):**
1. Push your code to GitHub.
2. Sign up at [render.com](https://render.com).
3. Click "New +" -> "Web Service".
4. Connect your GitHub repository.
5. **Settings**:
   - **Root Directory**: `server` (Important!)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
6. **Environment Variables** (Add these in the "Environment" tab):
   - `TELEGRAM_BOT_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`
   - `MONGO_URI` (if using database)
7. Click "Create Web Service".
8. **Copy the Service URL** (e.g., `https://my-cafe-backend.onrender.com`). You will need this for the frontend.

---

### Part 2: Frontend Deployment
Now deploy the frontend to Vercel or Netlify.

#### Option A: Deploying to Vercel (Recommended)
1. Push your code to GitHub.
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click "Add New..." -> "Project".
4. Import your `cafe-main` repository.
5. **Configure Project**:
   - **Framework Preset**: Vite (should detect automatically)
   - **Root Directory**: `./` (Default is fine)
   - **Build Command**: `npm run build` (Default)
   - **Output Directory**: `dist` (Default)
6. **Environment Variables**:
   - Expand the "Environment Variables" section.
   - Key: `VITE_API_URL`
   - Value: Your Backend URL from Part 1 (e.g., `https://my-cafe-backend.onrender.com`)
   - Click "Add".
7. Click **Deploy**.
8. Once deployed, copy your new frontend URL (e.g., `https://my-cafe.vercel.app`).
9. **Final Step**: Go back to your Backend (Render) and Google Cloud Console to add this new Vercel URL to the **CORS allowed origins** and **Authorized Redirect URIs**.

#### Option B: Deploying to Netlify
1. Push your code to GitHub.
2. Go to [netlify.com](https://netlify.com) and log in.
3. Click "Add new site" -> "Import from existing project".
4. Connect using GitHub and select your repo.
5. **Build Settings**:
   - **Base directory**: Not strictly necessary if package.json is in root, but you can leave empty.
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. **Environment variables** (Click "Advanced" or "Site settings" -> "Environment variables" after creation):
   - Key: `VITE_API_URL`
   - Value: Your Backend URL (e.g., `https://my-cafe-backend.onrender.com`)
7. Click **Deploy Site**.
8. **Final Step**: Just like Vercel, verify your CORS settings on the backend and Google Console with the new Netlify URL.

### Option C: VPS (DigitalOcean/EC2)
(Advanced users only)
1. Provision a server (Ubuntu).
2. Install Node.js and PM2.
3. Clone repo.
4. Build frontend: `npm run build`.
5. Serve frontend using Nginx or serve static files from Node.
6. Run backend using PM2: `pm2 start server/index.js`.

## 5. Troubleshooting

- **CORS Errors**: If frontend fails to talk to backend, check `server/index.js`. Update the `cors` origin list to include your production frontend domain.
  ```javascript
  app.use(cors({
    origin: ['http://localhost:5173', 'https://my-cafe-app.vercel.app'],
    credentials: true
  }));
  ```
- **Auth Fails**: Check Redirect URIs in Google Console.
- **Notifications**: Browser notifications require HTTPS (which Vercel/Render provide automatically).

## 6. Verification
After deployment:
1. **Test Login**: Try logging in with Google and Telegram.
2. **Test Notifications**: Place an order and check if notifications appear.
3. **Test Persistence**: Restart the server (if using DB) and check if menu/orders persist.

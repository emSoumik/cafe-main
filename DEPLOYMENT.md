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

### Option A: Separate Frontend & Backend (Recommended)
- **Frontend (Vercel/Netlify)**:
  1. Push code to GitHub.
  2. Import project in Vercel.
  3. Set `VITE_API_URL` environment variable to your backend URL.
  4. Deploy.
- **Backend (Render/Railway/Heroku)**:
  1. Push code to GitHub.
  2. Create a new Web Service.
  3. Set Root Directory to `server` (or configure build command to `cd server && npm install`).
  4. Set Start Command to `node index.js`.
  5. Add all environment variables (`TELEGRAM_BOT_TOKEN`, etc.).
  6. Deploy.

### Option B: VPS (DigitalOcean/EC2)
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

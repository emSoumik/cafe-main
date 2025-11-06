# Snappy Serve — Minimal Backend

This folder contains a tiny Express.js backend used for local development. It provides simple endpoints for menu, orders, and bills stored in-memory.

How to run

```powershell
cd "c:\Users\ragha\OneDrive\Desktop\Cafe Management\snappy-serve-suite-main\server"
npm install
npm run dev   # or npm start
```

API Endpoints
- GET /menu — returns menu JSON
- GET /orders — list all orders
- POST /orders — create an order (body: { tableNumber, customerName, items, totalAmount })
- POST /bills — generate a bill (body: { tableNumber, customerName, items })
- GET /bills/:id — fetch bill by id

Notes
- Data is stored in-memory and will be lost when the server restarts. This is intended for local development and prototyping. For production, connect a real database.

Optional MongoDB persistence

This backend runs with in-memory stores by default. To persist data across restarts, enable MongoDB:

1. Start a local MongoDB instance (or use an Atlas URI).
2. Create a `server/.env` file (not committed) with:

```
USE_MONGO=true
MONGODB_URI=mongodb://localhost:27017
MONGODB_DBNAME=snappy_serve
```

3. Start the server (npm run dev) and you should see `MongoDB connected to database: snappy_serve` in the logs.

You can then seed the `menu` collection via the admin UI or POST `/menu` to add items.

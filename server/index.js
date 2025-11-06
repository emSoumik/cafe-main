const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { menuData } = require("./data");
const path = require("path");
const fs = require("fs");

// Load .env from server/.env when present (local dev convenience)
try {
  const dotenv = require("dotenv");
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log("Loaded server/.env file");
  }
} catch (e) {
  // ignore if dotenv not installed — handled by package.json
}

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

// In-memory stores (reset on restart)
const orders = [];
const bills = [];

// MongoDB integration (enabled when USE_MONGO=true)
let useMongo = false;
let mongoClient = null;
let mongoDb = null;
let mongoConnectPromise = null;

// Optional MongoDB integration (enabled when USE_MONGO=true)
try {
  if (process.env.USE_MONGO === "true") {
    const { MongoClient } = require("mongodb");
    const uri = process.env.MONGODB_URI || "";
    const dbName = process.env.MONGODB_DBNAME || "snappy_serve";
    if (!uri) {
      console.warn("USE_MONGO=true set but MONGODB_URI not provided. Falling back to in-memory stores.");
    } else {
      mongoClient = new MongoClient(uri, { serverApi: { version: "1" } });
      // Start connect but don't block here — expose the promise so startup can wait for it with a timeout
      mongoConnectPromise = mongoClient.connect().then(() => {
        mongoDb = mongoClient.db(dbName);
        useMongo = true;
        console.log(`MongoDB connected to database: ${dbName}`);
      }).catch((e) => {
        console.warn("Failed to connect to MongoDB:", e && e.message ? e.message : e);
      });
    }
  }
} catch (e) {
  console.warn("MongoDB init error, falling back to in-memory:", e && e.message ? e.message : e);
}

// GET /menu - return available menu
app.get("/menu", async (req, res) => {
  // If using Mongo, read menu items from DB and group by category
  if (useMongo && mongoDb) {
    try {
      const items = await mongoDb.collection("menu").find({}).toArray();
      const grouped = {};
      (items || []).forEach((it) => {
        const category = it.category || "Uncategorized";
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push({ id: it._id || it.id, name: it.name, price: it.price, available: typeof it.available === 'boolean' ? it.available : true, category });
      });
      return res.json(grouped);
    } catch (e) {
      console.warn("Failed to load menu from MongoDB, falling back to in-memory", e);
    }
  }

  // Ensure each item includes an 'available' flag (default true) for clients
  const normalized = {};
  Object.entries(menuData).forEach(([cat, items]) => {
    normalized[cat] = (items || []).map((it) => ({ ...it, available: typeof it.available === 'boolean' ? it.available : true }));
  });
  res.json(normalized);
});

// Menu management endpoints (in-memory, optional MongoDB persistence)
const findMenuItem = (id) => {
  for (const cat of Object.keys(menuData)) {
    const idx = menuData[cat].findIndex((i) => i.id === id);
    if (idx !== -1) return { category: cat, index: idx };
  }
  return null;
};

app.post("/menu", async (req, res) => {
  const { id, name, category, price, available } = req.body;
  if (!name || !category || typeof price !== "number") return res.status(400).json({ success: false, message: "Invalid item" });
  const newId = id || `item-${Date.now()}`;
  if (!menuData[category]) menuData[category] = [];
  const item = { id: newId, name, category, price, available: available ?? true };
  menuData[category].push(item);
    if (useMongo && mongoDb) {
      try {
        await mongoDb.collection("menu").updateOne({ _id: item.id }, { $set: { ...item, _id: item.id } }, { upsert: true });
      } catch (e) {
        console.warn("Failed to persist menu item to MongoDB:", e && e.message ? e.message : e);
      }
    }
  res.json({ success: true, item });
});

app.put("/menu/:id", async (req, res) => {
  const { id } = req.params;
  const pos = findMenuItem(id);
  if (!pos) return res.status(404).json({ success: false, message: "Item not found" });
  const { name, category, price, available } = req.body;
  const old = menuData[pos.category][pos.index];
  // remove from old category if category changed
  if (category && category !== pos.category) {
    menuData[pos.category].splice(pos.index, 1);
    if (!menuData[category]) menuData[category] = [];
    const updated = { id, name: name ?? old.name, category, price: typeof price === 'number' ? price : old.price, available: available ?? old.available };
    menuData[category].push(updated);
    
    return res.json({ success: true, item: updated });
  }
  // update in-place
  const updated = { ...old, name: name ?? old.name, price: typeof price === 'number' ? price : old.price, available: available ?? old.available };
  menuData[pos.category][pos.index] = updated;
  
  res.json({ success: true, item: updated });
});

app.delete("/menu/:id", async (req, res) => {
  const { id } = req.params;
  const pos = findMenuItem(id);
  if (!pos) return res.status(404).json({ success: false, message: "Item not found" });
  const removed = menuData[pos.category].splice(pos.index, 1)[0];
    if (useMongo && mongoDb) {
      try { await mongoDb.collection("menu").deleteOne({ _id: id }); } catch (e) { console.warn("Failed to delete menu item in MongoDB:", e && e.message ? e.message : e); }
    }
  res.json({ success: true, item: removed });
});

// GET /orders - list orders
  app.get("/orders", async (req, res) => {
    if (useMongo && mongoDb) {
      try {
        const docs = await mongoDb.collection("orders").find({}).toArray();
        const mapped = (docs || []).map((d) => ({ id: d._id || d.id, tableNumber: d.tableNumber, customerName: d.customerName, items: d.items, totalAmount: d.totalAmount, status: d.status, createdAt: d.createdAt || d.timestamp || Date.now() }));
        return res.json(mapped);
      } catch (e) {
        console.warn("Failed to load orders from MongoDB, falling back to in-memory", e);
      }
    }
    res.json(orders);
});

// Diagnostic endpoint removed — use MongoDB health checks instead if needed

// GET /orders/:id - get single order
app.get("/orders/:id", (req, res) => {
  (async () => {
    const id = req.params.id;
    if (useMongo && mongoDb) {
      try {
        const doc = await mongoDb.collection("orders").findOne({ _id: id });
        if (!doc) return res.status(404).json({ success: false, message: "Order not found" });
        return res.json({ id: doc._id || doc.id, ...doc });
      } catch (e) {
        console.warn("Failed to load order from MongoDB:", e);
      }
    }
    const order = orders.find((o) => o.id === id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json(order);
  })();
});

// POST /orders - create an order
app.post("/orders", async (req, res) => {
  const { tableNumber, customerName, items, totalAmount } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "No items in order" });
  }

  const order = {
    id: `ORD-${Date.now()}`,
    tableNumber: tableNumber || null,
    customerName: customerName || "Guest",
    items,
    totalAmount: totalAmount || items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0),
    status: "PENDING",
    createdAt: Date.now()
  };

  orders.push(order);
  // persist to MongoDB when available
  if (useMongo && mongoDb) {
    try { await mongoDb.collection("orders").updateOne({ _id: order.id }, { $set: { ...order, _id: order.id } }, { upsert: true }); } catch (e) { console.warn("Failed to persist order to MongoDB:", e && e.message ? e.message : e); }
  }
  res.json({ success: true, orderId: order.id });
});

// PATCH /orders/:id - update status or other fields
app.patch("/orders/:id", async (req, res) => {
  const { status } = req.body;
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, message: "Order not found" });

  if (status) orders[idx].status = status;
  // persist update
  if (useMongo && mongoDb) {
    try { await mongoDb.collection("orders").updateOne({ _id: orders[idx].id }, { $set: { ...orders[idx], _id: orders[idx].id } }, { upsert: true }); } catch (e) { console.warn("Failed to persist order update to MongoDB:", e && e.message ? e.message : e); }
  }

  res.json({ success: true, order: orders[idx] });
});

// Simple OTP endpoints for local testing (insecure — for dev only)
const otps = {}; // phone -> code

app.post("/otp", (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: "Phone required" });
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  otps[phone] = { code, createdAt: Date.now() };
  console.log(`Generated OTP for ${phone}: ${code}`);
  // In production you'd send via SMS; for local/dev we return it so QA can test
  res.json({ success: true, code });
});

// Debug endpoint to list recently generated OTPs (development only)
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/otps', (req, res) => {
    try {
      return res.json({ success: true, otps });
    } catch (e) {
      return res.status(500).json({ success: false, message: String(e) });
    }
  });
}

app.post("/otp/verify", (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ success: false, message: "Phone and code required" });
  const record = otps[phone];
  if (!record) return res.status(400).json({ success: false, message: "No OTP requested" });
  if (record.code !== String(code)) return res.status(400).json({ success: false, message: "Invalid code" });
  delete otps[phone];
  res.json({ success: true });
});

// POST /bills - generate a bill (returns computed bill)
app.post("/bills", async (req, res) => {
  const { tableNumber, customerName, items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "No items to bill" });
  }

  const subtotal = items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0);
  const taxRate = 0.05;
  const serviceRate = 0.02;
  const tax = Math.round(subtotal * taxRate);
  const service = Math.round(subtotal * serviceRate);
  const total = subtotal + tax + service;

  const bill = {
    id: `BILL-${Date.now()}`,
    tableNumber: tableNumber || null,
    customerName: customerName || "Guest",
    items,
    subtotal,
    tax,
    service,
    total,
    createdAt: Date.now()
  };

  bills.push(bill);
  if (useMongo && mongoDb) {
    try { await mongoDb.collection("bills").updateOne({ _id: bill.id }, { $set: { ...bill, _id: bill.id } }, { upsert: true }); } catch (e) { console.warn("Failed to persist bill to MongoDB:", e && e.message ? e.message : e); }
  }
  res.json({ success: true, bill });
});

// GET /bills/:id
app.get("/bills/:id", (req, res) => {
  (async () => {
    const id = req.params.id;
    if (useMongo && mongoDb) {
      try {
        const doc = await mongoDb.collection("bills").findOne({ _id: id });
        if (!doc) return res.status(404).json({ success: false, message: "Bill not found" });
        return res.json({ id: doc._id || doc.id, ...doc });
      } catch (e) {
        console.warn("Failed to load bill from MongoDB:", e);
      }
    }
    const bill = bills.find((b) => b.id === id);
    if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
    res.json(bill);
  })();
});

// Simple daily report computed from stored bills/orders
app.get("/reports/daily", (req, res) => {
  const date = req.query.date || new Date().toISOString().split("T")[0];
  // filter bills by date (createdAt)
  const start = new Date(date + "T00:00:00").getTime();
  const end = new Date(date + "T23:59:59").getTime();
  const dayBills = bills.filter((b) => b.createdAt >= start && b.createdAt <= end);
  const totalRevenue = dayBills.reduce((s, b) => s + (b.total || 0), 0);
  const totalOrders = dayBills.length;
  const customers = new Set(dayBills.map((b) => b.customerName));
  // top items
  const itemMap = {};
  dayBills.forEach((b) => {
    b.items.forEach((it) => {
      const key = it.id || it.name;
      if (!itemMap[key]) itemMap[key] = { name: it.name, quantity: 0, revenue: 0 };
      itemMap[key].quantity += it.quantity || 1;
      itemMap[key].revenue += (it.price || 0) * (it.quantity || 1);
    });
  });
  const topItems = Object.values(itemMap).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  const hourly = [];
  for (let h = 0; h < 24; h++) {
    const hourStart = start + h * 3600 * 1000;
    const hourEnd = hourStart + 3600 * 1000 - 1;
    const hb = dayBills.filter((b) => b.createdAt >= hourStart && b.createdAt <= hourEnd);
    hourly.push({ hour: `${String(h).padStart(2, "0")}:00`, orders: hb.length, revenue: hb.reduce((s, x) => s + (x.total || 0), 0) });
  }
  res.json({ date, totalOrders, totalRevenue, averageOrderValue: totalOrders ? totalRevenue / totalOrders : 0, totalCustomers: customers.size, topItems, hourlyBreakdown: hourly });
});

// Dev-only: seed menu collection from `menuData` (safe for local development)
if (process.env.NODE_ENV !== 'production') {
  app.post('/admin/seed-menu', async (req, res) => {
    try {
      const docs = [];
      Object.entries(menuData).forEach(([cat, items]) => {
        (items || []).forEach((it) => {
          const id = it.id || `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
          docs.push({ _id: id, name: it.name, price: it.price, available: typeof it.available === 'boolean' ? it.available : true, category: cat });
        });
      });

      if (useMongo && mongoDb) {
        const ops = docs.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: d }, upsert: true } }));
        if (ops.length) await mongoDb.collection('menu').bulkWrite(ops);
        return res.json({ success: true, inserted: docs.length });
      }

      // Fallback: seed in-memory menuData
      docs.forEach((d) => {
        if (!menuData[d.category]) menuData[d.category] = [];
        menuData[d.category].push({ id: d._id, name: d.name, price: d.price, available: d.available, category: d.category });
      });
      return res.json({ success: true, inserted: docs.length, message: 'Seeded in-memory menu' });
    } catch (e) {
      console.error('Seed failed:', e);
      return res.status(500).json({ success: false, error: String(e) });
    }
  });
}

const http = require("http");

// Helper: await a promise with timeout
function awaitPromiseWithTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const t = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('timeout'));
      }
    }, ms);
    promise.then((v) => {
      if (!settled) {
        settled = true;
        clearTimeout(t);
        resolve(v);
      }
    }).catch((e) => {
      if (!settled) {
        settled = true;
        clearTimeout(t);
        reject(e);
      }
    });
  });
}

// Start server with a retry when a port is already in use
const maxRetries = 10;
const basePort = parseInt(process.env.PORT || PORT, 10) || 4001;

(async function startServer() {
  // If configured to use MongoDB, wait a short time for the initial connection to complete
  if (process.env.USE_MONGO === "true" && mongoConnectPromise) {
    try {
      console.log('Waiting up to 5s for MongoDB connection before starting server...');
      await awaitPromiseWithTimeout(mongoConnectPromise, 5000);
      console.log('MongoDB connection established (or was already connected).');
    } catch (e) {
      console.error('MongoDB did not connect within timeout; failing fast. Error:', e && e.message ? e.message : e);
      // Fail-fast: stop startup so issues are visible in CI/dev when DB is required
      process.exit(1);
    }
  }
  for (let i = 0; i <= maxRetries; i++) {
    const tryPort = basePort + i;
    try {
      const server = http.createServer(app);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(tryPort, () => resolve());
      });
      console.log(`Backend API listening on http://localhost:${tryPort}`);
      return;
    } catch (err) {
      if (err && err.code === "EADDRINUSE") {
        console.warn(`Port ${tryPort} is in use — trying ${tryPort + 1}...`);
        // try next
        continue;
      }
      console.error("Failed to start server:", err);
      process.exit(1);
    }
  }
  console.error(`Unable to bind server after ${maxRetries + 1} attempts.`);
  process.exit(1);
})();

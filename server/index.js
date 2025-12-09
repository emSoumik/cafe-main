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

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Session setup for OAuth
const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set to true in production with HTTPS
}));

// Passport setup
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

app.use(passport.initialize());
app.use(passport.session());

// Configure Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:4001/auth/google/callback"
  },
    function (accessToken, refreshToken, profile, cb) {
      // In production, save user to database
      const user = {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        name: profile.displayName,
        authMethod: 'google'
      };
      return cb(null, user);
    }));

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  console.log("Google OAuth configured");
} else {
  console.warn("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found. Google OAuth disabled.");
}

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
const otps = {}; // phone/chatId -> { code, createdAt }

// Telegram Bot Setup
let bot = null;
const phoneToChat = {}; // phone -> chatId mapping

if (process.env.TELEGRAM_BOT_TOKEN) {
  try {
    const TelegramBot = require("node-telegram-bot-api");
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    console.log("Telegram Bot initialized with polling enabled");

    // Handle /start command
    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      bot.sendMessage(chatId,
        "Welcome! To use phone-based login, please share your phone number.\n\n" +
        "You can share it by:\n" +
        "1. Clicking the paperclip icon\n" +
        "2. Selecting 'Contact'\n" +
        "3. Choosing 'Share My Contact'\n\n" +
        "Or simply type your phone number (e.g., +1234567890)"
      );
    });

    // Handle contact (phone number shared via button)
    bot.on('contact', (msg) => {
      const chatId = msg.chat.id;
      const phone = msg.contact.phone_number;

      // Normalize phone (remove + and spaces)
      const normalizedPhone = phone.replace(/[\s+\-()]/g, '');
      phoneToChat[normalizedPhone] = chatId;

      console.log(`Registered phone ${normalizedPhone} -> chatId ${chatId}`);
      bot.sendMessage(chatId, `✅ Your phone number (${phone}) has been registered! You can now use it to login on the website.`);
    });

    // Handle text messages (in case user types phone number)
    bot.on('message', (msg) => {
      // Skip if it's a command or contact
      if (msg.text && msg.text.startsWith('/')) return;
      if (msg.contact) return;

      const chatId = msg.chat.id;
      const text = msg.text || '';

      // Check if message looks like a phone number (contains mostly digits)
      const digitsOnly = text.replace(/[\s+\-()]/g, '');
      if (digitsOnly.length >= 10 && /^\d+$/.test(digitsOnly)) {
        phoneToChat[digitsOnly] = chatId;
        console.log(`Registered phone ${digitsOnly} -> chatId ${chatId}`);
        bot.sendMessage(chatId, `✅ Your phone number has been registered! You can now use it to login on the website.`);
      }
    });

  } catch (e) {
    console.warn("Failed to initialize Telegram Bot:", e.message);
  }
} else {
  console.warn("TELEGRAM_BOT_TOKEN not found in .env. Telegram features will be disabled.");
}

app.post("/otp", (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: "Phone required" });
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  otps[phone] = { code, createdAt: Date.now() };
  console.log(`Generated OTP for ${phone}: ${code}`);
  // In production you'd send via SMS; for local/dev we return it so QA can test
  res.json({ success: true, code });
});

// Telegram OTP Endpoints (phone-based)
app.post("/auth/telegram/otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: "Phone number required" });

  if (!bot) {
    return res.status(503).json({ success: false, message: "Telegram service not configured (missing token)" });
  }

  // Normalize phone number
  const normalizedPhone = phone.replace(/[\s+\-()]/g, '');

  // Look up chatId from phone number
  const chatId = phoneToChat[normalizedPhone];
  if (!chatId) {
    return res.status(404).json({
      success: false,
      message: "Phone number not registered. Please send /start to the bot and share your phone number first."
    });
  }

  const code = Math.floor(1000 + Math.random() * 9000).toString();
  otps[normalizedPhone] = { code, createdAt: Date.now() };

  try {
    await bot.sendMessage(chatId, `🔐 Your login code is: ${code}\n\nThis code will expire in 5 minutes.`);
    console.log(`Sent Telegram OTP to phone ${normalizedPhone} (chatId ${chatId}): ${code}`);
    res.json({ success: true, message: "OTP sent to your Telegram" });
  } catch (e) {
    console.error("Failed to send Telegram message:", e.message);
    res.status(500).json({ success: false, message: "Failed to send OTP via Telegram. Please try again." });
  }
});

app.post("/auth/telegram/verify", (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ success: false, message: "Phone number and code required" });

  // Normalize phone number
  const normalizedPhone = phone.replace(/[\s+\-()]/g, '');

  const record = otps[normalizedPhone];
  if (!record) return res.status(400).json({ success: false, message: "No OTP requested for this phone number" });

  // Check expiration (e.g., 5 minutes)
  if (Date.now() - record.createdAt > 5 * 60 * 1000) {
    delete otps[normalizedPhone];
    return res.status(400).json({ success: false, message: "OTP expired" });
  }

  if (record.code !== String(code)) return res.status(400).json({ success: false, message: "Invalid code" });

  // Clear OTP after successful use
  delete otps[normalizedPhone];

  // Return a mock token or session info
  const token = `telegram-${Date.now()}-${normalizedPhone}`;
  res.json({ success: true, token, user: { phone: normalizedPhone, authMethod: 'telegram' } });
});

app.post("/otp/verify", (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ success: false, message: "Phone and code required" });
  const record = otps[phone];
  if (!record) return res.status(400).json({ success: false, message: "No OTP requested" });
  if (record.code !== String(code)) return res.status(400).json({ success: false, message: "Invalid code" });
  delete otps[phone];
  res.json({ success: true });
});

// Google OAuth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173' }),
  function (req, res) {
    // Successful authentication - generate token
    const token = `google-${Date.now()}-${req.user.id}`;
    // Redirect to frontend with token
    res.redirect(`http://localhost:5173?auth=success&token=${token}&user=${encodeURIComponent(JSON.stringify(req.user))}`);
  }
);

// Logout endpoint
app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
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
      const newMenuData = {
        "Coffee": [
          { id: "1", name: "Espresso", price: 120, available: true, description: "Rich and bold single shot espresso", image: "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=800&q=80" },
          { id: "2", name: "Cappuccino", price: 180, available: true, description: "Espresso with steamed milk and foam", image: "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&q=80" },
          { id: "3", name: "Latte", price: 200, available: true, description: "Creamy espresso with steamed milk", image: "https://images.unsplash.com/photo-1561882468-485337cbe922?w=800&q=80" },
          { id: "4", name: "Americano", price: 150, available: true, description: "Espresso diluted with hot water", image: "https://images.unsplash.com/photo-1551033406-611cf9a28f67?w=800&q=80" }
        ],
        "Snacks": [
          { id: "5", name: "Croissant", price: 120, available: true, description: "Buttery, flaky, and freshly baked", image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80" },
          { id: "6", name: "Muffin", price: 100, available: true, description: "Soft blueberry muffin", image: "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=800&q=80" },
          { id: "7", name: "Sandwich", price: 250, available: true, description: "Grilled cheese and veggie sandwich", image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&q=80" }
        ],
        "Desserts": [
          { id: "8", name: "Cheesecake", price: 220, available: true, description: "Classic New York style cheesecake", image: "https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=800&q=80" },
          { id: "9", name: "Brownie", price: 150, available: true, description: "Fudgy chocolate brownie", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476d?w=800&q=80" }
        ]
      };
      Object.entries(newMenuData).forEach(([cat, items]) => {
        (items || []).forEach((it) => {
          const id = it.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          docs.push({ _id: id, name: it.name, price: it.price, available: typeof it.available === 'boolean' ? it.available : true, category: cat, description: it.description, image: it.image });
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

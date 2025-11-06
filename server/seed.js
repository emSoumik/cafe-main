// Simple seed script to populate MongoDB with menuData from ./data.js
// Usage: node seed.js

const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

// Load .env if present
try {
  const dotenv = require('dotenv');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
} catch (e) {
  // ignore
}

const { menuData } = require('./data');

async function run() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DBNAME || 'snappy_serve';
  if (!uri) {
    console.error('MONGODB_URI not set in env. Create server/.env with MONGODB_URI to run this script.');
    process.exit(2);
  }
  const client = new MongoClient(uri, { serverApi: { version: '1' } });
  try {
    await client.connect();
    const db = client.db(dbName);
    const docs = [];
    Object.entries(menuData).forEach(([cat, items]) => {
      (items || []).forEach((it) => {
        const id = it.id || `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
        docs.push({ _id: id, name: it.name, price: it.price, available: typeof it.available === 'boolean' ? it.available : true, category: cat });
      });
    });
    if (docs.length === 0) {
      console.log('No menu items found to seed.');
      return;
    }
    const ops = docs.map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: d }, upsert: true } }));
    const res = await db.collection('menu').bulkWrite(ops);
    console.log('Seed completed. Upserted:', res.upsertedCount || 0, 'Modified:', res.modifiedCount || 0);
  } catch (e) {
    console.error('Seed failed:', e);
  } finally {
    await client.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });

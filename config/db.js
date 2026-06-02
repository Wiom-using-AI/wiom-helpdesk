const mongoose = require('mongoose');

let isConnected = false;

// Build direct connection URI as fallback (Windows SRV DNS workaround)
const buildDirectUri = (srvUri) => {
  try {
    const match = srvUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]*)/);
    if (!match) return null;
    const [, user, pass, host, db] = match;
    const base = host.replace(/^[^.]+\./, ''); // remove cluster prefix
    const dbName = db || 'wiom_helpdesk';
    return `mongodb://${user}:${pass}@ac-iqzzmqw-shard-00-00.${base}:27017/${dbName}?ssl=true&authSource=admin&directConnection=true`;
  } catch { return null; }
};

const connectDB = async () => {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;

  try {
    // Try SRV URI first (works on Railway/Linux)
    const conn = await mongoose.connect(uri, { dbName: 'wiom_helpdesk', serverSelectionTimeoutMS: 8000 });
    isConnected = true;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (srvErr) {
    console.warn('⚠️  SRV connection failed, trying direct connection...');
    const directUri = buildDirectUri(uri);
    if (!directUri) {
      console.error('❌ MongoDB connection failed:', srvErr.message);
      process.exit(1);
    }
    try {
      const conn = await mongoose.connect(directUri, { dbName: 'wiom_helpdesk', directConnection: true });
      isConnected = true;
      console.log(`✅ MongoDB connected (direct): ${conn.connection.host}`);
    } catch (directErr) {
      console.error('❌ MongoDB connection failed:', directErr.message);
      process.exit(1);
    }
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected. Retrying...');
    isConnected = false;
    setTimeout(connectDB, 5000);
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB error:', err.message);
  });
};

module.exports = connectDB;

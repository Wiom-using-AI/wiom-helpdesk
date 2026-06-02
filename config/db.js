const mongoose = require('mongoose');

let isConnected = false;

// Find primary MongoDB node dynamically (Windows SRV DNS workaround)
const findPrimaryAndConnect = async (srvUri) => {
  const match = srvUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]*)/);
  if (!match) return null;
  const [, user, pass, host, db] = match;
  const base = host.replace(/^[^.]+\./, '');
  const dbName = db || 'wiom_helpdesk';
  const nodes = ['shard-00-00', 'shard-00-01', 'shard-00-02'];

  // Try each node — find the primary (avoid "not primary" write errors)
  for (const node of nodes) {
    const nodeUri = `mongodb://${user}:${pass}@ac-iqzzmqw-${node}.${base}:27017/${dbName}?ssl=true&authSource=admin&directConnection=true`;
    try {
      const tempConn = mongoose.createConnection(nodeUri, { serverSelectionTimeoutMS: 6000, directConnection: true });
      await tempConn.asPromise();
      const result = await tempConn.db.admin().command({ isMaster: 1 });
      await tempConn.close();
      if (result.ismaster) {
        // This node IS the primary — connect to it
        console.log(`✅ MongoDB primary found: ac-iqzzmqw-${node}.${base}`);
        return `mongodb://${user}:${pass}@ac-iqzzmqw-${node}.${base}:27017/${dbName}?ssl=true&authSource=admin&directConnection=true`;
      }
    } catch { /* try next node */ }
  }
  return null;
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
    console.warn('⚠️  SRV failed, finding primary node...');
    try {
      const primaryUri = await findPrimaryAndConnect(uri);
      if (!primaryUri) throw new Error('No primary found');
      const conn = await mongoose.connect(primaryUri, { dbName: 'wiom_helpdesk', directConnection: true });
      isConnected = true;
      console.log(`✅ MongoDB connected (primary): ${conn.connection.host}`);
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

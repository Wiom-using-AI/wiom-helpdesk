require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const cron       = require('node-cron');
const connectDB  = require('./config/db');

const authRoutes     = require('./routes/auth');
const ticketRoutes   = require('./routes/tickets');
const aiRoutes       = require('./routes/ai');
const employeeRoutes = require('./routes/employees');
const adminRoutes    = require('./routes/admin');
const kbRoutes       = require('./routes/kb');
const agentRoutes    = require('./routes/agent');
const slaService     = require('./services/sla');
const Ticket         = require('./models/Ticket');
const Conversation   = require('./models/Conversation');
const FixJob         = require('./models/FixJob');

// â”€â”€ FIX: Global crash guards â€” Slack Socket Mode disconnect nahi crash karein â”€
process.on('uncaughtException', (err) => {
  // Slack Socket Mode "server explicit disconnect" is normal â€” ignore it
  if (err.message && err.message.includes('Unhandled event')) {
    console.warn('âš ï¸  Slack WebSocket disconnect (auto-reconnecting):', err.message);
    return; // do NOT exit â€” let Bolt auto-reconnect
  }
  console.error('ðŸ’¥ Uncaught Exception:', err.message);
  // For truly unexpected errors, log but keep running
});

process.on('unhandledRejection', (reason) => {
  console.error('ðŸ’¥ Unhandled Rejection:', reason?.message || reason);
  // Never crash the process on unhandled promise rejections
});

// â”€â”€ Slack client (set after bot starts) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let slackClient = null;

const app  = express();
const PORT = process.env.PORT || 3000;

// â”€â”€ Connect Database â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
connectDB();

// â”€â”€ Security & Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc    : ["'self'"],
      scriptSrc     : ["'self'", "'unsafe-inline'"],
      scriptSrcAttr : ["'unsafe-inline'"],
      styleSrc      : ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc       : ["'self'", "https://fonts.gstatic.com"],
      imgSrc        : ["'self'", "data:", "https:"],
      connectSrc    : ["'self'", "https://web-production-ef6c1.up.railway.app"]
    }
  }
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// â”€â”€ Serve Employee Portal (public/) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(express.static('public'));

// â”€â”€ Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api', (req, res) => {
  res.json({
    status  : 'ok',
    service : 'WIOM IT Helpdesk API',
    version : '1.0.0',
    portal  : 'https://web-production-ef6c1.up.railway.app',
    time    : new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// â”€â”€ API Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/api/auth',      authRoutes);
app.use('/api/tickets',   ticketRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/kb',        kbRoutes);
app.use('/api/agent',     agentRoutes);

// â”€â”€ WhatsApp Webhook (Twilio) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/whatsapp/incoming', async (req, res) => {
  try {
    const accountSid  = process.env.TWILIO_ACCOUNT_SID;
    const authToken   = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return res.send('<Response></Response>');
    const twilio = require('twilio')(accountSid, authToken);
    const waSvc  = require('./services/whatsapp');
    await waSvc.handleIncoming(req, res, twilio);
  } catch (err) {
    console.error('WhatsApp webhook error:', err.message);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  }
});

// â”€â”€ 404 Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// â”€â”€ Global Error Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((err, req, res, next) => {
  console.error('âŒ Error:', err.message);
  res.status(err.status || 500).json({
    error  : err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// â”€â”€ SLA Cron: Check every 30 min â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
cron.schedule('*/30 * * * *', () => {
  console.log('â° SLA check running...');
  slaService.checkBreaches();
});

// â”€â”€ Auto-Escalation Cron: Every hour â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
cron.schedule('0 * * * *', async () => {
  try {
    const adminId = process.env.ADMIN_EMAIL_SLACK_ID;
    if (!slackClient || !adminId || adminId === 'FILL_KARO') return;

    const fourHoursAgo = new Date(Date.now() - 4 * 3600000);
    const stale = await Ticket.find({
      status       : { $in: ['Open', 'In Progress'] },
      createdAt    : { $lte: fourHoursAgo },
      escalationSent: false
    });

    for (const t of stale) {
      const hoursOld = Math.round((Date.now() - t.createdAt) / 3600000);
      const priEmoji = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };
      try {
        await slackClient.chat.postMessage({
          channel: adminId,
          text: `âš ï¸ Escalation: ${t.ticketId} â€” ${t.empName} (${hoursOld}h open)`,
          attachments: [{
            color: '#ef4444',
            blocks: [
              { type:'header', text:{ type:'plain_text', text:`âš ï¸ Escalation Alert â€” ${t.ticketId}`, emoji:true }},
              { type:'section', fields:[
                { type:'mrkdwn', text:`*ðŸ‘¤ Employee*\n${t.empName} (${t.empDept||'Unknown'})` },
                { type:'mrkdwn', text:`*${priEmoji[t.priority]||'ðŸŸ¡'} Priority*\n${t.priority}` },
                { type:'mrkdwn', text:`*â± Open Since*\n${hoursOld} hours` },
                { type:'mrkdwn', text:`*ðŸ“‚ Category*\n${t.category||'Other'}` }
              ]},
              { type:'section', text:{ type:'mrkdwn', text:`*ðŸ“ Issue:*\n${t.description}` }},
              { type:'context', elements:[{ type:'mrkdwn', text:`_Abhi tak resolve nahi hua â€” please check karo!_` }]}
            ]
          }]
        });
        t.escalationSent = true;
        await t.save();
        console.log(`ðŸ“£ Escalation sent for ${t.ticketId} (${hoursOld}h old)`);
      } catch (err) {
        console.error(`Escalation DM failed for ${t.ticketId}:`, err.message);
      }
    }
    if (stale.length) console.log(`âš¡ Escalated ${stale.length} tickets`);
  } catch (err) {
    console.error('Escalation cron error:', err.message);
  }
});

// â”€â”€ Employee Reminder Cron: Every hour â€” ticket 4h+ open â†’ remind employee via Slack â”€
cron.schedule('30 * * * *', async () => {
  try {
    if (!slackClient) return;

    const fourHoursAgo = new Date(Date.now() - 4 * 3600000);
    const unreminded = await Ticket.find({
      status       : { $in: ['Open', 'In Progress'] },
      createdAt    : { $lte: fourHoursAgo },
      reminderSent : false,
      slackUserId  : { $exists: true, $ne: null }
    });

    for (const t of unreminded) {
      const hoursOld = Math.floor((Date.now() - new Date(t.createdAt)) / 3600000);
      const priEmoji = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };
      try {
        await slackClient.chat.postMessage({
          channel: t.slackUserId,
          text   : `â³ Aapka ticket ${t.ticketId} abhi bhi open hai â€” IT team kaam kar rahi hai!`,
          blocks : [
            { type:'section', text:{ type:'mrkdwn', text:
              `â³ *Aapka ticket abhi bhi open hai!*\n\n` +
              `*ðŸŽ« Ticket:* \`${t.ticketId}\`\n` +
              `*${priEmoji[t.priority]||'ðŸŸ¡'} Priority:* ${t.priority}\n` +
              `*ðŸ“ Problem:* ${(t.description||'').substring(0,80)}${(t.description||'').length>80?'...':''}\n` +
              `*â± Open Since:* ${hoursOld} ghante pehle`
            }},
            { type:'context', elements:[{ type:'mrkdwn', text:
              `_IT team aapke ticket par kaam kar rahi hai ðŸ™ Jaldi solve ho jayega!_\nUrgent ho toh call karein: *IT Helpdesk (Slack)*`
            }]}
          ]
        });
        t.reminderSent = true;
        await t.save();
        console.log(`ðŸ”” Reminder sent to ${t.slackUserId} for ticket ${t.ticketId} (${hoursOld}h old)`);
      } catch (err) {
        console.error(`Reminder DM failed for ${t.ticketId}:`, err.message);
      }
    }
    if (unreminded.length) console.log(`ðŸ”” Sent ${unreminded.length} employee reminders`);
  } catch (err) {
    console.error('Employee reminder cron error:', err.message);
  }
});

// â”€â”€ Auto-Close Cron: Daily 2AM â€” Resolved 3+ days ago â†’ Closed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
cron.schedule('0 2 * * *', async () => {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600000);
    const result = await Ticket.updateMany(
      { status: 'Resolved', resolvedAt: { $lte: threeDaysAgo } },
      { $set: { status: 'Closed', closedAt: new Date() } }
    );
    if (result.modifiedCount > 0)
      console.log(`ðŸ”’ Auto-closed ${result.modifiedCount} resolved tickets`);
  } catch (err) {
    console.error('Auto-close cron error:', err.message);
  }
});

// â”€â”€ Recurring Issue Alert: Every 30 min â€” flag when 3+ employees report same problem â”€â”€
cron.schedule('*/30 * * * *', async () => {
  try {
    if (!slackClient) return;
    const adminId = process.env.ADMIN_EMAIL_SLACK_ID;
    if (!adminId || adminId === 'FILL_KARO') return;

    const oneHourAgo = new Date(Date.now() - 3600000);
    // Group recent tickets by category
    const grouped = await Ticket.aggregate([
      { $match: { createdAt: { $gte: oneHourAgo }, status: { $in: ['Open','In Progress'] } } },
      { $group: { _id: '$category', count: { $sum: 1 }, employees: { $push: '$empName' } } },
      { $match: { count: { $gte: 3 } } }
    ]);

    for (const g of grouped) {
      const key = `recurring-alert-${g._id}-${new Date().toISOString().slice(0,13)}`;
      // Avoid duplicate alerts in same hour (use simple in-memory set)
      if (global._sentRecurringAlerts?.has(key)) continue;
      if (!global._sentRecurringAlerts) global._sentRecurringAlerts = new Set();
      global._sentRecurringAlerts.add(key);

      await slackClient.chat.postMessage({
        channel: adminId,
        text   : `âš ï¸ ${g.count} employees same problem report kar rahe hain: ${g._id}`,
        blocks : [
          { type:'header', text:{ type:'plain_text', text:`âš ï¸ Recurring Issue Alert`, emoji:true }},
          { type:'section', text:{ type:'mrkdwn', text:
            `*${g.count} employees ne last 1 hour mein same issue report kiya!*\n\n*Category:* ${g._id}\n*Employees:* ${g.employees.slice(0,5).join(', ')}${g.count > 5 ? ` +${g.count-5} more` : ''}`
          }},
          { type:'context', elements:[{ type:'mrkdwn', text:`_Systemic problem ho sakta hai â€” please investigate!_` }]}
        ]
      });
      console.log(`âš ï¸ Recurring issue alert sent for category: ${g._id} (${g.count} tickets)`);
    }
  } catch (err) {
    console.error('Recurring issue cron error:', err.message);
  }
});

// â”€â”€ Auto-create default admin if none exists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ensureAdminExists = async () => {
  try {
    const Admin = require('./models/Admin');
    const count = await Admin.countDocuments();
    if (count === 0) {
      await Admin.create({
        username    : 'ADMIN_EMAIL',
        passwordHash: process.env.ADMIN_PASSWORD || 'Wiom@2024',
        name        : 'IT Admin',
        email       : process.env.ADMIN_EMAIL || 'it@wiom.in',
        role        : 'superadmin'
      });
      console.log('âœ… Default admin created: ADMIN_EMAIL / Wiom@2024');
    }
  } catch (err) {
    console.error('Admin setup error:', err.message);
  }
};

// â”€â”€ Start Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.listen(PORT, async () => {
  console.log(`\nðŸš€ WIOM Helpdesk API running on port ${PORT}`);
  console.log(`ðŸ“‹ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`ðŸŒ Health: http://localhost:${PORT}/health\n`);

  await ensureAdminExists();

  // â”€â”€ Start Slack Bot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_BOT_TOKEN !== 'FILL_KARO') {
    try {
      const { App }   = require('@slack/bolt');
      const claudeSvc = require('./services/claude');
      const Employee  = require('./models/Employee');
      const API_BASE  = process.env.API_BASE_URL || `http://localhost:${PORT}`;

      const slackApp = new App({
        token        : process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        socketMode   : true,
        appToken     : process.env.SLACK_APP_TOKEN
      });

      // â”€â”€ In-memory store for pending ticket confirmations (short-lived) â”€â”€â”€â”€â”€
      const pendingTickets  = new Map(); // slackUserId -> ticketData
      const expandedHomeMap = new Map(); // slackUserId -> Set<categoryKey>

      // â”€â”€ Brand detection helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const detectBrand = (laptopName) => {
        if (!laptopName) return 'unknown';
        const n = laptopName.toLowerCase();
        if (n.includes('macbook') || n.includes('apple') || n.includes('mac pro') || n.includes('mac mini') || n.includes('m4') || n.includes('m5')) return 'apple';
        if (n.includes('hp') || n.includes('elitebook') || n.includes('probook') || n.includes('envy') || n.includes('pavilion') || n.includes('omen') || n.includes('zbook')) return 'hp';
        if (n.includes('dell') || n.includes('latitude') || n.includes('inspiron') || n.includes('xps') || n.includes('precision') || n.includes('vostro') || n.includes('alienware')) return 'dell';
        if (n.includes('lenovo') || n.includes('thinkpad') || n.includes('ideapad') || n.includes('yoga') || n.includes('legion')) return 'lenovo';
        if (n.includes('asus') || n.includes('vivobook') || n.includes('zenbook') || n.includes('rog')) return 'asus';
        if (n.includes('acer') || n.includes('aspire') || n.includes('swift') || n.includes('nitro')) return 'acer';
        return 'unknown';
      };

      const getBrandInfo = (brand, sn) => {
        const enc = encodeURIComponent(sn || '');
        switch (brand) {
          case 'apple':
            return {
              brandLabel : 'ðŸŽ Apple MacBook',
              warrantyUrl: `https://checkcoverage.apple.com/?sn=${enc}`,
              diagScript : null,   // Mac can't run .bat
              diagLabel  : null,
              appleMode  : true,
              supportUrl : 'https://getsupport.apple.com'
            };
          case 'hp':
            return {
              brandLabel : 'ðŸ–¥ï¸ HP',
              warrantyUrl: `https://support.hp.com/us-en/checkwarranty`,
              diagScript : 'fix-diagnostic-hp.bat',
              diagLabel  : 'ðŸ” HP Hardware Diagnostic Script',
              appleMode  : false,
              supportUrl : 'https://support.hp.com'
            };
          case 'dell':
            return {
              brandLabel : 'ðŸ–¥ï¸ Dell',
              warrantyUrl: `https://www.dell.com/support/home/?s=BSD&ServiceTag=${enc}`,
              diagScript : 'fix-diagnostic-dell.bat',
              diagLabel  : 'ðŸ” Dell SupportAssist Script',
              appleMode  : false,
              supportUrl : 'https://www.dell.com/support'
            };
          case 'lenovo':
            return {
              brandLabel : 'ðŸ–¥ï¸ Lenovo',
              warrantyUrl: `https://pcsupport.lenovo.com/us/en/warranty-lookup`,
              diagScript : 'fix-diagnostic-lenovo.bat',
              diagLabel  : 'ðŸ” Lenovo Vantage Diagnostic Script',
              appleMode  : false,
              supportUrl : 'https://support.lenovo.com'
            };
          default:
            return {
              brandLabel : 'ðŸ’» Laptop',
              warrantyUrl: null,
              diagScript : null,
              diagLabel  : null,
              appleMode  : false,
              supportUrl : null
            };
        }
      };

      // â”€â”€ Category definitions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const CATEGORIES = [
        {
          key: 'laptop', label: 'ðŸ”µ ðŸ’» Laptop & Display',
          desc: 'Slow laptop â€¢ Screen â€¢ Keyboard â€¢ Audio â€¢ Camera â€¢ USB â€¢ Bluetooth aur zyada',
          rows: [
            [
              { text:'ðŸ’» Laptop Slow',              value:'My laptop is very slow what should I do',                                   id:'home_quick_1'  },
              { text:'ðŸ’» Won\'t Turn On',            value:'My laptop is not turning on at all',                                        id:'home_quick_2'  },
              { text:'ðŸ’™ Blue Screen',               value:'Getting blue screen of death BSOD error',                                   id:'home_quick_3'  },
              { text:'ðŸŒ¡ï¸ Overheating',              value:'My laptop is overheating getting very hot',                                  id:'home_quick_4'  },
              { text:'ðŸ”‹ Battery Issue',             value:'Laptop battery drains quickly or not charging at all',                      id:'home_quick_5'  }
            ],
            [
              { text:'ðŸ–¥ï¸ Screen Black',             value:'Laptop screen is black cannot see anything',                                id:'home_quick_6'  },
              { text:'âŒ¨ï¸ Keyboard Issue',            value:'Laptop keyboard not working some keys not responding',                      id:'home_quick_7'  },
              { text:'ðŸ–±ï¸ Touchpad Issue',            value:'Mouse or touchpad is not working not responding',                          id:'home_quick_8'  },
              { text:'â„ï¸ Freezing / Hanging',        value:'Laptop is hanging freezing not responding at all',                          id:'home_quick_21' },
              { text:'âš¡ Sudden Shutdown',           value:'Laptop shuts down suddenly without any warning',                            id:'home_quick_30' }
            ],
            [
              { text:'ðŸ”Š No Sound',                  value:'No sound coming from laptop speakers audio not working',                   id:'home_quick_9'  },
              { text:'ðŸŽ¤ Mic Not Working',           value:'Microphone not working voice not going in Teams or calls',                  id:'home_quick_16' },
              { text:'ðŸ“· Camera Issue',              value:'Laptop camera not working in Teams Zoom or Meet',                          id:'home_quick_20' },
              { text:'ðŸŽ§ Headphone Issue',           value:'Headphone or earphone not connecting or no sound',                         id:'home_quick_46' },
              { text:'ðŸ–¥ï¸ External Monitor',          value:'External monitor not detected screen not showing on it',                   id:'home_quick_17' }
            ],
            [
              { text:'ðŸ“º Screen Flickering',         value:'Laptop screen is flickering blinking or flashing',                         id:'home_quick_39' },
              { text:'ðŸ”µ Bluetooth Issue',           value:'Laptop bluetooth not working cannot connect any device',                    id:'home_quick_40' },
              { text:'ðŸ”Œ USB Not Working',           value:'USB port not working pendrive or device not detected',                     id:'home_quick_63' },
              { text:'ðŸ˜´ Sleep / Wake Issue',        value:'Laptop not waking up from sleep screen stays black',                       id:'home_quick_64' },
              { text:'ðŸ’¨ Fan Noise',                 value:'Laptop fan is making very loud noise constantly',                          id:'home_quick_38' }
            ],
            [
              { text:'ðŸ’§ Liquid Damage',             value:'Liquid or water spilled on laptop needs immediate attention',               id:'home_quick_70', style:'danger' },
              { text:'ðŸ” Stuck Restarting',          value:'Laptop is stuck in restart loop keeps restarting again and again',          id:'home_quick_33', style:'danger' },
              { text:'ðŸš« Boot Error',                value:'Laptop not starting getting boot error Windows not loading',               id:'home_quick_65', style:'danger' },
              { text:'ðŸ”¡ Caps Lock Stuck',           value:'Caps Lock always stays on or keyboard keys are stuck',                     id:'home_quick_72' },
              { text:'ðŸŒ Slow After Update',         value:'Laptop became very slow after a Windows update',                           id:'home_quick_71' }
            ]
          ]
        },
        {
          key: 'network', label: 'ðŸŸ¢ ðŸŒ Network & Internet', style: 'primary',
          desc: 'WiFi problem â€¢ Internet slow â€¢ Website blocked â€¢ Password â€¢ Disconnecting',
          rows: [
            [
              { text:'ðŸ“¶ WiFi Not Working',          value:'WiFi not working no internet connection',                                   id:'home_quick_11' },
              { text:'ðŸ¢ Internet Very Slow',        value:'Internet speed is very slow browsing not working properly',                 id:'home_quick_29' },
              { text:'ðŸ”‘ WiFi Password',             value:'Need WiFi password or forgot WiFi password',                               id:'home_quick_32' },
              { text:'ðŸš« Website Not Opening',       value:'Website not opening showing blocked or access denied',                     id:'home_quick_43' },
              { text:'ðŸ“¶ WiFi Disconnecting',        value:'WiFi keeps disconnecting again and again dropping connection',              id:'home_quick_44' }
            ]
          ]
        },
        {
          key: 'software', label: 'ðŸŸ¡ ðŸ’¿ Software, Apps & Account',
          desc: 'Teams â€¢ Zoom â€¢ Outlook â€¢ Password reset â€¢ Virus â€¢ Account locked â€¢ OneDrive',
          rows: [
            [
              { text:'ðŸ“¹ Teams Issue',               value:'Microsoft Teams not working call dropping or not opening',                  id:'home_quick_13' },
              { text:'ðŸ–¥ï¸ Zoom Issue',                value:'Zoom not working cannot join meeting or Zoom crashing',                    id:'home_quick_27' },
              { text:'ðŸ“§ Outlook Issue',             value:'Outlook not opening or cannot send receive emails',                        id:'home_quick_50' },
              { text:'ðŸŒ Browser Issue',             value:'Browser is slow crashing or freezing Chrome Firefox Edge',                 id:'home_quick_31' },
              { text:'ðŸ“„ Word / Excel Issue',        value:'Microsoft Word or Excel not opening showing error',                        id:'home_quick_23' }
            ],
            [
              { text:'â˜ï¸ OneDrive Sync Issue',       value:'OneDrive not syncing files not going to cloud',                            id:'home_quick_51' },
              { text:'ðŸ”„ Windows Update Issue',      value:'Windows update not installing stuck or causing issues',                    id:'home_quick_24' },
              { text:'ðŸ“„ PDF Not Opening',           value:'PDF file not opening PDF reader not working',                              id:'home_quick_52' },
              { text:'ðŸ’¥ App Crashing',              value:'Application keeps crashing or closing suddenly',                           id:'home_quick_53' },
              { text:'ðŸ“‹ Copy Paste Issue',          value:'Copy paste not working Ctrl+C Ctrl+V not responding',                     id:'home_quick_34' }
            ],
            [
              { text:'ðŸ”‘ Password Reset',            value:'Forgot password need to reset it',                                         id:'home_quick_14' },
              { text:'ðŸ“§ Email Password',            value:'Forgot email account password need to reset it',                           id:'home_quick_59' },
              { text:'ðŸ’¾ Storage Full',              value:'Laptop storage full C drive is full cannot save files',                    id:'home_quick_18' },
              { text:'ðŸ¦  Virus Suspected',           value:'Laptop may have virus showing ads or behaving strangely',                  id:'home_quick_19' },
              { text:'ðŸ”’ Account Locked',            value:'Account is locked cannot login to Windows or any account',                 id:'home_quick_55' }
            ],
            [
              { text:'ðŸ“± 2FA / OTP Issue',           value:'Two factor authentication OTP not coming cannot login',                    id:'home_quick_56' },
              { text:'ðŸ›¡ï¸ Antivirus Alert',           value:'Antivirus showing alert or has blocked something',                        id:'home_quick_57' },
              { text:'â˜ï¸ OneDrive Full',             value:'OneDrive storage is full files not syncing',                               id:'home_quick_58' },
              { text:'ðŸ• Wrong Date / Time',         value:'Laptop showing wrong date or time needs to be corrected',                  id:'home_quick_35' }
            ]
          ]
        },
        {
          key: 'replacement', label: 'ðŸ”´ ðŸ”„ Replacement / Upgrade', style: 'danger',
          desc: 'Laptop â€¢ Mouse â€¢ Keyboard â€¢ Monitor â€” replacement request karein',
          rows: [
            [
              { text:'ðŸ”„ Laptop Replacement',        value:'Laptop needs replacement old one is damaged or not working',               id:'home_quick_37' },
              { text:'ðŸ–±ï¸ Mouse Replacement',         value:'Mouse is damaged need a replacement',                                      id:'home_quick_60' },
              { text:'âŒ¨ï¸ Keyboard Replacement',      value:'Keyboard is damaged need a replacement',                                   id:'home_quick_61' },
              { text:'ðŸ–¥ï¸ New Monitor Request',       value:'Need a new monitor or monitor replacement',                               id:'home_quick_62' }
            ]
          ]
        }
      ];

      // â”€â”€ Auto-Fix mapping: which buttons can be auto-fixed on laptop â”€â”€â”€â”€â”€â”€
      const AUTO_FIX_MAP = {
        // â”€â”€ Performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_1' : { fixType: ['kill_heavy', 'clean_temp'], label: 'ðŸ’» Laptop Speed Fix'      },
        'home_quick_21': { fixType: ['kill_heavy'],               label: 'ðŸ’» Freezing Fix'           },
        'home_quick_71': { fixType: ['kill_heavy', 'clean_temp'], label: 'ðŸŒ Post-Update Fix'        },
        'home_quick_4' : { fixType: ['fix_overheating'],          label: 'ðŸŒ¡ï¸ Overheating Fix'        },
        'home_quick_38': { fixType: ['fix_overheating'],          label: 'ðŸ’¨ Fan/Heat Fix'           },
        // â”€â”€ Network â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_11': { fixType: ['fix_wifi'],                 label: 'ðŸ“¶ WiFi Reset'             },
        'home_quick_44': { fixType: ['fix_wifi'],                 label: 'ðŸ“¶ WiFi Reconnect Fix'     },
        'home_quick_29': { fixType: ['fix_wifi'],                 label: 'ðŸ“¶ Internet Speed Fix'     },
        // â”€â”€ Audio & Display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_9' : { fixType: ['fix_sound'],                label: 'ðŸ”Š Sound Fix'             },
        'home_quick_28': { fixType: ['fix_sound'],                label: 'ðŸ”Š Speaker Fix'            },
        'home_quick_46': { fixType: ['fix_sound'],                label: 'ðŸŽ§ Headphone Fix'          },
        'home_quick_39': { fixType: ['fix_screen_flicker'],       label: 'ðŸ“º Screen Flicker Fix'     },
        // â”€â”€ Input Devices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_7' : { fixType: ['fix_keyboard'],             label: 'âŒ¨ï¸ Keyboard Fix'           },
        'home_quick_72': { fixType: ['fix_keyboard'],             label: 'ðŸ”¡ Caps Lock Fix'          },
        'home_quick_8' : { fixType: ['fix_touchpad'],             label: 'ðŸ–±ï¸ Touchpad Fix'           },
        'home_quick_40': { fixType: ['fix_bluetooth'],            label: 'ðŸ”µ Bluetooth Fix'          },
        'home_quick_63': { fixType: ['fix_usb'],                  label: 'ðŸ”Œ USB Fix'                },
        // â”€â”€ Camera & Mic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_16': { fixType: ['fix_mic'],                  label: 'ðŸŽ¤ Microphone Fix'         },
        'home_quick_20': { fixType: ['fix_camera'],               label: 'ðŸ“· Camera Fix'             },
        // â”€â”€ Software â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_13': { fixType: ['fix_teams'],                label: 'ðŸ“¹ Teams Fix'              },
        'home_quick_27': { fixType: ['fix_zoom'],                 label: 'ðŸ–¥ï¸ Zoom Fix'               },
        'home_quick_31': { fixType: ['fix_browser'],              label: 'ðŸŒ Browser Fix'            },
        'home_quick_53': { fixType: ['fix_browser'],              label: 'ðŸ’¥ App Crash Fix'          },
        'home_quick_50': { fixType: ['fix_outlook'],              label: 'ðŸ“§ Outlook Fix'            },
        'home_quick_51': { fixType: ['fix_onedrive'],             label: 'â˜ï¸ OneDrive Fix'           },
        'home_quick_58': { fixType: ['fix_onedrive'],             label: 'â˜ï¸ OneDrive Storage Fix'   },
        'home_quick_54': { fixType: ['fix_printer'],              label: 'ðŸ–¨ï¸ Printer Fix'            },
        // â”€â”€ Productivity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_34': { fixType: ['fix_clipboard'],            label: 'ðŸ“‹ Copy-Paste Fix'         },
        'home_quick_35': { fixType: ['fix_datetime'],             label: 'ðŸ• Date/Time Fix'         },
        'home_quick_30': { fixType: ['fix_sleep'],                label: 'âš¡ Shutdown Fix'           },
        'home_quick_64': { fixType: ['fix_sleep'],                label: 'ðŸ˜´ Sleep Fix'              },
        // â”€â”€ Security & Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_18': { fixType: ['clean_disk', 'clean_temp'], label: 'ðŸ’¾ Storage Cleanup'        },
        'home_quick_19': { fixType: ['fix_virus_scan'],           label: 'ðŸ¦  Virus Scan'             },
        'home_quick_57': { fixType: ['fix_virus_scan'],           label: 'ðŸ›¡ï¸ Antivirus Fix'          },
      };

      // â”€â”€ Download Script mapping: 1-click .bat scripts hosted on server â”€â”€â”€
      const PORTAL = process.env.API_BASE_URL || 'https://web-production-ef6c1.up.railway.app';
      const SCRIPT_MAP = {
        // â”€â”€ Laptop Hardware & Performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_1' : { file: 'fix-slow-laptop.bat',     label: 'ðŸ’» Slow Laptop Fix'        },
        'home_quick_3' : { file: 'fix-bluescreen.bat',      label: 'ðŸ’™ Blue Screen Fix'        },
        'home_quick_4' : { file: 'fix-overheating.bat',     label: 'ðŸŒ¡ï¸ Overheating Fix'        },
        'home_quick_6' : { file: 'fix-black-screen.bat',    label: 'ðŸ–¥ï¸ Black Screen Fix'       },
        'home_quick_7' : { file: 'fix-keyboard.bat',        label: 'âŒ¨ï¸ Keyboard Fix'           },
        'home_quick_8' : { file: 'fix-touchpad.bat',        label: 'ðŸ–±ï¸ Touchpad Fix'           },
        'home_quick_21': { file: 'fix-freezing.bat',        label: 'â„ï¸ Freezing Fix'           },
        'home_quick_30': { file: 'fix-sudden-shutdown.bat', label: 'âš¡ Sudden Shutdown Fix'    },
        'home_quick_33': { file: 'fix-bluescreen.bat',      label: 'ðŸ” Restart Loop Fix'       },
        'home_quick_38': { file: 'fix-fan-noise.bat',       label: 'ðŸ’¨ Fan Noise Fix'          },
        'home_quick_39': { file: 'fix-screen-flicker.bat',  label: 'ðŸ“º Screen Flicker Fix'     },
        'home_quick_40': { file: 'fix-bluetooth.bat',       label: 'ðŸ”µ Bluetooth Fix'          },
        'home_quick_63': { file: 'fix-usb.bat',             label: 'ðŸ”Œ USB Fix'                },
        'home_quick_64': { file: 'fix-sleep-wake.bat',      label: 'ðŸ˜´ Sleep/Wake Fix'         },
        'home_quick_65': { file: 'fix-bluescreen.bat',      label: 'ðŸš« Boot Error Fix'         },
        'home_quick_66': { file: 'fix-touchscreen.bat',     label: 'ðŸ‘† Touchscreen Fix'        },
        'home_quick_67': { file: 'fix-hdmi.bat',            label: 'ðŸ–¥ï¸ HDMI Fix'               },
        'home_quick_68': { file: 'fix-sdcard.bat',          label: 'ðŸ’³ SD Card Fix'            },
        'home_quick_69': { file: 'fix-fingerprint.bat',     label: 'ðŸ” Fingerprint Fix'        },
        'home_quick_71': { file: 'fix-slow-laptop.bat',     label: 'ðŸŒ Post-Update Speed Fix'  },
        'home_quick_72': { file: 'fix-capslock.bat',        label: 'ðŸ”¡ Caps Lock Fix'          },
        // â”€â”€ Internet & Network â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_11': { file: 'fix-wifi.bat',            label: 'ðŸ“¶ WiFi Fix'               },
        'home_quick_26': { file: 'fix-wifi.bat',            label: 'ðŸ“¡ Hotspot Fix'            },
        'home_quick_29': { file: 'fix-wifi.bat',            label: 'ðŸ¢ Internet Speed Fix'     },
        'home_quick_44': { file: 'fix-wifi.bat',            label: 'ðŸ“¶ WiFi Disconnect Fix'    },
        'home_quick_45': { file: 'fix-outlook.bat',         label: 'ðŸ“§ Email Fix'              },
        // â”€â”€ Audio & Display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_9' : { file: 'fix-sound.bat',           label: 'ðŸ”Š Sound Fix'              },
        'home_quick_16': { file: 'fix-mic.bat',             label: 'ðŸŽ¤ Microphone Fix'         },
        'home_quick_17': { file: 'fix-hdmi.bat',            label: 'ðŸ–¥ï¸ External Monitor Fix'   },
        'home_quick_20': { file: 'fix-camera.bat',          label: 'ðŸ“· Camera Fix'             },
        'home_quick_28': { file: 'fix-sound.bat',           label: 'ðŸ”‡ Speaker Fix'            },
        'home_quick_46': { file: 'fix-headphone.bat',       label: 'ðŸŽ§ Headphone Fix'          },
        'home_quick_47': { file: 'fix-projector.bat',       label: 'ðŸ“½ï¸ Projector Fix'          },
        'home_quick_48': { file: 'fix-resolution.bat',      label: 'ðŸ–¥ï¸ Resolution Fix'         },
        'home_quick_49': { file: 'fix-video-call.bat',      label: 'ðŸ“¹ Video Call Fix'         },
        // â”€â”€ Software & Apps â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_13': { file: 'fix-teams.bat',           label: 'ðŸ“¹ Teams Fix'              },
        'home_quick_23': { file: 'fix-word-excel.bat',      label: 'ðŸ“„ Word/Excel Fix'         },
        'home_quick_24': { file: 'fix-windows-update.bat',  label: 'ðŸ”„ Windows Update Fix'     },
        'home_quick_27': { file: 'fix-zoom.bat',            label: 'ðŸ–¥ï¸ Zoom Fix'               },
        'home_quick_31': { file: 'fix-browser.bat',         label: 'ðŸŒ Browser Fix'            },
        'home_quick_34': { file: 'fix-clipboard.bat',       label: 'ðŸ“‹ Copy-Paste Fix'         },
        'home_quick_35': { file: 'fix-datetime.bat',        label: 'ðŸ• Date/Time Fix'          },
        'home_quick_50': { file: 'fix-outlook.bat',         label: 'ðŸ“§ Outlook Fix'            },
        'home_quick_51': { file: 'fix-onedrive.bat',        label: 'â˜ï¸ OneDrive Fix'           },
        'home_quick_52': { file: 'fix-pdf.bat',             label: 'ðŸ“„ PDF Fix'                },
        'home_quick_53': { file: 'fix-app-crash.bat',       label: 'ðŸ’¥ App Crash Fix'          },
        'home_quick_54': { file: 'fix-printer.bat',         label: 'ðŸ–¨ï¸ Printer Fix'            },
        // â”€â”€ Security & Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_18': { file: 'fix-storage.bat',         label: 'ðŸ’¾ Storage Cleanup'        },
        'home_quick_19': { file: 'fix-virus-scan.bat',      label: 'ðŸ¦  Virus Scan'             },
        'home_quick_57': { file: 'fix-virus-scan.bat',      label: 'ðŸ›¡ï¸ Antivirus Fix'          },
        'home_quick_58': { file: 'fix-onedrive.bat',        label: 'â˜ï¸ OneDrive Storage Fix'   },
        // â”€â”€ Power & Boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_2' : { file: 'fix-wont-turn-on.bat',   label: 'ðŸ”´ Won\'t Turn On Fix'     },
        'home_quick_5' : { file: 'fix-battery.bat',         label: 'ðŸ”‹ Battery Fix'            },
        'home_quick_10': { file: 'fix-battery.bat',         label: 'ðŸ”Œ Charging Fix'           },
        // â”€â”€ WiFi Password & Website â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'home_quick_32': { file: 'fix-wifi-password.bat',   label: 'ðŸ”‘ WiFi Password Fix'      },
        'home_quick_43': { file: 'fix-website-blocked.bat', label: 'ðŸŒ Website Fix'            },
      };

      // â”€â”€ Build Home Tab blocks (with collapsible categories) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const buildHomeBlocks = (emp, myTickets, expandedSet) => {
        const name     = emp?.name?.split(' ')[0] || 'Employee';
        const laptop   = emp?.laptop    || null;
        const laptopSN = emp?.laptopSN  || null;
        const dept     = emp?.department || null;
        const openCnt  = myTickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;

        const statEmoji = { 'Open':'ðŸŸ¡', 'In Progress':'ðŸ”µ', 'Resolved':'âœ…', 'Closed':'âš«' };
        const priEmoji2 = { 'Critical':'ðŸ”´', 'High':'ðŸŸ ', 'Medium':'ðŸŸ¡', 'Low':'ðŸŸ¢' };

        // Time-based greeting â€” IST (UTC+5:30)
        const _now = new Date();
        const istHour = Math.floor((_now.getUTCHours() * 60 + _now.getUTCMinutes() + 330) / 60) % 24;
        const greeting = istHour < 12 ? 'Good Morning' : istHour < 17 ? 'Good Afternoon' : 'Good Evening';

        const blocks = [
          { type:'header', text:{ type:'plain_text', text:'ðŸ› ï¸ WIOM IT Helpdesk', emoji:true }},

          // Greeting + tip
          { type:'section', text:{ type:'mrkdwn', text:
            `*${greeting}, ${name}! ðŸ‘‹*\nKoi bhi IT problem ho â€” neeche se category select karo ya *DM mein seedha type karo* apni problem.\n_Ticket banane ke liye: \`/ticket\` type karo_`
          }},

          // Employee info + ticket status
          ...(emp ? [{
            type:'section', fields:[
              { type:'mrkdwn', text:`ðŸªª *Emp ID:* \`${emp.empId}\`` },
              { type:'mrkdwn', text:`ðŸ¢ *Dept:* ${dept||'â€”'}` },
              { type:'mrkdwn', text:`ðŸ’» *Laptop:* ${laptop||'â€”'}` },
              { type:'mrkdwn', text:`ðŸ”¢ *S/N:* \`${laptopSN||'â€”'}\`` },
              { type:'mrkdwn', text: openCnt > 0
                ? `ðŸŽ« *Open Tickets:* *${openCnt} open* âš ï¸`
                : `ðŸŽ« *Tickets:* âœ… Koi open ticket nahi` }
            ]
          }] : []),

          { type:'divider' },

          // Last ticket status
          ...(myTickets.length > 0 ? [
            { type:'section', text:{ type:'mrkdwn', text:
              `*ðŸ“‹ Last Ticket:* ${statEmoji[myTickets[0].status]||'ðŸŸ¡'} \`${myTickets[0].ticketId}\` â€” ${(myTickets[0].description||'').substring(0,50)}...\n` +
              `${priEmoji2[myTickets[0].priority]||'ðŸŸ¡'} ${myTickets[0].priority} Â· ${myTickets[0].category||'Other'} Â· _${Math.floor((Date.now()-new Date(myTickets[0].createdAt))/3600000)}h ago_` +
              (myTickets[0].resolution ? `\nâœ… *Resolved:* ${myTickets[0].resolution.substring(0,60)}` : '')
            }}
          ] : []),

          { type:'divider' },
          { type:'section', text:{ type:'mrkdwn', text:'*ðŸ“‚ Apni Category Choose Karo:*' }},
          { type:'context', elements:[{ type:'mrkdwn', text:'_Category button click karo â†’ expand hogi â†’ apna problem select karo â€¢ Ya seedha DM mein type karo ðŸ’¬_' }]}
        ];

        for (const cat of CATEGORIES) {
          const isExpanded = expandedSet.has(cat.key);
          const arrow = isExpanded ? 'â–¼' : 'â–¶';
          blocks.push({
            type: 'actions',
            elements: [{
              type: 'button',
              text: { type: 'plain_text', text: `${arrow}  ${cat.label}`, emoji: true },
              action_id: `cat_toggle_${cat.key}`,
              value: cat.key,
              ...(cat.style ? { style: cat.style } : {})
            }]
          });

          if (isExpanded) {
            for (const row of cat.rows) {
              blocks.push({
                type: 'actions',
                elements: row.map(btn => ({
                  type    : 'button',
                  text    : { type: 'plain_text', text: btn.text, emoji: true },
                  value   : btn.value,
                  action_id: btn.id,
                  style   : btn.style || cat.style || undefined
                }))
              });
            }
          }
        }

        // SOS at bottom
        blocks.push({ type:'divider' });
        blocks.push({
          type:'actions',
          elements:[{
            type:'button', style:'danger',
            text:{ type:'plain_text', text:'ðŸ†˜ IT Emergency / SOS', emoji:true },
            action_id:'home_sos', value:'sos'
          }]
        });

        return blocks;
      };

      // â”€â”€ FEATURE 5: Office hours check (IST = UTC+5:30) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const isOfficeHours = () => {
        const now = new Date();
        const istMins = now.getUTCHours() * 60 + now.getUTCMinutes() + 330;
        const istHour = Math.floor(istMins / 60) % 24;
        return istHour >= 9 && istHour < 19; // 9AMâ€“7PM IST
      };

      // â”€â”€ FEATURE 2: Format reply for Slack mrkdwn â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const formatForSlack = (text) => {
        return text
          .replace(/\bStep (\d+):\s*/gi, '\n*Step $1:* ')  // Bold step numbers
          .replace(/^\n+/, '')                               // Remove leading newline
          .replace(/\n{3,}/g, '\n\n')                       // Max 2 blank lines
          .trim();
      };

      // â”€â”€ FEATURE 1: Load/create MongoDB conversation session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const getSlackSession = async (slackUserId, emp) => {
        const cutoff = new Date(Date.now() - 24 * 3600000); // 24h window
        let conv = await Conversation.findOne({
          slackUserId,
          source  : 'slack',
          resolved: false,
          lastActive: { $gte: cutoff }
        }).sort({ lastActive: -1 });

        if (!conv) {
          conv = new Conversation({
            sessionId: `slack-${slackUserId}-${Date.now()}`,
            empId    : emp.empId,
            empName  : emp.empName,
            source   : 'slack',
            slackUserId,
            messages : []
          });
        }
        return conv;
      };

      // â”€â”€ Employee lookup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const lookupEmployee = async (slackUserId, client) => {
        try {
          let dbEmp = await Employee.findOne({ slackUserId });
          if (dbEmp) {
            return { empId: dbEmp.empId, empName: dbEmp.name, email: dbEmp.email,
                     dept: dbEmp.department, floor: dbEmp.floor,
                     laptop: dbEmp.laptop, laptopSN: dbEmp.laptopSN };
          }
          const profile = await client.users.info({ user: slackUserId });
          const email   = profile.user?.profile?.email;
          const name    = profile.user?.profile?.real_name || profile.user?.name;
          if (email)  dbEmp = await Employee.findOne({ email: email.toLowerCase() });
          if (!dbEmp && name) dbEmp = await Employee.findOne({ name: { $regex: name.split(' ')[0], $options: 'i' } });
          if (dbEmp) {
            dbEmp.slackUserId = slackUserId;
            await dbEmp.save();
            return { empId: dbEmp.empId, empName: dbEmp.name, email: dbEmp.email,
                     dept: dbEmp.department, floor: dbEmp.floor,
                     laptop: dbEmp.laptop, laptopSN: dbEmp.laptopSN };
          }
          return { empId: slackUserId, empName: name || 'Employee', email, dept: 'Unknown' };
        } catch {
          return { empId: slackUserId, empName: 'Employee', email: null, dept: 'Unknown' };
        }
      };

      // â”€â”€ Notify admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const notifyAdmin = async (client, ticket, emp) => {
        try {
          const adminId = process.env.ADMIN_EMAIL_SLACK_ID;
          if (!adminId || adminId === 'FILL_KARO') return;
          const priEmoji = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };
          const priColor = { Critical:'#ef4444', High:'#f59e0b', Medium:'#3b82f6', Low:'#10b981' };
          await client.chat.postMessage({
            channel: adminId,
            text: `${priEmoji[ticket.priority]||'ðŸŸ¡'} Naya ticket: ${ticket.ticketId} â€” ${emp.empName}`,
            attachments: [{
              color: priColor[ticket.priority] || '#3b82f6',
              blocks: [
                { type:'section', fields:[
                  { type:'mrkdwn', text:`*ðŸŽ« Ticket ID*\n\`${ticket.ticketId}\`` },
                  { type:'mrkdwn', text:`*ðŸ‘¤ Employee*\n${emp.empName}` },
                  { type:'mrkdwn', text:`*${priEmoji[ticket.priority]||'ðŸŸ¡'} Priority*\n${ticket.priority}` },
                  { type:'mrkdwn', text:`*ðŸ“‚ Category*\n${ticket.category||'Other'}` }
                ]},
                { type:'section', text:{ type:'mrkdwn', text:`*ðŸ“ Issue:*\n${ticket.description}` }},
                { type:'context', elements:[{ type:'mrkdwn', text:`Category: ${ticket.category} | ${emp.dept||'Unknown Dept'}` }]}
              ]
            }]
          });
        } catch (err) {
          console.error('Admin DM error:', err.message);
        }
      };

      // â”€â”€ Create ticket via API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const createTicketSlack = async (data) => {
        try {
          const res = await fetch(`${API_BASE}/api/tickets`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({ ...data, aiTried: true })
          });
          const json = await res.json();
          if (res.status === 409) return { _duplicate: true, ticket: json.ticket, message: json.message };
          return json.ticket;
        } catch { return null; }
      };

      // â”€â”€ /helpdesk command â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.command('/helpdesk', async ({ command, ack, respond, client }) => {
        await ack();
        const userId = command.user_id;
        const text   = command.text?.trim() || '';

        if (!text) {
          await respond({ response_type: 'ephemeral', blocks:[
            { type:'section', text:{ type:'mrkdwn', text:'*ðŸ›  WIOM IT Helpdesk*\nApni IT problem batao!\n\n*Examples:*\nâ€¢ `/helpdesk wifi nahi chal raha`\nâ€¢ `/helpdesk laptop slow hai`\nâ€¢ `/helpdesk outlook nahi khul raha`\n\n_Apne tickets dekhne ke liye:_ `/helpdesk status`' }}
          ], text:'WIOM IT Helpdesk â€” apni problem batao' });
          return;
        }

        // â”€â”€ /helpdesk status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (text.toLowerCase() === 'status' || text.toLowerCase() === 'meri tickets') {
          const emp = await lookupEmployee(userId, client);
          const tickets = await Ticket.find({
            $or: [{ empId: emp.empId }, { slackUserId: userId }],
            status: { $nin: ['Closed'] }
          }).sort({ createdAt: -1 }).limit(5);

          if (!tickets.length) {
            await respond({ response_type: 'ephemeral', text: 'ðŸŽ‰ Koi open ticket nahi hai! Sab kuch theek hai.' });
            return;
          }

          const priEmoji  = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };
          const statEmoji = { Open:'â³', 'In Progress':'ðŸ”„', Waiting:'â¸', Resolved:'âœ…', Closed:'ðŸ”’' };
          const blocks = [
            { type:'section', text:{ type:'mrkdwn', text:`*ðŸ“‹ Aapke Tickets (${tickets.length})*` }},
            { type:'divider' }
          ];
          tickets.forEach(t => {
            const hrs = Math.round((Date.now() - new Date(t.createdAt)) / 3600000);
            blocks.push({ type:'section', fields:[
              { type:'mrkdwn', text:`*\`${t.ticketId}\`*\n${priEmoji[t.priority]||'ðŸŸ¡'} ${t.priority}` },
              { type:'mrkdwn', text:`*${statEmoji[t.status]||'â³'} ${t.status}*\n${hrs}h ago` }
            ]});
            blocks.push({ type:'context', elements:[{ type:'mrkdwn', text:`_${(t.description||'').substring(0,70)}..._` }]});
          });
          await respond({ response_type: 'ephemeral', text: `Aapke ${tickets.length} ticket(s)`, blocks });
          return;
        }

        await respond({ text: 'ðŸ¤– _Soch raha hoon..._ ek second!', response_type: 'ephemeral' });

        const emp  = await lookupEmployee(userId, client);
        const conv = await getSlackSession(userId, emp);
        conv.messages.push({ role: 'user', content: text });

        try {
          const { reply, shouldCreateTicket, ticketData } = await claudeSvc.chat(
            conv.messages,
            { empId: emp.empId, empName: emp.empName, source: 'slack',
              laptop: emp.laptop, laptopSN: emp.laptopSN, dept: emp.dept, floor: emp.floor }
          );
          conv.messages.push({ role: 'assistant', content: reply });
          await conv.save();

          const formattedReply = formatForSlack(reply);
          const blocks = [{ type:'section', text:{ type:'mrkdwn', text: formattedReply }}];

          if (shouldCreateTicket && ticketData) {
            const result = await createTicketSlack({
              empId: emp.empId, empName: emp.empName, empEmail: emp.email,
              empDept: emp.dept, empFloor: emp.floor,
              laptop: emp.laptop, laptopSN: emp.laptopSN,
              ...ticketData, description: ticketData.description || text,
              source: 'slack', slackUserId: userId
            });
            if (result?._duplicate) {
              blocks.push({ type:'divider' });
              blocks.push({ type:'context', elements:[{ type:'mrkdwn', text:`âš ï¸ ${result.message}` }]});
            } else if (result) {
              const priEmoji = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };
              blocks.push({ type:'divider' });
              blocks.push({ type:'section', fields:[
                { type:'mrkdwn', text:`*âœ… Ticket Bana:*\n\`${result.ticketId}\`` },
                { type:'mrkdwn', text:`*${priEmoji[result.priority]||'ðŸŸ¡'} Priority:*\n${result.priority}` }
              ]});
              blocks.push({ type:'context', elements:[{ type:'mrkdwn', text:`âœ… IT team ko alert kar diya gaya ðŸ™` }]});
              await notifyAdmin(client, result, emp);
            }
          }

          await respond({ response_type: 'ephemeral', text: reply, blocks });
        } catch (err) {
          console.error('Slack /helpdesk error:', err.message);
          await respond({ text: 'âŒ Error aa gaya. Baad mein try karo.', response_type: 'ephemeral' });
        }
      });

      // â”€â”€ /ticket command â€” Quick modal ticket creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.command('/ticket', async ({ command, ack, client }) => {
        await ack();
        try {
          await client.views.open({
            trigger_id: command.trigger_id,
            view: {
              type       : 'modal',
              callback_id: 'ticket_modal',
              title  : { type:'plain_text', text:'ðŸŽ« Naya IT Ticket', emoji:true },
              submit : { type:'plain_text', text:'Ticket Banao âœ…', emoji:true },
              close  : { type:'plain_text', text:'Cancel', emoji:true },
              blocks : [
                {
                  type    : 'input',
                  block_id: 'description_block',
                  label   : { type:'plain_text', text:'ðŸ“ Problem kya hai?', emoji:true },
                  element : {
                    type       : 'plain_text_input',
                    action_id  : 'description_input',
                    multiline  : true,
                    min_length : 10,
                    placeholder: { type:'plain_text', text:'Jaise: Laptop on nahi ho raha, WiFi nahi chal raha, Password bhool gaya...' }
                  }
                },
                {
                  type    : 'input',
                  block_id: 'category_block',
                  label   : { type:'plain_text', text:'ðŸ“‚ Category', emoji:true },
                  element : {
                    type       : 'static_select',
                    action_id  : 'category_input',
                    placeholder: { type:'plain_text', text:'Category select karo' },
                    options    : [
                      { text:{ type:'plain_text', text:'ðŸ’» Hardware â€” Laptop, keyboard, mouse, screen' }, value:'Hardware' },
                      { text:{ type:'plain_text', text:'ðŸ’¿ Software â€” App, Windows, Office' }, value:'Software' },
                      { text:{ type:'plain_text', text:'ðŸ“¶ Network â€” WiFi, internet, VPN' }, value:'Network' },
                      { text:{ type:'plain_text', text:'ðŸ”‘ Account â€” Password, login, email' }, value:'Account' },
                      { text:{ type:'plain_text', text:'ðŸ›’ Purchase â€” New equipment request' }, value:'Purchase' },
                      { text:{ type:'plain_text', text:'â“ Other â€” Kuch aur' }, value:'Other' }
                    ]
                  }
                },
                {
                  type    : 'input',
                  block_id: 'priority_block',
                  label   : { type:'plain_text', text:'ðŸš¨ Kitna Urgent Hai?', emoji:true },
                  element : {
                    type          : 'static_select',
                    action_id     : 'priority_input',
                    initial_option: { text:{ type:'plain_text', text:'ðŸŸ¡ Medium â€” Normal problem' }, value:'Medium' },
                    options       : [
                      { text:{ type:'plain_text', text:'ðŸ”´ Critical â€” Kaam bilkul ruk gaya' }, value:'Critical' },
                      { text:{ type:'plain_text', text:'ðŸŸ  High â€” Bahut zaruri, jaldi chahiye' }, value:'High' },
                      { text:{ type:'plain_text', text:'ðŸŸ¡ Medium â€” Normal problem, chal sakta hai' }, value:'Medium' },
                      { text:{ type:'plain_text', text:'ðŸŸ¢ Low â€” Jab time mile tab theek karo' }, value:'Low' }
                    ]
                  }
                }
              ]
            }
          });
        } catch (err) {
          console.error('/ticket modal open error:', err.message);
        }
      });

      // â”€â”€ /ticket modal submission â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.view('ticket_modal', async ({ ack, body, view, client }) => {
        await ack();
        const userId = body.user.id;
        try {
          const vals       = view.state.values;
          const description = vals.description_block.description_input.value;
          const category    = vals.category_block.category_input.selected_option?.value || 'Other';
          const priority    = vals.priority_block.priority_input.selected_option?.value || 'Medium';

          const emp = await lookupEmployee(userId, client);

          const result = await createTicketSlack({
            empId  : emp.empId,   empName : emp.empName, empEmail: emp.email,
            empDept: emp.dept,    empFloor: emp.floor,
            laptop : emp.laptop,  laptopSN: emp.laptopSN,
            description, category, priority,
            source: 'slack', slackUserId: userId
          });

          const priEmoji = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };

          if (result?._duplicate) {
            await client.chat.postMessage({
              channel: userId,
              text   : `âš ï¸ ${result.message}`
            });
          } else if (result) {
            await client.chat.postMessage({
              channel: userId,
              text   : `ðŸŽ« Ticket ${result.ticketId} create ho gaya!`,
              blocks : [
                { type:'header', text:{ type:'plain_text', text:'âœ… Ticket Create Ho Gaya!', emoji:true }},
                { type:'section', fields:[
                  { type:'mrkdwn', text:`*ðŸŽ« Ticket ID:*\n\`${result.ticketId}\`` },
                  { type:'mrkdwn', text:`*${priEmoji[result.priority]||'ðŸŸ¡'} Priority:*\n${result.priority}` },
                  { type:'mrkdwn', text:`*ðŸ“‚ Category:*\n${result.category}` },
                  { type:'mrkdwn', text:`*â³ Status:*\nOpen` }
                ]},
                { type:'section', text:{ type:'mrkdwn', text:`*ðŸ“ Problem:*\n${description}` }},
                { type:'context', elements:[{ type:'mrkdwn', text:`âœ… IT team ko notify kar diya gaya ðŸ™ | _App Home mein "Mere Tickets" section mein dekh sakte ho_` }]}
              ]
            });
            await notifyAdmin(client, result, emp);
            console.log(`ðŸŽ« Ticket ${result.ticketId} created via /ticket modal by ${emp.empName}`);
          }
        } catch (err) {
          console.error('/ticket modal submit error:', err.message);
          try {
            await client.chat.postMessage({
              channel: userId,
              text   : 'âŒ Ticket create karne mein error aaya. Dobara try karein ya call karein: *IT Helpdesk (Slack)*'
            });
          } catch {}
        }
      });

      // â”€â”€ FEATURE 8: Rating action handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.action('rate_ticket', async ({ body, ack, client }) => {
        await ack();
        try {
          const value    = body.actions[0].value;          // "WIOM-TKT-0001:4"
          const [ticketId, ratingStr] = value.split(':');
          const rating   = parseInt(ratingStr);
          const userId   = body.user.id;

          await Ticket.findOneAndUpdate(
            { ticketId },
            { userRating: rating, userFeedback: `${rating}/5 stars via Slack` }
          );

          const stars     = 'â­'.repeat(rating);
          const ratingMsg = rating >= 4 ? 'Shukriya! Bahut accha feedback mila ðŸ˜Š'
                          : rating >= 3 ? 'Shukriya! Hum aur behtar karne ki koshish karenge ðŸ™'
                          : 'Shukriya! Hum is feedback ko improve karne mein use karenge ðŸ˜”';

          await client.chat.update({
            channel: body.channel.id,
            ts     : body.message.ts,
            text   : `âœ… Ticket ${ticketId} â€” Rating: ${stars}`,
            blocks : [
              { type:'section', text:{ type:'mrkdwn', text:
                `âœ… *Ticket \`${ticketId}\` resolve ho gaya!*\n\n*Aapki Rating:* ${stars} (${rating}/5)\n${ratingMsg}`
              }},
              { type:'context', elements:[{ type:'mrkdwn', text:`IT Helpdesk: IT Helpdesk (Slack) | Koi aur problem ho toh batao!` }]}
            ]
          });
          console.log(`â­ Rating ${rating}/5 saved for ${ticketId}`);
        } catch (err) {
          console.error('Rating action error:', err.message);
        }
      });

      // â”€â”€ APP HOME TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.event('app_home_opened', async ({ event, client }) => {
        try {
          const userId = event.user;
          const emp = await Employee.findOne({ $or: [{ slackUserId: userId }, { empId: userId }] });
          let myTickets = [];
          if (emp?.empId) {
            myTickets = await Ticket.find({ empId: emp.empId }).sort({ createdAt: -1 }).limit(1).lean();
          }
          const expandedSet = expandedHomeMap.get(userId) || new Set();
          const blocks = buildHomeBlocks(emp, myTickets, expandedSet);
          await client.views.publish({ user_id: userId, view: { type: 'home', blocks } });
        } catch (err) {
          console.error('App Home error:', err.message);
        }
      });

      // â”€â”€ Category toggle handlers (Home Tab accordion) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      CATEGORIES.forEach(cat => {
        slackApp.action(`cat_toggle_${cat.key}`, async ({ body, ack, client }) => {
          await ack();
          const userId = body.user.id;
          if (!expandedHomeMap.has(userId)) expandedHomeMap.set(userId, new Set());
          const userExpanded = expandedHomeMap.get(userId);
          if (userExpanded.has(cat.key)) userExpanded.delete(cat.key);
          else userExpanded.add(cat.key);

          try {
            const emp = await Employee.findOne({ $or: [{ slackUserId: userId }, { empId: userId }] });
            let myTickets = [];
            if (emp?.empId) myTickets = await Ticket.find({ empId: emp.empId }).sort({ createdAt: -1 }).limit(1).lean();
            const blocks = buildHomeBlocks(emp, myTickets, userExpanded);
            await client.views.publish({ user_id: userId, view: { type: 'home', blocks } });
          } catch (err) {
            console.error('cat_toggle error:', err.message);
          }
        });
      });

      // â”€â”€ DM category expand handlers (post sub-buttons on click) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      CATEGORIES.forEach(cat => {
        slackApp.action(`dm_cat_${cat.key}`, async ({ body, ack, client }) => {
          await ack();
          const userId = body.user.id;
          try {
            const catBlocks = [
              { type:'section', text:{ type:'mrkdwn', text:`> *${cat.label}*` }}
            ];
            for (const row of cat.rows) {
              catBlocks.push({
                type: 'actions',
                elements: row.map(btn => ({
                  type    : 'button',
                  text    : { type: 'plain_text', text: btn.text, emoji: true },
                  value   : btn.value,
                  action_id: btn.id,
                  ...(btn.style ? { style: btn.style } : {})
                }))
              });
            }
            await client.chat.postMessage({ channel: userId, text: cat.label, blocks: catBlocks });
          } catch (err) {
            console.error('dm_cat action error:', err.message);
          }
        });
      });

      // â”€â”€ Hardware Replacement / Emergency special IDs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const HARDWARE_SPECIAL_IDS = new Set(['home_quick_37','home_quick_60','home_quick_61','home_quick_62','home_quick_70']);

      const buildHardwareBlocks = (actionId, emp) => {
        const isLiquid     = actionId === 'home_quick_70';
        const isNewMonitor = actionId === 'home_quick_62';
        const blocks       = [];

        // â”€â”€ Emergency alert (liquid damage) â€” unchanged â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (isLiquid) {
          blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text:
              'ðŸš¨ *EMERGENCY â€” Turant yeh karo:*\n' +
              '1. *TURANT laptop band karo* â€” Power button 10 sec hold karo\n' +
              '2. Charger aur USB sab nikaalo\n' +
              '3. Laptop *ulta rakh do* (keyboard neeche)\n' +
              '4. *MAT chalaao* â€” circuit damage hoga\n' +
              '5. IT ko call karo: *IT Helpdesk (Slack)*'
            }
          });
          return blocks;
        }

        // â”€â”€ New Monitor / New Equipment â€” Functional Head approval needed â”€â”€
        if (isNewMonitor) {
          blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text:
              '*ðŸ–¥ï¸ New Monitor Request*\n\n' +
              'Naye equipment ke liye *Functional Head ki approval* zaroori hai.\n\n' +
              '*Kya karna hai:*\n' +
              '1. Apne *Reporting Manager* ko email karo\n' +
              '2. CC mein dono add karo:\n' +
              '   â€¢ *sajan.kumar@wiom.in*\n' +
              '   â€¢ Apne *Functional Head*\n' +
              '3. Email mein likho â€” item ki zaroorat kyun hai\n\n' +
              '*Timeline: Functional Head ki approval ke baad 4 working days*'
            }
          });
          return blocks;
        }

        // â”€â”€ Replacement (Laptop / Mouse / Keyboard) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const itemMap = {
          'home_quick_37': 'ðŸ’» Laptop',
          'home_quick_60': 'ðŸ–±ï¸ Mouse',
          'home_quick_61': 'âŒ¨ï¸ Keyboard'
        };
        const item = itemMap[actionId] || 'ðŸ”§ Equipment';

        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text:
            `*${item} Replacement Request*\n\n` +
            '*Kya karna hai:*\n' +
            '1. Apne *Reporting Manager* ko email karo\n' +
            '2. CC mein add karo: *sajan.kumar@wiom.in*\n' +
            '3. Email mein likho â€” kya problem hai aur replacement kyun chahiye\n\n' +
            '*Timeline: 2 working days*'
          }
        });

        return blocks;
      };

      // â”€â”€ Quick Action buttons from Home tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const homeQuickActions = ['home_quick_1','home_quick_2','home_quick_3','home_quick_4','home_quick_5','home_quick_6','home_quick_7','home_quick_8','home_quick_9','home_quick_10','home_quick_11','home_quick_12','home_quick_13','home_quick_14','home_quick_15','home_quick_16','home_quick_17','home_quick_18','home_quick_19','home_quick_20','home_quick_21','home_quick_22','home_quick_23','home_quick_24','home_quick_25','home_quick_26','home_quick_27','home_quick_28','home_quick_29','home_quick_30','home_quick_31','home_quick_32','home_quick_33','home_quick_34','home_quick_35','home_quick_36','home_quick_37','home_quick_38','home_quick_39','home_quick_40','home_quick_41','home_quick_42','home_quick_43','home_quick_44','home_quick_45','home_quick_46','home_quick_47','home_quick_48','home_quick_49','home_quick_50','home_quick_51','home_quick_52','home_quick_53','home_quick_54','home_quick_55','home_quick_56','home_quick_57','home_quick_58','home_quick_59','home_quick_60','home_quick_61','home_quick_62','home_quick_63','home_quick_64','home_quick_65','home_quick_66','home_quick_67','home_quick_68','home_quick_69','home_quick_70','home_quick_71','home_quick_72','home_sos'];
      homeQuickActions.forEach(actionId => {
        slackApp.action(actionId, async ({ body, ack, client }) => {
          await ack();
          const userId    = body.user.id;
          const problem   = body.actions[0].value;
          const triggerId = body.trigger_id;
          try {
            const emp     = await Employee.findOne({ slackUserId: userId });
            const empInfo = {
              empId  : emp?.empId    || userId,
              empName: emp?.name     || 'Employee',
              source : 'slack',
              laptop : emp?.laptop,
              laptopSN: emp?.laptopSN,
              dept   : emp?.department,
              floor  : emp?.floor
            };

            // â”€â”€ Email Password Reset â€” modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            if (actionId === 'home_quick_59') {
              await client.views.open({
                trigger_id: triggerId,
                view: {
                  type: 'modal',
                  title: { type: 'plain_text', text: 'ðŸ“§ Password Reset', emoji: true },
                  close: { type: 'plain_text', text: 'Wapas Jaao', emoji: true },
                  blocks: [
                    { type: 'section', text: { type: 'mrkdwn', text:
                      '*ðŸ“§ Email / Google Account Password Reset*\n\n' +
                      '*Yeh steps follow karo:*\n' +
                      '1. *Google Account page* pe jaao: myaccount.google.com\n' +
                      '2. *Security* tab click karo\n' +
                      '3. *"How you sign in to Google"* mein *Password* click karo\n' +
                      '4. Current password enter karo _(ya fingerprint / prompt se verify karo)_\n' +
                      '5. Naya password set karo\n\n' +
                      '_Agar nahi hua to neeche ticket banao_ ðŸŽ«'
                    }},
                    { type: 'divider' },
                    { type: 'actions', elements: [{
                      type: 'button',
                      text: { type: 'plain_text', text: 'ðŸŽ« Ticket Banao â€” IT Help Chahiye', emoji: true },
                      style: 'danger',
                      action_id: 'raise_ticket_email_pwd',
                      value: 'email_password_reset'
                    }]}
                  ]
                }
              });
              return;
            }

            // â”€â”€ Hardware Replacement / Emergency â€” modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            if (HARDWARE_SPECIAL_IDS.has(actionId)) {
              const hwBlocks = buildHardwareBlocks(actionId, emp);
              await client.views.open({
                trigger_id: triggerId,
                view: {
                  type: 'modal',
                  title: { type: 'plain_text', text: 'ðŸ”§ Hardware Request', emoji: true },
                  close: { type: 'plain_text', text: 'Wapas Jaao', emoji: true },
                  blocks: hwBlocks
                }
              });
              // Auto-create ticket ONLY for liquid damage emergency
              if (actionId === 'home_quick_70' && emp?.empId) {
                try {
                  const result = await createTicketSlack({
                    empId: emp.empId, empName: emp.empName, empEmail: emp.email,
                    empDept: emp.dept, empFloor: emp.floor,
                    laptop: emp.laptop, laptopSN: emp.laptopSN,
                    description: `EMERGENCY: Liquid/Water Damage â€” ${emp.laptop || 'Laptop'} (S/N: ${emp.laptopSN || 'Unknown'})`,
                    category: 'Hardware', priority: 'Critical',
                    source: 'slack', slackUserId: userId
                  });
                  if (result && !result._duplicate) await notifyAdmin(client, result, emp);
                } catch (ticketErr) {
                  console.error('Liquid damage ticket error:', ticketErr.message);
                }
              }
              return;
            }

            // â”€â”€ Open loading modal immediately (trigger_id valid only 3 sec) â”€â”€
            const loadingView = await client.views.open({
              trigger_id: triggerId,
              view: {
                type: 'modal',
                title: { type: 'plain_text', text: 'ðŸ› ï¸ IT Help', emoji: true },
                close: { type: 'plain_text', text: 'Wapas Jaao', emoji: true },
                blocks: [
                  { type: 'section', text: { type: 'mrkdwn', text: 'ðŸ¤– _Soch raha hoon... ek second!_\n_Aapki problem analyze ho rahi hai..._' }}
                ]
              }
            });

            // â”€â”€ Get AI response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            await Conversation.updateMany(
              { slackUserId: userId, source: 'slack', resolved: false },
              { resolved: true }
            );
            const conv = await getSlackSession(userId, empInfo);
            conv.messages.push({ role: 'user', content: problem });
            const claudeSvc = require('./services/claude');
            const { reply } = await claudeSvc.chat(conv.messages, empInfo);
            conv.messages.push({ role: 'assistant', content: reply });
            await conv.save();
            const formattedReply = formatForSlack(reply);

            // â”€â”€ Build response blocks for modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const modalBlocks = [
              { type: 'section', text: { type: 'mrkdwn', text: formattedReply }}
            ];

            const scriptConfig = SCRIPT_MAP[actionId];
            if (scriptConfig) {
              const scriptUrl = `${PORTAL}/scripts/${scriptConfig.file}`;
              modalBlocks.push({ type: 'divider' });
              modalBlocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*âš¡ Ya ek click mein automatic fix karo:*\n_Download karo, double-click karo, kaam ho jayega!_' }});
              modalBlocks.push({
                type: 'actions',
                elements: [{
                  type: 'button',
                  text: { type: 'plain_text', text: `â¬‡ï¸ ${scriptConfig.label} â€” Auto Script`, emoji: true },
                  style: 'primary',
                  url: scriptUrl,
                  action_id: `dl_${actionId}`
                }]
              });
            }

            const fixConfig = AUTO_FIX_MAP[actionId];
            if (fixConfig && emp?.laptopSN && emp?.agentRegistered) {
              const isOnline = emp.agentLastSeen && (Date.now() - new Date(emp.agentLastSeen)) < 120000;
              if (isOnline) {
                const fixValue = `${fixConfig.fixType.join(',')}|${fixConfig.label}|${emp.laptopSN}`;
                modalBlocks.push({
                  type: 'actions',
                  elements: [{
                    type: 'button',
                    text: { type: 'plain_text', text: 'âš¡ IT Agent se Auto-Fix', emoji: true },
                    action_id: 'autofix_request',
                    value: fixValue,
                    confirm: {
                      title: { type: 'plain_text', text: 'Auto-Fix Confirm?' },
                      text: { type: 'mrkdwn', text: `*${fixConfig.label}* automatically run hogi aapke laptop par.\n30 seconds mein result milega! ðŸ”§` },
                      confirm: { type: 'plain_text', text: 'Haan, Fix Karo!' },
                      deny: { type: 'plain_text', text: 'Nahi' }
                    }
                  }]
                });
              }
            }

            modalBlocks.push({ type: 'divider' });
            modalBlocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '_Nahi hua? DM mein apni problem type karo â€” AI follow-up karega ðŸ’¬_' }]});

            // â”€â”€ Update modal with actual response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            await client.views.update({
              view_id: loadingView.view.id,
              view: {
                type: 'modal',
                title: { type: 'plain_text', text: 'ðŸ› ï¸ IT Help', emoji: true },
                close: { type: 'plain_text', text: 'Wapas Jaao', emoji: true },
                blocks: modalBlocks
              }
            });

          } catch (err) {
            console.error('Home quick action error:', err.message, err.stack);
            try {
              const scriptConfig = SCRIPT_MAP[actionId];
              const fallbackBlocks = [
                { type: 'section', text: { type: 'mrkdwn', text: `*Aapki problem note kar li!*\n\nAI abhi available nahi â€” script se try karo ya DM mein type karo ðŸ”§` }}
              ];
              if (scriptConfig) {
                const scriptUrl = `${PORTAL}/scripts/${scriptConfig.file}`;
                fallbackBlocks.push({ type: 'divider' });
                fallbackBlocks.push({ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: `â¬‡ï¸ ${scriptConfig.label} â€” Auto Script`, emoji: true }, style: 'primary', url: scriptUrl, action_id: `dl_fallback_${actionId}` }] });
              }
              fallbackBlocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '_Ya DM mein apni problem type karo â€” AI wahan bhi help karega ðŸ’¬_' }]});
              await client.chat.postMessage({ channel: userId, text: 'Aapki problem note kar li!', blocks: fallbackBlocks });
            } catch (msgErr) {
              console.error('Fallback message failed:', msgErr.message);
            }
          }
        });
      });

      // â”€â”€ Download script button clicks â€” just ack, URL opens in browser â”€â”€
      slackApp.action(/^dl_/, async ({ ack }) => { await ack(); });

      // â”€â”€ Email password reset ticket button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.action('raise_ticket_email_pwd', async ({ body, ack, client }) => {
        await ack();
        const userId = body.user.id;
        try {
          const emp = await lookupEmployee(userId, client);
          const result = await createTicketSlack({
            empId: emp.empId, empName: emp.empName, empEmail: emp.email,
            empDept: emp.dept, empFloor: emp.floor,
            laptop: emp.laptop, laptopSN: emp.laptopSN,
            description: 'Email / Google Account password reset â€” self-service steps try kiye, nahi hua',
            category: 'Account', priority: 'High',
            source: 'slack', slackUserId: userId
          });
          if (result && !result._duplicate) {
            await client.chat.postMessage({
              channel: userId,
              text: `Ticket ${result.ticketId} create ho gaya!`,
              blocks: [
                { type: 'section', fields: [
                  { type: 'mrkdwn', text: `*ðŸŽ« Ticket:*\n\`${result.ticketId}\`` },
                  { type: 'mrkdwn', text: `*ðŸŸ  Priority:*\nHigh` }
                ]},
                { type: 'context', elements: [{ type: 'mrkdwn', text: 'âœ… IT team password reset kar degi â€” jaldi respond karenge ðŸ™' }]}
              ]
            });
            await notifyAdmin(client, result, emp);
          } else if (result?._duplicate) {
            await client.chat.postMessage({ channel: userId, text: `âš ï¸ ${result.message}` });
          }
        } catch (err) {
          console.error('Email pwd ticket error:', err.message);
        }
      });
      // â”€â”€ Warranty / diagnostic / support link buttons â€” just ack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.action(/^(warranty_|apple_support_|diag_dl_)/, async ({ ack }) => { await ack(); });

      // â”€â”€ Auto-Fix request handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.action('autofix_request', async ({ body, ack, client }) => {
        await ack();
        const userId = body.user.id;
        const value  = body.actions[0].value;  // "fix_teams,fix_outlook|ðŸ“§ Teams Fix|SN123"

        try {
          const [typesPart, label, laptopSN] = value.split('|');
          const fixType = typesPart.split(',').filter(Boolean);

          if (!laptopSN || !fixType.length) {
            await client.chat.postMessage({
              channel: userId,
              text   : 'âŒ Auto-fix config mein kuch issue hai. Manually steps try karo.'
            });
            return;
          }

          const emp = await Employee.findOne({ slackUserId: userId });
          if (!emp) {
            await client.chat.postMessage({
              channel: userId,
              text   : 'âŒ Employee record nahi mila. IT ko contact karo: IT Helpdesk (Slack)'
            });
            return;
          }

          // Create FixJob in DB
          const job = await FixJob.create({
            empId      : emp.empId,
            empName    : emp.name,
            laptopSN,
            fixType,
            fixLabel   : label || 'Auto Fix',
            status     : 'pending',
            slackUserId: userId
          });

          console.log(`âš¡ Auto-fix job created: ${job._id} â†’ ${fixType.join(',')} for ${emp.empId} (SN:${laptopSN})`);

          await client.chat.postMessage({
            channel: userId,
            text   : `âš¡ ${label} shuru ho rahi hai...`,
            blocks : [
              { type: 'header', text: { type: 'plain_text', text: 'âš¡ Auto-Fix Shuru!', emoji: true }},
              { type: 'section', text: { type: 'mrkdwn', text:
                `*${label}* aapke laptop par automatically run ho rahi hai! ðŸ”§\n\n` +
                `_Aapko kuch nahi karna â€” laptop par IT Agent kaam kar raha hai..._\n\n` +
                `â³ *~30 seconds mein result milega!*`
              }},
              { type: 'context', elements: [{ type: 'mrkdwn', text: `_Job ID: \`${job._id}\` | Laptop: \`${laptopSN}\`_` }]}
            ]
          });

        } catch (err) {
          console.error('autofix_request error:', err.message);
          try {
            await client.chat.postMessage({
              channel: userId,
              text   : 'âŒ Auto-fix shuru nahi ho saka. Manual steps try karo ya ticket raise karo.'
            });
          } catch {}
        }
      });

      // â”€â”€ DM Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.message(async ({ message, client, say }) => {
        if (message.bot_id || message.subtype) return;
        const userId = message.user;
        const text   = message.text?.trim();
        if (!text) return;

        try {
          const emp = await lookupEmployee(userId, client);

          // â”€â”€ FEATURE 4: Reset command â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const isReset = /^(reset|nayi baat|new problem|naya|shuru karo|start over|naya topic|clear|naya sawal)$/i.test(text.trim());
          if (isReset) {
            await Conversation.updateMany(
              { slackUserId: userId, source: 'slack', resolved: false },
              { resolved: true }
            );
            pendingTickets.delete(userId);
            const firstName = (emp.empName || 'there').split(' ')[0];
            await say({ text: `ðŸ”„ Theek hai ${firstName}! Nayi baat shuru karte hain. Aapki nai IT problem kya hai?` });
            return;
          }

          // â”€â”€ FEATURE 7: Meri tickets command â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const isTicketCheck = /^(meri tickets|my tickets|tickets dikhao|ticket status|mera ticket|open tickets|meri ticket)$/i.test(text.trim());
          if (isTicketCheck) {
            const tickets = await Ticket.find({
              $or: [{ empId: emp.empId }, { slackUserId: userId }],
              status: { $nin: ['Closed'] }
            }).sort({ createdAt: -1 }).limit(5);

            if (!tickets.length) {
              await say({ text: 'ðŸŽ‰ *Koi open ticket nahi hai!* Sab kuch theek chal raha hai.' });
              return;
            }

            const priEmoji  = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };
            const statEmoji = { Open:'â³', 'In Progress':'ðŸ”„', Waiting:'â¸', Resolved:'âœ…', Closed:'ðŸ”’' };
            let ticketText  = `*ðŸ“‹ Aapke Open Tickets (${tickets.length}):*\n\n`;
            tickets.forEach(t => {
              const hrs = Math.round((Date.now() - new Date(t.createdAt)) / 3600000);
              ticketText += `${priEmoji[t.priority]||'ðŸŸ¡'} *\`${t.ticketId}\`* ${statEmoji[t.status]||'â³'} ${t.status} â€” _${hrs}h pehle_\n`;
              ticketText += `> ${(t.description||'').substring(0,60)}...\n\n`;
            });
            await say({ blocks:[
              { type:'section', text:{ type:'mrkdwn', text: ticketText }},
              { type:'context', elements:[{ type:'mrkdwn', text:`_Aur help chahiye to batao, ya call karein: IT Helpdesk (Slack)_` }]}
            ], text: `Aapke ${tickets.length} open ticket(s)` });
            return;
          }

          // â”€â”€ Greeting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const isGreeting = /^(hello|hi|hey|namaste|hlo|hii|namaskar|good morning|good afternoon|good evening|salam|sup|helo|helllo)$/i.test(text.trim());
          if (isGreeting) {
            await Conversation.updateMany(
              { slackUserId: userId, source: 'slack', resolved: false },
              { resolved: true }
            );
            pendingTickets.delete(userId);
            const firstName = (emp.empName || 'there').split(' ')[0];
            await say({
              text: `Hello ${firstName}! ðŸ‘‹ WIOM IT Helpdesk`,
              blocks: [
                { type:'section', text:{ type:'mrkdwn', text:`*Hello ${firstName}!* ðŸ‘‹\n_Apni IT problem category select karo:_` }},
                { type:'divider' },
                ...CATEGORIES.map(cat => ({
                  type: 'actions',
                  elements: [{
                    type    : 'button',
                    text    : { type: 'plain_text', text: cat.label, emoji: true },
                    action_id: `dm_cat_${cat.key}`,
                    value   : cat.key
                  }]
                }))
              ]
            });
            return;
          }

          // â”€â”€ Laptop info query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const isLaptopQuery = /laptop|model|serial|s\/n|sn|serial no|asset|device/i.test(text.trim());
          if (isLaptopQuery) {
            const empRec = await Employee.findOne({ slackUserId: userId });
            const model  = empRec?.laptop   || emp.laptop   || null;
            const sn     = empRec?.laptopSN || emp.laptopSN || null;
            if (model || sn) {
              await say({
                text: `ðŸ’» Aapka Laptop: ${model||'â€”'} | SN: ${sn||'â€”'}`,
                blocks: [
                  { type:'section', fields:[
                    { type:'mrkdwn', text:`*ðŸ’» Laptop Model:*\n${model||'â€”'}` },
                    { type:'mrkdwn', text:`*ðŸ”¢ Serial No:*\n\`${sn||'â€”'}\`` }
                  ]}
                ]
              });
              return;
            }
          }

          // â”€â”€ "Ticket bana do" â€” instant creation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const isTicketNow = /ticket\s*(bana\s*do|banao|raise\s*karo|create|chahiye|do|bana|raise)/i.test(text.trim())
                           || /^(ticket|raise ticket|create ticket|bana do ticket)$/i.test(text.trim());
          if (isTicketNow) {
            const pending = pendingTickets.get(userId);
            if (pending) {
              // Pending context exists â†’ create immediately, no Ha/Nahi needed
              pendingTickets.delete(userId);
              const result = await createTicketSlack(pending);
              if (result?._duplicate) {
                await say({ text: `âš ï¸ ${result.message}` });
              } else if (result) {
                const priEmoji = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };
                await say({
                  text: `ðŸŽ« Ticket ${result.ticketId} ban gaya!`,
                  blocks: [
                    { type:'header', text:{ type:'plain_text', text:'âœ… Ticket Created!', emoji:true }},
                    { type:'section', fields:[
                      { type:'mrkdwn', text:`*ðŸŽ« Ticket ID:*\n\`${result.ticketId}\`` },
                      { type:'mrkdwn', text:`*${priEmoji[result.priority]||'ðŸŸ¡'} Priority:*\n${result.priority}` },
                      { type:'mrkdwn', text:`*ðŸ“‚ Category:*\n${result.category||'Other'}` },
                      { type:'mrkdwn', text:`*â³ Status:*\nOpen` }
                    ]},
                    { type:'section', text:{ type:'mrkdwn', text:`*ðŸ“ Problem:*\n${(result.description||'').substring(0,100)}` }},
                    { type:'context', elements:[{ type:'mrkdwn', text:`âœ… IT team ko notify kar diya gaya ðŸ™ | Status: *meri tickets* likh ke check karo` }]}
                  ]
                });
                await notifyAdmin(client, result, emp);
              }
            } else {
              // No context â†’ ask for problem description
              await say({
                text: 'ðŸŽ« Ticket banane ke liye `/ticket` command use karo â€” seedha modal khulega!',
                blocks: [
                  { type:'section', text:{ type:'mrkdwn', text:`*ðŸŽ« Ticket Banana Hai?*\n\nDo tarike hain:\n\n*1.* \`/ticket\` type karo â†’ form bhar do â†’ turant ticket ban jayega âœ…\n*2.* Apni problem batao â†’ AI steps dega â†’ phir ticket automatically suggest karega ðŸ¤–` }},
                  { type:'context', elements:[{ type:'mrkdwn', text:`_Urgent hai? Call karo: *IT Helpdesk (Slack)*_` }]}
                ]
              });
            }
            return;
          }

          // â”€â”€ Pending ticket confirmation check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const pending = pendingTickets.get(userId);
          if (pending) {
            // IMPORTANT: Must be exact short responses â€” "NAHI HUAA" must NOT trigger isNo
            // "nahi huaa", "nahi chala", "kaam nahi kiya" = failed attempt â†’ goes to AI
            // "nahi", "na", "no" alone = user declining ticket â†’ isNo
            const isYes = /^(ha|haan|haa|han|yes|bilkul|ok|bana do|create|kar do|ho jaye)\s*[!à¥¤.,]?\s*$/i.test(text.trim());
            const isNo  = /^(nahi|na|no|nope|mat|chodo|rehne do|band karo)\s*[!à¥¤.,]?\s*$/i.test(text.trim());

            if (isYes) {
              pendingTickets.delete(userId);
              const result = await createTicketSlack(pending);
              if (result?._duplicate) {
                await say({ text: `âš ï¸ ${result.message}` });
              } else if (result) {
                const priEmoji = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };
                await say({
                  text: `ðŸŽ« Ticket ${result.ticketId} create ho gaya!`,
                  blocks: [
                    { type:'section', fields:[
                      { type:'mrkdwn', text:`*ðŸŽ« Ticket Bana!*\n\`${result.ticketId}\`` },
                      { type:'mrkdwn', text:`*${priEmoji[result.priority]||'ðŸŸ¡'} Priority*\n${result.priority}` }
                    ]},
                    { type:'context', elements:[{ type:'mrkdwn', text:`âœ… IT team ko notify kar diya gaya ðŸ™` }]}
                  ]
                });
                await notifyAdmin(client, result, emp);
              }
              return;
            }

            if (isNo) {
              pendingTickets.delete(userId);
              await say({ text: 'ðŸ‘ Theek hai! Koi aur problem ho toh batao.' });
              return;
            }
          }

          // â”€â”€ "Aap karo" / "You do it" detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const isAapKaro = /\b(aap\s*(he|hi|karo|kar|kardo|krdo|khud|chalao|run|open)|tum\s*karo|khud\s*kar|agent\s*(se|karo|chalao)|auto.*fix|you\s*do\s*it|do\s*it\s*yourself|khud\s*(karo|kare|chalao))\b/i.test(text);
          if (isAapKaro) {
            const brand     = detectBrand(emp?.laptop);
            const brandInfo = getBrandInfo(brand, emp?.laptopSN);
            const isOnline  = emp?.agentRegistered && emp?.agentLastSeen
              && (Date.now() - new Date(emp.agentLastSeen)) < 120000;

            const aapKaroBlocks = [];

            if (isOnline && emp?.laptopSN) {
              // Agent online â†’ create a FixJob for diagnostic
              const diagFixMap = { hp: 'run_hp_diag', dell: 'run_dell_diag', lenovo: 'run_lenovo_diag' };
              const diagFix    = diagFixMap[brand] || 'kill_heavy';
              const diagLabel  = brandInfo.diagScript
                ? `ðŸ” ${brandInfo.brandLabel} Diagnostic`
                : 'ðŸ’» Auto Cleanup';
              await FixJob.create({
                empId: emp.empId, empName: emp.empName, laptopSN: emp.laptopSN,
                fixType: [diagFix], fixLabel: diagLabel,
                status: 'pending', slackUserId: userId
              });
              aapKaroBlocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text:
                  `âš¡ *Chal raha hoon!* Agent aapke laptop par *${diagLabel}* run kar raha hai.\n_30-60 seconds mein result milega â€” wait karo!_ ðŸ”`
                }
              });
            } else {
              // Agent offline â†’ show download script
              aapKaroBlocks.push({
                type: 'section',
                text: { type: 'mrkdwn', text:
                  `ðŸ¤– *Script download karo â†’ double-click karo â†’ automatic chalega!*\n_IT ka safe script hai â€” bilkul ek click mein kaam ho jayega._`
                }
              });
              if (brandInfo.diagScript) {
                aapKaroBlocks.push({ type: 'divider' });
                aapKaroBlocks.push({
                  type: 'actions',
                  elements: [{
                    type: 'button',
                    text: { type: 'plain_text', text: `â¬‡ï¸ ${brandInfo.diagLabel}`, emoji: true },
                    style: 'primary',
                    url: `${PORTAL}/scripts/${brandInfo.diagScript}`,
                    action_id: 'diag_dl_dm'
                  }]
                });
              } else {
                aapKaroBlocks.push({
                  type: 'context',
                  elements: [{ type: 'mrkdwn', text: '_Is problem ke liye specific script nahi hai â€” ticket raise karo ya steps manually karo._' }]
                });
              }
            }

            await say({ text: 'ðŸ¤– Auto-fix chal raha hai!', blocks: aapKaroBlocks });
            return;
          }

          // â”€â”€ Normal AI chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const conv = await getSlackSession(userId, emp);
          conv.messages.push({ role: 'user', content: text });
          // Trim to last 30 messages to keep DB lean
          if (conv.messages.length > 30) conv.messages = conv.messages.slice(-30);
          await conv.save();

          const { reply, shouldCreateTicket, ticketData } = await claudeSvc.chat(
            conv.messages,
            { empId: emp.empId, empName: emp.empName, source: 'slack',
              laptop: emp.laptop, laptopSN: emp.laptopSN, dept: emp.dept, floor: emp.floor }
          );

          conv.messages.push({ role: 'assistant', content: reply });
          await conv.save();

          // â”€â”€ FEATURE 2: Format for Slack â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const formattedReply = formatForSlack(reply);

          const blocks = [{ type:'section', text:{ type:'mrkdwn', text: formattedReply }}];

          if (shouldCreateTicket && ticketData) {
            pendingTickets.set(userId, {
              empId: emp.empId, empName: emp.empName, empEmail: emp.email,
              empDept: emp.dept, empFloor: emp.floor,
              laptop: emp.laptop, laptopSN: emp.laptopSN,
              ...ticketData,
              description: ticketData.description || text,
              source: 'slack', slackUserId: userId
            });
            blocks.push({ type:'context', elements:[{ type:'mrkdwn', text:`_Ticket banana hai? *"Ha"* ya *"Nahi"* reply karo_ ðŸŽ«` }]});
          }

          await say({ text: reply, blocks });

        } catch (err) {
          console.error('âŒ DM handler error:', err.message);
          try {
            await say({ text: 'âŒ Kuch technical problem aa gayi. Thoda wait karein aur dobara try karein. IT Helpdesk: IT Helpdesk (Slack)' });
          } catch (sayErr) {
            console.error('âŒ Could not send error message:', sayErr.message);
          }
        }
      });

      // â”€â”€ Start Slack App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      slackApp.start().then(async () => {
        console.log('ðŸ¤– Slack Bot started! Socket Mode active.');
        slackClient = slackApp.client;
        app.locals.slackClient = slackApp.client;

        // Auto-link admin Slack ID
        const adminSlackId = process.env.ADMIN_EMAIL_SLACK_ID;
        if (adminSlackId && adminSlackId !== 'FILL_KARO') {
          await Employee.findOneAndUpdate(
            { name: { $regex: 'ADMIN_EMAIL', $options: 'i' } },
            { slackUserId: adminSlackId },
            { new: true }
          ).catch(() => {});
        }

        // â”€â”€ FEATURE 6: Daily 9AM IST summary (= 03:30 UTC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        cron.schedule('30 3 * * *', async () => {
          try {
            const adminId = process.env.ADMIN_EMAIL_SLACK_ID;
            if (!adminId || adminId === 'FILL_KARO') return;

            const todayStart = new Date();
            todayStart.setUTCHours(0, 0, 0, 0);

            const [totalOpen, newToday, resolvedToday, critical, slaBreached] = await Promise.all([
              Ticket.countDocuments({ status: { $in: ['Open', 'In Progress'] } }),
              Ticket.countDocuments({ createdAt: { $gte: todayStart } }),
              Ticket.countDocuments({ resolvedAt: { $gte: todayStart } }),
              Ticket.countDocuments({ priority: 'Critical', status: { $nin: ['Resolved', 'Closed'] } }),
              Ticket.countDocuments({ slaBreached: true, status: { $nin: ['Resolved', 'Closed'] } })
            ]);

            // Top 3 oldest unresolved tickets
            const oldest = await Ticket.find({ status: { $in: ['Open', 'In Progress'] } })
              .sort({ createdAt: 1 }).limit(3);

            const priEmoji = { Critical:'ðŸ”´', High:'ðŸŸ ', Medium:'ðŸŸ¡', Low:'ðŸŸ¢' };
            let oldestText = '';
            oldest.forEach(t => {
              const hrs = Math.round((Date.now() - new Date(t.createdAt)) / 3600000);
              oldestText += `${priEmoji[t.priority]||'ðŸŸ¡'} \`${t.ticketId}\` â€” ${t.empName} _(${hrs}h pending)_\n`;
            });

            const dateStr = new Date().toLocaleDateString('en-IN', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              timeZone: 'Asia/Kolkata'
            });

            await slackApp.client.chat.postMessage({
              channel: adminId,
              text   : `ðŸ“Š Good Morning! IT Helpdesk Daily Summary â€” ${dateStr}`,
              blocks : [
                { type:'header', text:{ type:'plain_text', text:`ðŸ“Š IT Helpdesk â€” Daily Summary`, emoji:true }},
                { type:'context', elements:[{ type:'mrkdwn', text:`_${dateStr}_` }]},
                { type:'divider' },
                { type:'section', fields:[
                  { type:'mrkdwn', text:`*ðŸ“¬ Aaj Aaye*\n*${newToday}* tickets` },
                  { type:'mrkdwn', text:`*âœ… Aaj Resolve*\n*${resolvedToday}* tickets` },
                  { type:'mrkdwn', text:`*â³ Total Open*\n*${totalOpen}* tickets` },
                  { type:'mrkdwn', text:`*ðŸ”´ Critical Open*\n*${critical}*` },
                  { type:'mrkdwn', text:`*âš ï¸ SLA Breached*\n*${slaBreached}*` }
                ]},
                ...(oldestText ? [
                  { type:'divider' },
                  { type:'section', text:{ type:'mrkdwn', text:`*â³ Sabse Purane Pending Tickets:*\n${oldestText}` }}
                ] : []),
                { type:'context', elements:[{ type:'mrkdwn', text:`_Aaj ki shuruat mubarak! IT Helpdesk: IT Helpdesk (Slack)_` }]}
              ]
            });
            console.log('ðŸ“Š Daily summary sent to admin');
          } catch (err) {
            console.error('Daily summary cron error:', err.message);
          }
        });

      }).catch(err => {
        console.error('âŒ Slack Bot start failed:', err.message);
      });

    } catch (err) {
      console.error('âŒ Slack Bot init error:', err.message);
    }
  } else {
    console.log('âš ï¸  Slack tokens not configured â€” bot not started.');
  }
});

module.exports = app;


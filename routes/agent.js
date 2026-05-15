/**
 * WIOM IT Helpdesk — Laptop Agent API
 * Endpoints used by the Node.js agent running on employee laptops.
 * Authentication: x-agent-key header must match AGENT_SECRET env var.
 */
const router   = require('express').Router();
const FixJob   = require('../models/FixJob');
const Employee = require('../models/Employee');

// ── Auth middleware ───────────────────────────────────────────────────────────
const checkKey = (req, res, next) => {
  const key = req.headers['x-agent-key'];
  if (!key || key !== process.env.AGENT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ── POST /api/agent/register — agent startup ping ────────────────────────────
router.post('/register', checkKey, async (req, res) => {
  const { laptopSN, empId, agentVersion } = req.body;
  if (!laptopSN) return res.status(400).json({ error: 'laptopSN required' });
  try {
    await Employee.findOneAndUpdate(
      { laptopSN },
      { agentRegistered: true, agentVersion, agentLastSeen: new Date() }
    );
    console.log(`🤖 Agent registered: SN=${laptopSN} empId=${empId} v${agentVersion}`);
    res.json({ ok: true, message: 'Registered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/agent/poll?sn=XXX — agent polls for pending fix jobs ─────────────
router.get('/poll', checkKey, async (req, res) => {
  const { sn } = req.query;
  if (!sn) return res.status(400).json({ error: 'sn required' });
  try {
    // Update last-seen
    await Employee.findOneAndUpdate({ laptopSN: sn }, { agentLastSeen: new Date() });

    // Grab the oldest pending job for this laptop
    const job = await FixJob.findOneAndUpdate(
      { laptopSN: sn, status: 'pending' },
      { $set: { status: 'running' } },
      { sort: { createdAt: 1 }, new: true }
    );

    res.json({ job: job || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/agent/result — agent reports fix outcome ───────────────────────
router.post('/result', checkKey, async (req, res) => {
  const { jobId, status, result, details } = req.body;
  if (!jobId) return res.status(400).json({ error: 'jobId required' });

  try {
    const job = await FixJob.findByIdAndUpdate(
      jobId,
      { status, result, details },
      { new: true }
    );
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Push Slack notification to employee
    const slackClient = req.app.locals.slackClient;
    if (slackClient && job.slackUserId) {
      const isSuccess = status === 'success';
      const header = isSuccess ? '✅ Auto-Fix Ho Gaya!' : '⚠️ Auto-Fix Mein Issue';
      const msg    = isSuccess
        ? `✅ *${job.fixLabel || 'Fix'} complete!* 🎉\n\n${result}\n\n_Kuch aur ho toh batao!_ 🙏`
        : `❌ *Auto-fix mein problem aayi.*\n\n${result}\n\nManual steps try karo ya ticket raise karo — \`/ticket\` 🎫`;

      await slackClient.chat.postMessage({
        channel: job.slackUserId,
        text   : isSuccess ? `✅ ${job.fixLabel} complete!` : `⚠️ Auto-fix issue — ${result}`,
        blocks : [
          { type: 'header', text: { type: 'plain_text', text: header, emoji: true }},
          { type: 'section', text: { type: 'mrkdwn', text: msg }},
          ...(details?.summary ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: `_${details.summary}_` }]}] : [])
        ]
      }).catch(err => console.error('Fix result Slack DM error:', err.message));
    }

    console.log(`🔧 Fix job ${jobId} → ${status}: ${result}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/agent/status?sn=XXX — check if agent is online (admin use) ──────
router.get('/status', checkKey, async (req, res) => {
  const { sn } = req.query;
  try {
    const emp = await Employee.findOne({ laptopSN: sn });
    if (!emp) return res.status(404).json({ error: 'Laptop not found' });

    const lastSeen = emp.agentLastSeen;
    const isOnline = lastSeen && (Date.now() - new Date(lastSeen)) < 120000; // within 2 min

    res.json({
      empId          : emp.empId,
      empName        : emp.name,
      laptopSN       : emp.laptopSN,
      agentRegistered: !!emp.agentRegistered,
      agentVersion   : emp.agentVersion,
      agentLastSeen  : lastSeen,
      isOnline
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

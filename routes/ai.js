const router       = require('express').Router();
const Conversation = require('../models/Conversation');
const Ticket       = require('../models/Ticket');
const claudeSvc    = require('../services/claude');
const emailSvc     = require('../services/email');
const { verifyAdmin } = require('../middleware/auth');

// ── POST /api/ai/chat  — Main AI chat endpoint ────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const { message: msgSingle, messages: msgHistory, sessionId, empId, empName, source = 'web',
            slackUserId, slackChannelId, laptop, laptopSN, dept, floor } = req.body;

    // Accept either a single message string or a full messages array from the portal
    const message = msgSingle || (Array.isArray(msgHistory) && msgHistory.length
      ? msgHistory[msgHistory.length - 1]?.content
      : null);

    if (!message || !empId)
      return res.status(400).json({ error: 'message and empId required' });

    // Get or create conversation
    let conv = sessionId
      ? await Conversation.findOne({ sessionId })
      : null;

    if (!conv) {
      conv = await Conversation.create({
        sessionId      : sessionId || `${empId}-${Date.now()}`,
        empId,
        empName        : empName || empId,
        source,
        slackUserId,
        slackChannelId,
        messages       : []
      });
    }

    // Add user message
    conv.messages.push({ role: 'user', content: message });

    // Use client-side history if richer than DB history (portal sends full chatHistory)
    const historyToUse = (Array.isArray(msgHistory) && msgHistory.length > conv.messages.length)
      ? msgHistory
      : conv.messages;

    // Call Claude with full history
    const { reply, shouldCreateTicket, ticketData } = await claudeSvc.chat(
      historyToUse,
      { empId, empName, source, laptop, laptopSN, dept, floor }
    );

    // Add assistant reply
    conv.messages.push({ role: 'assistant', content: reply });

    await conv.save();

    // Return shouldCreateTicket flag to frontend — frontend will ask user for confirmation
    // Ticket is NOT auto-created here; employee portal handles confirmation + creation
    res.json({
      reply,
      sessionId        : conv.sessionId,
      shouldCreateTicket: !!shouldCreateTicket,
      ticketData       : shouldCreateTicket ? ticketData : null
    });

  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/stream  — Server-Sent Events streaming endpoint ─────────────
router.post('/stream', async (req, res) => {
  const { message: msgSingle, messages: msgHistory, sessionId, empId, empName,
          source = 'web', laptop, laptopSN, dept, floor } = req.body;

  const message = msgSingle || (Array.isArray(msgHistory) && msgHistory.length
    ? msgHistory[msgHistory.length - 1]?.content : null);

  if (!message || !empId) {
    res.status(400).json({ error: 'message and empId required' });
    return;
  }

  // ── SSE headers — disable all buffering so chunks arrive instantly ──────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');   // disable nginx buffering
  res.flushHeaders();

  const send = (obj) => {
    try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch {}
  };

  try {
    // Get or create conversation
    let conv = sessionId ? await Conversation.findOne({ sessionId }) : null;
    if (!conv) {
      conv = await Conversation.create({
        sessionId: sessionId || `${empId}-${Date.now()}`,
        empId, empName: empName || empId, source, messages: []
      });
    }

    conv.messages.push({ role: 'user', content: message });
    const historyToUse = (Array.isArray(msgHistory) && msgHistory.length > conv.messages.length)
      ? msgHistory : conv.messages;

    // ── Stream AI response chunk by chunk ────────────────────────────────
    let streamedRaw = '';
    streamedRaw = await claudeSvc.chatStream(
      historyToUse,
      { empId, empName, source, laptop, laptopSN, dept, floor },
      (chunk) => send({ chunk })
    );

    // ── Post-process full text (same as /chat) ────────────────────────────
    let reply = (streamedRaw || '').trim();

    // Detect leaked system prompt
    const isLeaked = /❌\s*(Bot|Step)|✅\s*Real:|BANNED:|━━━|TICKET RULES/i.test(reply);
    if (isLeaked) {
      const lastUser = historyToUse.filter(m => m.role === 'user').pop()?.content || '';
      reply = claudeSvc.getKBAnswer ? (claudeSvc.getKBAnswer(lastUser) || reply) : reply;
    }

    // Clean banned words
    reply = reply
      .replace(/\barre\s+yaar\b/gi, 'Haan').replace(/\barre\s+bhai\b/gi, 'Haan')
      .replace(/\barre\b/gi, '').replace(/\byaar\b/gi, '').replace(/\bbhai\b/gi, '')
      .replace(/\s{2,}/g, ' ').replace(/^[\s,!]+/, '').trim();

    // Ticket detection
    const shouldCreateTicket =
      /type\s*karo[:\s]*\*?ha(an|a|n)?\*?/i.test(reply) ||
      (reply.toLowerCase().includes('ticket') && /ticket\s*(bana|raise|create|banana)/i.test(reply));

    // Save to DB
    conv.messages.push({ role: 'assistant', content: reply });
    await conv.save();

    // Send done signal with final (post-processed) text
    send({ done: true, finalText: reply, sessionId: conv.sessionId, shouldCreateTicket });
    res.end();

  } catch (err) {
    console.error('Stream error:', err.message);
    send({ error: 'AI unavailable. IT Helpdesk: 9654244281', done: true });
    res.end();
  }
});

// ── GET /api/ai/history/:empId  — Get chat history for employee ───────────────
// BUG-28 fix: requires admin auth — conversation history is sensitive
router.get('/history/:empId', verifyAdmin, async (req, res) => {
  try {
    const convs = await Conversation.find({ empId: req.params.empId })
      .sort({ createdAt: -1 }).limit(10)
      .select('sessionId createdAt messageCount resolved ticketId lastActive');
    res.json({ conversations: convs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/ai/session/:sessionId  — Get full conversation ──────────────────
// BUG-29 fix: requires admin auth — session IDs are predictable, full messages exposed
router.get('/session/:sessionId', verifyAdmin, async (req, res) => {
  try {
    const conv = await Conversation.findOne({ sessionId: req.params.sessionId });
    if (!conv) return res.status(404).json({ error: 'Session not found' });
    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/escalate  — Employee requests human support ─────────────────
router.post('/escalate', async (req, res) => {
  try {
    const { empId, empName, empEmail, dept, floor, laptop, issue } = req.body;
    if (!empId) return res.status(400).json({ error: 'empId required' });

    // Send email to IT admin
    await emailSvc.sendEscalationAlert({ empId, empName, empEmail, dept, floor, laptop, issue });

    res.json({ success: true, message: 'IT Admin ko alert bhej diya gaya!' });
  } catch (err) {
    console.error('Escalation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

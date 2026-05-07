const router       = require('express').Router();
const Conversation = require('../models/Conversation');
const Ticket       = require('../models/Ticket');
const claudeSvc    = require('../services/claude');

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

// ── GET /api/ai/history/:empId  — Get chat history for employee ───────────────
router.get('/history/:empId', async (req, res) => {
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
router.get('/session/:sessionId', async (req, res) => {
  try {
    const conv = await Conversation.findOne({ sessionId: req.params.sessionId });
    if (!conv) return res.status(404).json({ error: 'Session not found' });
    res.json({ conversation: conv });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

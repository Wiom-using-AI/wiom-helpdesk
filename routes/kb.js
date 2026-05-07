const router        = require('express').Router();
const KnowledgeBase = require('../models/KnowledgeBase');
const { verifyAdmin } = require('../middleware/auth');

// ── GET /api/kb/search?q=text  — Used by AI service before calling Groq ───────
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ match: null });

    const words = q.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    if (!words.length) return res.json({ match: null });

    const entry = await KnowledgeBase.findOne({
      isActive: true,
      keywords: { $in: words }
    }).sort({ useCount: -1 });

    if (entry) {
      await KnowledgeBase.findByIdAndUpdate(entry._id, { $inc: { useCount: 1 } });
      return res.json({ match: entry });
    }
    res.json({ match: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/kb  — List all entries (admin) ────────────────────────────────────
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const entries = await KnowledgeBase.find({}).sort({ useCount: -1, createdAt: -1 });
    res.json({ entries, total: entries.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/kb  — Create entry ──────────────────────────────────────────────
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { question, answer, keywords, category } = req.body;
    if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });

    // Auto-extract keywords from question if not provided
    const autoKeywords = keywords?.length ? keywords
      : question.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);

    const entry = await KnowledgeBase.create({
      question, answer, keywords: autoKeywords,
      category: category || 'General',
      createdBy: req.admin?.name || 'Admin'
    });
    res.status(201).json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/kb/:id  — Update entry ────────────────────────────────────────
router.patch('/:id', verifyAdmin, async (req, res) => {
  try {
    const entry = await KnowledgeBase.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/kb/:id  — Delete entry ───────────────────────────────────────
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await KnowledgeBase.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

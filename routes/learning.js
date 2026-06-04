const router = require('express').Router();
const LearningQueue = require('../models/LearningQueue');
const { verifyAdmin } = require('../middleware/auth');

// GET /api/learning — list all pending items
router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [items, total] = await Promise.all([
      LearningQueue.find({ status })
        .sort({ occurrences: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      LearningQueue.countDocuments({ status })
    ]);

    res.json({ items, total, page: parseInt(page), status });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// GET /api/learning/stats — dashboard stats
router.get('/stats', verifyAdmin, async (req, res) => {
  try {
    const [pending, approved, rejected, totalOccurrences] = await Promise.all([
      LearningQueue.countDocuments({ status: 'pending' }),
      LearningQueue.countDocuments({ status: { $in: ['approved', 'edited_approved'] } }),
      LearningQueue.countDocuments({ status: 'rejected' }),
      LearningQueue.aggregate([{ $group: { _id: null, total: { $sum: '$occurrences' } } }])
    ]);

    // Top repeated unknown queries
    const topRepeated = await LearningQueue.find({ status: 'pending' })
      .sort({ occurrences: -1 })
      .limit(10)
      .select('query occurrences category intent')
      .lean();

    res.json({
      pending, approved, rejected,
      totalUnknownOccurrences: totalOccurrences[0]?.total || 0,
      topRepeated
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/learning/:id/approve — approve an answer (optionally with edited version)
router.patch('/:id/approve', verifyAdmin, async (req, res) => {
  try {
    const { editedAnswer, reviewNote } = req.body;
    const item = await LearningQueue.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const finalAnswer = editedAnswer || item.aiAnswer;
    const status = editedAnswer ? 'edited_approved' : 'approved';

    await LearningQueue.findByIdAndUpdate(req.params.id, {
      status,
      editedAnswer: editedAnswer || undefined,
      finalAnswer,
      reviewedBy: req.admin?.username || 'admin',
      reviewedAt: new Date(),
      reviewNote
    });

    res.json({ success: true, status, finalAnswer });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/learning/:id/reject — reject an answer
router.patch('/:id/reject', verifyAdmin, async (req, res) => {
  try {
    const { reviewNote } = req.body;
    await LearningQueue.findByIdAndUpdate(req.params.id, {
      status: 'rejected',
      reviewedBy: req.admin?.username || 'admin',
      reviewedAt: new Date(),
      reviewNote
    });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/learning/:id — delete from queue
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    await LearningQueue.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

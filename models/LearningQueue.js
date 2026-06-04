const mongoose = require('mongoose');
const learningQueueSchema = new mongoose.Schema({
  query: { type: String, required: true },
  normalizedQuery: { type: String },
  aiAnswer: { type: String, required: true },
  editedAnswer: { type: String }, // admin-edited version
  finalAnswer: { type: String }, // approved answer (for KB)
  category: { type: String, default: 'unknown' },
  intent: { type: String, default: 'unknown' },
  confidence: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'edited_approved'],
    default: 'pending'
  },
  reviewedBy: { type: String },
  reviewedAt: { type: Date },
  reviewNote: { type: String },
  occurrences: { type: Number, default: 1 }, // how many times this query was asked
  empIds: [{ type: String }], // which employees asked this
  addedToKB: { type: Boolean, default: false },
}, { timestamps: true });

learningQueueSchema.index({ status: 1, createdAt: -1 });
learningQueueSchema.index({ normalizedQuery: 1 });
learningQueueSchema.index({ occurrences: -1 });
module.exports = mongoose.model('LearningQueue', learningQueueSchema);

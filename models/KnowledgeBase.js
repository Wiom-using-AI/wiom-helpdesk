const mongoose = require('mongoose');

const kbSchema = new mongoose.Schema({
  question  : { type: String, required: true },
  keywords  : [{ type: String }],   // match words: ['wifi', 'connect', 'nahi']
  answer    : { type: String, required: true },
  category  : { type: String, default: 'General' },
  useCount  : { type: Number, default: 0 },
  isActive  : { type: Boolean, default: true },
  createdBy : { type: String, default: 'Admin' }
}, { timestamps: true });

kbSchema.index({ keywords: 1 });
kbSchema.index({ isActive: 1, useCount: -1 });

module.exports = mongoose.model('KnowledgeBase', kbSchema);

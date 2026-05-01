const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role     : { type: String, enum: ['user','assistant'], required: true },
  content  : { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const conversationSchema = new mongoose.Schema({
  // ── Session Identity ──────────────────────────────────────────────────────────
  sessionId    : { type: String, required: true, unique: true },
  empId        : { type: String, required: true },
  empName      : { type: String },
  source       : { type: String, enum: ['slack','web','teams'], default: 'web' },

  // ── Slack Context ────────────────────────────────────────────────────────────
  slackUserId  : { type: String },
  slackChannelId: { type: String },

  // ── Conversation ─────────────────────────────────────────────────────────────
  messages     : [messageSchema],
  context      : { type: String },        // running summary for long convos

  // ── Outcome ──────────────────────────────────────────────────────────────────
  resolved     : { type: Boolean, default: false },
  resolvedBy   : { type: String, enum: ['AI','Human','Escalated'], default: null },
  ticketCreated: { type: Boolean, default: false },
  ticketId     : { type: String },        // linked ticket if created

  // ── Stats ─────────────────────────────────────────────────────────────────────
  messageCount : { type: Number, default: 0 },
  lastActive   : { type: Date, default: Date.now },

}, { timestamps: true });

// Update messageCount + lastActive on each message push
conversationSchema.pre('save', function (next) {
  this.messageCount = this.messages.length;
  this.lastActive   = new Date();
  next();
});

conversationSchema.index({ empId: 1, createdAt: -1 });
conversationSchema.index({ slackUserId: 1 });
conversationSchema.index({ lastActive: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);

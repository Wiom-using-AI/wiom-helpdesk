const mongoose = require('mongoose');

const fixJobSchema = new mongoose.Schema({
  empId      : { type: String, required: true },
  empName    : { type: String },
  laptopSN   : { type: String, required: true },
  fixType    : [{ type: String }],
  fixLabel   : { type: String },
  status     : { type: String, enum: ['pending','running','success','failed'], default: 'pending' },
  result     : { type: String },
  details    : { type: Object },
  slackUserId: { type: String },
  agentVersion: { type: String },
  createdAt  : { type: Date, default: Date.now, expires: 86400 }   // auto-delete after 24h
}, { timestamps: true });

fixJobSchema.index({ laptopSN: 1, status: 1, createdAt: 1 });

module.exports = mongoose.model('FixJob', fixJobSchema);

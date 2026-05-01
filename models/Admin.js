const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  username    : { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name        : { type: String, required: true },
  email       : { type: String, required: true },
  role        : { type: String, enum: ['superadmin','admin','viewer'], default: 'admin' },
  isActive    : { type: Boolean, default: true },
  lastLogin   : { type: Date },
}, { timestamps: true });

// Hash password before save
adminSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Compare password helper
adminSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model('Admin', adminSchema);

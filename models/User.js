const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  tc: { type: String, required: true, unique: true, length: 11 },
  password: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'student'], required: true },
  name: { type: String, required: true },
  branch: String,       // Öğretmen için (Matematik, Fizik vb.)
  className: String,    // Öğrenci için (9-A, 11-B vb.)
  avatar: String        // Profil fotoğrafı linki
});

// Şifreyi kaydetmeden önce hash'leyen fonksiyon (next parametresi YOK)
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model('User', userSchema);
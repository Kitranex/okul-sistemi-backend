const mongoose = require('mongoose');

const studentNoteSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 1000 },
  category: {
    type: String,
    enum: ['general', 'academic', 'behavior', 'warning'],
    default: 'general'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StudentNote', studentNoteSchema);
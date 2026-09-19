const mongoose = require('mongoose');

const homeworkSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: String,
  title: { type: String, required: true },
  description: String,
  className: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  dueDate: Date,
  submissions: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    files: [{
      fileName: String,
      filePath: String,
      fileType: String,
      fileSize: Number,
      uploadedAt: { type: Date, default: Date.now }
    }],
    status: { type: String, enum: ['pending', 'done', 'not_done'], default: 'pending' },
    lastUploadedAt: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('Homework', homeworkSchema);

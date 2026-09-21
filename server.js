const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const studentRoutes = require('./routes/students');
app.use('/api/students', studentRoutes);
require('dotenv').config();

const app = express();
app.use(cors());
// Ders programı JSON'unu sun
app.get('/api/schedule', (req, res) => {
  try {
    const schedulePath = path.join(__dirname, 'schedule.json');
    if (!fs.existsSync(schedulePath)) {
      return res.status(404).json({ error: 'Ders programı henüz yüklenmemiş.' });
    }
    const data = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.use(express.json());

// MongoDB Bağlantısı
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB bağlantısı başarılı'))
  .catch(err => console.error('❌ MongoDB bağlantı hatası:', err));

// Route'lar
const authRoutes = require('./routes/auth');
const homeworkRoutes = require('./routes/homework');
const announcementRoutes = require('./routes/announcement');
const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/homeworks', homeworkRoutes);
app.use('/api/announcements', announcementRoutes);

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend çalışıyor!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Sunucu ${PORT} portunda çalışıyor`);
});

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ⚠️ ÖNCE app tanımlanmalı
const app = express();

// ============ MIDDLEWARE ============
app.use(cors());
app.use(express.json());

// ============ ROUTE'LARI IMPORT ET ============
const authRoutes = require('./routes/auth');
const homeworkRoutes = require('./routes/homework');
const announcementRoutes = require('./routes/announcement');
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/students');

// ============ ROUTE'LARI KULLAN ============
app.use('/api/auth', authRoutes);
app.use('/api/homeworks', homeworkRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);

// ============ DERS PROGRAMI ============
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

// ============ TEST ENDPOINT ============
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend çalışıyor!' });
});

// ============ MONGODB BAĞLANTISI ============
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB bağlantısı başarılı'))
  .catch(err => console.error('❌ MongoDB bağlantı hatası:', err));

// ============ SUNUCUYU BAŞLAT ============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Sunucu ${PORT} portunda çalışıyor`);
});

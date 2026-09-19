const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
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

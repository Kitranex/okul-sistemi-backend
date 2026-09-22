const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();

// ============ GÜVENLİK MIDDLEWARE ============

// 1. Helmet - Güvenlik başlıkları
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Cloudinary için
  contentSecurityPolicy: false // Frontend ayrı domainde olduğu için
}));

// 2. CORS - Sadece izin verilen domainler
const allowedOrigins = [
  'https://dedekorkutpts.netlify.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    // Postman/curl gibi origin'siz isteklere izin ver
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Bu origin izinli değil.'));
  },
  credentials: true
}));

// 3. Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. NoSQL Injection koruması
// NoSQL Injection koruması (Express 5 uyumlu özel sanitizer)
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (key.startsWith('$') || key.includes('.')) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
    }
    return obj;
  };
  if (req.body) sanitize(req.body);
  if (req.params) sanitize(req.params);
  // req.query'ye dokunmuyoruz (Express 5'te read-only)
  next();
});
// 5. Rate Limiting - Global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 300, // 15 dakikada max 300 istek
  message: { error: 'Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', globalLimiter);

// 6. Rate Limiting - Login (çok daha sıkı)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10, // 15 dakikada max 10 giriş denemesi
  message: { error: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth/login', loginLimiter);

// 7. Rate Limiting - Kayıt
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 20, // 1 saatte max 20 kayıt
  message: { error: 'Çok fazla kayıt denemesi. Lütfen 1 saat sonra tekrar deneyin.' }
});
app.use('/api/auth/register', registerLimiter);

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

// ============ 404 HANDLER ============
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı.' });
});

// ============ GLOBAL ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error('Hata:', err.message);
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ error: 'Bu origin izinli değil.' });
  }
  res.status(500).json({ error: 'Sunucu hatası.' });
});

// ============ MONGODB BAĞLANTISI ============
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB bağlantısı başarılı');

    // MongoDB bağlandıktan SONRA sunucuyu başlat
    app.listen(PORT, () => {
      console.log(`🚀 Sunucu ${PORT} portunda çalışıyor`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB bağlantı hatası:', err);
    // Bağlantı başarısızsa yine de başlat (hata vermeden bekle)
    app.listen(PORT, () => {
      console.log(`⚠️ Sunucu ${PORT} portunda çalışıyor (MongoDB bağlantısı yok)`);
    });
  });
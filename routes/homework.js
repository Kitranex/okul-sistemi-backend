const express = require('express');
const router = express.Router();
const Homework = require('../models/homework');
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('../middleware/cloudinary');
const path = require('path');

// Multer ayarları (hafızada tut, sonra Cloudinary'ye gönder)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 }, // max 10 dosya, her biri 8 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Desteklenmeyen dosya türü: ' + ext));
  }
});

// TÜM ÖDEVLERİ GETİR
router.get('/', auth, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'student') {
      const student = await User.findById(req.user.id);
      filter.className = student.className;
    }
    if (req.user.role === 'teacher') {
      filter.teacher = req.user.id;
    }
    const homeworks = await Homework.find(filter)
      .populate('teacher', 'name branch')
      .populate('submissions.student', 'name className')
      .sort({ createdAt: -1 });
    res.json(homeworks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YENİ ÖDEV EKLE
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Yetkiniz yok.' });
    const { title, description, className, dueDate, subject } = req.body;
    if (!title || !className || !dueDate) return res.status(400).json({ error: 'Eksik bilgi.' });

    const homework = new Homework({
      teacher: req.user.id,
      subject: subject || 'Genel',
      title, description, className, dueDate
    });
    await homework.save();
    res.status(201).json({ message: 'Ödev yayınlandı.', homework });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DURUM GÜNCELLE
router.put('/:id/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Yetkiniz yok.' });
    const { studentId, status } = req.body;
    if (!['pending', 'done', 'not_done'].includes(status)) return res.status(400).json({ error: 'Geçersiz durum.' });

    const homework = await Homework.findById(req.params.id);
    if (!homework) return res.status(404).json({ error: 'Ödev bulunamadı.' });

    let submission = homework.submissions.find(s => s.student.toString() === studentId);
    if (submission) {
      submission.status = status;
    } else {
      homework.submissions.push({ student: studentId, status, files: [] });
    }
    await homework.save();
    res.json({ message: 'Durum güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ÇOKLU DOSYA YÜKLE (max 10 dosya)
router.post('/:id/upload', auth, upload.array('files', 10), async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Sadece öğrenciler yükleyebilir.' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Dosya seçilmedi.' });

    const homework = await Homework.findById(req.params.id);
    if (!homework) return res.status(404).json({ error: 'Ödev bulunamadı.' });

    // Her dosyayı Cloudinary'ye paralel yükle
    const uploadPromises = req.files.map(file => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'okul-sistemi/odevler',
            resource_type: 'auto',
            public_id: `odev_${homework._id}_${req.user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
          },
          (err, result) => err ? reject(err) : resolve({
            fileName: file.originalname,
            filePath: result.secure_url,
            fileType: file.mimetype,
            fileSize: file.size,
            uploadedAt: new Date()
          })
        );
        stream.end(file.buffer);
      });
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    // Submission'ı bul veya oluştur
    let submission = homework.submissions.find(s => s.student.toString() === req.user.id);
    if (!submission) {
      submission = { student: req.user.id, files: [], status: 'pending' };
      homework.submissions.push(submission);
      submission = homework.submissions[homework.submissions.length - 1];
    }

    // Yeni dosyaları mevcut dosyalara ekle
    submission.files.push(...uploadedFiles);
    submission.status = 'pending';
    submission.lastUploadedAt = new Date();

    await homework.save();
    res.json({
      message: `${uploadedFiles.length} dosya başarıyla yüklendi.`,
      files: uploadedFiles
    });
  } catch (err) {
    console.error('Yükleme hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

// TEK DOSYA SİL
router.delete('/:hwId/files/:fileId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Yetkiniz yok.' });

    const homework = await Homework.findById(req.params.hwId);
    if (!homework) return res.status(404).json({ error: 'Ödev bulunamadı.' });

    const submission = homework.submissions.find(s => s.student.toString() === req.user.id);
    if (!submission) return res.status(404).json({ error: 'Kayıt bulunamadı.' });

    const fileIndex = submission.files.findIndex(f => f._id.toString() === req.params.fileId);
    if (fileIndex === -1) return res.status(404).json({ error: 'Dosya bulunamadı.' });

    // Cloudinary'den sil (opsiyonel, hata olsa da devam et)
    try {
      const urlParts = submission.files[fileIndex].filePath.split('/');
      const publicId = urlParts.slice(-1)[0].split('.')[0];
      await cloudinary.uploader.destroy(`okul-sistemi/odevler/${publicId}`, { resource_type: 'auto' });
    } catch (e) { console.log('Cloudinary silme hatası:', e.message); }

    // MongoDB'den sil
    submission.files.splice(fileIndex, 1);
    await homework.save();
    res.json({ message: 'Dosya silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('../middleware/cloudinary');
const path = require('path');

// Multer ayarları
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // max 5 dosya, her biri 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Desteklenmeyen dosya türü.'));
  }
});

// TÜM DUYURULARI GETİR
router.get('/', auth, async (req, res) => {
  try {
    const announcements = await Announcement.find()
      .populate('author', 'name role branch avatar')
      .sort({ date: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// YENİ DUYURU EKLE (dosya desteği ile)
router.post('/', auth, upload.array('files', 5), async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Sadece öğretmenler duyuru ekleyebilir.' });
    }

    const { title, content, priority } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Başlık ve içerik zorunludur.' });
    }

    let uploadedFiles = [];
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(file => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: 'okul-sistemi/duyurular',
              resource_type: 'auto',
              public_id: `duyuru_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
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
      uploadedFiles = await Promise.all(uploadPromises);
    }

    const announcement = new Announcement({
      title,
      content,
      priority: priority || 'normal',
      author: req.user.id,
      files: uploadedFiles
    });

    await announcement.save();
    res.status(201).json({ message: 'Duyuru yayınlandı.', announcement });
  } catch (err) {
    console.error('Duyuru hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

// DUYURU SİL (sadece yazar)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Yetkiniz yok.' });
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Duyuru bulunamadı.' });
    if (ann.author.toString() !== req.user.id) return res.status(403).json({ error: 'Sadece kendi duyurunuzu silebilirsiniz.' });
    await ann.deleteOne();
    res.json({ message: 'Duyuru silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

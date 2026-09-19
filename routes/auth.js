const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('../middleware/cloudinary');
const auth = require('../middleware/auth');

// KAYIT (sadece öğretmen ekleyebilir)
router.post('/register', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Sadece öğretmenler hesap ekleyebilir.' });
    }
    const { tc, password, role, name, branch, className } = req.body;
    const existing = await User.findOne({ tc });
    if (existing) return res.status(400).json({ error: 'Bu T.C. zaten kayıtlı.' });

    const user = new User({ tc, password, role, name, branch, className });
    await user.save();
    res.status(201).json({ message: 'Kullanıcı oluşturuldu.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GİRİŞ
router.post('/login', async (req, res) => {
  try {
    const { tc, password } = req.body;
    const user = await User.findOne({ tc });
    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Şifre hatalı.' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        tc: user.tc,
        name: user.name,
        role: user.role,
        className: user.className,
        branch: user.branch,
        avatar: user.avatar
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ŞİFRE DEĞİŞTİR
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Mevcut şifre hatalı.' });

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Şifre güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AVATAR YÜKLE
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }
});

router.put('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Dosya yok.' });
    const ext = require('path').extname(req.file.originalname).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
      return res.status(400).json({ error: 'Sadece PNG/JPG yükleyebilirsiniz.' });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'okul-sistemi/avatarlar', resource_type: 'image' },
        (err, r) => err ? reject(err) : resolve(r)
      );
      stream.end(req.file.buffer);
    });

    await User.findByIdAndUpdate(req.user.id, { avatar: result.secure_url });
    res.json({ message: 'Avatar güncellendi.', avatar: result.secure_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
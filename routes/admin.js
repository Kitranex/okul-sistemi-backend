const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Homework = require('../models/Homework');
const Announcement = require('../models/Announcement');
const StudentNote = require('../models/StudentNote');
const auth = require('../middleware/auth');

// Admin kontrolü
function isAdmin(req, res, next) {
  if (req.user.tc !== '10000000000') {
    return res.status(403).json({ error: 'Sadece sistem yöneticisi erişebilir.' });
  }
  next();
}

// TÜM KULLANICILARI GETİR
router.get('/users', auth, isAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password') // ⚠️ Şifreleri asla gönderme (hash'li bile olsa)
      .sort({ role: 1, className: 1, name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ŞİFRE SIFIRLA (yeni şifre belirle)
router.put('/users/:id/password', auth, isAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Şifre en az 4 karakter olmalı.' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    user.password = newPassword; // Model otomatik hash'ler
    await user.save();
    res.json({ message: 'Şifre güncellendi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// KULLANICI SİL
router.delete('/users/:id', auth, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    // Admin kendini silemesin
    if (user.tc === '10000000000') {
      return res.status(400).json({ error: 'Sistem yöneticisi silinemez.' });
    }

    // İlişkili kayıtları temizle
    await Homework.updateMany(
      { 'submissions.student': user._id },
      { $pull: { submissions: { student: user._id } } }
    );
    await StudentNote.deleteMany({ $or: [{ student: user._id }, { teacher: user._id }] });
    await Announcement.deleteMany({ author: user._id });
    await user.deleteOne();

    res.json({ message: 'Kullanıcı ve ilişkili kayıtlar silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SİSTEM İSTATİSTİKLERİ
router.get('/stats', auth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalHomeworks = await Homework.countDocuments();
    const totalAnnouncements = await Announcement.countDocuments();
    const totalNotes = await StudentNote.countDocuments();

    // Sınıf bazlı öğrenci sayıları
    const classCounts = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$className', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalUsers, totalTeachers, totalStudents,
      totalHomeworks, totalAnnouncements, totalNotes,
      classCounts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
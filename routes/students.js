const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Homework = require('../models/homework');const StudentNote = require('../models/StudentNote');
const auth = require('../middleware/auth');

// Bir sınıftaki tüm öğrencileri ödev istatistikleriyle listele
router.get('/class/:className', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Yetkiniz yok.' });
    }

    const students = await User.find({
      role: 'student',
      className: req.params.className
    }).select('_id name className avatar');

    const homeworks = await Homework.find({ className: req.params.className });

    const result = students.map(st => {
      let done = 0, pending = 0, notDone = 0;
      homeworks.forEach(hw => {
        const sub = hw.submissions.find(s => s.student.toString() === st._id.toString());
        const status = sub ? sub.status : 'pending';
        if (status === 'done') done++;
        else if (status === 'not_done') notDone++;
        else pending++;
      });
      return {
        _id: st._id,
        name: st.name,
        className: st.className,
        avatar: st.avatar,
        stats: { done, pending, notDone, total: homeworks.length }
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tek öğrencinin detayları (profil + ödev geçmişi + notlar)
router.get('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Yetkiniz yok.' });
    }

    const student = await User.findById(req.params.id).select('_id name className avatar tc role');
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Öğrenci bulunamadı.' });
    }

    const homeworks = await Homework.find({ className: student.className })
      .populate('teacher', 'name branch')
      .sort({ createdAt: -1 });

    const homeworksWithStatus = homeworks.map(hw => {
      const sub = hw.submissions.find(s => s.student.toString() === student._id.toString());
      return {
        _id: hw._id,
        title: hw.title,
        subject: hw.subject,
        teacher: hw.teacher,
        dueDate: hw.dueDate,
        createdAt: hw.createdAt,
        status: sub ? sub.status : 'pending'
      };
    });

    const stats = {
      done: homeworksWithStatus.filter(h => h.status === 'done').length,
      pending: homeworksWithStatus.filter(h => h.status === 'pending').length,
      notDone: homeworksWithStatus.filter(h => h.status === 'not_done').length,
      total: homeworksWithStatus.length
    };

    const notes = await StudentNote.find({ student: student._id })
      .populate('teacher', 'name branch avatar')
      .sort({ createdAt: -1 });

    res.json({
      student: {
        _id: student._id,
        name: student.name,
        className: student.className,
        avatar: student.avatar,
        tc: student.tc
      },
      stats,
      homeworks: homeworksWithStatus,
      notes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Not ekle
router.post('/:id/notes', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Yetkiniz yok.' });
    }

    const { content, category } = req.body;
    if (!content || content.trim().length < 2) {
      return res.status(400).json({ error: 'Not içeriği çok kısa.' });
    }

    const student = await User.findById(req.params.id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: 'Öğrenci bulunamadı.' });
    }

    const note = new StudentNote({
      student: req.params.id,
      teacher: req.user.id,
      content: content.trim(),
      category: category || 'general'
    });

    await note.save();
    await note.populate('teacher', 'name branch avatar');

    res.status(201).json({ message: 'Not eklendi.', note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Not sil (sadece yazan öğretmen)
router.delete('/:id/notes/:noteId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Yetkiniz yok.' });
    }

    const note = await StudentNote.findById(req.params.noteId);
    if (!note) return res.status(404).json({ error: 'Not bulunamadı.' });

    if (note.teacher.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Sadece kendi notunuzu silebilirsiniz.' });
    }

    await note.deleteOne();
    res.json({ message: 'Not silindi.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
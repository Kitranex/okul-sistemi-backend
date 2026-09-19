const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Belirli bir sınıftaki öğrencileri getir (sadece öğretmen)
router.get('/students/:className', auth, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ error: 'Yetkiniz yok.' });
    }
    const students = await User.find({
      role: 'student',
      className: req.params.className
    }).select('_id name className');
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
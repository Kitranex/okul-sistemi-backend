const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // İstek başlığından token'ı al
  const token = req.header('Authorization');

  // Token yoksa reddet
  if (!token) {
    return res.status(401).json({ error: 'Yetkisiz erişim. Lütfen giriş yapın.' });
  }

  try {
    // "Bearer xxxxx" formatındaki token'dan sadece xxxxx kısmını al
    const cleanToken = token.replace('Bearer ', '');
    const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
    req.user = decoded; // Kullanıcı bilgisini isteğe ekle
    next(); // Devam et
  } catch (err) {
    res.status(401).json({ error: 'Geçersiz token.' });
  }
};
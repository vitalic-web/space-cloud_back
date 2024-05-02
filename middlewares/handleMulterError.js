const multer = require('multer');

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
      // Ошибки, связанные с Multer
      if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).send('File too large. Maximum size is 16MB.');
      }
  } else if (err) {
      // Другие ошибки
      return res.status(500).send('Failed to upload file');
  }
  // Если ошибки нет, передать управление следующему обработчику
  next();
}

module.exports = handleMulterError;
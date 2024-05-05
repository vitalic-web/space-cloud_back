const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');

const multer = require('multer');
const storage = multer.memoryStorage(); // Хранение файлов в памяти
const upload = multer({
  storage: storage,
  limits: { fileSize: 16 * 1024 * 1024 } // размер файла не более 16 MB, ограничение MongoDb
});
const handleMulterError = require('../middlewares/handleMulterError');

router.post('/todos/:todoId/files', upload.single('file'), (req, res, next) => {
  // Проверяем, есть ли файл после работы multer
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  next();
}, handleMulterError, fileController.uploadFile);

router.get('/files/:fileId/:fileName', fileController.downloadFile);
router.patch('/files/:fileId/download-link', fileController.editDownloadFileLink);
router.delete('/files/:fileId/:todoId', fileController.deleteFile);

module.exports = router;
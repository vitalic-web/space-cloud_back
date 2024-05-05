const FileToDo = require('../models/File');
const Todo = require('../models/Todo');

async function uploadFile(req, res) {
  const { todoId } = req.params;

  try {
    // Поиск соответствующего ToDo
    const todo = await Todo.findById(todoId);
    if (!todo) {
      return res.status(404).send('ToDo not found.');
    }

    // Создание объекта файла
    const newFile = new FileToDo({
      name: req.file.originalname,
      data: req.file.buffer,
      contentType: req.file.mimetype,
      downloadLink: 'downloadLink',
    });

    // Сохранение файла в MongoDB
    const savedFile = await newFile.save();

    // Обновление downloadLink
    savedFile.downloadLink = `files/${savedFile._id}/${req.file.originalname}`;
    await savedFile.save();

    // Обновление ToDo с новым файлом
    todo.files.push(savedFile);
    await todo.save();

    res.status(201).send({ message: 'File uploaded successfully', file: savedFile });
  } catch (error) {
    console.error('Failed to upload file:', error);
    res.status(500).send('Failed to upload file');
  }
}

async function downloadFile(req, res) {
  const { fileId } = req.params;

  try {
    // Поиск файла по ID
    const file = await FileToDo.findById(fileId);
    if (!file) {
      return res.status(404).send('File not found.');
    }

    // Отправка файла
    const fileBuffer = file.data; // 'data' предполагает поле, где хранятся бинарные данные файла
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename=' + file.name);
    res.send(fileBuffer); // Отправляем бинарные данные клиенту
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).send('Error downloading file');
  }
}

async function editDownloadFileLink(req, res) {
  const { fileId } = req.params;
  const { newDownloadLink } = req.body;

  if (!newDownloadLink) {
    return res.status(400).json({ message: 'Требуется новая ссылка на скачивание.' });
  }

  try {
    // Поиск файла по ID
    const file = await FileToDo.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: 'Файл не найден.' });
    }

    // Обновление ссылки на скачивание в объекте файла
    file.downloadLink = `files/${file._id}/${newDownloadLink}`;
    await file.save();

    // Обновление ссылки на скачивание в объекте Todo
    const todo = await Todo.findOne({ 'files._id': fileId });

    if (!todo) {
      return res.status(404).json({ message: 'Todo не найден.' });
    }

    // Путь к полю внутри массива, который нужно обновить
    const fileIndex = `files.$.downloadLink`;

    // Обновление ссылки на скачивание в объекте Todo
    await Todo.updateOne(
      { 'files._id': fileId },
      { $set: { [fileIndex]: `files/${file._id}/${newDownloadLink}` } }
    );

    res.json({ message: 'Ссылка на скачивание успешно обновлена', file });
  } catch (error) {
    console.error('Ошибка при обновлении ссылки на скачивание:', error);
    res.status(500).json({ message: 'Не удалось обновить ссылку на скачивание', error: error.message });
  }
}

async function deleteFile(req, res) {
  const { fileId, todoId } = req.params;

  try {
    // Находим и удаляем файл из коллекции файлов
    const file = await FileToDo.findByIdAndDelete(fileId);
    if (!file) {
      return res.status(404).send({ message: 'File not found.' });
    }

    // Обновляем связанный Todo, удаляя файл из массива files в документе Todo
    const updatedTodo = await Todo.findByIdAndUpdate(todoId, {
      $pull: { files: { _id: fileId } }
    }, { new: true });

    res.status(200).send({ message: 'File deleted successfully.', todo: updatedTodo });
  } catch (error) {
    console.error('Failed to delete file:', error);
    res.status(500).send({ message: 'Error deleting file', error: error.message });
  }
}

module.exports = { uploadFile, downloadFile, editDownloadFileLink, deleteFile };
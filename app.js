const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const authenticateToken = require('./middlewares/authenticateToken');
const handleMulterError = require('./middlewares/handleMulterError');
const jwt = require('jsonwebtoken');

const port = 3000;

require('dotenv').config();

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
};

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(cors(corsOptions));

const uri = `mongodb+srv://vtlstk:${process.env.DB_PASSWORD}@cluster0.qpufjcu.mongodb.net/space-cloud?retryWrites=true&w=majority`;

async function runDB() {
  try {
    await mongoose.connect(uri);
    console.log("Successfully connected to MongoDB using Mongoose!");
  } catch (error) {
    console.error('Error connecting to MongoDB: ', error);
  }
}

const initializePassport = require('./passport-config');
initializePassport(passport);

const User = require('./models/User');

app.post('/register', async (req, res) => {
  try {
    const newUser = new User({ username: req.body.username, password: req.body.password });
    await newUser.save();
    res.json({ message: 'Registration successful', user: { id: newUser._id, username: newUser.username } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err || !user) {
      return res.status(401).json({ message: 'Authentication failed' });
    }
    req.logIn(user, async (err) => {
      if (err) return res.status(500).json({ message: 'Error logging in', error: err });

      const accessToken = jwt.sign({ username: user.username, userId: user._id.toString() }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ username: user.username, userId: user._id.toString() }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

      try {
        await User.findByIdAndUpdate(user._id, { refreshToken: refreshToken }, { new: true });

        res.json({
          message: 'Authentication successful',
          userId: user._id,
          username: user.username,
          accessToken,
          refreshToken
        });
      } catch (updateError) {
        console.error('Failed to update user with refreshToken', updateError);
        res.status(500).json({ message: 'Failed to update user with refreshToken', error: updateError.message });
      }
    });
  })(req, res, next);
});

app.post('/token', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh Token is required' });
  }
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (e) {
    return res.status(403).json({ message: 'Invalid Refresh Token' });
  }

  try {
    // Поиск пользователя по ID из payload и проверка, совпадает ли refreshToken
    const user = await User.findById(payload.userId);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({ message: 'Refresh Token does not match' });
    }

    // Если всё в порядке, генерируем и отправляем новый access токен
    const newAccessToken = jwt.sign({ username: user.username, userId: user._id.toString() }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

    res.json({ accessToken: newAccessToken });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// TODO: доработать метод
app.get('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

const Todo = require('./models/Todo');

app.post('/todos', authenticateToken, async (req, res) => {
  try {
    const todo = new Todo({
      user: req.user.userId, // Использование userId из верифицированного токена
      title: req.body.title,
      description: req.body.description,
      completed: req.body.completed,
      files: req.body.files,
      comment: req.body.comment
    });
    await todo.save();
    const total = await Todo.countDocuments({ user: req.user.userId });
    const { pageSize, currentPage } = req.body.paginationInfo;
    const totalPages = Math.ceil(total / pageSize);
    const isLoadLastPage = totalPages > currentPage;
    // paginationInfo для переключения на страницу добавления задачи
    res.status(201).send({ todo, paginationInfo: { isLoadLastPage, pageNumber: totalPages } });
  } catch (error) {
    res.status(400).send(error);
  }
});

app.patch('/todos/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const update = req.body; // Получаем обновленные данные из тела запроса

  try {
    // Проверяем, принадлежит ли TODO пользователю отправившему запрос
    const todo = await Todo.findOne({ _id: id, user: req.user.userId });
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found or you do not have permission to edit it.' });
    }

    const updatedTodo = await Todo.findByIdAndUpdate(id, update, { new: true });
    res.json(updatedTodo);
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

app.get('/todo-list', authenticateToken, async (req, res) => {
  const pageSize = parseInt(req.query.pageSize) || 10; // Количество элементов на странице
  const page = parseInt(req.query.page) || 1; // Номер текущей страницы

  try {
    const total = await Todo.countDocuments({ user: req.user.userId });

    const todos = await Todo.find({ user: req.user.userId })
      .sort({ createdAt: -1, _id: 1 }) // Сортировка сначала по дате создания (новые первыми), потом по ID (без id некорректно отрабатывала)
      .skip((page - 1) * pageSize) // Пропускаем предыдущие страницы
      .limit(pageSize); // Ограничиваем количество элементов

    const filteredTodos = todos.reduce((acc, item) => {
      if (item.completed) {
        acc.completed.push(item);
      } else {
        acc.notCompleted.push(item);
      }
      return acc;
    }, { completed: [], notCompleted: [] });

    res.json({
      totalPages: Math.ceil(total / pageSize),
      currentPage: page,
      pageSize,
      totalCount: total,
      todos: filteredTodos
    });
  } catch (error) {
    console.error('Failed to get todo list with pagination:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

app.delete('/todos', authenticateToken, async (req, res) => {
  try {
    // Удаление всех Todo принадлежащих пользователю, использующему этот токен
    const result = await Todo.deleteMany({ user: req.user.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No todos found for this user.' });
    }
    res.json({ message: `Successfully deleted ${result.deletedCount} todos.` });
  } catch (error) {
    console.error('Error deleting todos:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

const multer = require('multer');
const storage = multer.memoryStorage(); // Хранение файлов в памяти
const upload = multer({
  storage: storage,
  limits: { fileSize: 16 * 1024 * 1024 } // размер файла не более 16 MB, ограничение MongoDb
});
const FileToDo = require('./models/File');

app.post('/todos/:todoId/files', authenticateToken, upload.single('file'), (req, res, next) => {
  // Проверяем, есть ли файл после работы multer
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  next();
}, handleMulterError, async (req, res) => {
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
});

app.get('/files/:fileId/:fileName', async (req, res) => {
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
});

app.patch('/files/:fileId/download-link', authenticateToken, async (req, res) => {
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
});

app.delete('/files/:fileId/:todoId', authenticateToken, async (req, res) => {
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
});


async function startServer() {
  try {
    await runDB();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }
}

startServer();
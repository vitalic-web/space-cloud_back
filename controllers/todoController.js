const Todo = require('../models/Todo');
const FileToDo = require('../models/File');

async function addTodo(req, res) {
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
}

async function editTodo(req, res) {
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
}

async function getTodoList(req, res) {
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
}

async function deleteAllTodos(req, res) {
  try {
    // Найти все Todo принадлежащие пользователю, использующему этот токен
    const todos = await Todo.find({ user: req.user.userId });

    for (const todo of todos) {
      // Удалить все файлы, связанные с текущим Todo
      for (const file of todo.files) {
        await FileToDo.findByIdAndDelete(file._id);
      }
    }

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
}

module.exports = { addTodo, editTodo, getTodoList, deleteAllTodos };
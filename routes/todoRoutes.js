const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todoController');

router.post('/todos', todoController.addTodo);
router.patch('/todos/:id', todoController.editTodo);
router.get('/todo-list', todoController.getTodoList);
router.delete('/todos', todoController.deleteAllTodos);

module.exports = router;
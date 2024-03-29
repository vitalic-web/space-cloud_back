const mongoose = require('mongoose');

const { FileSchema } = require('./File');

const TodoSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  completed: { type: Boolean, default: false },
  files: [FileSchema],
  comment: { type: String }
});

const Todo = mongoose.model('Todo', TodoSchema);
module.exports = Todo;

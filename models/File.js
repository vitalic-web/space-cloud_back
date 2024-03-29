const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  downloadLink: { type: String, required: true }
});

module.exports = mongoose.model('File', FileSchema);
module.exports.FileSchema = FileSchema;

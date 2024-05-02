const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  data: { type: Buffer, required: true },
  contentType: { type: String, required: true },
  downloadLink: { type: String, required: true } 
});

module.exports = mongoose.model('File', FileSchema);
module.exports.FileSchema = FileSchema;

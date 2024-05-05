const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authenticateToken');
const userRoutes = require('./userRoutes');
const todoRoutes = require('./todoRoutes');

router.use(userRoutes);
router.use(authenticateToken);
router.use(todoRoutes);

module.exports = function(app) {
  app.use(router);
};
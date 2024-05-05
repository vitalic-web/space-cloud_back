const express = require('express');
const router = express.Router();
const authenticateToken = require('../middlewares/authenticateToken');
const userRoutes = require('./userRoutes');
const todoRoutes = require('./todoRoutes');
const fileRoutes = require('./fileRoutes');

router.use(userRoutes);
router.use(authenticateToken);
router.use(todoRoutes);
router.use(fileRoutes);

module.exports = function(app) {
  app.use(router);
};
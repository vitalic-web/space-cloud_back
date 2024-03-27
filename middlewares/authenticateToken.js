const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) return res.sendStatus(401); // Если токена нет, отправляем статус 401

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Если токен невалидный, отправляем статус 403
    req.user = user;
    next(); // Передаем управление следующему мидлвару или роуту
  });
}

module.exports = authenticateToken;

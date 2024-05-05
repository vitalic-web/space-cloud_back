const User = require('../models/User');
const jwt = require('jsonwebtoken');
const passport = require('passport');

async function register(req, res) {
  try {
    const newUser = new User({ username: req.body.username, password: req.body.password });
    await newUser.save();
    res.json({ message: 'Registration successful', user: { id: newUser._id, username: newUser.username } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
}

async function login(req, res, next) {
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
}

async function refreshToken(req, res) {
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
}

module.exports = { register, login, refreshToken };
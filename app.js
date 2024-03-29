const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const authenticateToken = require('./middlewares/authenticateToken');
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

app.get('/logout', (req, res) => {
  res.json({ message: 'Logged out' });
});

app.get('/todo-list', authenticateToken, (req, res) => {
  res.json({ message: 'This is a protected route' });
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

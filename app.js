const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const port = 3000;

require('dotenv').config();

const corsOptions = {
  origin: '*', // Это позволяет запросы со всех источников
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
    res.json({ message: 'Registration successful', user: { username: newUser.username } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.log('err', err);
      return res.status(500).json({ message: 'Error during authentication', error: err });
    }
    if (!user) {
      console.log('!user');
      return res.status(401).json({ message: 'Authentication failed', user: null });
    }
    req.logIn(user, (err) => {
      if (err) {
        console.log('logIn err', err);
        return res.status(500).json({ message: 'Error logging in', error: err });
      }
      // Аутентификация успешна, установка cookie
      res.cookie('user_id', user.id, {
        maxAge: 24 * 60 * 60 * 1000, // срок действия cookie (24 часа)
        httpOnly: true, // Cookie недоступен через JavaScript в браузере (повышение безопасности)
      });

      return res.json({ message: 'Authentication successful', user: { username: user.username } });
    });
  })(req, res, next);
});


app.post('/check-auth', (req, res) => {
  if (req.isAuthenticated()) { // используя Passport.js
    res.json({ isAuthenticated: true });
  } else {
    res.json({ isAuthenticated: false });
  }
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
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

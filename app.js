const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
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
    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.redirect('/register');
  }
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      // Обработка ошибки аутентификации
      console.log('err', err);
      return next(err);
    }
    if (!user) {
      // Аутентификация неудачна
      console.log('!user')
      return res.redirect('/login');
    }
    req.logIn(user, (err) => {
      if (err) {
        // Обработка ошибки при сохранении данных пользователя в сессию
        console.log('logIn err', err);
        return next(err);
      }
      // Аутентификация успешна
      console.log('success');
      return res.redirect('/');
    });
  })(req, res, next);
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

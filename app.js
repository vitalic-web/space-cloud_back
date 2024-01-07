const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = 3000;
const { MongoClient, ServerApiVersion } = require('mongodb');

require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
}));

const SECRET_KEY = 'your_secret_key';

const uri = `mongodb+srv://vtlstk:${process.env.DB_PASSWORD}@cluster0.qpufjcu.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const database = client.db('space-cloud');
const users = database.collection('users');

async function runDB() {
  try {
    await client.connect();
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } catch (error) {
    console.error('Error connecting to MongoDB: ', error);
  }
}

app.post('/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = { username: req.body.username, password: hashedPassword };
    await users.insertOne(user);
    res.status(201).send('User registered');
  } catch(err) {
    console.log(err);
    res.status(500).send();
  }
});

app.post('/login', async (req, res) => {
  try {
    const userDB = await users.findOne({ username: req.body.username });
    if (userDB && await bcrypt.compare(req.body.password, userDB.password)) {
      const accessToken = jwt.sign({ username: userDB.username }, SECRET_KEY);
      res.json({ accessToken });
    } else {
      res.status(401).send('Invalid username or password');
    }
  } catch (error) {
    console.error('Login error: ', error);
    res.status(500).send('Internal Server Error');
  }
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

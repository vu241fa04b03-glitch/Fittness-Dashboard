const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vitals';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const JWT_EXPIRES = '7d';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get(['/', '/login', '/signup', '/dashboard'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index1.html'));
});

const entrySchema = new mongoose.Schema({
  date: { type: String, required: true },
  steps: { type: Number, default: 0 },
  calories: { type: Number, default: 0 },
  distance: { type: Number, default: 0 },
  water: { type: Number, default: 0 },
  workout: { type: Number, default: 0 }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  entries: { type: [entrySchema], default: [] }
});

const User = mongoose.model('User', userSchema);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

function createToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const existing = await User.findOne({ username });
  if (existing) {
    return res.status(409).json({ message: 'Username already exists.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword, entries: [] });

  await user.save();
  return res.json({
    username: user.username,
    entries: user.entries,
    token: createToken(user)
  });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ message: 'Incorrect password.' });
  }

  return res.json({
    username: user.username,
    entries: user.entries,
    token: createToken(user)
  });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Authentication token required.' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

app.get('/api/entries/:username', authenticateToken, async (req, res) => {
  const { username } = req.params;
  if (!username) {
    return res.status(400).json({ message: 'Username is required.' });
  }

  if (req.user.username !== username) {
    return res.status(403).json({ message: 'Forbidden.' });
  }

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json({ entries: user.entries });
});

app.post('/api/entries', authenticateToken, async (req, res) => {
  const { entry } = req.body;
  const username = req.user.username;

  if (!entry || !entry.date) {
    return res.status(400).json({ message: 'Entry and entry date are required.' });
  }

  const user = await User.findOne({ username });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const existingIndex = user.entries.findIndex((item) => item.date === entry.date);
  if (existingIndex >= 0) {
    user.entries[existingIndex] = {
      ...user.entries[existingIndex].toObject(),
      ...entry
    };
  } else {
    user.entries.push(entry);
  }

  await user.save();
  return res.json({ entries: user.entries });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

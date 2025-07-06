import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const router = express.Router();

// ========================
// GET All Users
// ========================
router.get('/', async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users.' });
  }
});

// ========================
// POST Add New User
// ========================
router.post('/', async (req, res) => {
  const { svvNetId, password, role } = req.body;

  if (!svvNetId || !password || !role) {
    return res.status(400).json({ message: 'Please enter all fields (svvNetId, password, role).' });
  }

  if (!svvNetId.toLowerCase().endsWith('@somaiya.edu')) {
    return res.status(400).json({ message: 'Only somaiya.edu emails allowed.' });
  }

  try {
    let user = await User.findOne({ svvNetId: svvNetId.toLowerCase() });
    if (user) {
      return res.status(400).json({ message: 'User with this SVVNetID already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      svvNetId: svvNetId.toLowerCase(),
      password: hashedPassword,
      role
    });

    await user.save();

    res.status(201).json({
      message: 'User added successfully!',
      user: { svvNetId: user.svvNetId, role: user.role, _id: user._id }
    });
  } catch (error) {
    console.error('Error adding user:', error);
    res.status(500).json({ message: 'Server error adding user.' });
  }
});

// ========================
// PUT Update User
// ========================
router.put('/:id', async (req, res) => {
  const { svvNetId, password, role } = req.body;

  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (svvNetId && svvNetId.toLowerCase() !== user.svvNetId.toLowerCase()) {
      if (!svvNetId.toLowerCase().endsWith('@somaiya.edu')) {
        return res.status(400).json({ message: 'Only somaiya.edu emails allowed for updates.' });
      }

      const existingUser = await User.findOne({ svvNetId: svvNetId.toLowerCase() });
      if (existingUser && String(existingUser._id) !== req.params.id) {
        return res.status(400).json({ message: 'Another user with this SVVNetID already exists.' });
      }

      user.svvNetId = svvNetId.toLowerCase();
    }

    if (role) user.role = role;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    res.json({
      message: 'User updated successfully!',
      user: { svvNetId: user.svvNetId, role: user.role, _id: user._id }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error updating user.' });
  }
});

// ========================
// DELETE User
// ========================
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'User deleted successfully!' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error deleting user.' });
  }
});

export default router;
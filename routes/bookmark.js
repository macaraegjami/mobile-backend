import { Router } from 'express';
import User from "../models/User.js";
import Activity from '../models/Activity.js';
import LearningMaterial from '../models/LearningMaterial.js'; // Make sure to import this
import auth from '../middleware/auth.js'; // Make sure to import auth middleware

const router = Router();

// GET all bookmarks for a user
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('bookmarks');
    
    res.json({
      bookmarks: user.bookmarks || []
    });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// POST add bookmark
router.post('/:materialId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const material = await LearningMaterial.findById(req.params.materialId);

    if (!material) {
      return res.status(404).json({ error: 'Learning material not found' });
    }

    // Initialize bookmarks array if it doesn't exist
    if (!user.bookmarks) {
      user.bookmarks = [];
    }

    // Check if already bookmarked
    if (user.bookmarks.includes(req.params.materialId)) {
      return res.status(400).json({ error: 'Material already bookmarked' });
    }

    user.bookmarks.push(req.params.materialId);
    await user.save();

    await new Activity({
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'bookmark_add',
      details: `Bookmarked material: ${material.name}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    // Populate the bookmarks before sending response
    const updatedUser = await User.findById(user._id).populate('bookmarks');
    
    res.json({ 
      message: 'Bookmark added successfully', 
      bookmarks: updatedUser.bookmarks 
    });
  } catch (error) {
    console.error('Bookmark error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// DELETE remove bookmark
router.delete('/:materialId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Remove the bookmark
    user.bookmarks = user.bookmarks.filter(
      bookmarkId => bookmarkId.toString() !== req.params.materialId
    );
    
    await user.save();

    await new Activity({
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'bookmark_remove',
      details: `Removed bookmark for material ID: ${req.params.materialId}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.json({ 
      message: 'Bookmark removed successfully', 
      bookmarks: user.bookmarks 
    });
  } catch (error) {
    console.error('Remove bookmark error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

export default router;
import { Router } from 'express';
import User from "../models/User.js";
import Activity from '../models/Activity.js';
import LearningMaterial from '../models/LearningMaterials.js';
import authenticateToken from '../middleware/auth.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET all history items for authenticated user
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'history.material',
        model: 'LearningMaterial',
        select: 'name author description imageUrl status availableCopies'
      })
      .select('history');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Sort history by viewedAt descending (most recent first)
    const sortedHistory = user.history.sort((a, b) => 
      new Date(b.viewedAt) - new Date(a.viewedAt)
    );

    res.json({
      success: true,
      data: sortedHistory
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// POST add to history
router.post('/', async (req, res) => {
  try {
    const { materialId } = req.body;
    
    if (!materialId) {
      return res.status(400).json({ error: 'Material ID is required' });
    }

    const user = await User.findById(req.user._id);
    const material = await LearningMaterial.findById(materialId);

    if (!material) {
      return res.status(404).json({ error: 'Learning material not found' });
    }

    // Initialize history array if it doesn't exist
    if (!user.history) {
      user.history = [];
    }

    // Check if already in history and update timestamp, or add new
    const existingIndex = user.history.findIndex(
      item => item.material.toString() === materialId
    );

    if (existingIndex !== -1) {
      // Update existing entry timestamp
      user.history[existingIndex].viewedAt = new Date();
    } else {
      // Add new history entry
      user.history.push({
        material: materialId,
        viewedAt: new Date()
      });

      // Optional: Limit history to last 100 items
      if (user.history.length > 100) {
        user.history = user.history.slice(-100);
      }
    }

    await user.save();

    await new Activity({
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'history_add',
      details: `Added to history: ${material.name}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.json({ 
      success: true,
      message: 'Added to history successfully'
    });
  } catch (error) {
    console.error('History add error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// DELETE remove single item from history
router.delete('/:materialId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Remove the specific history item
    user.history = user.history.filter(
      item => item.material.toString() !== req.params.materialId
    );
    
    await user.save();

    await new Activity({
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'history_remove',
      details: `Removed from history: ${req.params.materialId}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.json({ 
      success: true,
      message: 'Removed from history successfully'
    });
  } catch (error) {
    console.error('Remove from history error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// DELETE clear all history
router.delete('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Clear all history
    user.history = [];
    
    await user.save();

    await new Activity({
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'history_clear',
      details: 'Cleared all viewing history',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.json({ 
      success: true,
      message: 'History cleared successfully'
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

export default router;
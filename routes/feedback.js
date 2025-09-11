// routes/feedback.js
import express from 'express';
import Feedback from '../models/Feedback.js';
import Activity from '../models/Activity.js';
import User from '../models/User.js';
import authenticateToken from '../middleware/authenticateToken.js';

const router = express.Router();

// Submit feedback (protected route)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Fetch the user from DB using req.user._id
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Create feedback with date
    const feedback = new Feedback({
      ...req.body,
      userId: user._id,
      date: new Date()
    });

    await feedback.save();

    // Log activity
    await new Activity({
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'feedback_add',
      details: 'User submitted feedback',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.status(201).json({ 
      success: true,
      message: 'Thank you for your submission!',
      data: feedback
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(400).json({ 
      success: false,
      message: 'Submission failed',
      error: error.message 
    });
  }
});

export default router;

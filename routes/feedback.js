// feedback.js
import express from 'express';
import Feedback from '../models/Feedback.js';
import Activity from '../models/Activity.js';
import User from '../models/User.js'; // assuming you have User model and req.user is set by auth middleware

const router = express.Router();

// Submit feedback
router.post('/', async (req, res) => {
  try {
    // Get logged-in user (requires auth middleware to set req.user)
    const user = await User.findById(req.user._id);

    // Save feedback
    const feedback = new Feedback({
      ...req.body,
      date: new Date()
    });
    await feedback.save();

    // Save activity log
    await new Activity({
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'feedback_add',
      details: 'User submitted a feedback',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    // Success response
    res.status(201).json({ 
      success: true,
      message: 'Thank you for your submission!',
      data: feedback
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      message: 'Submission failed',
      error: error.message 
    });
  }
});

export default router;

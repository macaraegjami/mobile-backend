// routes/feedback.js
import express from 'express';
import Feedback from '../models/Feedback.js';
import Activity from '../models/Activity.js';
import auth from '../middleware/auth.js'; // Assuming you have authentication middleware

const router = express.Router();

// Apply authentication middleware to protect this route
router.post('/', auth, async (req, res) => {
  try {
    // Create feedback with the correct schema structure
    const feedbackData = {
      name: req.body.userName || 'Anonymous',
      rating: req.body.rating,
      comment: req.body.comment,
      feedbackType: 'library' // Default to library as per your schema
    };

    const feedback = new Feedback(feedbackData);
    await feedback.save();

    // Log activity
    await new Activity({
      userId: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      role: req.user.role,
      action: 'feedback_add',
      details: 'User submitted feedback',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.status(201).json({ success: true, feedback });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
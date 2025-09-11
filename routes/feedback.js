// routes/feedback.js
import express from 'express';
import Feedback from '../models/Feedback.js';
import Activity from '../models/Activity.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { name, rating, comment, feedbackType } = req.body;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rating must be between 1 and 5' 
      });
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Comment is required' 
      });
    }

    const feedbackData = {
      name: name || 'Anonymous',
      rating: Number(rating),
      comment: comment.trim(),
      feedbackType: feedbackType || 'library'
    };

    const feedback = new Feedback(feedbackData);
    await feedback.save();

    // Log activity
    try {
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
    } catch (activityError) {
      console.error('Activity logging failed:', activityError);
      // Don't fail the main request if activity logging fails
    }

    res.status(201).json({ 
      success: true, 
      message: 'Feedback submitted successfully',
      feedback 
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message || 'Failed to submit feedback' 
    });
  }
});

// Get all feedback (optional - for admin dashboard)
router.get('/', auth, async (req, res) => {
  try {
    const feedback = await Feedback.find()
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({ success: true, feedback });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve feedback' 
    });
  }
});

export default router;
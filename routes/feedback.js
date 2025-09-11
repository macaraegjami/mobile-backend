import express from 'express';
import Feedback from '../models/Feedback.js';

const router = express.Router();

// POST /api/feedback
router.post('/', async (req, res) => {
  try {
    console.log('Feedback request received:', req.body);
    
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

    // Validate feedbackType with fallback
    const validFeedbackType = feedbackType && ['library', 'museum'].includes(feedbackType) 
      ? feedbackType 
      : 'library';

    const feedbackData = {
      name: name || 'Anonymous',
      rating: Number(rating),
      comment: comment.trim(),
      feedbackType: validFeedbackType
    };

    console.log('Creating feedback:', feedbackData);
    
    const feedback = new Feedback(feedbackData);
    await feedback.save();

    console.log('Feedback saved successfully');
    
    res.status(201).json({ 
      success: true, 
      message: 'Feedback submitted successfully',
      feedback 
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/feedback (for testing)
router.get('/', async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.json({ success: true, feedbacks });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
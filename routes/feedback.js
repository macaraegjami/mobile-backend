import express from 'express';
import Feedback from '../models/Feedback.js';

const router = express.Router();

router.post('/', async (req, res) => {
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

    // Validate feedbackType
    if (!feedbackType || !['library', 'museum'].includes(feedbackType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Feedback type must be either library or museum' 
      });
    }

    const feedbackData = {
      name: name || 'Anonymous',
      rating: Number(rating),
      comment: comment.trim(),
      feedbackType: feedbackType
    };

    const feedback = new Feedback(feedbackData);
    await feedback.save();

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

export default router;
import express from 'express';
import Suggestion from '../models/Suggestion.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { bookTitle, author, edition, reason } = req.body;

    // Validation
    if (!bookTitle || bookTitle.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Book title is required' 
      });
    }

    if (!author || author.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Author is required' 
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Reason for suggestion is required' 
      });
    }

    const suggestionData = {
      bookTitle: bookTitle.trim(),
      author: author.trim(),
      edition: edition ? edition.trim() : '',
      reason: reason.trim()
    };

    const suggestion = new Suggestion(suggestionData);
    await suggestion.save();

    res.status(201).json({ 
      success: true, 
      message: 'Book suggestion submitted successfully',
      suggestion 
    });

  } catch (error) {
    console.error('Suggestion submission error:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message || 'Failed to submit suggestion' 
    });
  }
});

export default router;
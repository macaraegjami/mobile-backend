import express from 'express';
import Suggestion from '../models/Suggestion.js';

const router = express.Router();

// POST /api/suggestion
router.post('/', async (req, res) => {
  try {
    console.log('Suggestion request received:', req.body);
    
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

    console.log('Creating suggestion:', suggestionData);
    
    const suggestion = new Suggestion(suggestionData);
    await suggestion.save();

    console.log('Suggestion saved successfully');
    
    res.status(201).json({ 
      success: true, 
      message: 'Book suggestion submitted successfully',
      suggestion 
    });

  } catch (error) {
    console.error('Suggestion submission error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/suggestion (for testing)
router.get('/', async (req, res) => {
  try {
    const suggestions = await Suggestion.find().sort({ createdAt: -1 });
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
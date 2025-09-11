// routes/suggestion.js
import express from 'express';
import Suggestion from '../models/Suggestion.js';
import Activity from '../models/Activity.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/', auth, async (req, res) => {
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

    // Log activity
    try {
      await new Activity({
        userId: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        role: req.user.role,
        action: 'suggestion_add',
        details: `User suggested book: ${bookTitle}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }).save();
    } catch (activityError) {
      console.error('Activity logging failed:', activityError);
      // Don't fail the main request if activity logging fails
    }

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

// Get all suggestions (optional - for admin dashboard)
router.get('/', auth, async (req, res) => {
  try {
    const suggestions = await Suggestion.find()
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({ success: true, suggestions });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve suggestions' 
    });
  }
});

export default router;
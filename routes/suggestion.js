// routes/suggestion.js
import express from 'express';
import Suggestion from '../models/Suggestion.js';
import Activity from '../models/Activity.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware
router.post('/', auth, async (req, res) => {
  try {
    // Create suggestion with the correct schema structure
    const suggestionData = {
      bookTitle: req.body.bookTitle,
      author: req.body.author,
      edition: req.body.edition,
      reason: req.body.reason
    };

    const suggestion = new Suggestion(suggestionData);
    await suggestion.save();

    // Log activity
    await new Activity({
      userId: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      role: req.user.role,
      action: 'suggestion_add',
      details: 'User suggested a book',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.status(201).json({ success: true, suggestion });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
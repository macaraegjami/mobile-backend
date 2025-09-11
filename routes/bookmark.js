
import User from "../models/User";

const router = express.Router();

router.post('/:materialId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const material = await LearningMaterial.findById(req.params.materialId);

    if (!material) {
      return res.status(404).json({ error: 'Learning material not found' });
    }

    // Initialize bookmarks array if it doesn't exist
    if (!user.bookmarks) {
      user.bookmarks = [];
    }

    // Check if already bookmarked
    if (user.bookmarks.includes(req.params.materialId)) {
      return res.status(400).json({ error: 'Material already bookmarked' });
    }

    user.bookmarks.push(req.params.materialId);
    await user.save();

    await new Activity({
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'bookmark_add',
      details: `Bookmarked material: ${material.name}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    // Populate the bookmarks before sending response
    const updatedUser = await User.findById(user._id).populate('bookmarks');
    
    res.json({ 
      message: 'Bookmark added successfully', 
      bookmarks: updatedUser.bookmarks 
    });
  } catch (error) {
    console.error('Bookmark error:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

export default router;
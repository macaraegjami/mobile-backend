import User from "../models/User";
import Suggestion from "../models/Suggestion";

const router = express.Router();

router.post('/', async (req, res) => {
  const user = await User.findById(req.user._id);
  try {
    const suggestion = new Suggestion(req.body);
    await suggestion.save();

await new Activity({
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        action: 'suggestion_add',
        details: 'User made a suggestion',
        ipAddress: req.ip,
      userAgent: req.headers['user-agent']
      }).save();

    res.status(201).json(suggestion);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
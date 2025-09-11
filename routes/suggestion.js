import { Router } from 'express';
import Suggestion from "../models/Suggestion.js";
import User from "../models/User.js";
import Activity from "../models/Activity.js";


const router = Router();

router.post('/', async (req, res) => {
    try {
        const suggestion = new Suggestion(req.body);
        await suggestion.save();

        // Only log activity if user is provided
        if (req.body.userId) {
            const user = await User.findById(req.body.userId);
            if (user) {
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
            }
        }

        res.status(201).json({ success: true, suggestion });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

export default router;
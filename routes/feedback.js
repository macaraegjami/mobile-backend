router.post('/', async (req, res) => {
  const user = await User.findById(req.user._id);
  try {
    const feedback = new Feedback(req.body);
    await feedback.save();

    await new Activity({
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'feedback_add',
      details: 'User made a feedback',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.status(201).json(feedback);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

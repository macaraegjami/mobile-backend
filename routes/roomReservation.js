import { Router } from 'express';
const router = Router();
import Feedback from '../models/Feedback.js';
import Activity from '../models/Activity.js';
import authenticateToken from '../middleware/authenticateToken.js';

// POST - Create new reservation
router.post('/', authenticateToken, async (req, res) => {
  try {
    const feedback = new Feedback({
      ...req.body,
      userId: req.user._id,   // now req.user is guaranteed
      date: new Date()
    });

    await feedback.save();

    // Log Activity
    await new Activity({
      userId: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      role: req.user.role,  // ✅ will not be undefined anymore
      action: 'feedback_add',
      details: `User submitted feedback: "${feedback.message || 'N/A'}"`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.status(201).json({
      message: 'Feedback submitted successfully',
      feedback
    });
  } catch (error) {
    res.status(400).json({
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
});

// GET - All reservations
router.get('/', async (req, res) => {
  try {
    const reservations = await RoomReservation.find().populate('userId', 'name email');
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET - Single reservation by ID
router.get('/:id', async (req, res) => {
  try {
    const reservation = await RoomReservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update reservation
router.put('/:id', async (req, res) => {
  try {
    const updatedReservation = await RoomReservation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Add Activity log for reservation update
    await new Activity({
      userId: updatedReservation.userId,
      firstName: req.user?.firstName,
      lastName: req.user?.lastName,
      email: req.user?.email,
      role: req.user?.role,
      action: 'roomreserve_update',
      details: `Updated reservation for room: ${updatedReservation.room} on ${updatedReservation.date.toLocaleDateString()} at ${updatedReservation.time}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.json(updatedReservation);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH - Update reservation status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const reservation = await RoomReservation.findById(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (reservation.status.toLowerCase() === 'cancelled') {
      return res.status(400).json({ message: 'Reservation is already cancelled' });
    }

    if (reservation.status.toLowerCase() === 'completed') {
      return res.status(400).json({ message: 'Cannot modify a completed reservation' });
    }

    // Update status
    reservation.status = status.toLowerCase();
    await reservation.save();

    // Add Activity log for status change
    await new Activity({
      userId: reservation.userId,
      firstName: req.user?.firstName,
      lastName: req.user?.lastName,
      email: req.user?.email,
      role: req.user?.role,
      action: 'status_change',
      details: `Room reservation status changed to "${status}" for room: ${reservation.room} on ${reservation.date.toLocaleDateString()} at ${reservation.time}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();
    
    res.json({
      message: 'Reservation status updated successfully',
      reservation
    });
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(400).json({ 
      message: 'Failed to update reservation status',
      error: error.message 
    });
  }
});

// DELETE - Cancel reservation instead of hard delete
router.delete('/:id', async (req, res) => {
  try {
    const reservation = await RoomReservation.findById(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Update status to cancelled instead of deleting
    reservation.status = 'cancelled';
    await reservation.save();

    // Add Activity log for cancellation
    await new Activity({
      userId: reservation.userId,
      firstName: req.user?.firstName,
      lastName: req.user?.lastName,
      email: req.user?.email,
      role: req.user?.role,
      action: 'status_change',
      details: `Cancelled room reservation for room: ${reservation.room} on ${reservation.date.toLocaleDateString()} at ${reservation.time}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }).save();

    res.json({ message: 'Reservation cancelled successfully', reservation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET - Reservations by user
router.get('/user/:userId', async (req, res) => {
  try {
    const reservations = await RoomReservation.find({ userId: req.params.userId })
      .sort({ date: 1, time: 1 });
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

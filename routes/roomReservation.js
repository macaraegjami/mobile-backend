  import { Router } from 'express';
  const router = Router();
  import RoomReservation from '../models/RoomReservation.js';
  import Activity from '../models/Activity.js';
  import authenticateToken from '../middleware/auth.js';
  import User from '../models/User.js'; // Add this import

  // POST - Create new reservation
  router.post('/', authenticateToken, async (req, res) => {
    try {
      const reservation = new RoomReservation({
        ...req.body,
        userId: req.user._id   // force assign logged-in user
      });
      await reservation.save();

      // Get user details for activity log
      const user = await User.findById(req.user._id);
      
      // Activity log
      await new Activity({
        userId: req.user._id,
        firstName: user.firstName, // Use populated user data
        lastName: user.lastName,
        email: user.email,
        role: user.role, // patron or admin
        action: 'roomreserve_add',
        details: `Reserved room: ${reservation.room} on ${reservation.date.toLocaleDateString()} at ${reservation.time} for "${reservation.purpose}"`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }).save();

      res.status(201).json(reservation);
    } catch (error) {
      res.status(400).json({
        message: 'Failed to create reservation',
        error: error.message
      });
    }
  });

  // PUT - Update reservation
  router.put('/:id', authenticateToken, async (req, res) => { // Add authenticateToken middleware
    try {
      const updatedReservation = await RoomReservation.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );

      if (!updatedReservation) {
        return res.status(404).json({ message: 'Reservation not found' });
      }

      // Get user details for activity log
      const user = await User.findById(req.user._id);

      // Add Activity log for reservation update
      await new Activity({
        userId: updatedReservation.userId,
        firstName: user.firstName, // Use populated user data
        lastName: user.lastName,
        email: user.email,
        role: user.role,
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
  router.patch('/:id/status', authenticateToken, async (req, res) => { // Add authenticateToken middleware
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

      // Get user details for activity log
      const user = await User.findById(req.user._id);

      // Add Activity log for status change
      await new Activity({
        userId: reservation.userId,
        firstName: user.firstName, // Use populated user data
        lastName: user.lastName,
        email: user.email,
        role: user.role,
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
  router.delete('/:id', authenticateToken, async (req, res) => { // Add authenticateToken middleware
    try {
      const reservation = await RoomReservation.findById(req.params.id);
      if (!reservation) {
        return res.status(404).json({ message: 'Reservation not found' });
      }

      // Update status to cancelled instead of deleting
      reservation.status = 'cancelled';
      await reservation.save();

      // Get user details for activity log
      const user = await User.findById(req.user._id);

      // Add Activity log for cancellation
      await new Activity({
        userId: reservation.userId,
        firstName: user.firstName, // Use populated user data
        lastName: user.lastName,
        email: user.email,
        role: user.role,
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
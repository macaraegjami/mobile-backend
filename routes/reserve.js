import { Router } from 'express';
import BorrowRequest from '../models/BorrowRequest.js';
import authenticateToken from '../middleware/auth.js';
import User from '../models/User.js';
import LearningMaterial from '../models/LearningMaterials.js';
import ReserveRequest from '../models/ReserveRequest.js';
import mongoose from 'mongoose';
import Activity from '../models/Activity.js';
import Notification from '../models/Notification.js';

const router = Router();
router.use(authenticateToken);

// Notification Service
const NotificationService = {
  async createNotification(userId, type, title, message) {
    try {
      const notification = new Notification({
        userId,
        type,
        title,
        message,
        isRead: false,
        createdAt: new Date()
      });
      await notification.save();
      return notification;
    } catch (error) {
      console.error('Notification creation error:', error);
    }
  }
};

// ✅ FIXED: Create reservation endpoint with proper 3-day logic
router.post('/', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookId, pickupDate, bookTitle, author, reservationDate, userId, userName } = req.body;

    console.log('Received reservation data:', req.body);

    // ✅ FIXED: Better date parsing with timezone handling
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Today without time

    let pickup;
    let reservation;

    try {
      // Handle pickup date - force to local timezone
      pickup = new Date(pickupDate);
      // Normalize to start of day in local timezone
      pickup = new Date(pickup.getFullYear(), pickup.getMonth(), pickup.getDate());

      if (isNaN(pickup.getTime())) {
        throw new Error('Invalid pickup date');
      }
    } catch (error) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Invalid pickup date format',
        details: 'Please provide a valid date for pickup'
      });
    }

    try {
      // Handle reservation date - force to local timezone
      reservation = reservationDate ? new Date(reservationDate) : new Date();
      // Normalize to start of day in local timezone
      reservation = new Date(reservation.getFullYear(), reservation.getMonth(), reservation.getDate());

      if (isNaN(reservation.getTime())) {
        throw new Error('Invalid reservation date');
      }
    } catch (error) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Invalid reservation date format',
        details: 'Please provide a valid date for reservation'
      });
    }

    console.log('Parsed dates - Today:', today.toISOString());
    console.log('Parsed dates - Reservation:', reservation.toISOString());
    console.log('Parsed dates - Pickup:', pickup.toISOString());

    // ✅ FIXED: Date comparisons using normalized dates
    const maxReservationDate = new Date(today);
    maxReservationDate.setDate(today.getDate() + 2);

    if (reservation < today) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Reservation date cannot be in the past.',
        receivedReservationDate: reservation.toISOString().split('T')[0],
        todayDate: today.toISOString().split('T')[0]
      });
    }

    if (reservation > maxReservationDate) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Reservation date must be within 3 days from today.',
        receivedReservationDate: reservation.toISOString().split('T')[0],
        maxAllowedDate: maxReservationDate.toISOString().split('T')[0]
      });
    }

    // ✅ FIXED: Pickup date must be weekday only (Monday-Friday)
    const pickupDay = pickup.getDay();
    if (pickupDay === 0 || pickupDay === 6) { // 0 = Sunday, 6 = Saturday
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Pickup date must be on a weekday (Monday-Friday).',
        receivedPickupDate: pickup.toISOString().split('T')[0],
        pickupDayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][pickupDay]
      });
    }

    // ✅ FIXED: Pickup can be same day or after reservation (not before)
    if (pickup < reservation) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Pickup date cannot be before reservation date.',
        reservationDate: reservation.toISOString().split('T')[0],
        pickupDate: pickup.toISOString().split('T')[0]
      });
    }

    // ✅ FIXED: Pickup must be within 3 days of reservation (inclusive)
    const maxPickupDate = new Date(reservation);
    maxPickupDate.setDate(reservation.getDate() + 2); // Reservation date + 2 days = 3 days total
    maxPickupDate.setHours(23, 59, 59, 999);

    if (pickup > maxPickupDate) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Pickup date must be within 3 days of reservation date.',
        reservationDate: reservation.toISOString().split('T')[0],
        pickupDate: pickup.toISOString().split('T')[0],
        maxPickupDate: maxPickupDate.toISOString().split('T')[0]
      });
    }

    // Get user info
    let finalUserId = userId;
    let finalUserName = userName;

    if (!finalUserId || !finalUserName) {
      const user = await User.findById(req.user._id).session(session);
      if (!user) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'User not found' });
      }
      finalUserId = user._id;
      finalUserName = `${user.firstName} ${user.lastName}`;
    }

    // Check material availability
    const material = await LearningMaterial.findById(bookId).session(session);
    if (!material) {
      await session.abortTransaction();
      return res.status(404).json({
        error: 'Material not found',
        details: `No material found with ID: ${bookId}`
      });
    }

    if (material.availableCopies <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'No available copies to reserve',
        availableCopies: material.availableCopies,
        materialStatus: material.status
      });
    }

    // Check for existing active reservations
    const existingReservation = await ReserveRequest.findOne({
      userId: finalUserId,
      bookId: bookId,
      status: { $in: ['pending', 'approved'] }
    }).session(session);

    if (existingReservation) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'You already have an active reservation for this book',
        existingReservationId: existingReservation._id,
        existingStatus: existingReservation.status
      });
    }

    // Create reservation
    const newReservation = new ReserveRequest({
      bookTitle: bookTitle,
      author: author || material.author || 'Unknown Author',
      reservationDate: reservation,
      pickupDate: pickup,
      bookId: bookId,
      userId: finalUserId,
      userName: finalUserName,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newReservation.save({ session });

    // Update material availability
    material.availableCopies -= 1;
    if (material.availableCopies <= 0) {
      material.status = 'unavailable';
    }
    await material.save({ session });

    await session.commitTransaction();

    // Activity Logging
    const user = await User.findById(finalUserId);
    if (user) {
      await new Activity({
        userId: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        action: 'reserve_add',
        details: `Reserved material: ${material.name || bookTitle}`,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || 'Unknown'
      }).save();
    }

    // Send notification
    await NotificationService.createNotification(
      finalUserId,
      'reservation_created',
      'Reservation Submitted',
      `Your reservation for "${bookTitle}" has been submitted successfully.`
    );

    res.status(201).json({
      message: 'Reservation submitted successfully',
      request: {
        id: newReservation._id,
        bookTitle: newReservation.bookTitle,
        reservationDate: newReservation.reservationDate,
        pickupDate: newReservation.pickupDate,
        status: newReservation.status
      },
      updatedMaterial: {
        availableCopies: material.availableCopies,
        status: material.status
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Reservation error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid ID format',
        details: 'Please check the provided IDs'
      });
    }

    res.status(500).json({
      error: 'Failed to submit reservation',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  } finally {
    session.endSession();
  }
});

// ✅ FIXED: Admin get all requests
router.get('/admin/all-requests', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin required.' });
    }

    const requests = await ReserveRequest.find()
      .populate('userId', 'firstName lastName email phone')
      .populate('bookId', 'name author imageUrl isbn accessionNumber status availableCopies')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(requests);
  } catch (error) {
    console.error('Admin requests error:', error);
    res.status(500).json({
      error: 'Failed to fetch requests',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Status update endpoint
router.patch('/:id/status', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!status) {
      await session.abortTransaction();
      return res.status(400).json({ error: 'Status is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({ error: 'Access denied. Admin required.' });
    }

    const reserveRequest = await ReserveRequest.findById(id).session(session);
    if (!reserveRequest) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Reserve request not found' });
    }

    const oldStatus = reserveRequest.status;
    reserveRequest.status = status;
    reserveRequest.updatedAt = new Date();

    const material = await LearningMaterial.findById(reserveRequest.bookId).session(session);

    // Handle different status changes
    if (status === 'borrowed') {
      const newBorrow = new BorrowRequest({
        userId: reserveRequest.userId,
        userName: reserveRequest.userName,
        materialId: reserveRequest.bookId,
        bookTitle: reserveRequest.bookTitle,
        author: reserveRequest.author,
        imageUrl: material?.imageUrl || '',
        borrowDate: new Date(),
        returnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'borrowed'
      });

      await newBorrow.save({ session });

    } else if ((status === 'cancelled' || status === 'rejected') && oldStatus !== 'cancelled' && oldStatus !== 'rejected') {
      // Return the copy to available pool only if it wasn't already cancelled/rejected
      if (material) {
        material.availableCopies += 1;
        material.status = material.availableCopies > 0 ? 'available' : 'unavailable';
        await material.save({ session });
      }
    }

    await reserveRequest.save({ session });
    await session.commitTransaction();

    // Send notification
    let notificationTitle = '';
    let notificationMessage = '';

    switch (status) {
      case 'approved':
        notificationTitle = 'Reservation Approved';
        notificationMessage = `Your reservation for "${reserveRequest.bookTitle}" has been approved.`;
        break;
      case 'borrowed':
        notificationTitle = 'Reservation Converted';
        notificationMessage = `Your reservation for "${reserveRequest.bookTitle}" has been converted to a borrow.`;
        break;
      case 'cancelled':
      case 'rejected':
        notificationTitle = 'Reservation Cancelled';
        notificationMessage = `Your reservation for "${reserveRequest.bookTitle}" has been ${status}.`;
        break;
    }

    if (notificationTitle && oldStatus !== status) {
      await NotificationService.createNotification(
        reserveRequest.userId,
        `reservation_${status}`,
        notificationTitle,
        notificationMessage
      );
    }

    // Activity Logging
    await new Activity({
      userId: req.user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: `reserve_status_${status}`,
      details: `Changed reservation status from ${oldStatus} to ${status} for: ${reserveRequest.bookTitle}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown'
    }).save();

    res.json({
      message: `Reservation status updated to ${status}`,
      reserveRequest: {
        id: reserveRequest._id,
        bookTitle: reserveRequest.bookTitle,
        status: reserveRequest.status,
        oldStatus
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Status update error:', error);
    res.status(500).json({
      error: 'Failed to update status',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  } finally {
    session.endSession();
  }
});

// ✅ FIXED: Get user reservations
router.get('/my-requests', async (req, res) => {
  try {
    const requests = await ReserveRequest.find({ userId: req.user._id })
      .populate('bookId', 'title author imageUrl isbn accessionNumber yearofpub typeofmat status availableCopies')
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({
      error: 'Failed to fetch your reservation requests',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ✅ FIXED: Cancel reservation
router.patch('/:id/cancel', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const reservation = await ReserveRequest.findById(req.params.id).session(session);

    if (!reservation) {
      await session.abortTransaction();
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const user = await User.findById(req.user._id);
    if (reservation.userId.toString() !== req.user._id.toString() && user.role !== 'admin') {
      await session.abortTransaction();
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!['pending', 'approved'].includes(reservation.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        error: 'Cannot cancel this reservation',
        currentStatus: reservation.status
      });
    }

    const oldStatus = reservation.status;
    reservation.status = 'cancelled';
    reservation.cancelledAt = new Date();
    reservation.updatedAt = new Date();
    await reservation.save({ session });

    // Return copy to available pool
    const material = await LearningMaterial.findById(reservation.bookId).session(session);
    if (material) {
      material.availableCopies += 1;
      material.status = material.availableCopies > 0 ? 'available' : 'unavailable';
      await material.save({ session });
    }

    await session.commitTransaction();

    // Send notification
    if (oldStatus !== 'cancelled') {
      await NotificationService.createNotification(
        reservation.userId,
        'reservation_cancelled',
        'Reservation Cancelled',
        `Your reservation for "${reservation.bookTitle}" has been cancelled.`
      );
    }

    // Activity Logging
    await new Activity({
      userId: req.user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      action: 'reserve_cancel',
      details: `Cancelled reservation for: ${reservation.bookTitle}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || 'Unknown'
    }).save();

    res.json({
      message: 'Reservation cancelled successfully',
      reservation: {
        id: reservation._id,
        bookTitle: reservation.bookTitle,
        status: reservation.status
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Cancel reservation error:', error);
    res.status(500).json({
      error: 'Failed to cancel reservation',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  } finally {
    session.endSession();
  }
});

export default router;
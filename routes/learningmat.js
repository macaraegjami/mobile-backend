import { Router } from 'express';
import LearningMaterial from '../models/LearningMaterials.js';
import User from '../models/User.js';
import authenticateToken from '../middleware/auth.js';
import BorrowRequest from '../models/BorrowRequest.js';
import ReserveRequest from '../models/ReserveRequest.js';
import BookRating from '../models/BookRating.js';

const router = Router();

// Improved async handler with error logging
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error('Async handler error:', err);
    next(err);
  });
};

// GET availability status for a specific material
router.get('/:id/availability', asyncHandler(async (req, res) => {
  const material = await LearningMaterial.findById(req.params.id)
    .select('name availableCopies totalCopies status');
  
  if (!material) {
    return res.status(404).json({ error: 'Material not found' });
  }
  
  res.json({
    _id: material._id,
    name: material.name,
    availableCopies: material.availableCopies,
    totalCopies: material.totalCopies,
    status: material.status,
    isAvailable: material.availableCopies > 0
  });
}));

// Combined and improved single GET endpoint for materials
router.get('/', asyncHandler(async (req, res) => {
  // Debug log the query parameters
  console.log('Query params:', req.query);

  // Filter by type if provided
  const filter = {};
  if (req.query.typeofmat) {
    filter.typeofmat = req.query.typeofmat;
  }

  // Add status filter if provided
  if (req.query.status) {
    filter.status = req.query.status;
  }

  // Add available copies filter
  if (req.query.available === 'true') {
    filter.availableCopies = { $gt: 0 };
  }

  // Build sort object based on query parameters
  let sort = {};
  if (req.query.sort) {
    // Handle sort parameter (e.g., '-createdAt' for descending)
    const sortField = req.query.sort;
    if (sortField.startsWith('-')) {
      // Descending order
      sort[sortField.substring(1)] = -1;
    } else {
      // Ascending order
      sort[sortField] = 1;
    }
  } else {
    // Default sort by createdAt descending (newest first)
    sort = { createdAt: -1 };
  }

  // Debug log the filter and sort being applied
  console.log('Applying filter:', filter);
  console.log('Applying sort:', sort);

  // Apply limit if provided
  let query = LearningMaterial.find(filter).sort(sort);
  if (req.query.limit) {
    query = query.limit(parseInt(req.query.limit));
  }

  const materials = await query.lean();

  // Debug log the number of results
  console.log(`Found ${materials.length} materials matching filter`);

  // Format the response to match what frontend expects
  const formattedMaterials = materials.map(material => ({
    _id: material._id,
    name: material.name,
    author: material.author,
    description: material.description,
    imageUrl: material.imageUrl || 'https://via.placeholder.com/150x200?text=No+Cover',
    status: material.status || (material.availableCopies > 0 ? 'available' : 'borrowed'),
    availableCopies: material.availableCopies,
    totalCopies: material.totalCopies,
    typeofmat: material.typeofmat,
    createdAt: material.createdAt,
    accessionNumber: material.accessionNumber,
    edition: material.edition,
    yearofpub: material.yearofpub,
    isbn: material.isbn,
    issn: material.issn,
    // Add calculated availability field
    isAvailable: material.availableCopies > 0
  }));

  res.json({
    success: true,
    data: formattedMaterials
  });
}));

// GET a specific learning material by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const material = await LearningMaterial.findById(req.params.id);
  if (!material) {
    return res.status(404).json({ message: 'Learning material not found' });
  }

  // Ensure status is calculated correctly
  const materialWithStatus = {
    ...material.toObject(),
    status: material.status || (material.availableCopies > 0 ? 'available' : 'borrowed'),
    isAvailable: material.availableCopies > 0
  };

  res.json(materialWithStatus);
}));

// GET status endpoint
router.get('/:id/status', asyncHandler(async (req, res) => {
  const material = await LearningMaterial.findById(req.params.id);
  if (!material) {
    return res.status(404).json({ error: 'Material not found' });
  }
  
  const status = material.status || (material.availableCopies > 0 ? 'available' : 'borrowed');
  res.json({ 
    status,
    availableCopies: material.availableCopies,
    totalCopies: material.totalCopies,
    isAvailable: material.availableCopies > 0
  });
}));

// PATCH route to fix status based on available copies
router.patch('/:id/fix-status', authenticateToken, asyncHandler(async (req, res) => {
  const material = await LearningMaterial.findById(req.params.id);
  if (!material) {
    return res.status(404).json({ error: 'Material not found' });
  }
  
  console.log('Before fix - Available copies:', material.availableCopies, 'Status:', material.status);
  
  // Fix the status based on available copies
  if (material.availableCopies > 0) {
    material.status = 'available';
  } else {
    material.status = 'borrowed';
  }
  
  await material.save();
  
  console.log('After fix - Available copies:', material.availableCopies, 'Status:', material.status);
  
  res.json({ message: 'Status fixed', material });
}));

// Debug endpoint
router.get('/:id/debug', asyncHandler(async (req, res) => {
  const material = await LearningMaterial.findById(req.params.id);
  if (!material) {
    return res.status(404).json({ error: 'Material not found' });
  }
  
  res.json({
    id: material._id,
    name: material.name,
    availableCopies: material.availableCopies,
    totalCopies: material.totalCopies,
    status: material.status || (material.availableCopies > 0 ? 'available' : 'borrowed'),
    canBorrow: material.availableCopies > 0,
    canReserve: material.availableCopies > 0
  });
}));

// User reserved materials endpoint
router.get('/user/reserved', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const reservedMaterials = await ReserveRequest.find({
    userId,
    status: { $in: ['pending', 'approved', 'active'] }
  }).populate('bookId');

  res.json({ success: true, data: reservedMaterials });
}));

// User borrowed materials endpoint
router.get('/user/borrowed', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const borrowedMaterials = await BorrowRequest.find({
    userId,
    status: { $in: ['pending', 'borrowed'] }
  }).populate('materialId');

  res.json({ success: true, data: borrowedMaterials });
}));


// Cancel borrow request
router.post('/:id/cancel-borrow', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { userId, transactionId } = req.body;
    const materialId = req.params.id;

    // Validate inputs
    if (!userId || !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Both userId and transactionId are required'
      });
    }

    // Find the borrow request
    const borrowRequest = await BorrowRequest.findOne({
      _id: transactionId,
      materialId,
      userId,
      status: { $in: ['pending', 'borrowed'] }
    });

    if (!borrowRequest) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found or already cancelled/returned'
      });
    }

    // Update material's available copies if it was approved/borrowed
    if (['borrowed'].includes(borrowRequest.status)) {
      await LearningMaterial.findByIdAndUpdate(
        materialId,
        { $inc: { availableCopies: 1 } }
      );
    }

    // Update the borrow request status
    borrowRequest.status = 'cancelled';
    borrowRequest.cancelledAt = new Date();
    await borrowRequest.save();

    res.json({
      success: true,
      message: 'Borrow request cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel borrow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel borrow request',
      error: error.message
    });
  }
}));

// Cancel reserve request
router.post('/:id/cancel-reserve', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { userId, transactionId } = req.body;
    const materialId = req.params.id;

    // Validate inputs
    if (!userId || !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Both userId and transactionId are required'
      });
    }

    // Find the reserve request
    const reserveRequest = await ReserveRequest.findOne({
      _id: transactionId,
      bookId: materialId,
      userId,
      status: { $in: ['pending', 'approved', 'active'] }
    });

    if (!reserveRequest) {
      return res.status(404).json({
        success: false,
        message: 'Reservation not found or already cancelled'
      });
    }

    // Update material's available copies if it was approved/active
    if (['approved', 'active'].includes(reserveRequest.status)) {
      await LearningMaterial.findByIdAndUpdate(
        materialId,
        { $inc: { availableCopies: 1 } }
      );
    }

    // Update the reserve request status
    reserveRequest.status = 'cancelled';
    reserveRequest.cancelledAt = new Date();
    await reserveRequest.save();

    res.json({
      success: true,
      message: 'Reservation cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel reserve error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel reservation',
      error: error.message
    });
  }
}));

// Return a borrowed material
router.post('/:id/return', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { userId, transactionId } = req.body;

    // Validate inputs
    if (!userId || !transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Both userId and transactionId are required'
      });
    }

    // Find the borrow request
    const borrowRequest = await BorrowRequest.findOne({
      _id: transactionId,
      materialId: req.params.id,
      userId,
      status: 'borrowed'
    });

    if (!borrowRequest) {
      return res.status(404).json({
        success: false,
        message: 'Borrow record not found or already returned'
      });
    }

    // Update the material's available copies
    await LearningMaterial.findByIdAndUpdate(
      req.params.id,
      { $inc: { availableCopies: 1 } }
    );

    // Update the borrow request status
    borrowRequest.status = 'returned';
    borrowRequest.returnDate = new Date();
    await borrowRequest.save();

    res.json({
      success: true,
      message: 'Material returned successfully'
    });

  } catch (error) {
    console.error('Return material error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to return material',
      error: error.message
    });
  }
}));

router.post('/:id/rating', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { rating, review, borrowId } = req.body;
    const userId = req.user._id;
    const materialId = req.params.id;

    // Validate input
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid rating between 1 and 5'
      });
    }

    // Check if the material exists
    const material = await LearningMaterial.findById(materialId);
    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Learning material not found'
      });
    }

    // Check if the borrow transaction exists and is returned
    const borrow = await BorrowRequest.findOne({
      _id: borrowId,
      userId,
      materialId,
      status: 'returned'
    });

    if (!borrow) {
      return res.status(404).json({
        success: false,
        message: 'Borrow transaction not found, not returned, or does not belong to you'
      });
    }

    // Check if user has already rated this material for this transaction
    const existingRating = await BookRating.findOne({
      userId,
      materialId,
      borrowId
    });

    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: 'You have already rated this material for this transaction'
      });
    }

    // Create new rating
    const newRating = await BookRating.create({
      userId,
      materialId,
      borrowId,
      rating,
      review,
      materialTitle: material.name,
      author: material.author
    });

    // Update the borrow record to mark as rated
    borrow.isRated = true;
    await borrow.save();

    // Update material's average rating
    const ratings = await BookRating.find({ materialId });
    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    material.averageRating = parseFloat(averageRating.toFixed(1));
    await material.save();

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      data: newRating
    });
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting rating',
      error: error.message
    });
  }
}));

export default router;
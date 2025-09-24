import { Router } from 'express';
import LearningMaterial from '../models/LearningMaterials.js';
import User from '../models/User.js';
import authenticateToken from '../middleware/auth.js';
import BorrowRequest from '../models/BorrowRequest.js';
import ReserveRequest from '../models/ReserveRequest.js';
import BookRating from '../models/BookRating.js';
import mongoose from 'mongoose'; // Make sure to import mongoose

const router = Router();

// Improved async handler with error logging
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(err => {
    console.error('Async handler error:', err);
    next(err);
  });
};

// Combined and improved single GET endpoint for materials
router.get('/', async (req, res) => {
  try {

    // Debug log the query parameters
    console.log('Query params:', req.query);

    // Filter by type if provided
    const filter = {};
    if (req.query.typeofmat) {
      filter.typeofmat = req.query.typeofmat;
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
      status: material.availableCopies > 0 ? 'available' : 'unavailable',
      availableCopies: material.availableCopies,
      totalCopies: material.totalCopies,
      typeofmat: material.typeofmat,
      createdAt: material.createdAt, // Make sure to include this field

      // ✅ add these fields
      accessionNumber: material.accessionNumber,
      edition: material.edition,
      yearofpub: material.yearofpub,
      isbn: material.isbn,
      issn: material.issn,
    }));



    res.json({
      success: true,
      data: formattedMaterials
    });
  } catch (err) {
    console.error('Error fetching materials:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch materials',
      error: err.message
    });
  }
});

// GET a specific learning material by ID with consistent status formatting
router.get('/:id', async (req, res) => {
  try {
    const material = await LearningMaterial.findById(req.params.id).lean();
    if (!material) {
      return res.status(404).json({ message: 'Learning material not found' });
    }

    // Format same as list
    const formattedMaterial = {
      _id: material._id,
      name: material.name,
      author: material.author,
      description: material.description,
      imageUrl: material.imageUrl || 'https://via.placeholder.com/150x200?text=No+Cover',
      status: material.availableCopies > 0 ? 'available' : 'unavailable',
      availableCopies: material.availableCopies,
      totalCopies: material.totalCopies,
      typeofmat: material.typeofmat,
      createdAt: material.createdAt,
      accessionNumber: material.accessionNumber,
      edition: material.edition,
      yearofpub: material.yearofpub,
      isbn: material.isbn,
      issn: material.issn,
    };

    res.json({ success: true, data: formattedMaterial });
  } catch (error) {
    console.error('Error fetching material:', error);
    res.status(500).json({ message: error.message });
  }
});


router.get('/:id/status', async (req, res) => {
  try {
    const material = await LearningMaterial.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    res.json({ status: material.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this to your learningmat.js routes file
router.delete('/:id', async (req, res) => {
  try {
    const deletedMat = await LearningMaterial.findByIdAndDelete(req.params.id);
    if (!deletedMat) {
      return res.status(404).json({ message: 'Learning material not found' });
    }

    res.status(200).json({ message: 'Learning material deleted successfully' });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      message: 'Failed to delete learning material',
      error: error.message
    });
  }
});

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


router.get('/:id/rating/check/:transactionId', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id: bookId, transactionId } = req.params;
    const userId = req.user._id;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(bookId) || !mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    const existingRating = await BookRating.findOne({
      userId,
      bookId,
      transactionId
    });

    return res.json({
      success: true,
      hasRated: !!existingRating,
      rating: existingRating || null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to check existing rating'
    });
  }
}));


router.post('/:id/rating', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const { id: bookId } = req.params;
    const { rating, review, transactionId, materialTitle, author } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(bookId) || !mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const newRating = await BookRating.createSafeRating({
      userId,
      bookId,
      transactionId,
      rating,
      review: review?.trim() || '',
      materialTitle,
      author
    });

    return res.json({
      success: true,
      message: 'Rating submitted successfully',
      rating: newRating
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit rating'
    });
  }
}));


// Get all ratings for a material
router.get('/:id/ratings', asyncHandler(async (req, res) => {
  try {
    const bookId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid book ID format'
      });
    }

    const ratings = await BookRating.find({ 
      bookId: bookId
    }).populate('userId', 'firstName lastName').sort({ createdAt: -1 });

    const averageRating = ratings.length > 0 
      ? parseFloat((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1))
      : 0;

    res.json({
      success: true,
      data: {
        ratings: ratings,
        totalRatings: ratings.length,
        averageRating: averageRating
      }
    });
  } catch (error) {
    console.error('Error fetching ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ratings',
      error: error.message
    });
  }
}));

export default router;
import mongoose from 'mongoose';

const bookRatingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LearningMaterial',
    required: true
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BorrowRequest',
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  review: {
    type: String,
    maxlength: 500,
    trim: true,
    default: ''
  },
  materialTitle: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Create a unique index with partial filter to handle null values
bookRatingSchema.index(
  { userId: 1, transactionId: 1 }, 
  { 
    unique: true,
    name: 'userId_1_transactionId_1',
    partialFilterExpression: { 
      transactionId: { $ne: null, $exists: true } 
    }
  }
);

// Add a pre-save hook to validate transactionId
bookRatingSchema.pre('save', function(next) {
  if (!this.transactionId) {
    return next(new Error('transactionId is required and cannot be null'));
  }
  next();
});

// Static method to safely create rating with duplicate check
bookRatingSchema.statics.createSafeRating = async function(ratingData) {
  try {
    // Double-check for existing rating before creation
    const existing = await this.findOne({
      userId: ratingData.userId,
      transactionId: ratingData.transactionId
    });
    
    if (existing) {
      throw new Error('DUPLICATE_RATING');
    }
    
    return await this.create(ratingData);
  } catch (error) {
    if (error.code === 11000 || error.message === 'DUPLICATE_RATING') {
      throw new Error('You have already rated this material for this transaction');
    }
    throw error;
  }
};

const BookRating = mongoose.model('BookRating', bookRatingSchema);
export default BookRating;
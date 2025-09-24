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
    trim: true
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

// Fix the unique index to prevent null values issue
bookRatingSchema.index({ 
  userId: 1, 
  transactionId: 1 
}, { 
  unique: true,
  partialFilterExpression: { 
    transactionId: { $type: "objectId" } 
  }
});

const BookRating = mongoose.model('BookRating', bookRatingSchema);
export default BookRating;
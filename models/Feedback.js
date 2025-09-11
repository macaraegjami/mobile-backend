import { Schema, model } from 'mongoose';

const feedbackSchema = new Schema({
  name: { type: String, default: 'Anonymous' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  feedbackType: { 
    type: String, 
    required: true,
    enum: ['library', 'museum'], // Only allows these two values
    default: 'library'
  },
  createdAt: { type: Date, default: Date.now }

});

export default model('Feedback', feedbackSchema);
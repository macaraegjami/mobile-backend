import { Schema, model } from 'mongoose';

const suggestionSchema = new Schema({
  bookTitle: { type: String, required: true },
  author: { type: String, required: true },
  edition: { type: String },
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default model('Suggestion', suggestionSchema);

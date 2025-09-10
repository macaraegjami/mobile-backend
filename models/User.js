import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new Schema({
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  studentID: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
  dob: { type: Date, required: true },
  password: { type: String, required: true },
  course: { type: String, required: true },
  yearLevel: { type: String, required: true },
  department: { type: String, required: true },
  profileImage: { type: String },
  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 },
  loginAttempts: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpires: { type: Date },
  otp: { type: String },
  otpExpires: { type: Date },
  role: { type: String, default: 'patron' },

  // Password reset fields
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
  resetTokenUsed: { type: Boolean, default: false }
}, {
  timestamps: true,
  collection: 'lms_user',
  toJSON: {
    transform: function (doc, ret) {
      delete ret.password;
      delete ret.__v;
      delete ret.otp;
      delete ret.verificationToken;
      delete ret.loginAttempts;
      delete ret.resetToken;
      delete ret.resetTokenExpires;
      delete ret.resetTokenUsed;
      return ret;
    },
  },
});

// IMPROVED Password hashing middleware
userSchema.pre('save', async function (next) {
  // Only proceed if password was modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    console.log('Pre-save hook: Password was modified for user:', this.email);
    
    // Check if password is already hashed
    // Bcrypt hashes start with $2a$, $2b$, or $2y$ followed by the cost factor
    const bcryptHashRegex = /^\$2[ayb]\$[0-9]{2}\$/;
    
    if (bcryptHashRegex.test(this.password)) {
      console.log('Pre-save hook: Password is already hashed, skipping hash process');
      return next();
    }
    
    console.log('Pre-save hook: Hashing raw password');
    
    // Hash the password with salt rounds of 10 (consistent across app)
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    console.log('Pre-save hook: Password hashed successfully');

    // Clear reset token if password was changed
    if (this.resetToken) {
      console.log('Pre-save hook: Clearing reset tokens');
      this.resetToken = undefined;
      this.resetTokenExpires = undefined;
      this.resetTokenUsed = true;
    }
    
    next();
  } catch (err) {
    console.error('Pre-save hook error:', err);
    return next(err);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function (candidatePassword) {
  console.log('Comparing password for user:', this.email);
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  console.log('Password comparison result:', isMatch ? 'MATCH' : 'NO MATCH');
  return isMatch;
};

// Password reset token generation
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetToken = resetToken;
  this.resetTokenExpires = Date.now() + 3600000; // 1 hour
  this.resetTokenUsed = false;
  return resetToken;
};

// Clear reset token
userSchema.methods.clearPasswordResetToken = function () {
  this.resetToken = undefined;
  this.resetTokenExpires = undefined;
  this.resetTokenUsed = true;
};

// Check if reset token is valid
userSchema.methods.isResetTokenValid = function (token) {
  return (
    this.resetToken === token &&
    this.resetTokenExpires > Date.now() &&
    !this.resetTokenUsed
  );
};

export default model('User', userSchema, 'lms_user');
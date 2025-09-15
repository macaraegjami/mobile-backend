import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const userSchema = new Schema({
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },

  // Conditionally required studentID
  studentID: { 
    type: String, 
    required: function () {
      return !['admin', 'superadmin', 'super_admin'].includes(this.role);
    }, 
    sparse: true,
    unique: false // allow duplicates for admins
  },

  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String },
  dob: { type: Date },
  password: { type: String, required: true },

  // Conditionally required academic info
  course: { 
    type: String,
    required: function () {
      return !['admin', 'superadmin', 'super_admin'].includes(this.role);
    }
  },
  department: { 
    type: String,
    required: function () {
      return !['admin', 'superadmin', 'super_admin'].includes(this.role);
    }
  },
  yearLevel: { 
    type: String,
    required: function () {
      return !['admin', 'superadmin', 'super_admin'].includes(this.role);
    }
  },

  // Library card number
  libraryCardNumber: { type: String, unique: true, sparse: true },

  profileImage: { type: String },
  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 },
  loginAttempts: { type: Number, default: 0 },

  // Verification
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpires: { type: Date },

  // OTPs
  otp: { type: String },
  otpExpires: { type: Date },
  loginOtp: { type: String },
  loginOtpExpires: { type: Date },

  role: { type: String, enum: ['patron', 'admin', 'superadmin', 'super_admin'], default: 'patron' },

  // Password reset fields
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
  resetTokenUsed: { type: Boolean, default: false },

  // Bookmarks and history
  bookmarks: [{
    type: Schema.Types.ObjectId,
    ref: 'LearningMaterial',
    default: []
  }],
  history: [{
    material: {
      type: Schema.Types.ObjectId,
      ref: 'LearningMaterial'
    },
    viewedAt: {
      type: Date,
      default: Date.now
    }
  }]
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

// Password hashing
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const bcryptHashRegex = /^\$2[ayb]\$[0-9]{2}\$/;
    if (bcryptHashRegex.test(this.password)) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    if (this.resetToken) {
      this.resetToken = undefined;
      this.resetTokenExpires = undefined;
      this.resetTokenUsed = true;
    }

    next();
  } catch (err) {
    return next(err);
  }
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetToken = resetToken;
  this.resetTokenExpires = Date.now() + 3600000; // 1h
  this.resetTokenUsed = false;
  return resetToken;
};

userSchema.methods.clearPasswordResetToken = function () {
  this.resetToken = undefined;
  this.resetTokenExpires = undefined;
  this.resetTokenUsed = true;
};

userSchema.methods.isResetTokenValid = function (token) {
  return (
    this.resetToken === token &&
    this.resetTokenExpires > Date.now() &&
    !this.resetTokenUsed
  );
};

// Generate library card number (static)
userSchema.statics.generateLibraryCardNumber = async function () {
  const lastUser = await this.findOne(
    { libraryCardNumber: { $exists: true, $ne: null } },
    { libraryCardNumber: 1 }
  ).sort({ libraryCardNumber: -1 });

  let nextNumber = 1000;
  if (lastUser && lastUser.libraryCardNumber) {
    const lastNumber = parseInt(lastUser.libraryCardNumber.replace('LC', ''));
    nextNumber = lastNumber + 1;
  }

  return `LC${nextNumber}`;
};

// ✅ Only keep role index
userSchema.index({ role: 1 });

export default model('User', userSchema, 'lms_user');

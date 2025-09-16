import express from 'express';
import authenticateToken from '../middleware/auth.js';
import User from '../models/User.js';
import LearningMaterial from '../models/LearningMaterial.js';
import cloudinary from '../config/cloudinary.js';
import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcryptjs';

const router = express.Router();

// ✅ ayusin dirname para consistent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get user history
router.get('/:userId/history', authenticateToken, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to access this history'
      });
    }

    const user = await User.findById(req.params.userId)
      .populate({
        path: 'history.material',
        select: 'name title author imageUrl description status availableCopies totalCopies typeofmat isbn issn accessionNumber yearofpub edition'
      })
      .select('history');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Transform the data to match frontend expectations
    const historyData = user.history.map(item => {
      if (!item.material) return null; // Skip if material was deleted
      
      const material = item.material;
      return {
        _id: material._id,
        name: material.name || material.title,
        title: material.name || material.title,
        author: material.author,
        imageUrl: material.imageUrl || 'https://via.placeholder.com/150x200?text=No+Cover',
        description: material.description || 'No description available',
        status: material.status,
        availableCopies: material.availableCopies,
        totalCopies: material.totalCopies,
        typeofmat: material.typeofmat,
        isbn: material.isbn,
        issn: material.issn,
        accessionNumber: material.accessionNumber,
        yearofpub: material.yearofpub,
        edition: material.edition,
        viewedAt: item.viewedAt
      };
    }).filter(item => item !== null); // Remove null items

    // Sort by viewedAt descending (most recent first)
    historyData.sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));

    res.json({
      success: true,
      data: historyData
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add item to user history
router.post('/:userId/history', authenticateToken, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to modify this history'
      });
    }

    const { bookId } = req.body;
    
    if (!bookId) {
      return res.status(400).json({
        success: false,
        error: 'Book ID is required'
      });
    }

    // Verify the material exists
    const material = await LearningMaterial.findById(bookId);
    if (!material) {
      return res.status(404).json({
        success: false,
        error: 'Book not found'
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Remove existing entry if it exists
    user.history = user.history.filter(item => 
      item.material.toString() !== bookId.toString()
    );

    // Add new entry at the beginning
    user.history.unshift({
      material: bookId,
      viewedAt: new Date()
    });

    // Keep only last 50 items
    if (user.history.length > 50) {
      user.history = user.history.slice(0, 50);
    }

    await user.save();

    res.json({
      success: true,
      message: 'Item added to history successfully'
    });

  } catch (error) {
    console.error('Add to history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add item to history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Remove single item from history
router.delete('/:userId/history/:bookId', authenticateToken, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to modify this history'
      });
    }

    const { userId, bookId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Remove the item from history
    user.history = user.history.filter(item => 
      item.material.toString() !== bookId.toString()
    );

    await user.save();

    res.json({
      success: true,
      message: 'Item removed from history successfully'
    });

  } catch (error) {
    console.error('Remove from history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove item from history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Clear all history
router.delete('/:userId/history', authenticateToken, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized to modify this history'
      });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.history = [];
    await user.save();

    res.json({
      success: true,
      message: 'History cleared successfully'
    });

  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear history',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Upload profile image to Cloudinary
router.post('/:userId/upload-profile', authenticateToken, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId) {
      return res.status(403).json({ error: 'Unauthorized to upload for this user' });
    }

    if (!req.files || !req.files.profileImage) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.profileImage;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: 'profile-images', // organize in folder
      public_id: `${req.params.userId}_${Date.now()}`,
      resource_type: 'image',
    });

    // Update user with Cloudinary URL
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { profileImage: result.secure_url },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Profile image uploaded successfully',
      profileImage: result.secure_url, // Cloudinary URL
      user
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Server error while uploading profile image' });
  }
});

// Fixed change-password route in users.js
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    console.log('Change password request received for user:', req.user._id);

    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required.'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long.'
      });
    }

    // Check if new password is different from current
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password.'
      });
    }

    // Find user and explicitly select password field
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    // Check if user has a password (in case of social login users)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        error: 'Password change not available for this account type.'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    console.log('Current password verification:', isCurrentPasswordValid ? 'SUCCESS' : 'FAILED');

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect.'
      });
    }

    // Hash new password with same salt rounds as registration
    const saltRounds = 10; // Use consistent salt rounds
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    console.log('New password hashed successfully');

    // Update password directly without triggering pre-save hooks
    await User.findByIdAndUpdate(
      userId,
      { 
        password: hashedNewPassword,
        // Clear any reset tokens if they exist
        resetToken: undefined,
        resetTokenExpires: undefined,
        resetTokenUsed: undefined
      },
      { new: false } // Don't return the updated document to avoid password in response
    );

    console.log('Password updated successfully in database for user:', user.email);

    // Verify the password was saved correctly by testing it
    const updatedUser = await User.findById(userId).select('+password');
    const testNewPassword = await updatedUser.comparePassword(newPassword);
    console.log('New password verification test:', testNewPassword ? 'SUCCESS' : 'FAILED');

    if (!testNewPassword) {
      console.error('Password update failed - verification test failed');
      return res.status(500).json({
        success: false,
        error: 'Password update failed. Please try again.'
      });
    }

    res.json({
      success: true,
      message: 'Password updated successfully. Please log in with your new password.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating password. Please try again.'
    });
  }
});

export default router;
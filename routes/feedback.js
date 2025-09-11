import express from "express";
import Feedback from "../models/Feedback.js";

const router = express.Router();

// POST feedback
router.post("/", async (req, res) => {
  try {
    const { name, rating, comment, feedbackType } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Submission failed",
        error: "Rating must be between 1 and 5",
      });
    }
    if (!comment) {
      return res.status(400).json({
        success: false,
        message: "Submission failed",
        error: "Comment is required",
      });
    }

    const feedback = new Feedback({ name, rating, comment, feedbackType });
    await feedback.save();

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: feedback,
    });
  } catch (error) {
    console.error("Feedback submission error:", error);
    res.status(500).json({
      success: false,
      message: "Submission failed",
      error: error.message || "Internal server error",
    });
  }
});

export default router;

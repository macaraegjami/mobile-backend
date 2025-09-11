import express from "express";
import Suggestion from "../models/Suggestion.js";

const router = express.Router();

// POST suggestion
router.post("/", async (req, res) => {
  try {
    const { bookTitle, author, edition, reason } = req.body;

    if (!bookTitle) {
      return res.status(400).json({
        success: false,
        message: "Submission failed",
        error: "Book title is required",
      });
    }
    if (!author) {
      return res.status(400).json({
        success: false,
        message: "Submission failed",
        error: "Author is required",
      });
    }
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Submission failed",
        error: "Reason for suggestion is required",
      });
    }

    const suggestion = new Suggestion({ bookTitle, author, edition, reason });
    await suggestion.save();

    res.status(201).json({
      success: true,
      message: "Suggestion submitted successfully",
      data: suggestion,
    });
  } catch (error) {
    console.error("Suggestion submission error:", error);
    res.status(500).json({
      success: false,
      message: "Submission failed",
      error: error.message || "Internal server error",
    });
  }
});

export default router;

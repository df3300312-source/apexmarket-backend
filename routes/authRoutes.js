const express = require("express");
const router = express.Router();
const db = require("../config/db");

// Controllers
const {
  register,
  login,
  logout, // Added this
  getProfile,
  verifyEmail,
  forgotPassword,
  resetPassword,
  resendVerification,
} = require("../controllers/authController");

// Middleware
const { protect } = require("../middleware/auth");

/**
 * 🔓 PUBLIC ROUTES
 * No authentication required
 */
router.post("/register", register);
router.post("/login", login);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-verification", resendVerification);

/**
 * 🔒 PROTECTED ROUTES
 * User must be logged in
 */

// Get current user profile
router.get("/profile", protect, getProfile);

// Secure Logout (Clears the HTTP-only cookie)
router.post("/logout", protect, logout);

// Auth Status check (Useful for frontend to verify session on page refresh)
router.get("/status", protect, (req, res) => {
  res.status(200).json({
    authenticated: true,
    user: {
      id: req.user.id,
      role: req.user.role,
    },
  });
});

module.exports = router;

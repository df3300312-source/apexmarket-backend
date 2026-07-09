const express = require("express");
const router = express.Router();

// Middleware
const { protect } = require("../middleware/auth");

// Controllers
const {
  createWithdrawal,
  getUserWithdrawals,
  getWithdrawalById,
} = require("../controllers/withdrawalController");

/**
 * 🔒 SECURITY LAYER
 * All withdrawal routes are private.
 * Users must be authenticated to request or view payouts.
 */
router.use(protect);

// @route   POST /api/withdrawals
// @desc    Submit a new withdrawal request (Min $50)
router.post("/", createWithdrawal);

// @route   GET /api/withdrawals
// @desc    Get the payout history for the logged-in user
router.get("/", getUserWithdrawals);

// @route   GET /api/withdrawals/:id
// @desc    Get detailed status of a specific withdrawal request
router.get("/:id", getWithdrawalById);

module.exports = router;

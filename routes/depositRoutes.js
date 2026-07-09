const express = require("express");
const router = express.Router();

// Middleware
const { protect } = require("../middleware/auth");

// Controllers
const {
  createDeposit,
  getUserDeposits,
  updateDepositHash, // Added this from our enhanced controller
} = require("../controllers/depositController");

/**
 * 🔒 ALL ROUTES BELOW ARE PROTECTED
 * Users must be logged in to access deposit features
 */
router.use(protect);

// @route   POST /api/deposits
// @desc    Initiate a new investment deposit
router.post("/", createDeposit);

// @route   GET /api/deposits/my-deposits
// @desc    Get the deposit history for the logged-in user
router.get("/my-deposits", getUserDeposits);

// @route   PATCH /api/deposits/:id/hash
// @desc    Update a pending deposit with a crypto transaction hash (TXID)
router.patch("/:id/hash", updateDepositHash);

module.exports = router;

const express = require("express");
const router = express.Router();

// Controllers
const { getPlans, getPlanById } = require("../controllers/planController");

/**
 * 🔓 PUBLIC ROUTES
 * These routes are public because you want visitors to see your
 * investment plans before they even sign up.
 */

// @route   GET /api/plans
// @desc    Get all active investment plans (Starter, Silver, Gold, etc.)
router.get("/", getPlans);

// @route   GET /api/plans/:id
// @desc    Get detailed information about a single plan
router.get("/:id", getPlanById);

module.exports = router;

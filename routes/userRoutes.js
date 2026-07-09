const express = require("express");
const router = express.Router();

// Middleware
const { protect } = require("../middleware/auth");

// Controllers
const {
  getDashboardOverview, // Optimized single-call for stats
  getProfile,
  getBalance,
  getReferrals,
  getTransactions,
  getNotifications,
  updateNotifications,
  get2FAStatus,
  getActiveInvestments,
  getTotalEarned,
  getPendingWithdrawals,
  updateProfile,
  changePassword,
  enable2FA,
  disable2FA,
  logout,
} = require("../controllers/userController");

/**
 * 🔒 SECURITY LAYER
 * All routes in this file require the user to be logged in.
 */
router.use(protect);

// --- 📊 DASHBOARD & STATS ---
// This is the main route your React Dashboard will call on load
router.get("/overview", getDashboardOverview);

router.get("/balance", getBalance);
router.get("/active-investments", getActiveInvestments);
router.get("/total-earned", getTotalEarned);
router.get("/pending-withdrawals", getPendingWithdrawals);
router.get("/transactions", getTransactions);

// --- 👥 REFERRALS ---
router.get("/referrals", getReferrals);

// --- 👤 PROFILE MANAGEMENT ---
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.put("/password", changePassword);

// --- ⚙️ SETTINGS & NOTIFICATIONS ---
router.get("/notifications", getNotifications);
router.put("/notifications", updateNotifications);

// --- 🛡️ SECURITY & 2FA ---
router.get("/2fa/status", get2FAStatus);
router.post("/2fa/enable", enable2FA);
router.post("/2fa/disable", disable2FA);

// --- 🚪 AUTH ACTION ---
router.post("/logout", logout);

module.exports = router;

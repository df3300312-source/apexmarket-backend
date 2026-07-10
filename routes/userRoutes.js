const express = require("express");
const router = express.Router();

// Middleware
const { protect } = require("../middleware/auth");

// Controllers
const {
  getDashboardOverview,
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
  generate2FASecret,
  logout,
} = require("../controllers/userController");

/**
 * 🔒 SECURITY LAYER
 * All routes in this file require the user to be logged in.
 */
router.use(protect);

// --- 📊 DASHBOARD & STATS ---
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

// --- 🛡️ SECURITY & 2FA (no extra auth needed – already protected by router.use) ---
router.get("/2fa/generate", generate2FASecret);
router.post("/2fa/enable", enable2FA);
router.post("/2fa/disable", disable2FA);
router.get("/2fa/status", get2FAStatus);

// --- 🚪 AUTH ACTION ---
router.post("/logout", logout);

module.exports = router;

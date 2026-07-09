const express = require("express");
const router = express.Router();
const { auth, admin } = require("../middleware/auth"); //
const {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getAllDeposits,
  approveDeposit,
  rejectDeposit,
  getAllWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getAllPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getSettings,
  updateSettings,
  getDashboardStats,
} = require("../controllers/adminController");
const contactController = require("../controllers/contactController");

router.use(auth, admin);

// --- 📊 DASHBOARD ---
router.get("/stats", getDashboardStats);

// --- 👥 USER MANAGEMENT ---
router.get("/users", getAllUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
// Note: You might want a router.get('/users/:id', getUserById) later

// --- 💰 DEPOSIT MANAGEMENT ---
router.get("/deposits", getAllDeposits);
router.put("/deposits/:id/approve", approveDeposit); // Matches controller: req.params.id
router.put("/deposits/:id/reject", rejectDeposit);

// --- 💸 WITHDRAWAL MANAGEMENT ---
router.get("/withdrawals", getAllWithdrawals);
router.put("/withdrawals/:id/approve", approveWithdrawal);
router.put("/withdrawals/:id/reject", rejectWithdrawal);

// --- 📈 INVESTMENT PLANS ---
router.get("/plans", getAllPlans);
router.post("/plans", createPlan);
router.put("/plans/:id", updatePlan);
router.delete("/plans/:id", deletePlan);

// --- ⚙️ SYSTEM SETTINGS ---
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

// --- 📩 CONTACT MESSAGES ---
router.get("/messages", contactController.getAdminMessages);
router.delete("/messages/:id", contactController.deleteMessage);

module.exports = router;

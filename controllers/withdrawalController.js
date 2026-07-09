const db = require("../config/db");

// Helper to get total pending withdrawal amount for a user
const getPendingWithdrawalTotal = async (userId) => {
  const [rows] = await db.query(
    'SELECT IFNULL(SUM(amount), 0) as total FROM withdrawals WHERE user_id = ? AND status = "pending"',
    [userId],
  );
  return parseFloat(rows[0].total);
};

// User creates a withdrawal request
exports.createWithdrawal = async (req, res) => {
  const { amount, method, address } = req.body;
  const userId = req.user.id;

  // 1. Validate required fields
  if (!amount || !method || !address) {
    return res
      .status(400)
      .json({ message: "Amount, method, and wallet address are required" });
  }

  // 2. Validate amount (Production standard: Min $50)
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum < 50) {
    return res
      .status(400)
      .json({ message: "Minimum withdrawal amount is $50.00" });
  }

  try {
    // 3. Get user current balance (Fresh check from DB)
    const [userRows] = await db.query(
      "SELECT balance FROM users WHERE id = ?",
      [userId],
    );
    const currentBalance = parseFloat(userRows[0].balance);

    // 4. Double-check balance
    if (amountNum > currentBalance) {
      return res
        .status(400)
        .json({ message: "Insufficient balance for this withdrawal" });
    }

    // 5. Check if total pending withdrawals + this amount would exceed balance
    const pendingTotal = await getPendingWithdrawalTotal(userId);
    if (pendingTotal + amountNum > currentBalance) {
      return res.status(400).json({
        message: `Total pending withdrawals ($${pendingTotal}) plus this request exceeds your current balance.`,
      });
    }

    // 6. Insert withdrawal request
    const [result] = await db.query(
      `INSERT INTO withdrawals (user_id, amount, method, address, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [userId, amountNum, method.toUpperCase(), address],
    );

    res.status(201).json({
      status: "success",
      id: result.insertId,
      message:
        "Withdrawal request submitted. It will be processed after admin verification.",
    });
  } catch (err) {
    console.error("Withdrawal Request Error:", err);
    res
      .status(500)
      .json({ message: "Server error while processing withdrawal" });
  }
};
// User gets their own withdrawal history
exports.getUserWithdrawals = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, amount, method, address, status, rejection_reason, 
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') as date
       FROM withdrawals
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id],
    );

    res.json({
      status: "success",
      results: rows.length,
      withdrawals: rows,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// User gets a single withdrawal by ID (optional)
exports.getWithdrawalById = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT id, amount, method, address, status, rejection_reason, created_at, processed_at
       FROM withdrawals 
       WHERE id = ? AND user_id = ?`, // Fixed: needed to check for both ID and User
      [id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Withdrawal record not found" });
    }

    res.json({
      status: "success",
      data: rows[0],
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

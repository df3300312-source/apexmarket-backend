const db = require("../config/db"); // ✅ only once
const { sendEmail } = require("../services/emailService");

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [userCount] = await db.query("SELECT COUNT(*) as total FROM users");
    const [depositSum] = await db.query(
      'SELECT SUM(amount) as total FROM deposits WHERE status = "completed"',
    );
    const [withdrawalSum] = await db.query(
      'SELECT SUM(amount) as total FROM withdrawals WHERE status = "approved"',
    );
    const [pendingDeposits] = await db.query(
      'SELECT COUNT(*) as total FROM deposits WHERE status = "pending"',
    );

    const [recent] = await db.query(`
      (SELECT 'deposit' as type, d.id, d.amount, d.status, d.created_at, u.name as userName
       FROM deposits d JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC LIMIT 5)
      UNION ALL
      (SELECT 'withdrawal' as type, w.id, w.amount, w.status, w.created_at, u.name as userName
       FROM withdrawals w JOIN users u ON w.user_id = u.id
       ORDER BY w.created_at DESC LIMIT 5)
      ORDER BY created_at DESC LIMIT 10
    `);

    res.json({
      stats: {
        users: userCount[0].total,
        deposits: pendingDeposits[0].total,
        withdrawals: 0,
        totalDeposits: depositSum[0].total || 0,
        totalWithdrawals: withdrawalSum[0].total || 0,
      },
      recent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// === USERS ===
// --- Updated getAllUsers in adminController.js ---
exports.getAllUsers = async (req, res) => {
  try {
    // We join the users table with itself to get the name of the person who referred them
    const [rows] = await db.query(`
      SELECT 
        u1.*, 
        u2.name as referrerName, 
        u2.email as referrerEmail
      FROM users u1
      LEFT JOIN users u2 ON u1.referred_by = u2.id
      ORDER BY u1.created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("Admin Fetch Users Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createUser = async (req, res) => {
  const { name, email, password, role, balance } = req.body;
  try {
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (name, email, password, role, balance) VALUES (?, ?, ?, ?, ?)",
      [name, email, hashedPassword, role || "user", balance || 0],
    );
    res.status(201).json({ message: "User created" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, balance } = req.body;
  try {
    await db.query(
      "UPDATE users SET name = ?, email = ?, role = ?, balance = ? WHERE id = ?",
      [name, email, role, balance, id],
    );
    res.json({ message: "User updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM users WHERE id = ?", [id]);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// === DEPOSITS ===
exports.getAllDeposits = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.id, d.amount, d.status, d.created_at, d.txid,
             p.name AS plan, u.name AS userName
      FROM deposits d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN plans p ON d.plan_id = p.id
      ORDER BY d.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ getAllDeposits error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.approveDeposit = async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Get deposit details, user info, and referrer
    const [depositRows] = await connection.query(
      `SELECT d.user_id, d.amount, d.plan_id, u.referred_by, u.email, u.name
       FROM deposits d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.id = ? AND d.status = "pending"`,
      [id],
    );

    if (depositRows.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ message: "Deposit not found or already processed" });
    }
    const deposit = depositRows[0];

    // 2. Fetch plan details (ROI & Duration)
    const [planRows] = await connection.query(
      "SELECT roi_percent, duration_days FROM plans WHERE id = ?",
      [deposit.plan_id],
    );

    if (planRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Investment plan not found" });
    }
    const plan = planRows[0];

    // 3. Update deposit status to completed
    await connection.query(
      'UPDATE deposits SET status = "completed" WHERE id = ?',
      [id],
    );

    // 4. Increase User Balance
    await connection.query(
      "UPDATE users SET balance = balance + ? WHERE id = ?",
      [deposit.amount, deposit.user_id],
    );

    // 5. Log User's Deposit Transaction
    await connection.query(
      `INSERT INTO transactions (user_id, type, amount, balance_after, description)
       VALUES (?, 'deposit', ?, (SELECT balance FROM users WHERE id = ?), 'Deposit approved & Investment Started')`,
      [deposit.user_id, deposit.amount, deposit.user_id],
    );

    // 6. START THE INVESTMENT
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration_days);

    await connection.query(
      `INSERT INTO user_investments (user_id, plan_id, amount, daily_percent, end_date, status, last_profit_date) 
       VALUES (?, ?, ?, ?, ?, 'active', NOW())`,
      [
        deposit.user_id,
        deposit.plan_id,
        deposit.amount,
        plan.roi_percent,
        endDate,
      ],
    );

    // 7. REFERRAL COMMISSION LOGIC
    if (deposit.referred_by) {
      const commissionPercent = 10;
      const commissionAmount = (deposit.amount * commissionPercent) / 100;

      await connection.query(
        "UPDATE users SET balance = balance + ? WHERE id = ?",
        [commissionAmount, deposit.referred_by],
      );

      await connection.query(
        `INSERT INTO transactions (user_id, type, amount, balance_after, description)
         VALUES (?, 'referral_commission', ?, (SELECT balance FROM users WHERE id = ?), ?)`,
        [
          deposit.referred_by,
          commissionAmount,
          deposit.referred_by,
          `Commission from referral deposit (User ID: ${deposit.user_id})`,
        ],
      );

      await connection.query(
        `INSERT INTO referrals (referrer_id, referred_id, commission_earned, status) 
         VALUES (?, ?, ?, 'paid')`,
        [deposit.referred_by, deposit.user_id, commissionAmount],
      );

      console.log(
        `🎁 Referral commission of $${commissionAmount} paid to User ${deposit.referred_by}`,
      );
    }

    // 8. Commit everything
    await connection.commit();

    // 9. 📧 Send deposit approval email to the user
    try {
      await sendEmail({
        to: deposit.email,
        subject: "Deposit Approved ✅",
        html: `
          <h2>Deposit Approved</h2>
          <p><strong>Amount:</strong> $${deposit.amount.toFixed(2)}</p>
          <p><strong>Plan:</strong> ${plan.name || "N/A"}</p>
          <p><strong>ROI:</strong> ${plan.roi_percent}% daily</p>
          <p><strong>Investment Duration:</strong> ${plan.duration_days} days</p>
          <p>Your investment is now active. Daily profits will be credited to your account.</p>
          <p>Thank you for choosing ApexMarkets.</p>
        `,
      });
      console.log(`📧 Deposit approval email sent to ${deposit.email}`);
    } catch (emailErr) {
      console.error("❌ Deposit approval email failed:", emailErr);
    }

    res.json({
      message:
        "Deposit approved, investment active, and referral commission paid.",
      endDate: endDate,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Critical Error in approveDeposit:", err);
    res.status(500).json({ message: "Server error during approval" });
  } finally {
    connection.release();
  }
};

exports.rejectDeposit = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body; // optional reason from admin
  try {
    // 1. Get deposit details before updating
    const [depositRows] = await db.query(
      `SELECT d.user_id, d.amount, u.email, u.name 
       FROM deposits d 
       JOIN users u ON d.user_id = u.id 
       WHERE d.id = ? AND d.status = "pending"`,
      [id],
    );

    if (depositRows.length === 0) {
      return res
        .status(404)
        .json({ message: "Deposit not found or already processed" });
    }

    const deposit = depositRows[0];

    // 2. Update deposit status to rejected
    await db.query(
      'UPDATE deposits SET status = "rejected" WHERE id = ? AND status = "pending"',
      [id],
    );

    // 3. 📧 Send rejection email
    try {
      await sendEmail({
        to: deposit.email,
        subject: "Deposit Rejected ❌",
        html: `
          <h2>Deposit Rejected</h2>
          <p><strong>Amount:</strong> $${deposit.amount.toFixed(2)}</p>
          <p><strong>Status:</strong> Rejected</p>
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
          <p>If you have any questions, please contact our support team.</p>
        `,
      });
      console.log(`📧 Deposit rejection email sent to ${deposit.email}`);
    } catch (emailErr) {
      console.error("❌ Deposit rejection email failed:", emailErr);
    }

    res.json({ message: "Deposit rejected" });
  } catch (err) {
    console.error("Error in rejectDeposit:", err);
    res.status(500).json({ message: "Server error" });
  }
};
// === WITHDRAWALS ===
exports.getAllWithdrawals = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT w.*, u.name as user_name, u.email as user_email
      FROM withdrawals w
      JOIN users u ON w.user_id = u.id
      ORDER BY w.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.approveWithdrawal = async (req, res) => {
  const { id } = req.params;
  const connection = await db.getConnection();
  await connection.beginTransaction();
  try {
    const [withdrawal] = await connection.query(
      'SELECT user_id, amount FROM withdrawals WHERE id = ? AND status = "pending"',
      [id],
    );
    if (withdrawal.length === 0)
      throw new Error("Withdrawal not found or already processed");
    const { user_id, amount } = withdrawal[0];
    const [[user]] = await connection.query(
      "SELECT balance FROM users WHERE id = ?",
      [user_id],
    );
    if (user.balance < amount) throw new Error("Insufficient balance");
    await connection.query(
      "UPDATE users SET balance = balance - ? WHERE id = ?",
      [amount, user_id],
    );
    await connection.query(
      'UPDATE withdrawals SET status = "approved", processed_at = NOW() WHERE id = ?',
      [id],
    );
    await connection.query(
      'INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?, "withdrawal", ?, (SELECT balance FROM users WHERE id = ?), "Withdrawal approved")',
      [user_id, amount, user_id],
    );
    await connection.commit();
    res.json({ message: "Withdrawal approved" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ message: err.message || "Server error" });
  } finally {
    connection.release();
  }
};

exports.rejectWithdrawal = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  await db.query(
    'UPDATE withdrawals SET status = "rejected", rejection_reason = ? WHERE id = ?',
    [reason, id],
  );
  res.json({ message: "Withdrawal rejected" });
};

// === PLANS ===
exports.getAllPlans = async (req, res) => {
  // ✅ renamed from getPlans → getAllPlans
  try {
    const [rows] = await db.query(
      "SELECT * FROM plans ORDER BY min_amount ASC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.createPlan = async (req, res) => {
  const { name, min_amount, max_amount, roi_percent, duration_days } = req.body;
  try {
    await db.query(
      'INSERT INTO plans (name, min_amount, max_amount, roi_percent, duration_days, status) VALUES (?, ?, ?, ?, ?, "active")',
      [name, min_amount, max_amount || null, roi_percent, duration_days],
    );
    res.status(201).json({ message: "Plan created" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updatePlan = async (req, res) => {
  const { id } = req.params;
  const { name, min_amount, max_amount, roi_percent, duration_days, status } =
    req.body;
  try {
    await db.query(
      "UPDATE plans SET name = ?, min_amount = ?, max_amount = ?, roi_percent = ?, duration_days = ?, status = ? WHERE id = ?",
      [
        name,
        min_amount,
        max_amount || null,
        roi_percent,
        duration_days,
        status,
        id,
      ],
    );
    res.json({ message: "Plan updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.deletePlan = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM plans WHERE id = ?", [id]);
    res.json({ message: "Plan deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// === SETTINGS ===
exports.getSettings = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT key_name, value FROM settings");
    const settings = rows.reduce((acc, row) => {
      acc[row.key_name] = String(row.value);
      return acc;
    }, {});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateSettings = async (req, res) => {
  const updates = req.body;
  try {
    for (const [key, value] of Object.entries(updates)) {
      await db.query("UPDATE settings SET value = ? WHERE key_name = ?", [
        String(value),
        key,
      ]);
    }
    res.json({ message: "Settings updated" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// kept for any legacy usage
exports.getStats = exports.getDashboardStats;

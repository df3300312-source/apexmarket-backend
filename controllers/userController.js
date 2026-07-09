const db = require("../config/db");
const bcrypt = require("bcryptjs");

exports.getDashboardOverview = async (req, res) => {
  try {
    const userId = req.user.id;

    // Run multiple queries in parallel for speed
    const [[balanceRow], [earnedRow], [activeInvRow], [pendingWithRow]] =
      await Promise.all([
        db.query("SELECT balance FROM users WHERE id = ?", [userId]),
        db.query(
          'SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "profit"',
          [userId],
        ),
        db.query(
          "SELECT COUNT(*) as count FROM user_investments WHERE user_id = ? AND status = 'active'",
          [userId],
        ),
        db.query(
          'SELECT SUM(amount) as total FROM withdrawals WHERE user_id = ? AND status = "pending"',
          [userId],
        ),
      ]);

    res.json({
      balance: balanceRow[0]?.balance || 0,
      totalEarned: earnedRow[0]?.total || 0,
      activeInvestmentsCount: activeInvRow[0]?.count || 0,
      pendingWithdrawals: pendingWithRow[0]?.total || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error loading dashboard data" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, role, balance, phone, country, timezone, referral_code FROM users WHERE id = ?",
      [req.user.id],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Get user balance
exports.getBalance = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT balance FROM users WHERE id = ?", [
      req.user.id,
    ]);
    res.json({ balance: rows[0]?.balance || 0 });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ========== INVESTMENTS ==========
exports.getActiveInvestments = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ui.id, p.name as planName, ui.amount, ui.daily_percent, 
              DATE_FORMAT(ui.start_date, '%Y-%m-%d') as startDate,
              DATE_FORMAT(ui.end_date, '%Y-%m-%d') as endDate,
              DATEDIFF(ui.end_date, CURDATE()) as daysRemaining,
              DATE_FORMAT(DATE_ADD(ui.last_profit_date, INTERVAL 1 DAY), '%Y-%m-%d %H:%i') as nextPayout
       FROM user_investments ui
       JOIN plans p ON ui.plan_id = p.id
       WHERE ui.user_id = ? AND ui.status = 'active'`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getTotalEarned = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND type = "profit"',
      [req.user.id],
    );
    res.json({ total: rows[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPendingWithdrawals = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT SUM(amount) as total FROM withdrawals WHERE user_id = ? AND status = "pending"',
      [req.user.id],
    );
    res.json({ total: rows[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ========== REFERRALS ==========
// --- Updated getReferrals in userController.js ---
exports.getReferrals = async (req, res) => {
  try {
    const userId = req.user.id;
    const referralCode = req.user.referral_code;

    // 1. Generate Link
    const referralLink = `${process.env.FRONTEND_URL}/register?ref=${referralCode}`;

    // 2. Fetch referred users (Added 'as joinDate' to fix the mismatch)
    const [referred] = await db.query(
      `SELECT name, email, DATE_FORMAT(created_at, '%Y-%m-%d') as joinDate 
       FROM users 
       WHERE referred_by = ?`,
      [userId],
    );

    // 3. Fetch total commission from the transactions ledger
    const [commission] = await db.query(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND type = 'referral_commission'`,
      [userId],
    );

    // 4. Send response (Ensuring the key is 'referredUsers')
    res.json({
      referralCode: referralCode,
      referralLink: referralLink,
      referredUsers: referred, // This must match the frontend
      totalCommission: commission[0].total || 0,
    });
  } catch (err) {
    console.error("Referral Fetch Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ========== TRANSACTIONS (With Filters) ==========
exports.getTransactions = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const type = req.query.type; // Optional filter by type (deposit, profit, etc)

  try {
    let query =
      "SELECT id, type, amount, balance_after, created_at as date, description FROM transactions WHERE user_id = ?";
    let params = [req.user.id];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) as total FROM transactions WHERE user_id = ?",
      [req.user.id],
    );

    res.json({
      transactions: rows,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
// ========== PROFILE & SECURITY ==========
exports.updateProfile = async (req, res) => {
  const { name, email, phone, country, timezone } = req.body;
  try {
    // 1. Perform the update
    await db.query(
      `UPDATE users SET name = ?, email = ?, phone = ?, country = ?, timezone = ? WHERE id = ?`,
      [name, email, phone, country, timezone, req.user.id],
    );

    // 2. CRITICAL: Fetch the FRESH data including the new fields to send back
    const [updated] = await db.query(
      "SELECT id, name, email, role, balance, phone, country, timezone, referral_code FROM users WHERE id = ?",
      [req.user.id],
    );

    res.json({
      message: "Profile updated successfully",
      user: updated[0],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res
      .status(400)
      .json({ message: "New password must be at least 6 characters" });
  }

  try {
    const [rows] = await db.query("SELECT password FROM users WHERE id = ?", [
      req.user.id,
    ]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password);

    if (!valid)
      return res.status(401).json({ message: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, 12); // Higher salt rounds
    await db.query("UPDATE users SET password = ? WHERE id = ?", [
      hashed,
      req.user.id,
    ]);

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// ========== NOTIFICATIONS ==========
exports.getNotifications = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT email_deposit, email_withdrawal, email_profit, email_security, push_deposit, push_withdrawal FROM user_settings WHERE user_id = ?",
      [req.user.id],
    );
    if (rows.length === 0) {
      return res.json({
        emailDeposit: true,
        emailWithdrawal: true,
        emailProfit: true,
        emailSecurity: true,
        pushDeposit: false,
        pushWithdrawal: false,
      });
    }
    const prefs = rows[0];
    res.json({
      emailDeposit: !!prefs.email_deposit,
      emailWithdrawal: !!prefs.email_withdrawal,
      emailProfit: !!prefs.email_profit,
      emailSecurity: !!prefs.email_security,
      pushDeposit: !!prefs.push_deposit,
      pushWithdrawal: !!prefs.push_withdrawal,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateNotifications = async (req, res) => {
  const {
    emailDeposit,
    emailWithdrawal,
    emailProfit,
    emailSecurity,
    pushDeposit,
    pushWithdrawal,
  } = req.body;
  try {
    await db.query(
      `INSERT INTO user_settings (user_id, email_deposit, email_withdrawal, email_profit, email_security, push_deposit, push_withdrawal)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email_deposit = VALUES(email_deposit),
         email_withdrawal = VALUES(email_withdrawal),
         email_profit = VALUES(email_profit),
         email_security = VALUES(email_security),
         push_deposit = VALUES(push_deposit),
         push_withdrawal = VALUES(push_withdrawal)`,
      [
        req.user.id,
        emailDeposit,
        emailWithdrawal,
        emailProfit,
        emailSecurity,
        pushDeposit,
        pushWithdrawal,
      ],
    );
    res.json({ message: "Notification preferences saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ========== TWO-FACTOR AUTH (mock – replace with real TOTP later) ==========
exports.get2FAStatus = async (req, res) => {
  const [rows] = await db.query(
    "SELECT two_factor_enabled FROM users WHERE id = ?",
    [req.user.id],
  );
  res.json({ enabled: rows[0]?.two_factor_enabled === 1 });
};

exports.enable2FA = async (req, res) => {
  const { code } = req.body;
  // In a real implementation, verify TOTP code here
  if (!code || code.length !== 6)
    return res.status(400).json({ message: "Invalid code" });
  await db.query("UPDATE users SET two_factor_enabled = 1 WHERE id = ?", [
    req.user.id,
  ]);
  res.json({ message: "2FA enabled" });
};

exports.disable2FA = async (req, res) => {
  await db.query("UPDATE users SET two_factor_enabled = 0 WHERE id = ?", [
    req.user.id,
  ]);
  res.json({ message: "2FA disabled" });
};
// ========== AUTH / LOGOUT ==========
exports.logout = (req, res) => {
  // Clear the cookie by setting its expiry to a past date
  res.cookie("token", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000), // expires in 10 seconds
    httpOnly: true,
  });
  res.status(200).json({ status: "success", message: "User logged out" });
};

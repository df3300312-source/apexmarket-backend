const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { generateReferralCode, isValidEmail } = require("../utils/helpers");

// Helper: Sign JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "24h",
  });
};

// Helper: Send token in HTTP‑only cookie and JSON response
const sendToken = (user, statusCode, res) => {
  const token = signToken(user.id);

  const cookieOptions = {
    expires: new Date(
      Date.now() +
        (process.env.JWT_COOKIE_EXPIRES_IN || 1) * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
  };

  res.cookie("token", token, cookieOptions);
  delete user.password;

  res.status(statusCode).json({
    token,
    user,
  });
};

// Register a new user
exports.register = async (req, res) => {
  const { name, email, password, referral } = req.body;

  // 1. Validation
  if (!isValidEmail(email)) {
    return res
      .status(400)
      .json({ message: "Please provide a valid email address." });
  }
  if (!name || !password || password.length < 6) {
    return res.status(400).json({
      message: "Please provide all details. Password must be at least 6 chars.",
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 2. Check if user exists
    const [existing] = await connection.query(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ message: "Email already registered" });
    }

    // 3. Hash password & Generate professional Referral Code
    const hashedPassword = await bcrypt.hash(password, 12);
    const myReferralCode = generateReferralCode(); // Using your helper!

    // 4. Insert user
    const [result] = await connection.query(
      "INSERT INTO users (name, email, password, referral_code) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, myReferralCode],
    );
    const userId = result.insertId;

    // 5. Initialize User Settings (Notifications)
    await connection.query("INSERT INTO user_settings (user_id) VALUES (?)", [
      userId,
    ]);

    // 6. Handle Referral logic (If this new user was invited by someone)
    if (referral) {
      const [refUser] = await connection.query(
        "SELECT id FROM users WHERE referral_code = ?",
        [referral],
      );

      if (refUser.length > 0) {
        const referrerId = refUser[0].id;
        await connection.query(
          "UPDATE users SET referred_by = ? WHERE id = ?",
          [referrerId, userId],
        );

        // Track the referral in the tracking table
        await connection.query(
          "INSERT INTO referrals (referrer_id, referred_id, status) VALUES (?, ?, 'pending')",
          [referrerId, userId],
        );
      }
    }

    // 7. Fetch the final user object
    const [userRows] = await connection.query(
      "SELECT id, name, email, role, balance, referral_code FROM users WHERE id = ?",
      [userId],
    );

    await connection.commit();
    sendToken(userRows[0], 201, res);
  } catch (err) {
    await connection.rollback();
    console.error("Registration Error:", err);
    res.status(500).json({ message: "Server error during registration" });
  } finally {
    connection.release();
  }
};

// Login user
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await db.query(
      "SELECT id, name, email, password, role, balance, referral_code FROM users WHERE email = ?",
      [email],
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    sendToken(user, 200, res);
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// Logout user
exports.logout = (req, res) => {
  res.cookie("token", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res
    .status(200)
    .json({ status: "success", message: "Successfully logged out" });
};

// Get profile (protected)
exports.getProfile = async (req, res) => {
  res.json(req.user);
};

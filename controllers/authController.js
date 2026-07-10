const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { generateReferralCode, isValidEmail } = require("../utils/helpers");
const { sendEmail } = require("../services/emailService");

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
  try {
    // Check if user exists
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0)
      return res.status(400).json({ message: "Email already registered" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate referral code and verification token
    const referralCode = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Insert user (is_verified defaults to false)
    const [result] = await db.query(
      `INSERT INTO users (name, email, password, referral_code, verification_token)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, referralCode, verificationToken],
    );
    const userId = result.insertId;

    // Handle referral if provided
    if (referral) {
      const [refUser] = await db.query(
        "SELECT id FROM users WHERE referral_code = ?",
        [referral],
      );
      if (refUser.length > 0) {
        await db.query("UPDATE users SET referred_by = ? WHERE id = ?", [
          refUser[0].id,
          userId,
        ]);
      }
    }

    // 📧 Send verification email
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: email,
      subject: "Verify Your ApexMarkets Account",
      html: `
        <h2>Welcome to ApexMarkets!</h2>
        <p>Hi ${name},</p>
        <p>Please click the link below to verify your email address and activate your account:</p>
        <a href="${verificationLink}" style="display:inline-block;padding:12px 24px;background:#8a2be2;color:#fff;text-decoration:none;border-radius:4px;">Verify Email</a>
        <p>If you didn't create this account, you can safely ignore this email.</p>
        <p>This link will expire in 24 hours.</p>
      `,
    });

    res.status(201).json({
      message:
        "Registration successful. A verification email has been sent to your address. Please verify before logging in.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Login user
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await db.query(
      "SELECT id, name, email, password, role, balance, is_verified FROM users WHERE email = ?",
      [email],
    );
    if (!user.is_verified) {
      return res.status(403).json({
        message:
          "Please verify your email first. A verification link was sent to your email.",
      });
    }
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

exports.verifyEmail = async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/login?error=missing_token`,
    );
  }

  try {
    const [rows] = await db.query(
      "SELECT id FROM users WHERE verification_token = ? AND is_verified = FALSE",
      [token],
    );
    if (rows.length === 0) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=invalid_or_expired_token`,
      );
    }
    const userId = rows[0].id;
    await db.query(
      "UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = ?",
      [userId],
    );
    res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
  } catch (err) {
    console.error(err);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
  }
};

const jwt = require("jsonwebtoken");
const db = require("../config/db");

/**
 * Protect Middleware
 * The primary security layer for all user routes.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Get token from Headers OR Cookies
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // 2. Check if token exists
  if (!token) {
    return res.status(401).json({
      message:
        "Authentication required. Please log in to access this resource.",
    });
  }

  try {
    // 3. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Fetch user and include referral_code (Added referral_code here)
    const [rows] = await db.query(
      "SELECT id, name, email, role, balance, referral_code FROM users WHERE id = ?",
      [decoded.id],
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "This account no longer exists.",
      });
    }

    // 5. Grant access: Store user info in req.user
    // Now req.user.referral_code is available in every controller!
    req.user = rows[0];
    next();
  } catch (err) {
    console.error("🔒 Auth Middleware Error:", err.message);
    return res.status(401).json({
      message: "Your session has expired. Please login again.",
    });
  }
};

/**
 * Admin Middleware
 * Simplified check for admin-only routes
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Admin access required." });
  }
};

/**
 * Flexible Role-based access
 * Example: restrictTo('admin', 'manager')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};

module.exports = {
  auth: protect, // Alias for backward compatibility
  protect,
  admin,
  restrictTo,
};

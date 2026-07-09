/**
 * Admin Middleware
 * This should ALWAYS be placed AFTER the 'protect' middleware in your routes.
 */
const admin = (req, res, next) => {
  // 1. Check if user was attached to the request by the protect middleware
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required. Please log in first.",
    });
  }

  // 2. Check the user role
  if (req.user.role === "admin") {
    // User is authorized, proceed to the controller
    next();
  } else {
    // User is logged in but is NOT an admin
    console.warn(
      `🛑 Security Alert: User ${req.user.email} tried to access an admin route.`,
    );
    res.status(403).json({
      message:
        "Access denied. Admin privileges are required to access this resource.",
    });
  }
};

module.exports = admin;

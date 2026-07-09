const crypto = require("crypto");

/**
 * formatCurrency
 * Formats a number into a clean USD string (e.g., 5000 -> $5,000.00)
 */
exports.formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

/**
 * generateReferralCode
 * Creates a unique, high-entropy referral code for new users
 */
exports.generateReferralCode = () => {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g., 4F2A1B9C
};

/**
 * generateTransactionId
 * Generates a unique reference ID for deposits and withdrawals
 */
exports.generateTransactionId = (prefix = "TXN") => {
  const timestamp = Date.now().toString(36);
  const randomStr = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}-${randomStr}`; // e.g., DEP-l9x1z2-A1B2
};

/**
 * calculateInvestmentROI
 * Calculates the final profit and end date for an investment
 */
exports.calculateInvestmentROI = (amount, dailyPercent, durationDays) => {
  const dailyProfit = parseFloat(amount) * (parseFloat(dailyPercent) / 100);
  const totalProfit = dailyProfit * durationDays;
  const totalReturn = parseFloat(amount) + totalProfit;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);

  return {
    dailyProfit: dailyProfit.toFixed(2),
    totalProfit: totalProfit.toFixed(2),
    totalReturn: totalReturn.toFixed(2),
    endDate,
  };
};

/**
 * paginate
 * Standardizes pagination logic for database queries
 */
exports.getPagination = (page, limit) => {
  const p = parseInt(page) || 1;
  const l = parseInt(limit) || 10;
  const offset = (p - 1) * l;

  return { limit: l, offset, page: p };
};

/**
 * validateEmail
 * Simple regex for server-side email validation
 */
exports.isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const db = require("../config/db");

// @desc    Get all active investment plans
// @route   GET /api/plans
// @access  Public
exports.getPlans = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        id, 
        name, 
        min_amount, 
        max_amount, 
        roi_percent, 
        duration_days,
        (roi_percent * duration_days) as total_roi_percent 
       FROM plans 
       WHERE status = "active" 
       ORDER BY min_amount ASC`,
    );

    // Add a "popularity" or "hot" tag logic if needed
    const plansWithMeta = rows.map((plan) => ({
      ...plan,
      isPopular: plan.name === "Silver" || plan.name === "Gold", // Example logic
      formattedMin: `$${parseFloat(plan.min_amount).toLocaleString()}`,
      formattedMax: plan.max_amount
        ? `$${parseFloat(plan.max_amount).toLocaleString()}`
        : "Unlimited",
    }));

    res.status(200).json({
      status: "success",
      results: rows.length,
      data: plansWithMeta,
    });
  } catch (err) {
    console.error("Fetch Plans Error:", err);
    res
      .status(500)
      .json({ message: "Server error while fetching investment plans" });
  }
};

// @desc    Get a single plan by ID
// @route   GET /api/plans/:id
// @access  Public
exports.getPlanById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT *, (roi_percent * duration_days) as total_roi_percent 
       FROM plans 
       WHERE id = ? AND status = "active"`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Investment plan not found" });
    }

    res.status(200).json({
      status: "success",
      data: rows[0],
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

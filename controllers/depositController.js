const db = require("../config/db");
const axios = require("axios");
const { generateTransactionId } = require("../utils/helpers");

// @desc    Initiate a new deposit
exports.createDeposit = async (req, res) => {
  const { planId, amount } = req.body;
  const userId = req.user.id;

  try {
    // 1. Create a "Pending" record in your DB first
    const [result] = await db.query(
      "INSERT INTO deposits (user_id, plan_id, amount, status) VALUES (?, ?, ?, 'pending')",
      [userId, planId, amount],
    );
    const depositId = result.insertId;

    // 2. Call the Payment Gateway (Example: NowPayments)
    // You will need an API KEY from NowPayments.io
    const response = await axios.post(
      "https://api.nowpayments.io/v1/invoice",
      {
        price_amount: amount,
        price_currency: "usd",
        order_id: depositId, // We send our internal ID so we can find it later
        order_description: `Investment Plan Deposit`,
        ipn_callback_url: `${process.env.BACKEND_URL}/api/webhooks/nowpayments`, // Your Webhook
        success_url: `${process.env.FRONTEND_URL}/dashboard`,
        cancel_url: `${process.env.FRONTEND_URL}/deposit`,
      },
      {
        headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY },
      },
    );

    // 3. Send the Gateway URL to the frontend
    res.json({
      status: "success",
      checkoutUrl: response.data.invoice_url,
      depositId: depositId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gateway connection error" });
  }
};

// @desc    Get user deposit history
exports.getUserDeposits = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
          d.id, 
          d.txid, -- Show the reference ID in the history
          d.amount, 
          d.status, 
          d.transaction_hash,
          DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i') as date, 
          p.name as planName
       FROM deposits d 
       JOIN plans p ON d.plan_id = p.id 
       WHERE d.user_id = ? 
       ORDER BY d.created_at DESC`,
      [req.user.id],
    );

    res.json({
      status: "success",
      deposits: rows,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
// @desc    Update a pending deposit with a transaction hash
// @route   PATCH /api/deposits/:id/hash
// @access  Private
exports.updateDepositHash = async (req, res) => {
  const { transaction_hash } = req.body;
  const depositId = req.params.id;

  try {
    if (!transaction_hash) {
      return res.status(400).json({ message: "Transaction hash is required" });
    }

    const [result] = await db.query(
      "UPDATE deposits SET transaction_hash = ? WHERE id = ? AND user_id = ? AND status = 'pending'",
      [transaction_hash, depositId, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Pending deposit not found" });
    }

    res.json({
      message: "Transaction hash updated. Admin will verify shortly.",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

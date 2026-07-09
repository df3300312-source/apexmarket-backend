const db = require("../config/db");
const crypto = require("crypto");

exports.handleNowPaymentsWebhook = async (req, res) => {
  const hmac = req.headers["x-nowpayments-sig"];
  const notificationsPayload = req.body;

  // 1. Verify the signature (Security: prevents people from faking payments)
  // Check gateway documentation for exact signature verification logic

  try {
    const { payment_status, order_id, purchase_id } = req.body;

    // Status 'finished' means the money is confirmed and forwarded to your wallet
    if (payment_status === "finished") {
      // A. Find the deposit in our DB
      const [deposits] = await db.query("SELECT * FROM deposits WHERE id = ?", [
        order_id,
      ]);
      const deposit = deposits[0];

      if (deposit && deposit.status === "pending") {
        const conn = await db.getConnection();
        await conn.beginTransaction();

        try {
          // B. Update Deposit
          await conn.query(
            "UPDATE deposits SET status = 'completed' WHERE id = ?",
            [order_id],
          );

          // C. Update User Balance
          await conn.query(
            "UPDATE users SET balance = balance + ? WHERE id = ?",
            [deposit.amount, deposit.user_id],
          );

          // D. Log Transaction
          await conn.query(
            "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'deposit', ?, ?)",
            [
              deposit.user_id,
              deposit.amount,
              `Automated Deposit via Gateway (${purchase_id})`,
            ],
          );

          await conn.commit();
          console.log(`✅ Automated payout completed for Order ${order_id}`);
        } catch (error) {
          await conn.rollback();
          throw error;
        } finally {
          conn.release();
        }
      }
    }

    res.status(200).send("Webhook Received");
  } catch (err) {
    console.error("Webhook Error:", err);
    res.status(500).send("Internal Error");
  }
};

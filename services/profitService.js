const cron = require("node-cron");
const db = require("../config/db");
const { sendEmail } = require("./emailService"); // 👈 import email service

/**
 * processDailyProfits
 * The "Engine" that runs every 24 hours to pay out ROI
 */
const processDailyProfits = async () => {
  console.log("-----------------------------------------");
  console.log(`🕒 [${new Date().toISOString()}] Starting Profit Engine...`);

  let processedCount = 0;
  let totalPayout = 0;

  try {
    // 1. Find all active investments that haven't been paid today, JOIN users to get email
    const [activeInvestments] = await db.query(
      `SELECT ui.*, u.email, u.name 
       FROM user_investments ui 
       JOIN users u ON ui.user_id = u.id
       WHERE ui.status = 'active' 
         AND (ui.last_profit_date < CURDATE() OR ui.last_profit_date IS NULL)`,
    );

    if (activeInvestments.length === 0) {
      console.log("✅ No pending profits to process today.");
      return;
    }

    console.log(`📊 Found ${activeInvestments.length} investments to process.`);

    for (const inv of activeInvestments) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // 2. Calculate daily profit
        const amount = parseFloat(inv.amount);
        const roi = parseFloat(inv.daily_percent);
        const dailyProfit = (amount * (roi / 100)).toFixed(2); // Keep 2 decimal places

        // 3. Update User Balance
        await connection.query(
          "UPDATE users SET balance = balance + ? WHERE id = ?",
          [dailyProfit, inv.user_id],
        );

        // 4. Get new balance for the ledger
        const [[user]] = await connection.query(
          "SELECT balance FROM users WHERE id = ?",
          [inv.user_id],
        );

        // 5. Record the Profit Transaction record
        await connection.query(
          `INSERT INTO transactions (user_id, type, amount, balance_after, description)
           VALUES (?, 'profit', ?, ?, CONCAT('Daily ROI payout for Investment ID: ', ?))`,
          [inv.user_id, dailyProfit, user.balance, inv.id],
        );

        // 6. Update last_profit_date to today
        await connection.query(
          "UPDATE user_investments SET last_profit_date = CURDATE() WHERE id = ?",
          [inv.id],
        );

        // 7. MATURITY CHECK: Close investment if it reaches the end date
        const today = new Date();
        const endDate = new Date(inv.end_date);

        if (today >= endDate) {
          await connection.query(
            "UPDATE user_investments SET status = 'completed' WHERE id = ?",
            [inv.id],
          );
          console.log(
            `🏁 Investment ID ${inv.id} has matured and is now completed.`,
          );
        }

        await connection.commit();
        processedCount++;
        totalPayout += parseFloat(dailyProfit);

        // 8. 📧 Send daily profit email notification to the user
        try {
          await sendEmail({
            to: inv.email,
            subject: "Daily Profit Credited 🎉",
            html: `
              <h2>Your daily profit has been credited!</h2>
              <p><strong>Amount:</strong> $${parseFloat(dailyProfit).toFixed(2)}</p>
              <p><strong>New Balance:</strong> $${user.balance.toFixed(2)}</p>
              <p>Thank you for investing with ApexMarkets. Your returns are growing daily.</p>
            `,
          });
          console.log(`📧 Daily profit email sent to ${inv.email}`);
        } catch (emailErr) {
          // Log error but don't stop the profit processing
          console.error(
            `❌ Failed to send profit email to ${inv.email}:`,
            emailErr.message,
          );
        }
      } catch (err) {
        await connection.rollback();
        console.error(
          `❌ Error processing Investment ID ${inv.id}:`,
          err.message,
        );
      } finally {
        connection.release();
      }
    }

    console.log(
      `💰 Payout Summary: Successfully paid ${processedCount} users.`,
    );
    console.log(`💵 Total Amount Distributed: $${totalPayout.toFixed(2)}`);
    console.log("-----------------------------------------");
  } catch (err) {
    console.error("🚨 CRITICAL ERROR in Profit Engine:", err.message);
  }
};

cron.schedule("0 0 * * *", () => {
  processDailyProfits();
});

module.exports = processDailyProfits;

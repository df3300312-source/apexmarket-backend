const axios = require("axios");
require("dotenv").config();
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "ApexMarkets",
          email: process.env.EMAIL_FROM || "no-reply@apexmarkets.com",
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text || "",
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      },
    );

    console.log(`✅ Email sent to ${to}: ${response.data.messageId}`);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Email sending failed:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

module.exports = { sendEmail };

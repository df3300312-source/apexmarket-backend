const axios = require("axios");
require("dotenv").config();

// Validate email format
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Send a transactional email via Brevo.
 *
 * @param {Object} params
 * @param {string} params.to      - Recipient email address
 * @param {string} params.subject - Email subject line
 * @param {string} params.html    - HTML content (required)
 * @param {string} [params.text]  - Plain text fallback (optional)
 * @returns {Promise<Object>} Brevo API response
 */
const sendEmail = async ({ to, subject, html, text }) => {
  // ─── 1. Validate required inputs ──────────────────────────────
  if (!to || !isValidEmail(to)) {
    throw new Error(`Invalid recipient email: "${to}"`);
  }
  if (!subject) throw new Error("Email subject is required");
  if (!html) throw new Error("Email HTML content is required");

  // ─── 2. Check environment configuration ───────────────────────
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn(
      "⚠️ BREVO_API_KEY is not set. Email will not be sent (development fallback).",
    );
    console.log(`📧 [FALLBACK] Would send to "${to}": "${subject}"`);
    return { fallback: true };
  }

  // ─── 3. Build the payload ─────────────────────────────────────
  const payload = {
    sender: {
      name: process.env.SENDER_NAME || "ApexMarkets",
      email: process.env.SENDER_EMAIL || "df3300312@gmail.com",
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };
  if (text) payload.textContent = text; // only include if provided

  // ─── 4. Send request ──────────────────────────────────────────
  try {
    const response = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      payload,
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
      },
    );

    console.log(`✅ Email sent to ${to} (ID: ${response.data.messageId})`);
    return response.data;
  } catch (error) {
    const errorDetail = error.response?.data || error.message;
    console.error(
      `❌ Failed to send email to ${to}:`,
      JSON.stringify(errorDetail, null, 2),
    );
    throw new Error(
      `Email delivery failed: ${errorDetail.message || errorDetail}`,
    );
  }
};

module.exports = { sendEmail };

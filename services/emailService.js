const SibApiV3Sdk = require("@getbrevo/brevo");
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// Set API key
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY,
);

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: "ApexMarkets",
      email: process.env.EMAIL_FROM || "no-reply@apexmarkets.com",
    };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.textContent = text || "";

    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Email sent to ${to}: ${response.messageId}`);
    return response;
  } catch (error) {
    console.error("❌ Email sending failed:", error);
    throw error;
  }
};

module.exports = { sendEmail };

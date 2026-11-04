const nodemailer = require("nodemailer");

const sendEmail = async (message) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_FROM_EMAIL) {
    const error = new Error("SMTP email delivery is not configured");
    error.code = "EMAIL_DELIVERY_NOT_CONFIGURED";
    throw error;
  }
  const port = Number(SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter.sendMail({ from: SMTP_FROM_EMAIL, ...message });
};

module.exports = { sendEmail };
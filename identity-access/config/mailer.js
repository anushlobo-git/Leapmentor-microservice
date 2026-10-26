const nodemailer = require("nodemailer");

const env = require("./env");

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: env.smtp.port === 465,
  auth:
    env.smtp.user && env.smtp.pass
      ? { user: env.smtp.user, pass: env.smtp.pass }
      : undefined,
});

const sendEmail = async (message) => {
  if (!env.smtp.user || !env.smtp.pass || !env.smtp.fromEmail) {
    const error = new Error("SMTP email delivery is not configured");
    error.code = "EMAIL_DELIVERY_NOT_CONFIGURED";
    throw error;
  }

  return transporter.sendMail({
    from: env.smtp.fromEmail,
    ...message,
  });
};

module.exports = {
  sendEmail,
};

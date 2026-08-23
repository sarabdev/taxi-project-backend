const nodemailer = require("nodemailer");

let transporter;

// Create transporter only once
function getTransporter() {
  if (transporter) return transporter;

  const port = Number(process.env.EMAIL_PORT || 587);

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: process.env.EMAIL_SECURE === "true" || port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
}

// ---------------------------------
// Send Email
// ---------------------------------
exports.sendMail = async ({ to, subject, text, html }) => {
  try {
    if (!to) {
      console.warn("emailService: No recipient provided");
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || "Taxi Booking <no-reply@taxi.com>",
      to,
      subject,
      text,
      html,
    };

    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);

    console.log(`📧 Email sent to ${to}`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error("emailService.sendMail error:", err);
    return { ok: false, message: err.message };
  }
};

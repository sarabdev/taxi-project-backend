const nodemailer = require("nodemailer");

let transporter;

// Create transporter only once
function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: false, // true for 465, false for other ports
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
    await transporter.sendMail(mailOptions);

    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error("emailService.sendMail error:", err);
  }
};

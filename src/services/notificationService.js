const whatsappService = require("./whatsappService");
const emailService = require("./emailService"); // we will create next

exports.notifyDriverAssigned = async (booking, driver) => {
  try {
    if (!booking || !driver) {
      console.warn("notifyDriverAssigned: Missing booking or driver");
      return;
    }

    // -----------------------------
    // WHATSAPP BOOKING
    // -----------------------------
    if (booking.source === "whatsapp") {
      const userPhone = booking.user?.phone;

      if (!userPhone) {
        console.warn("WhatsApp booking but user phone not found");
        return;
      }

      const message =
        `🚕 *Your driver has been assigned!*\n\n` +
        `👤 *Driver Name:* ${driver.name}\n` +
        `🚗 *Car:* ${driver.carModel || "N/A"} (${driver.carNumber || "N/A"})\n` +
        `📞 *Driver Phone:* ${driver.phone}\n\n` +
        `Your driver will contact you shortly.\n` +
        `Thank you for choosing our taxi service!`;

      await whatsappService.sendText(userPhone, message);
      return;
    }

    // -----------------------------
    // WEB BOOKING → EMAIL
    // -----------------------------
    if (booking.source === "web") {
      const userEmail = booking.user?.email;

      if (!userEmail) {
        console.warn("Web booking but user email not found");
        return;
      }

      const subject = "Your Taxi Driver Has Been Assigned";

      const body =
        `Hello ${booking.user.name || "Customer"},\n\n` +
        `Your taxi booking has been assigned a driver.\n\n` +
        `Driver Details:\n` +
        `Name: ${driver.name}\n` +
        `Phone: ${driver.phone}\n` +
        `Car: ${driver.carModel || "N/A"} (${driver.carNumber || "N/A"})\n\n` +
        `Pickup Location: ${booking.fromAddress}\n` +
        `Drop-off Location: ${booking.toAddress}\n\n` +
        `Thank you for using our service.\n` +
        `Best regards,\nTaxi Booking Team`;

      await emailService.sendMail({
        to: userEmail,
        subject,
        text: body,
      });

      return;
    }

    console.warn("Unknown booking source:", booking.source);
  } catch (err) {
    console.error("notifyDriverAssigned error:", err);
  }
};

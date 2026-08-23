const whatsappService = require("./whatsappService");
const emailService = require("./emailService");

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatMoney = (booking) => {
  const symbol = !booking.currency || booking.currency === "GBP" ? "£" : `${booking.currency} `;
  return `${symbol}${Number(booking.amount || 0).toFixed(2)}`;
};

const bookingReference = (booking) => String(booking._id).slice(-8).toUpperCase();

const formatJourneyDate = (date, time) => {
  if (!date || !time) return "—";
  const parsed = new Date(`${date}T00:00:00Z`);
  const friendlyDate = Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  return `${friendlyDate} at ${time}`;
};

const detailsRows = (booking, includeCustomer = false) => {
  const rows = [];
  if (includeCustomer) {
    rows.push(["Customer", booking.customerName], ["Email", booking.customerEmail], ["Phone", booking.customerPhone]);
  }
  rows.push(
    ["Pickup", booking.fromAddress],
    ["Drop-off", booking.toAddress],
    ["Pickup time", formatJourneyDate(booking.bookingDate, booking.bookingTime)],
  );
  if (booking.returnDate && booking.returnTime) rows.push(["Return time", formatJourneyDate(booking.returnDate, booking.returnTime)]);
  rows.push(
    ["Passengers", booking.numberOfPersons],
    ["Suitcases", booking.luggage],
    ["Vehicle", booking.carType ? booking.carType.charAt(0).toUpperCase() + booking.carType.slice(1) : "—"],
    ["Total paid", formatMoney(booking)],
    ["Payment", booking.paymentStatus],
  );
  return rows;
};

const rowsHtml = (rows) => rows.map(([label, value]) => `
  <tr>
    <td style="padding:10px 0;color:#64748b;border-bottom:1px solid #e2e8f0;width:35%;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:10px 0;color:#0f172a;font-weight:600;border-bottom:1px solid #e2e8f0;vertical-align:top">${escapeHtml(value || "—")}</td>
  </tr>`).join("");

const emailShell = ({ preheader, title, greeting, intro, reference, rows, footer }) => `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>
  <div style="padding:32px 12px">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,.08)">
      <div style="background:#2563eb;padding:28px 32px;color:#ffffff">
        <div style="font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85">AirportRide</div>
        <h1 style="font-size:28px;line-height:1.2;margin:10px 0 0">${escapeHtml(title)}</h1>
      </div>
      <div style="padding:30px 32px">
        <p style="font-size:18px;margin:0 0 12px;font-weight:700">${escapeHtml(greeting)}</p>
        <p style="font-size:15px;line-height:1.7;color:#475569;margin:0 0 24px">${escapeHtml(intro)}</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:22px">
          <span style="color:#64748b;font-size:13px">Booking reference</span><br>
          <strong style="font-size:20px;color:#1d4ed8">${escapeHtml(reference)}</strong>
        </div>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px">${rowsHtml(rows)}</table>
        <p style="font-size:14px;line-height:1.7;color:#475569;margin:24px 0 0">${escapeHtml(footer)}</p>
      </div>
      <div style="padding:18px 32px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center">AirportRide · Reliable airport transfers</div>
    </div>
  </div>
</body></html>`;

const detailsText = (booking, includeCustomer = false) => detailsRows(booking, includeCustomer)
  .map(([label, value]) => `${label}: ${value || "—"}`)
  .join("\n");

exports.sendBookingConfirmation = async (booking) => {
  if (!booking?.customerEmail) {
    console.warn("sendBookingConfirmation: Customer email is missing");
    return;
  }

  const reference = bookingReference(booking);
  const adminEmail = process.env.ADMIN_BOOKING_EMAIL || process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

  const customerEmail = emailService.sendMail({
    to: booking.customerEmail,
    subject: `Booking confirmed – ${reference}`,
    text: `Hello ${booking.customerName},\n\nYour AirportRide booking is confirmed and payment has been received.\n\nBooking reference: ${reference}\n\n${detailsText(booking, true)}\n\nPlease keep this email for your journey. Your driver details will be shared when assigned.\n\nAirportRide Team`,
    html: emailShell({
      preheader: `Your AirportRide booking ${reference} is confirmed.`,
      title: "Your ride is confirmed",
      greeting: `Hello ${booking.customerName},`,
      intro: "Thanks for booking with us. We’ve received your payment and your journey is now confirmed.",
      reference,
      rows: detailsRows(booking, true),
      footer: "Please keep this email for your journey. We’ll contact you using the details provided and share driver information when assigned.",
    }),
  });

  const adminEmailTask = adminEmail ? emailService.sendMail({
    to: adminEmail,
    subject: `New paid booking – ${reference} – ${booking.customerName}`,
    text: `A new website booking has been confirmed.\n\nBooking reference: ${reference}\n\n${detailsText(booking, true)}\n\nStatus: ${booking.status}`,
    html: emailShell({
      preheader: `New paid booking from ${booking.customerName}.`,
      title: "New paid booking",
      greeting: "Hello Admin,",
      intro: "A customer has completed payment and the booking is ready for review and driver assignment.",
      reference,
      rows: [...detailsRows(booking, true), ["Booking status", booking.status]],
      footer: "Open the admin bookings page to review this journey and assign a driver.",
    }),
  }) : Promise.resolve({ ok: false, message: "Admin email is not configured" });

  const results = await Promise.all([customerEmail, adminEmailTask]);
  if (!adminEmail) console.warn("sendBookingConfirmation: Set ADMIN_BOOKING_EMAIL or ADMIN_EMAIL for admin alerts");
  return { customer: results[0], admin: results[1] };
};

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
    if (booking.source === "website") {
      const userEmail = booking.customerEmail || booking.websiteUser?.email;

      if (!userEmail) {
        console.warn("Web booking but user email not found");
        return;
      }

      const subject = "Your Taxi Driver Has Been Assigned";

      const body =
        `Hello ${booking.customerName || booking.websiteUser?.fullName || "Customer"},\n\n` +
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

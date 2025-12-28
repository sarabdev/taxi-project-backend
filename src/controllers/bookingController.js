const Booking = require("../models/Booking");

/**
 * =========================================================
 * CREATE WEBSITE BOOKING (AFTER PAYMENT SUCCESS)
 * =========================================================
 * Source: website
 * Payment: stripe
 * Status: confirmed
 */
exports.createWebsiteBooking = async (req, res) => {
  try {
    const websiteUserId = req.user?.id;

    if (!websiteUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      fromAddress,
      toAddress,
      pickupDateTime,
      returnDateTime,
      numberOfPersons,
      luggage,
      carType,
      amount,
      currency,
      stripePaymentIntentId,
    } = req.body;

    if (!stripePaymentIntentId) {
      return res.status(400).json({
        success: false,
        message: "Payment not verified",
      });
    }

    const booking = await Booking.create({
      websiteUser: websiteUserId,
      source: "website",

      fromAddress,
      toAddress,
      pickupDateTime,
      returnDateTime,
      numberOfPersons,
      luggage,
      carType,

      amount,
      currency: currency || "GBP",

      paymentMethod: "stripe",
      paymentStatus: "paid",
      stripePaymentIntentId,

      status: "confirmed",
    });

    return res.status(201).json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("createWebsiteBooking error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * =========================================================
 * CREATE WHATSAPP BOOKING (NO ONLINE PAYMENT)
 * =========================================================
 */
exports.createWhatsappBooking = async (req, res) => {
  try {
    const {
      fromAddress,
      toAddress,
      pickupDateTime,
      returnDateTime,
      numberOfPersons,
      luggage,
      carType,
    } = req.body;

    const whatsappUserId = req.user?.id;

    if (!whatsappUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const booking = await Booking.create({
      user: whatsappUserId,
      source: "whatsapp",

      fromAddress,
      toAddress,
      pickupDateTime,
      returnDateTime,
      numberOfPersons,
      luggage,
      carType,

      paymentMethod: "cash",
      paymentStatus: "unpaid",
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("createWhatsappBooking error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * =========================================================
 * GET MY BOOKINGS (LIST)
 * =========================================================
 */
exports.getMyBookings = async (req, res) => {
  try {
    const websiteUserId = req.user?.id;

    const bookings = await Booking.find({
      $or: [
        { websiteUser: websiteUserId },
        { user: websiteUserId },
      ],
    })
      .sort({ createdAt: -1 })
      .populate("driver");

    return res.json({
      success: true,
      bookings,
    });
  } catch (err) {
    console.error("getMyBookings error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * =========================================================
 * GET MY BOOKING BY ID
 * =========================================================
 */
exports.getMyBookingById = async (req, res) => {
  try {
    const userId = req.user?.id;
    const bookingId = req.params.id;

    const booking = await Booking.findOne({
      _id: bookingId,
      $or: [{ websiteUser: userId }, { user: userId }],
    }).populate("driver");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("getMyBookingById error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * =========================================================
 * CANCEL MY BOOKING
 * =========================================================
 */
exports.cancelMyBooking = async (req, res) => {
  try {
    const userId = req.user?.id;
    const bookingId = req.params.id;

    const booking = await Booking.findOne({
      _id: bookingId,
      $or: [{ websiteUser: userId }, { user: userId }],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Only allow cancellation before driver assignment
    if (
      ["driver_assigned", "completed"].includes(booking.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Booking cannot be cancelled at this stage",
      });
    }

    booking.status = "cancelled";
    await booking.save();

    return res.json({
      success: true,
      booking,
    });
  } catch (err) {
    console.error("cancelMyBooking error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

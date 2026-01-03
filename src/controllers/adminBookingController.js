const Booking = require("../models/Booking");
const Driver = require("../models/Driver");
const notificationService = require("../services/notificationService");

exports.listBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate("user") // WhatsApp user
      .populate("websiteUser") // Website user ✅
      .populate("driver")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      bookings,
    });
  } catch (err) {
    console.error("listBookings error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.assignDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    const booking = await Booking.findById(id).populate("user");
    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) {
      return res
        .status(404)
        .json({ success: false, message: "Driver not found" });
    }

    booking.driver = driver._id;
    booking.status = "driver_assigned";
    await booking.save();

    await notificationService.notifyDriverAssigned(booking, driver);

    res.json({ success: true, booking });
  } catch (err) {
    console.error("assignDriver error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

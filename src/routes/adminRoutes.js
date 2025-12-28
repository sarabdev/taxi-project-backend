const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const bookingController = require("../controllers/adminBookingController");
const adminAuth = require("../middleware/adminAuth");

// -----------------------------
// AUTH
// -----------------------------

// Admin login
router.post("/login", adminController.loginAdmin);

// Get logged-in admin
router.get("/me", adminAuth, adminController.getMe);

// -----------------------------
// BOOKINGS (ADMIN)
// -----------------------------

// List all bookings
router.get("/bookings", adminAuth, bookingController.listBookings);

// Assign driver to booking
router.patch(
  "/bookings/:id/assign-driver",
  adminAuth,
  bookingController.assignDriver
);

// Update booking status (confirm, cancel, complete)
router.patch(
  "/bookings/:id/status",
  adminAuth,
  async (req, res) => {
    try {
      const { status } = req.body;
      const booking = await require("../models/Booking").findById(
        req.params.id
      );

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      booking.status = status;
      await booking.save();

      res.json({ success: true, booking });
    } catch (err) {
      console.error("updateBookingStatus error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;

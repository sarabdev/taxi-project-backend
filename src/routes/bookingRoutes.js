// routes/booking.routes.js
const express = require("express");
const router = express.Router();
const userAuth = require("../middleware/userAuth");
const controller = require("../controllers/bookingController");

router.post("/website", userAuth, controller.createWebsiteBooking);
router.post("/whatsapp", userAuth, controller.createWhatsappBooking);

router.get("/me", userAuth, controller.getMyBookings);
router.get("/me/:id", userAuth, controller.getMyBookingById);

router.patch("/me/:id/cancel", userAuth, controller.cancelMyBooking);

module.exports = router;

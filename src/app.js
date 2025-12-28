const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const cors = require("cors");
const whatsappRoutes = require("./routes/whatsappRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const driverRoutes = require("./routes/driverRoutes");
const {seedAdmin} = require("./seeders/seedAdmin");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();
app.use(cors());
// Middlewares
app.use(bodyParser.json());
app.use(morgan("dev"));

// Routes
app.use("/whatsapp-webhook", whatsappRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/pricing", require("./routes/pricingRoutes"));
app.use("/payments", require("./routes/paymentRoutes"))
// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Taxi backend is running" });
});

// Error handling
app.use(notFound);
app.use(errorHandler);
seedAdmin();
module.exports = app;

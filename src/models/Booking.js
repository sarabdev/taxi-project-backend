const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    // ----------------------------------
    // USER REFERENCES (ONE IS REQUIRED)
    // ----------------------------------
    websiteUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WebsiteUser",
      default: null,
    },

    user: {
      // WhatsApp user
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ----------------------------------
    // BOOKING SOURCE
    // ----------------------------------
    source: {
      type: String,
      enum: ["website", "whatsapp"],
      required: true,
    },

    // ----------------------------------
    // DRIVER (ASSIGNED BY ADMIN)
    // ----------------------------------
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
    },

    // ----------------------------------
    // TRIP DETAILS
    // ----------------------------------
    fromAddress: {
      type: String,
      required: true,
    },

    toAddress: {
      type: String,
      required: true,
    },

    bookingDate: {
      type: String,
      required: true,
      trim: true,
    },

    bookingTime: {
      type: String,
      required: true,
      trim: true,
    },

    returnDate: {
      type: String,
      default: null,
      trim: true,
    },

    returnTime: {
      type: String,
      default: null,
      trim: true,
    },

    numberOfPersons: {
      type: Number,
      default: 1,
    },

    luggage: {
      type: Number,
      default: 0,
    },

    // Dropdown-based car type
    carType: {
      type: String,
      enum: ["sedan", "executive", "mpv", "suv", "van"],
      required: true,
    },

    // ----------------------------------
    // BOOKING STATUS
    // ----------------------------------
    status: {
      type: String,
      enum: [
        "draft", // website (before payment)
        "pending", // whatsapp OR after vehicle selection
        "confirmed", // payment success / whatsapp confirm
        "driver_assigned",
        "cancelled",
        "completed",
      ],
      default: "pending",
    },

    // ----------------------------------
    // PAYMENT (WEBSITE ONLY)
    // ----------------------------------
    amount: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "GBP",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },

    paymentMethod: {
      type: String,
      enum: ["stripe", "cash", "whatsapp"],
      default: null,
    },

    stripeSessionId: {
      type: String,
      default: null,
    },

    stripePaymentIntentId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// ----------------------------------
// VALIDATION & BUSINESS RULES
// ----------------------------------
bookingSchema.pre("validate", function (next) {
  // Website booking rules
  if (this.source === "website") {
    if (!this.websiteUser) {
      return next(new Error("websiteUser is required for website bookings"));
    }
    this.paymentMethod = "stripe";
    this.status = this.status || "draft";
  }

  // WhatsApp booking rules
  if (this.source === "whatsapp") {
    if (!this.user) {
      return next(new Error("user is required for WhatsApp bookings"));
    }
    this.paymentMethod = this.paymentMethod || "cash";
  }

  next();
});

module.exports = mongoose.model("Booking", bookingSchema);

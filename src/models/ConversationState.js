const mongoose = require("mongoose");

const conversationStateSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },

    step: {
      type: String,
      enum: [
        "ASK_NAME",
        "ASK_PICKUP",
        "PICKUP_CHOOSE",
        "ASK_DROPOFF",
        "DROPOFF_CHOOSE",
        "ASK_DATETIME",
        "CONFIRM",
        "DONE",
        "ASK_VEHICLE"
      ],
      default: "ASK_NAME",
    },

    temp: {
      name: String,
      pickup: String,
      pickupOptions: Array,

      dropoff: String,
      dropoffOptions: Array,

      datetime: String,
      notes: String,
      lastMessageId: { type: String }

    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ConversationState", conversationStateSchema);

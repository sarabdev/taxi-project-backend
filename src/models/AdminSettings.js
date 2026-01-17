const mongoose = require("mongoose");

const adminSettingsSchema = new mongoose.Schema(
  {
    perMilePrice: {
      type: Number,
      required: true,
      default: 2,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AdminSettings", adminSettingsSchema);

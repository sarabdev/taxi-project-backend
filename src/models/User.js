const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String },
    phone: { type: String, index: true }, // WhatsApp number
    email: { type: String },
    whatsappId: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

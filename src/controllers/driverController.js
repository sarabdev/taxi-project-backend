const Driver = require("../models/Driver");

exports.listDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    res.json({ success: true, drivers });
  } catch (err) {
    console.error("listDrivers error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.createDriver = async (req, res) => {
  try {
    const driver = await Driver.create(req.body);
    res.status(201).json({ success: true, driver });
  } catch (err) {
    console.error("createDriver error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

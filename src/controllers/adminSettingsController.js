const AdminSettings = require("../models/AdminSettings");

// Get saved settings
exports.getSettings = async (req, res) => {
  try {
    let settings = await AdminSettings.findOne();

    // Auto-create if not exists
    if (!settings) {
      settings = await AdminSettings.create({ perMilePrice: 0 });
    }

    res.json({ success: true, settings });
  } catch (err) {
    console.error("getSettings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Save / update settings
exports.saveSettings = async (req, res) => {
  try {
    const { perMilePrice } = req.body;

    let settings = await AdminSettings.findOne();

    if (!settings) {
      settings = new AdminSettings();
    }

    if (perMilePrice !== undefined) {
      settings.perMilePrice = perMilePrice;
    }

    await settings.save();

    res.json({ success: true, settings });
  } catch (err) {
    console.error("saveSettings error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

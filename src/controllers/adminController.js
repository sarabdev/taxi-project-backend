const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

// ---------------------------------
// POST /api/admin/login
// ---------------------------------
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // explicitly select passwordHash
    const admin = await Admin.findOne({ email }).select("+passwordHash");

    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "7d" }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (err) {
    console.error("loginAdmin error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ---------------------------------
// GET /api/admin/me
// ---------------------------------
exports.getMe = async (req, res) => {
  try {
    const admin = req.admin;

    res.json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

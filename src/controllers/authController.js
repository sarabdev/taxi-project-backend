const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const WebsiteUser = require("../models/WebsiteUser");

// ---------------- REGISTER ----------------
exports.register = async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const exists = await WebsiteUser.findOne({ email });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await WebsiteUser.create({
      fullName,
      email,
      phone,
      passwordHash,
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.USER_JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------------- LOGIN ----------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await WebsiteUser.findOne({ email }).select("+passwordHash");
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.USER_JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------------- ME ----------------
exports.me = async (req, res) => {
  const user = req.user;

  res.json({
    success: true,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
    },
  });
};

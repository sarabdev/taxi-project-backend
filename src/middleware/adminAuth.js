const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

module.exports = async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);

    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Admin not authorized",
      });
    }

    req.admin = admin; // attach admin to request
    next();
  } catch (err) {
    console.error("adminAuth error:", err);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

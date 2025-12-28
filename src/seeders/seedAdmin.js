const mongoose = require("mongoose");
const Admin = require("../models/Admin");

async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@taxi.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

    const existingAdmin = await Admin.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log("✅ Admin already exists:", adminEmail);
      return;
    }

    const admin = new Admin({
      name: "Super Admin",
      email: adminEmail,
      isActive: true,
    });

    await admin.setPassword(adminPassword);
    await admin.save();

    console.log("🚀 Admin seeded successfully");
    console.log("📧 Email:", adminEmail);
    console.log("🔑 Password:", adminPassword);
  } catch (err) {
    console.error("❌ seedAdmin error:", err);
  }
}

module.exports = { seedAdmin };

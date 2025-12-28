const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not defined in .env");

  await mongoose.connect(uri, {
    // options optional in latest versions
  });

  console.log("✅ Connected to MongoDB");
}

module.exports = connectDB;

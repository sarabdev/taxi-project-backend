const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driverController");
const adminAuth = require("../middleware/adminAuth");

// CRUD drivers (ADMIN ONLY)
router.get("/", adminAuth, driverController.listDrivers);
router.post("/", adminAuth, driverController.createDriver);

module.exports = router;

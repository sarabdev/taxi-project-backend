const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const userAuth = require("../middleware/userAuth");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", userAuth, authController.me);

module.exports = router;

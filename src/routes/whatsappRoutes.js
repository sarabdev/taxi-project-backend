const express = require("express");
const router = express.Router();
const whatsappController = require("../controllers/whatsappController");

// GET for webhook verification
router.get("/", whatsappController.verifyWebhook);

// POST for receiving messages
router.post("/", whatsappController.handleWebhook);

module.exports = router;

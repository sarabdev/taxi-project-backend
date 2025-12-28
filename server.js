const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const app = express();
const port = 3000;

// Use body-parser to parse incoming requests
app.use(bodyParser.json());

// Replace with your **verify_token** set in Meta Developer Console
const VERIFY_TOKEN = "your-verify-token";

// Webhook verification (GET request from Meta)
app.get("/whatsapp-webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    // Check if the token matches the one you set in the Meta Developer Console
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified successfully!");
      // Respond with the challenge to complete verification
      res.status(200).send(challenge);
    } else {
      console.error("Verification failed. Invalid token.");
      res.sendStatus(403); // Forbidden
    }
  } else {
    res.sendStatus(400); // Bad request
  }
});

// WhatsApp Webhook: When a message is sent to WhatsApp, it will trigger this endpoint (POST request)
app.post("/whatsapp-webhook", async (req, res) => {
  // Log the message data
  console.log(req.body.entry[0].changes[0].value.messages);

  // Correct path to extract the message and sender (from) information
  const message = req.body.entry[0].changes[0].value.messages[0]?.text?.body;
  const from = req.body.entry[0].changes[0].value.messages[0]?.from;

  console.log("Message:", message);
  console.log("From:", from);
  let userState = {};
  if (message && from) {
    // Handle initial "book" command
    if (message.toLowerCase() === "book") {
      userState[from] = { step: "pickup" };
      await sendWhatsApp(from, "Great! Please enter your pickup location.");
    }
    // Handle the pickup location
    else if (userState[from]?.step === "pickup") {
      userState[from].pickup = message;
      userState[from].step = "dropoff";
      await sendWhatsApp(from, "Enter your dropoff location:");
    }
    // Handle the dropoff location
    else if (userState[from]?.step === "dropoff") {
      userState[from].dropoff = message;
      userState[from].step = "date";
      await sendWhatsApp(from, "Enter the date for your ride (DD-MM-YYYY):");
    }
    // Handle the date
    else if (userState[from]?.step === "date") {
      userState[from].date = message;
      userState[from].step = "time";
      await sendWhatsApp(from, "Enter the time for your ride (HH:MM):");
    }
    // Handle the time
    else if (userState[from]?.step === "time") {
      userState[from].time = message;
      userState[from].step = "confirmation";
      await sendWhatsApp(
        from,
        "Please confirm your ride details:\n" +
          `Pickup: ${userState[from].pickup}\n` +
          `Dropoff: ${userState[from].dropoff}\n` +
          `Date: ${userState[from].date}\n` +
          `Time: ${userState[from].time}\n` +
          "Type 'confirm' to confirm or 'cancel' to cancel."
      );
    }
    // Handle confirmation
    else if (
      userState[from]?.step === "confirmation" &&
      message.toLowerCase() === "confirm"
    ) {
      await sendWhatsApp(from, "Your ride has been booked successfully! 🎉");
      delete userState[from]; // Clear the user state after booking
    }
    // Handle cancellation
    else if (
      userState[from]?.step === "confirmation" &&
      message.toLowerCase() === "cancel"
    ) {
      await sendWhatsApp(from, "Your booking has been canceled.");
      delete userState[from]; // Clear the user state
    }
  }

  res.sendStatus(200); // Respond to Meta Cloud API
});

// Send WhatsApp message using Meta Cloud API
async function sendWhatsApp(to, text) {
  const apiUrl = `https://graph.facebook.com/v22.0/924711590720155/messages`;
  try {
    await axios.post(
      apiUrl,
      {
        messaging_product: "whatsapp",
        to: to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer EAAm3Qg9Xn1MBQEuLvwLVDUfAQSp9kcMyTLb9a58ZBQJ67Lpa7ytZCCRRyDMrEtxN6huKr6ZCxirairqe8qZCFLixF4bfKZBixCFNs6q0Uu8xQswjiBGH9BKnBw9dxxTxMRjkgcRJ9SkS9qkCYon3hBKuv4WNzPrv730FD01LBU14ZCQmqc2nfBctmvPayn0jSwZAZBpW6E3QSN4VsLTI8DMpyefttG8xZC009zmQO0hfihZAC5f42pIIyDKaCOqyzofZBQvXnpihHWmoRioMdMg0FRFcGj1`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
  }
}

// Save booking to the database (MongoDB or another storage)

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

const axios = require("axios");

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

exports.sendText = async (to, text) => {
  const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ WhatsApp message sent to", to);
  } catch (err) {
    console.error(
      "Error sending WhatsApp message:",
      err.response?.data || err.message
    );
  }
};

exports.sendInteractive = async (to, interactive) => {
  const url = `https://graph.facebook.com/v24.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive,
  };

  // Remove invalid keys for location_request_message
  //   if (interactive.type === "location_request_message") {
  //     // interactive should only contain "type" and "body"
  //     if (interactive.action) delete interactive.action;
  //     if (interactive.header) delete interactive.header;
  //     if (interactive.footer) delete interactive.footer;
  //   }

  try {
    await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Interactive message sent:", interactive.type);
  } catch (err) {
    console.error(
      "Interactive send error:",
      JSON.stringify(err.response?.data, null, 2)
    );
  }
};

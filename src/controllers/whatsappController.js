const ConversationState = require("../models/ConversationState");
const { searchAddress } = require("../utils/addressSearch");
const { parseDateTime } = require("../utils/dateParser");
const whatsapp = require("../services/whatsappService");
const {formatListRow} = require("../utils/whatsappFormat");
exports.verifyWebhook = (req, res) => {
  try {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("🚀 WhatsApp Webhook Verified Successfully!");
        return res.status(200).send(challenge);
      } else {
        console.warn("❌ Invalid verify token");
        return res.sendStatus(403);
      }
    }

    return res.sendStatus(400);
  } catch (err) {
    console.error("Webhook verification error:", err);
    return res.sendStatus(500);
  }
};

const MAX_TITLE = 24;
const MAX_DESC = 72;

function formatRow(place, prefix) {
  let title =
    place.name ||
    place.text.split(",")[0] ||
    "Location";

  if (title.length > MAX_TITLE) {
    title = title.slice(0, MAX_TITLE - 1) + "…";
  }

  let description = place.text;
  if (description.length > MAX_DESC) {
    description = description.slice(0, MAX_DESC - 1) + "…";
  }

  return {
    id: `${prefix}_${place.id}`,
    title,
    description,
  };
}

exports.handleWebhook = async (req, res) => {
  try {
    const messageObj = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!messageObj) return res.sendStatus(200);

    const from = messageObj.from;
    const text = messageObj.text?.body;
    const buttonId = messageObj?.interactive?.button_reply?.id;
    const listId = messageObj?.interactive?.list_reply?.id;
    const location = messageObj.location;

    let convo = await ConversationState.findOne({ phone: from });
    if (!convo) {
      convo = await ConversationState.create({
        phone: from,
        step: "ASK_NAME",
        temp: {},
      });
    }

    // -----------------------------
    // RESET
    // -----------------------------
    if (text?.toLowerCase() === "book") {
      convo.step = "ASK_NAME";
      convo.temp = {};
      await convo.save();
      await whatsapp.sendText(from, "Please tell us your name?");
      return res.sendStatus(200);
    }

    // -----------------------------
    // STEP 1 — NAME
    // -----------------------------
    if (convo.step === "ASK_NAME") {
      if (!text) return res.sendStatus(200);

      convo.temp.name = text.trim();
      convo.step = "ASK_PICKUP";
      await convo.save();

      await whatsapp.sendInteractive(from, {
        type: "location_request_message",
        body: {
          text:
            "Where would you like to be picked up?\n\n" +
            "Send your location or type the address.\n" +
            "Example: 10 High Street",
        },
        action: { name: "send_location" },
      });

      return res.sendStatus(200);
    }

    // -----------------------------
    // STEP 2 — PICKUP SEARCH
    // -----------------------------
    if (convo.step === "ASK_PICKUP") {
      let query;

      if (location) {
        query = `${location.latitude}, ${location.longitude}`;
        convo.temp.pickupCoordinates = location;
      } else if (text) {
        query = text;
      } else {
        return res.sendStatus(200);
      }

      let results = (await searchAddress(query)).slice(0, 8);

      if (results.length === 1) {
        convo.temp.pickup = results[0].text;
        convo.temp.pickupPlaceId = results[0].placeId;
        convo.step = "ASK_DROPOFF";
        await convo.save();
        await whatsapp.sendText(from, "Where are you going?");
        return res.sendStatus(200);
      }

      convo.temp.pickupOptions = results;
      convo.step = "PICKUP_CHOOSE";
      await convo.save();

      await whatsapp.sendInteractive(from, {
        type: "list",
        header: { type: "text", text: "Pickup Location" },
        body: { text: "Multiple addresses found. Select one:" },
        footer: { text: "Choose from the list" },
        action: {
          button: "Choose Pickup",
          sections: [
            {
              title: "Pickup Options",
              rows: results.map((r) => formatRow(r, "pickup")),
            },
          ],
        },
      });

      return res.sendStatus(200);
    }

    // -----------------------------
    // STEP 3 — PICKUP SELECT
    // -----------------------------
    if (convo.step === "PICKUP_CHOOSE" && listId?.startsWith("pickup_")) {
      const id = listId.replace("pickup_", "");
      const selected = convo.temp.pickupOptions.find((o) => o.id === id);

      convo.temp.pickup = selected.text;
      convo.temp.pickupPlaceId = selected.placeId;
      convo.step = "ASK_DROPOFF";
      await convo.save();

      await whatsapp.sendText(from, "Please enter destination address:");
      return res.sendStatus(200);
    }

    // -----------------------------
    // STEP 4 — DROPOFF SEARCH
    // -----------------------------
    if (convo.step === "ASK_DROPOFF") {
      if (!text) return res.sendStatus(200);

      let results = (await searchAddress(text)).slice(0, 8);

      if (results.length === 1) {
        convo.temp.dropoff = results[0].text;
        convo.temp.dropoffPlaceId = results[0].placeId;
        convo.step = "ASK_DATETIME";
        await convo.save();
        return askTimeOptions(from);
      }

      convo.temp.dropoffOptions = results;
      convo.step = "DROPOFF_CHOOSE";
      await convo.save();

      await whatsapp.sendInteractive(from, {
        type: "list",
        header: { type: "text", text: "Destination Location" },
        body: { text: "Multiple addresses found. Select destination:" },
        footer: { text: "Choose from the list" },
        action: {
          button: "Choose Destination",
          sections: [
            {
              title: "Destination Options",
              rows: results.map((r) => formatRow(r, "drop")),
            },
          ],
        },
      });

      return res.sendStatus(200);
    }

    // -----------------------------
    // STEP 5 — DROPOFF SELECT
    // -----------------------------
    if (convo.step === "DROPOFF_CHOOSE" && listId?.startsWith("drop_")) {
      const id = listId.replace("drop_", "");
      const selected = convo.temp.dropoffOptions.find((o) => o.id === id);

      convo.temp.dropoff = selected.text;
      convo.temp.dropoffPlaceId = selected.placeId;
      convo.step = "ASK_DATETIME";
      await convo.save();

      return askTimeOptions(from);
    }

    // -----------------------------
    // STEP 6 — ASK DATETIME
    // -----------------------------

    // Button → open list
    if (convo.step === "ASK_DATETIME" && buttonId === "choose_time") {
      await whatsapp.sendInteractive(from, {
        type: "list",
        header: { type: "text", text: "Pickup Time" },
        body: { text: "Please select a pickup time:" },
        footer: { text: "Or type a custom time" },
        action: {
          button: "Choose Time",
          sections: [
            {
              title: "Time Options",
              rows: [
                { id: "time_asap", title: "ASAP", description: "Pickup as soon as possible" },
                { id: "time_15", title: "In 15 minutes", description: "Pickup after 15 minutes" },
                { id: "time_30", title: "In 30 minutes", description: "Pickup after 30 minutes" },
                { id: "time_60", title: "In 1 hour", description: "Pickup after 1 hour" },
              ],
            },
          ],
        },
      });

      return res.sendStatus(200);
    }

    // List selection
    if (convo.step === "ASK_DATETIME" && listId?.startsWith("time_")) {
      const mapping = {
        time_asap: "ASAP",
        time_15: "In 15 minutes",
        time_30: "In 30 minutes",
        time_60: "In 1 hour",
      };

      convo.temp.datetime = mapping[listId];
      convo.step = "CONFIRM";
      await convo.save();

      return sendConfirmation(from, convo);
    }

    // Typed time
    if (convo.step === "ASK_DATETIME" && text) {
      const parsed = parseDateTime(text);
      convo.temp.datetime = parsed.formatted;
      convo.step = "CONFIRM";
      await convo.save();

      return sendConfirmation(from, convo);
    }

    // -----------------------------
    // STEP 7 — CONFIRM
    // -----------------------------
    if (convo.step === "CONFIRM") {
      if (buttonId === "edit_booking") {
        convo.step = "ASK_NAME";
        convo.temp = {};
        await convo.save();
        await whatsapp.sendText(from, "Let's start again. What is your name?");
      }

      if (buttonId === "confirm_booking") {
  const User = require("../models/User");
  const Booking = require("../models/Booking");

  // 1️⃣ Create or find user
  let user = await User.findOne({ phone: from });
  if (!user) {
    user = await User.create({
      phone: from,
      name: convo.temp.name,
    });
  }

  // 2️⃣ Parse datetime
  const pickupDateTime = new Date(convo.temp.datetime);

  // 3️⃣ Create booking
  const booking = await Booking.create({
    user: user._id,
    source: "whatsapp",
    fromAddress: convo.temp.pickup,
    toAddress: convo.temp.dropoff,
    pickupDateTime,
    numberOfPersons: 1,
    carType: "Taxi",
    paymentMethod: "whatsapp",
    paymentStatus: "unpaid",
    status: "confirmed",
  });

  // 4️⃣ Reset conversation
  convo.step = "DONE";
  convo.temp = {};
  await convo.save();

  // 5️⃣ Confirm on WhatsApp
  await whatsapp.sendText(
    from,
    `🎉 *Booking Confirmed!*\n\n` +
      `📍 Pickup: ${booking.fromAddress}\n` +
      `📍 Drop-off: ${booking.toAddress}\n` +
      `🕒 Time: ${pickupDateTime.toLocaleString()}\n\n` +
      `Our team will assign a driver shortly.`
  );

  return res.sendStatus(200);
}

    }

    return res.sendStatus(200);

    // -----------------------------
    // HELPERS
    // -----------------------------
    function askTimeOptions(to) {
      return whatsapp.sendInteractive(to, {
        type: "button",
        body: {
          text:
            "When should we pick you up?\n\n" +
            "Tap below to choose a time or type a specific time.\n" +
            "Example: tomorrow 10am",
        },
        action: {
          buttons: [
            {
              type: "reply",
              reply: { id: "choose_time", title: "Choose Time" },
            },
          ],
        },
      });
    }

    function sendConfirmation(to, convo) {
      const msg =
        `OK looks like we are ready for booking!\n\n` +
        `☑ Name: ${convo.temp.name}\n` +
        `☑ Pickup: ${convo.temp.pickup}\n` +
        `☑ Drop Off: ${convo.temp.dropoff}\n` +
        `☑ When: ${convo.temp.datetime}\n` +
        `☑ Vehicle: Taxi (1–6 Max)\n` +
        `☑ Notes: No notes given\n` +
        `🕐 Waiting Time: 6 minutes\n\n` +
        `If incorrect, tap Edit. Otherwise tap Book.`;

      return whatsapp.sendInteractive(to, {
        type: "button",
        body: { text: msg },
        action: {
          buttons: [
            { type: "reply", reply: { id: "edit_booking", title: "Edit" } },
            { type: "reply", reply: { id: "confirm_booking", title: "Book" } },
          ],
        },
      });
    }
  } catch (err) {
    console.error("Webhook error:", err);
    return res.sendStatus(500);
  }
};



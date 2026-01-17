const ConversationState = require("../models/ConversationState");
const Booking = require("../models/Booking");
const User = require("../models/User");
const mongoose = require("mongoose");

const ProcessedMessage = mongoose.model("ProcessedMessage", new mongoose.Schema({
  messageId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } 
}));

const { searchAddress } = require("../utils/addressSearch");
const { parseDateTime } = require("../utils/dateParser");
const whatsapp = require("../services/whatsappService");

const MAX_TITLE = 24;
const MAX_DESC = 72;
const INACTIVITY_MS = 30 * 60 * 1000;

const CAR_TYPES = [
  { value: "sedan", label: "Sedan" },
  { value: "executive", label: "Executive" },
  { value: "mpv", label: "MPV" },
  { value: "suv", label: "SUV" },
  { value: "van", label: "Van" },
];

// =============================
// DATETIME HELPER (Strict Format)
// =============================
function getFormattedDateTime(input) {
  let dateObj = new Date();

  if (input === "asap") { /* current */ }
  else if (input === "15m") { dateObj.setMinutes(dateObj.getMinutes() + 15); }
  else if (input === "30m") { dateObj.setMinutes(dateObj.getMinutes() + 30); }
  else if (input === "1h") { dateObj.setHours(dateObj.getHours() + 1); }
  else {
    const parsed = parseDateTime(input);
    if (parsed && parsed.date && parsed.time) {
      return { date: parsed.date, time: parsed.time };
    }
  }

  // Format: YYYY-MM-DD
  const date = dateObj.toISOString().split('T')[0];
  // Format: HH:mm
  const time = dateObj.toTimeString().split(' ')[0].slice(0, 5);
  
  return { date, time };
}

// =============================
// UTILS
// =============================
function truncate(text = "", max) {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

async function safeSendInteractive(to, payload, fallbackText) {
  try {
    await whatsapp.sendInteractive(to, payload);
  } catch (err) {
    if (fallbackText) await whatsapp.sendText(to, fallbackText);
  }
}

// =============================
// WEBHOOK HANDLERS
// =============================
exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  return res.sendStatus(403);
};

exports.handleWebhook = async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (
      !message ||
      (
        !message.text &&
        !message.interactive &&
        !message.location
      )
    ) {
      return;
    }
    const from = message.from;
    const msgId = message.id;

    // const alreadyProcessed = await ProcessedMessage.findOne({ messageId: msgId });
    // if (alreadyProcessed) return;
    // await ProcessedMessage.create({ messageId: msgId });
    

    const text = message.text?.body?.trim();
    const buttonId = message?.interactive?.button_reply?.id;
    const listId = message?.interactive?.list_reply?.id;
    const location = message.location;

    let convo = await ConversationState.findOne({ phone: from });

    if (!convo) {
      convo = await ConversationState.findOneAndUpdate(
        { phone: from },
        { step: "START", temp: {}, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    }

    if (text?.toLowerCase() === "book" || buttonId === "new_booking") {
      convo.step = "ASK_NAME";
      convo.temp = {};
      await convo.save();
      return whatsapp.sendText(from, "Welcome! What is your name?");
    }

    if (text?.toLowerCase() === "my bookings" || buttonId === "my_bookings") {
      return sendBookingsList(from);
    }

    switch (convo.step) {
      case "ASK_NAME":
        if (!text) return;
        convo.temp.name = text;
        convo.step = "ASK_PICKUP";
        await convo.save();
        return safeSendInteractive(from, {
          type: "location_request_message",
          body: { text: `📍 Where should we pick you up, ${text}?` },
          action: { name: "send_location" }
        }, "📍 Please type your pickup address.");

      case "ASK_PICKUP":
        const pQuery = location ? `${location.latitude},${location.longitude}` : text;
        if (!pQuery) return;
        const pResults = (await searchAddress(pQuery)).slice(0, 8);
        if (pResults.length === 1) {
          convo.temp.pickup = pResults[0].text;
          convo.step = "ASK_DROPOFF";
          await convo.save();
          return whatsapp.sendText(from, "📍 Where are you going?");
        }
        convo.temp.pickupOptions = pResults;
        convo.step = "PICKUP_CHOOSE";
        await convo.save();
        return sendLocationList(from, "Pickup Location", "pickup", pResults);

      case "PICKUP_CHOOSE":
        if (!listId?.startsWith("pickup_")) return;
        const pSelected = convo.temp.pickupOptions.find(o => o.id === listId.replace("pickup_", ""));
        if (!pSelected) return;
        convo.temp.pickup = pSelected.text;
        convo.step = "ASK_DROPOFF";
        await convo.save();
        return whatsapp.sendText(from, "📍 Destination address?");

      case "ASK_DROPOFF":
        if (!text) return;
        const dResults = (await searchAddress(text)).slice(0, 8);
        if (dResults.length === 1) {
          convo.temp.dropoff = dResults[0].text;
          convo.step = "ASK_DATETIME";
          await convo.save();
          return askTime(from);
        }
        convo.temp.dropoffOptions = dResults;
        convo.step = "DROPOFF_CHOOSE";
        await convo.save();
        return sendLocationList(from, "Destination", "drop", dResults);

      case "DROPOFF_CHOOSE":
        if (!listId?.startsWith("drop_")) return;
        const dSelected = convo.temp.dropoffOptions.find(o => o.id === listId.replace("drop_", ""));
        if (!dSelected) return;
        convo.temp.dropoff = dSelected.text;
        convo.step = "ASK_DATETIME";
        await convo.save();
        return askTime(from);

      case "ASK_DATETIME":
        let dtInput = text;
        if (listId?.startsWith("time_")) {
          const map = { time_asap: "asap", time_15: "15m", time_30: "30m", time_60: "1h" };
          dtInput = map[listId];
        } else if (buttonId === "choose_time") {
          return sendTimeList(from);
        }

        if (!dtInput) return;

        const { date, time } = getFormattedDateTime(dtInput);
        
        // Use Mongoose .set() to ensure nested fields are marked as modified
        convo.temp.datetime = `${date} ${time}`; // Fallback legacy field if needed
        convo.set('temp.bookingDate', date);
        convo.set('temp.bookingTime', time);
        convo.step = "ASK_VEHICLE";
        await convo.save();
        return sendVehicleList(from);

      case "ASK_VEHICLE":
        if (!listId?.startsWith("car_")) return sendVehicleList(from);
        const selectedCar = listId.replace("car_", "");
        convo.set('temp.carType', selectedCar);
        convo.step = "CONFIRM";
        await convo.save();
        return sendConfirmation(from, convo);

      case "CONFIRM":
        if (buttonId === "confirm_booking") {
          let user = await User.findOne({ phone: from }) || await User.create({ phone: from, name: convo.temp.name });

          // THE FIX: Creating the object explicitly to ensure no values are undefined
          const bookingData = {
            user: user._id,
            source: "whatsapp",
            fromAddress: convo.temp.pickup,
            toAddress: convo.temp.dropoff,
            bookingDate: convo.temp.bookingDate || new Date().toISOString().split('T')[0],
            bookingTime: convo.temp.bookingTime || "ASAP",
            carType: convo.temp.carType || "sedan",
            status: "confirmed",
            paymentMethod: "cash"
          };

          await Booking.create(bookingData);

          convo.step = "DONE";
          convo.temp = {};
          await convo.save();
          return sendPostBookingMenu(from);
        }
        return sendConfirmation(from, convo);

      default:
        return sendMainMenu(from);
    }
  } catch (err) {
    console.error("🔥 Error Detail:", err);
  }
};

// =============================
// UI HELPERS
// =============================

async function sendMainMenu(to) {
  return safeSendInteractive(to, {
    type: "button",
    body: { text: "Welcome! How can we help you today?" },
    action: {
      buttons: [
        { type: "reply", reply: { id: "new_booking", title: "Book a Ride" } },
        { id: "my_bookings", title: "My Bookings" }
      ]
    }
  });
}

function sendVehicleList(to) {
  return safeSendInteractive(to, {
    type: "list",
    body: { text: "Select your car type:" },
    action: {
      button: "Choose Car",
      sections: [{
        title: "Fleet Options",
        rows: CAR_TYPES.map(c => ({ id: `car_${c.value}`, title: c.label }))
      }]
    }
  });
}

function askTime(to) {
  return safeSendInteractive(to, {
    type: "button",
    body: { text: "🕒 When is the pickup?\n\nSelect a quick option or type (e.g. 'tomorrow 10am')" },
    action: {
      buttons: [{ type: "reply", reply: { id: "choose_time", title: "Quick Options" } }]
    }
  });
}

function sendTimeList(to) {
  return safeSendInteractive(to, {
    type: "list",
    body: { text: "Select a pickup window:" },
    action: {
      button: "Select",
      sections: [{
        title: "Options",
        rows: [
          { id: "time_asap", title: "ASAP" },
          { id: "time_15", title: "In 15 mins" },
          { id: "time_30", title: "In 30 mins" },
          { id: "time_60", title: "In 1 hour" }
        ]
      }]
    }
  });
}

function sendLocationList(to, title, prefix, results) {
  return safeSendInteractive(to, {
    type: "list",
    header: { type: "text", text: title },
    body: { text: "Please select the best match:" },
    action: {
      button: "Select",
      sections: [{
        title: "Results",
        rows: results.map(r => ({
          id: `${prefix}_${r.id}`,
          title: truncate(r.name || r.text.split(",")[0], MAX_TITLE),
          description: truncate(r.text, MAX_DESC)
        }))
      }]
    }
  });
}

async function sendConfirmation(to, convo) {
  const date = convo.temp.bookingDate || "Today";
  const time = convo.temp.bookingTime || "ASAP";
  const car = (convo.temp.carType || "sedan").toUpperCase();

  const msg = `📋 *Booking Summary*\n\n📍 From: ${convo.temp.pickup}\n🏁 To: ${convo.temp.dropoff}\n📅 Date: ${date}\n🕒 Time: ${time}\n🚗 Car: ${car}`;
  
  return safeSendInteractive(to, {
    type: "button",
    body: { text: msg },
    action: {
      buttons: [{ type: "reply", reply: { id: "confirm_booking", title: "Confirm & Book" } }]
    }
  }, msg);
}

async function sendPostBookingMenu(to) {
  return safeSendInteractive(to, {
    type: "button",
    body: { text: "✅ Booking Confirmed! We are looking for your driver." },
    action: {
      buttons: [
        { type: "reply", reply: { id: "new_booking", title: "Book Another" } },
        { type: "reply", reply: { id: "my_bookings", title: "View All" } }
      ]
    }
  });
}

async function sendBookingsList(to) {
  const user = await User.findOne({ phone: to });
  if (!user) return whatsapp.sendText(to, "No history found.");
  const list = await Booking.find({ user: user._id }).sort({ createdAt: -1 }).limit(3);
  if (!list.length) return whatsapp.sendText(to, "You have no bookings.");

  let text = "📋 *Last 3 Bookings:*\n\n";
  list.forEach((b, i) => {
    text += `${i+1}. ${truncate(b.toAddress, 25)}\n📅 ${b.bookingDate} at ${b.bookingTime}\n\n`;
  });
  return whatsapp.sendText(to, text);
}
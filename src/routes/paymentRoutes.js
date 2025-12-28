const express = require("express");
const Stripe = require("stripe");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 1️⃣ Create PaymentIntent (ONE-TIME)
router.post("/create-intent", async (req, res) => {
  try {
    const { amount, bookingId, currency } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // GBP → pence
      currency: currency || "gbp",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        bookingId,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// router.post(
//   "/webhook",
//   bodyParser.raw({ type: "application/json" }),
//   (req, res) => {
//     const sig = req.headers["stripe-signature"];
//     let event;

//     try {
//       event = stripe.webhooks.constructEvent(
//         req.body,
//         sig,
//         process.env.STRIPE_WEBHOOK_SECRET
//       );
//     } catch (err) {
//       return res.status(400).send(`Webhook Error: ${err.message}`);
//     }

//     if (event.type === "payment_intent.succeeded") {
//       const intent = event.data.object;
//       console.log("Payment success for booking:", intent.metadata.bookingId);
//     }

//     res.json({ received: true });
//   }
// );


module.exports = router;

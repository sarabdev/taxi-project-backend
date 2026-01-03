const express = require("express");
const Stripe = require("stripe");
const User = require("../models/User");
const userAuth = require("../middleware/userAuth");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * =========================================================
 * CREATE PAYMENT INTENT (ONE-TIME PAYMENT)
 * =========================================================
 */
router.post("/create-intent", userAuth, async (req, res) => {
  try {
    const { amount, bookingId, currency } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    /**
     * ---------------------------------------------------------
     * 👤 CREATE / REUSE STRIPE CUSTOMER
     * ---------------------------------------------------------
     */
    let stripeCustomerId = req.user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.fullName,
        metadata: { userId },
      });

      stripeCustomerId = customer.id;

      await User.findByIdAndUpdate(userId, {
        stripeCustomerId,
      });
    }

    /**
     * ---------------------------------------------------------
     * 💳 CREATE PAYMENT INTENT
     * ---------------------------------------------------------
     * ❌ NO IDEMPOTENCY KEY
     */
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // GBP → pence
      currency: currency?.toLowerCase() || "gbp",
      customer: stripeCustomerId,

      automatic_payment_methods: {
        enabled: true,
      },

      metadata: {
        bookingId: bookingId || "draft",
        userId,
      },
    });

    return res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("❌ create-intent error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
});


/**
 * =========================================================
 * STRIPE WEBHOOK (AUDIT ONLY)
 * =========================================================
 */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const intent = event.data.object;

          console.log("✅ Payment succeeded (webhook)", {
            paymentIntentId: intent.id,
            userId: intent.metadata?.userId,
            bookingId: intent.metadata?.bookingId,
            amount: intent.amount,
          });

          break;
        }

        case "payment_intent.payment_failed": {
          const intent = event.data.object;

          console.warn("❌ Payment failed (webhook)", {
            paymentIntentId: intent.id,
          });

          break;
        }

        default:
          console.log(`ℹ️ Unhandled Stripe event: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err) {
      console.error("❌ Webhook processing error:", err);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  }
);

module.exports = router;

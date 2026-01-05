const express = require("express");
const axios = require("axios");
const userAuth = require("../middleware/userAuth");
const quoteLimiter = require("../middleware/quoteLimiter");

const router = express.Router();

router.post("/calculate",userAuth,  async (req, res, next) => {
  try {
    const { fromPlaceId, toPlaceId } = req.body;

    if (!fromPlaceId || !toPlaceId) {
      return res.status(400).json({
        message: "fromPlaceId and toPlaceId are required",
      });
    }

    const url = "https://maps.googleapis.com/maps/api/distancematrix/json";

    const response = await axios.get(url, {
      params: {
        origins: `place_id:${fromPlaceId}`,
        destinations: `place_id:${toPlaceId}`,
        units: "imperial",
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const element = response.data.rows[0]?.elements[0];

    if (!element || element.status !== "OK") {
      return res.status(400).json({
        message: "Unable to calculate distance",
      });
    }

    const meters = element.distance.value;
    const miles = meters / 1609.34;

    const RATE_PER_MILE = 2;
    const totalPrice = Number((miles * RATE_PER_MILE).toFixed(2));

    res.json({
      distance: {
        meters,
        miles: Number(miles.toFixed(2)),
        text: element.distance.text,
      },
      pricing: {
        ratePerMile: RATE_PER_MILE,
        total: totalPrice,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/quote", quoteLimiter, async (req, res, next) => {
  try {
    const { fromPlaceId, toPlaceId } = req.body;

    if (!fromPlaceId || !toPlaceId) {
      return res.status(400).json({
        message: "fromPlaceId and toPlaceId are required",
      });
    }

    // Basic Place ID validation (anti-abuse)
    const placeIdRegex = /^ChI[a-zA-Z0-9_-]{10,}$/;
    if (!placeIdRegex.test(fromPlaceId) || !placeIdRegex.test(toPlaceId)) {
      return res.status(400).json({ message: "Invalid place IDs" });
    }

    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/distancematrix/json",
      {
        params: {
          origins: `place_id:${fromPlaceId}`,
          destinations: `place_id:${toPlaceId}`,
          units: "imperial",
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      }
    );

    const element = response.data.rows[0]?.elements[0];
    if (!element || element.status !== "OK") {
      return res.status(400).json({
        message: "Unable to calculate distance",
      });
    }

    const meters = element.distance.value;
    const miles = meters / 1609.34;

    const RATE_PER_MILE = 2;
    const totalPrice = Number((miles * RATE_PER_MILE).toFixed(2));

    // ⚠️ LIMITED RESPONSE (important)
    res.json({
      distance: {
        miles: Number(miles.toFixed(2)),
      },
      pricing: {
        total: totalPrice,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

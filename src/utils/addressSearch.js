const axios = require("axios");

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

exports.searchAddress = async (query) => {
  try {
    const url = "https://maps.googleapis.com/maps/api/place/textsearch/json";

    const { data } = await axios.get(url, {
      params: {
        query,
        key: GOOGLE_KEY,
      },
    });

    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map((place) => ({
      id: place.place_id,
      text: place.formatted_address,
      placeId: place.place_id,
      location: place.geometry.location, // { lat, lng }
      name: place.name,
    }));
  } catch (err) {
    console.error("Google address search error:", err.message);
    return [];
  }
};

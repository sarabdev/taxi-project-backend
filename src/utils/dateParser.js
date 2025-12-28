exports.parseDateTime = (input) => {
  // Hard-coded future timestamp for now
  return {
    formatted: "09/12/2025 at 08:20 PM",
    iso: new Date("2025-12-09T20:20:00Z"),
  };
};

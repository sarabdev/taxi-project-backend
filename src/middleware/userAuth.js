const jwt = require("jsonwebtoken");
const WebsiteUser = require("../models/WebsiteUser");

module.exports = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.USER_JWT_SECRET);

    const user = await WebsiteUser.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

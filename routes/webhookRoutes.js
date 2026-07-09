const express = require("express");
const router = express.Router();
// We will build the actual controller logic during the Gateway setup
router.post("/nowpayments", (req, res) => {
  console.log("🔔 Webhook received:", req.body);
  res.status(200).send("Webhook received");
});

module.exports = router;

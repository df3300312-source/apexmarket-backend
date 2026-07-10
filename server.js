const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const db = require("./config/db");
require("dotenv").config();
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const depositRoutes = require("./routes/depositRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const planRoutes = require("./routes/planRoutes");
const adminRoutes = require("./routes/adminRoutes");
const processDailyProfits = require("./services/profitService");
const webhookRoutes = require("./routes/webhookRoutes");
const contactController = require("./controllers/contactController");
const { auth, admin } = require("./middleware/auth");
const chatController = require("./controllers/chatController");

const app = express();

// 1. Security Headers (Helps prevent XSS)
app.use(helmet());
app.use(cookieParser());
app.set("trust proxy", 1);

// 2. Rate Limiting (Prevents Brute Force on API endpoints)
const limiter = rateLimit({
  max: 100, // 100 requests per IP
  windowMs: 60 * 60 * 1000, // 1 hour
  message: "Too many requests from this IP, please try again in an hour!",
});
app.use("/api", limiter);

// 3. CORS Configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

// 4. Body parser middleware
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/webhooks", webhookRoutes);

app.post("/api/contact", contactController.submitMessage);
app.get("/api/admin/messages", auth, admin, contactController.getAdminMessages);
app.delete(
  "/api/admin/messages/:id",
  auth,
  admin,
  contactController.deleteMessage,
);

app.post("/api/chat/message", chatController.handleUserMessage);
app.get("/api/admin/chats", auth, admin, chatController.getChatHistory);
app.post("/api/admin/chat/reply", auth, admin, chatController.adminReply);
app.get("/", (req, res) => res.send("ApexMarkets API Running"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
processDailyProfits();

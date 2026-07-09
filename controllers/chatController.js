const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../config/db");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

exports.handleUserMessage = async (req, res) => {
  const { message, sessionId } = req.body;

  try {
    // 1. Save User Message to DB
    await db.query(
      "INSERT INTO chat_messages (session_id, sender, message) VALUES (?, 'user', ?)",
      [sessionId, message],
    );

    // 2. Prepare Gemini Prompt
    const prompt = `
      You are the ApexMarkets Assistant. 
      Rules:
      - Only answer questions related to cryptocurrency, blockchain, investing, and the ApexMarkets website.
      - If a user asks about anything else (e.g., recipes, sports, general history), politely say: "I am sorry, I can only assist with crypto and ApexMarkets related inquiries."
      - If a user wants to register or join, ask: "Which country are you joining us from? I will guide you through the process."
      - Keep answers professional and concise.
      
      User Message: ${message}
    `;

    // 3. Get Response from Gemini
    const result = await model.generateContent(prompt);
    const botResponse = result.response.text();

    // 4. Save Bot Response to DB
    await db.query(
      "INSERT INTO chat_messages (session_id, sender, message) VALUES (?, 'bot', ?)",
      [sessionId, botResponse],
    );

    res.json({ response: botResponse });
  } catch (err) {
    console.error("Gemini Error:", err);
    res.status(500).json({ error: "AI is busy. Please try again." });
  }
};

// Admin: Get all chat history
exports.getChatHistory = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM chat_messages ORDER BY created_at ASC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chats." });
  }
};

// Admin: Send a manual reply
exports.adminReply = async (req, res) => {
  const { sessionId, message } = req.body;
  try {
    await db.query(
      "INSERT INTO chat_messages (session_id, sender, message) VALUES (?, 'admin', ?)",
      [sessionId, message],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to send reply." });
  }
};

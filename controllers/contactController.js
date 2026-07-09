const db = require("../config/db");

// 1. User submits message (Public)
exports.submitMessage = async (req, res) => {
  const { name, email, subject, message } = req.body;
  try {
    await db.query(
      "INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)",
      [name, email, subject, message],
    );
    res.status(201).json({ message: "Message sent!" });
  } catch (err) {
    res.status(500).json({ message: "Error saving message" });
  }
};

// 2. Admin fetches messages (Private) - THIS IS LIKELY THE MISSING ONE
exports.getAdminMessages = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM contact_messages ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Error fetching messages" });
  }
};

// 3. Admin deletes message (Private) - THIS IS LIKELY THE MISSING ONE
exports.deleteMessage = async (req, res) => {
  try {
    await db.query("DELETE FROM contact_messages WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};

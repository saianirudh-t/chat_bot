require('dotenv').config();
const express = require('express'), cors = require('cors'), fs = require('fs');
const rateLimit = require('express-rate-limit'), { GoogleGenerativeAI } = require('@google/generative-ai'), db = require('./db');

const app = express();
app.use(express.json());
app.use(cors());
app.use('/api/', rateLimit({ windowMs: 15 * 60000, max: 100 }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const docs = JSON.parse(fs.readFileSync('./docs.json', 'utf-8'));

app.post('/api/chat', (req, res) => {
  const { sessionId, message } = req.body;
  if (!sessionId || !message) return res.status(400).json({ error: 'Missing data' });

  db.run(`INSERT OR IGNORE INTO sessions (id) VALUES (?)`, [sessionId]);
  db.run(`INSERT INTO messages (session_id, role, content) VALUES (?, 'user', ?)`, [sessionId, message]);

  db.all(`SELECT role, content FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 10`, [sessionId], async (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    
    // Convert SQLite roles (user/assistant) to Gemini format (user/model)
    const history = rows.reverse().map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    
    const sysPrompt = `Answer ONLY using these docs: ${JSON.stringify(docs)}. If not found, say EXACTLY: "Sorry, I don’t have information about that."`;

    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: sysPrompt 
      });
      
      const ai = await model.generateContent({ contents: history });
      const reply = ai.response.text();
      
      db.run(`INSERT INTO messages (session_id, role, content) VALUES (?, 'assistant', ?)`, [sessionId, reply]);
      db.run(`UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [sessionId]);
      
      res.json({ reply });
    } catch (e) { 
      console.error(e);
      res.status(500).json({ error: 'LLM error' }); 
    }
  });
});

app.get('/api/conversations/:sessionId', (req, res) => db.all(`SELECT * FROM messages WHERE session_id = ? ORDER BY id ASC`, [req.params.sessionId], (err, rows) => res.json(err ? {error: 'DB error'} : rows)));
app.get('/api/sessions', (req, res) => db.all(`SELECT id, updated_at FROM sessions ORDER BY updated_at DESC`, [], (err, rows) => res.json(err ? {error: 'DB error'} : rows)));

app.listen(process.env.PORT || 3000, () => console.log('Backend running'));
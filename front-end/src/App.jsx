import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import './App.css';

// FIXED: Added a fallback to ensure it doesn't default to localhost if the variable is missing
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://back-end-3kz5.onrender.com';

export default function App() {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let currentSession = localStorage.getItem('sessionId');
    if (!currentSession) {
      currentSession = uuidv4();
      localStorage.setItem('sessionId', currentSession);
    }
    setSessionId(currentSession);
    fetchHistory(currentSession);
  }, []);

  const fetchHistory = async (id) => {
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/conversations/${id}`);
      setMessages(data);
    } catch (err) { console.error("History fetch failed:", err); }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg, created_at: new Date() }]);
    setLoading(true);

    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/chat`, { sessionId, message: userMsg });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, created_at: new Date() }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Server error. Check CORS/API URL.', created_at: new Date() }]);
    } finally { setLoading(false); }
  };

  const newChat = () => {
    const newId = uuidv4();
    localStorage.setItem('sessionId', newId);
    setSessionId(newId);
    setMessages([]);
  };

  return (
    <div className="chat-app">
      <div className="header">
         <button onClick={newChat}>+ New Chat</button>
         <span className="status">● Online</span>
      </div>
      
      <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role === 'user' ? 'user' : 'ai'}`}>
            <div>{m.content}</div>
            {m.created_at && (
              <div className="time">
                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="bubble ai"><i>Typing...</i></div>}
      </div>

      <div className="input-row">
        <input 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleSend()} 
          placeholder="Message AI..." 
        />
        <button onClick={handleSend} disabled={loading || !input}>Send</button>
      </div>
    </div>
  );
}

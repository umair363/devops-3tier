import { useState, useEffect } from 'react';
import './App.css';

const API_URL = ""; 

function App() {
  const [records, setRecords] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRecords = async () => {
    try {
      const response = await fetch(`${API_URL}/records`);
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error("Error fetching records:", error);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || !name.trim()) return;
    
    setLoading(true);
    try {
      await fetch(`${API_URL}/insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_name: name, text })
      });
      setText('');
      setName('');
      fetchRecords();
    } catch (error) {
      console.error("Error inserting record:", error);
    }
    setLoading(false);
  };

  const formatPakistanTime = (utcDateString) => {
    const date = new Date(utcDateString + 'Z');
    return new Intl.DateTimeFormat('en-PK', {
      timeZone: 'Asia/Karachi',
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(date);
  };

  return (
    <div className="layout">
      <div className="container">
        <header className="header">
          <h1 className="title">SettleMint</h1>
          <p className="subtitle">A record of visitors and daily field notes.</p>
        </header>

        <main className="content">
          <form onSubmit={handleSubmit} className="entry-form">
            <div className="input-row">
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="Visitor name"
                disabled={loading}
                className="input-field"
                required
              />
            </div>
            <div className="input-row">
              <textarea 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                placeholder="Log message..."
                disabled={loading}
                className="input-field textarea-field"
                required
              />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={loading} className="submit-button">
                <span className="button-text">{loading ? 'Logging' : 'Submit entry'}</span>
              </button>
            </div>
          </form>

          <div className="logs-section">
            <h2 className="section-title">Recent Logs</h2>
            <div className="logs-list">
              {records.length === 0 ? (
                <p className="empty-state">No logs yet. The slate is clean.</p>
              ) : (
                records.map((record) => (
                  <div key={record.id} className="log-item">
                    <div className="log-meta">
                      <span className="log-author">{record.visitor_name}</span>
                      <span className="log-separator">—</span>
                      <time className="log-time">{formatPakistanTime(record.created_at)}</time>
                    </div>
                    <p className="log-text">{record.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

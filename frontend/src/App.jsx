import { useState, useEffect } from 'react';
import './App.css';

// The URL is completely empty because we use Nginx to reverse proxy the requests on the same domain
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

  // Convert UTC time from server to Pakistan Standard Time (PKT)
  const formatPakistanTime = (utcDateString) => {
    const date = new Date(utcDateString + 'Z'); // Append Z to ensure it's parsed as UTC
    return new Intl.DateTimeFormat('en-PK', {
      timeZone: 'Asia/Karachi',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>Welcome to SettleMint</h1>
        <p className="greeting">Good to see you! Please log your visit below.</p>
      </header>

      <main className="main-content">
        <section className="input-section">
          <h2>New Entry</h2>
          <form onSubmit={handleSubmit} className="log-form">
            <div className="input-group">
              <label>Visitor Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="e.g. Ali Khan"
                disabled={loading}
              />
            </div>
            <div className="input-group">
              <label>Log Message</label>
              <textarea 
                value={text} 
                onChange={(e) => setText(e.target.value)} 
                placeholder="What did you work on today?"
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Logging...' : 'Submit Log'}
            </button>
          </form>
        </section>

        <section className="logs-section">
          <h2>Recent Visitor Logs</h2>
          <div className="logs-container">
            {records.length === 0 ? (
              <div className="empty-state">No logs found. Be the first!</div>
            ) : (
              records.map((record) => (
                <div key={record.id} className="log-card">
                  <div className="log-header">
                    <span className="log-author">{record.visitor_name}</span>
                    <span className="log-time">{formatPakistanTime(record.created_at)}</span>
                  </div>
                  <p className="log-text">{record.text}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

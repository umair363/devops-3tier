import { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = "";

function LiveClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      setTime(new Intl.DateTimeFormat('en-PK', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date()) + ' PKT');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="live-clock">{time}</span>;
}

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 3000);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className={`toast toast--${type}`}>
      <span className="toast-icon">{type === 'success' ? '✓' : '✕'}</span>
      {message}
    </div>
  );
}

function formatPKT(utcDateString) {
  const date = new Date(utcDateString + 'Z');
  return new Intl.DateTimeFormat('en-PK', {
    timeZone: 'Asia/Karachi',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [toast, setToast] = useState(null);
  const [fetching, setFetching] = useState(true);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/records`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRecords(data);
    } catch {
      // silent — don't block UI
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_name: name.trim(), text: text.trim() }),
      });
      if (!res.ok) throw new Error();
      setName('');
      setText('');
      setStatus('success');
      setToast({ message: 'Entry logged successfully.', type: 'success' });
      fetchRecords();
    } catch {
      setStatus('error');
      setToast({ message: 'Failed to submit. Try again.', type: 'error' });
    } finally {
      setTimeout(() => setStatus('idle'), 1500);
    }
  };

  return (
    <div className="layout">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      <div className="container">
        {/* Header / Brand */}
        <header className="header">
          <div className="brand">
            <div className="logomark" aria-hidden="true">
              <div className="lm-line lm-line--full" />
              <div className="lm-line lm-line--short" />
              <div className="lm-line lm-line--med" />
            </div>
            <span className="brand-name">SettleMint</span>
          </div>
          <LiveClock />
        </header>

        <main className="content">
          {/* Visitor count pill */}
          {!fetching && (
            <p className="visitor-count">
              {records.length === 0
                ? 'No entries yet'
                : `${records.length} log entr${records.length === 1 ? 'y' : 'ies'}`}
            </p>
          )}

          {/* Entry form */}
          <form onSubmit={handleSubmit} className="entry-form" noValidate>
            <div className="form-grid">
              <input
                id="visitor-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={status === 'loading'}
                className="input-field"
                autoComplete="off"
                required
              />
              <textarea
                id="log-message"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What happened today?"
                disabled={status === 'loading'}
                className="input-field textarea-field"
                required
              />
            </div>
            <div className="form-footer">
              <button
                type="submit"
                disabled={status === 'loading' || !name.trim() || !text.trim()}
                className={`submit-btn submit-btn--${status}`}
              >
                {status === 'loading' ? (
                  <span className="spinner" />
                ) : status === 'success' ? (
                  '✓ Logged'
                ) : (
                  'Add entry'
                )}
              </button>
            </div>
          </form>

          {/* Log feed */}
          <section className="logs-section">
            <h2 className="section-label">Visitor log</h2>

            {fetching ? (
              <div className="skeleton-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-item">
                    <div className="skeleton-line skeleton-line--short" />
                    <div className="skeleton-line skeleton-line--long" />
                  </div>
                ))}
              </div>
            ) : records.length === 0 ? (
              <p className="empty-state">The log is empty. Be the first.</p>
            ) : (
              <ul className="log-list" role="list">
                {records.map((record, i) => (
                  <li
                    key={record.id}
                    className="log-item"
                    style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}
                  >
                    <div className="log-header">
                      <span className="log-author">{record.visitor_name}</span>
                      <time className="log-time">{formatPKT(record.created_at)}</time>
                    </div>
                    <p className="log-body">{record.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { get } from '../api/client';

interface Event {
  id: number;
  timestamp: string;
  event_type: string;
  user_id: string | null;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  viewed_user_id: string | null;
  description: string | null;
}

interface PaginationData {
  events: Event[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await get<PaginationData>(`/events?page=${page}&limit=20`);
        setEvents(data.events);
        setPagination(data.pagination);
        setError('');
      } catch (err) {
        console.error('Failed to fetch events:', err);
        setError('Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 1000);

    return () => clearInterval(interval);
  }, [page]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Events</h1>

      {error && <div style={{ color: '#cc0000', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p>Loading events...</p>
      ) : events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 'bold' }}>Timestamp</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 'bold' }}>Event Type</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 'bold' }}>User</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 'bold' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 'bold' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '0.5rem' }}>{event.event_type}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {event.user_first_name && event.user_last_name
                      ? `${event.user_first_name} ${event.user_last_name}`
                      : '—'}
                  </td>
                  <td style={{ padding: '0.5rem' }}>{event.user_email || '—'}</td>
                  <td style={{ padding: '0.5rem' }}>{event.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '0.5rem 1rem',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.5 : 1,
              }}
            >
              ← Previous
            </button>

            <div>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total events)
            </div>

            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page >= pagination.totalPages}
              style={{
                padding: '0.5rem 1rem',
                cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                opacity: page >= pagination.totalPages ? 0.5 : 1,
              }}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

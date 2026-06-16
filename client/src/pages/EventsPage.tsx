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

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await get<Event[]>('/events');
        setEvents(data);
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
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Events</h1>

      {error && <div style={{ color: '#cc0000', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p>Loading events...</p>
      ) : events.length === 0 ? (
        <p>No events yet.</p>
      ) : (
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
      )}
    </div>
  );
}

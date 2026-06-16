import { useState, useEffect, useTransition } from 'react';
import { get, post, ApiError } from '../api/client';

interface Shout {
  id: number;
  comment: string;
  created_at: string;
  first_name: string;
  last_name: string;
}

export default function ShoutsPage() {
  const [shouts, setShouts] = useState<Shout[]>([]);
  const [comment, setComment] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Log event when page loads
    post('/events/log', {
      event_type: 'shouts_page_loaded',
      description: 'User accessed the shouts page',
    }).catch(() => {
      // Silently fail if event logging fails
    });
  }, []);

  useEffect(() => {
    get<Shout[]>('/shouts')
      .then(setShouts)
      .catch((err) => {
        console.error('Failed to fetch shouts:', err);
        setError('Failed to load shouts');
      })
      .finally(() => setLoading(false));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;

    startTransition(async () => {
      try {
        setError('');
        const newShout = await post<Shout>('/shouts', { comment });
        setShouts([newShout, ...shouts]);
        setComment('');
        // Log event when shout is posted
        post('/events/log', {
          event_type: 'shout_posted',
          description: `User posted a shout: "${comment.trim().substring(0, 50)}${comment.trim().length > 50 ? '...' : ''}"`,
        }).catch(() => {
          // Silently fail if event logging fails
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to post shout');
        }
      }
    });
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Shouts</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={1000}
            disabled={isPending}
            rows={3}
            style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem' }}
          />
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              type="submit"
              disabled={!comment.trim() || isPending}
              style={{ padding: '0.5rem 1rem', cursor: isPending || !comment.trim() ? 'default' : 'pointer' }}
            >
              {isPending ? 'Posting...' : 'Post'}
            </button>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {comment.length}/1000
            </span>
          </div>
          {error && <div style={{ color: '#cc0000', marginTop: '0.5rem' }}>{error}</div>}
      </form>

      {loading ? (
        <p>Loading shouts...</p>
      ) : shouts.length === 0 ? (
        <p>No shouts yet. Be the first to post!</p>
      ) : (
        <table style={{ width: '100%', marginTop: '2rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Shout</th>
              <th style={{ textAlign: 'left', padding: '0.75rem', whiteSpace: 'nowrap' }}>Posted</th>
            </tr>
          </thead>
          <tbody>
            {shouts.map((shout) => (
              <tr key={shout.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>
                  {shout.first_name} {shout.last_name}
                </td>
                <td style={{ padding: '0.75rem' }}>{shout.comment}</td>
                <td style={{ padding: '0.75rem', whiteSpace: 'nowrap', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {new Date(shout.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { get, post } from '../api/client';

interface UserRanking {
  user_id: string;
  first_name: string;
  last_name: string;
  paymentStatus: 'NO' | 'WANTS_TO_PAY' | 'HAS_PAID';
  groupStageScore: number;
  r32Score: number;
  advancementScore: number;
  r16Score: number;
  qfScore: number;
  sfScore: number;
  finalScore: number;
  thirdPlaceScore: number;
  winnerScore: number;
  totalScore: number;
  maxPossibleScore: number;
  koWinner: string | null;
  koWinnerActive: boolean | null;
}

export default function RankingPage() {
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [maxMatchesWithResults, setMaxMatchesWithResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cutoffMatchNumber, setCutoffMatchNumber] = useState<number | null>(null);

  useEffect(() => {
    // Log event when page loads
    post('/events/log', {
      event_type: 'ranking_page_loaded',
      description: 'User loaded the ranking page',
    }).catch(() => {
      // Silently fail if event logging fails
    });
  }, []);

  useEffect(() => {
    // Log event when cutoff selection changes (but not on initial mount)
    if (cutoffMatchNumber !== null) {
      post('/events/log', {
        event_type: 'ranking_cutoff_changed',
        description: `User selected ranking cutoff: ${cutoffMatchNumber} matches`,
      }).catch(() => {
        // Silently fail if event logging fails
      });
    }
  }, [cutoffMatchNumber]);

  useEffect(() => {
    const url = cutoffMatchNumber ? `/ranking?cutoff=${cutoffMatchNumber}` : '/ranking';
    setLoading(true);
    get<{ rankings: UserRanking[]; maxMatchesWithResults: number }>(url)
      .then((data) => {
        setRankings(data.rankings);
        setMaxMatchesWithResults(data.maxMatchesWithResults);
      })
      .catch((err) => {
        console.error('Failed to fetch rankings:', err);
        setError('Failed to load rankings');
      })
      .finally(() => setLoading(false));
  }, [cutoffMatchNumber]);

  const maxPossibleScore = rankings.length > 0 ? rankings[0].maxPossibleScore : 0;

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Rankings</h1>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Show ranking after</span>
        <select
          value={cutoffMatchNumber ?? ''}
          onChange={(e) => setCutoffMatchNumber(e.target.value ? parseInt(e.target.value) : null)}
          style={{ padding: '0.5rem', fontSize: '1rem' }}
        >
          <option value="">all</option>
          {Array.from({ length: maxMatchesWithResults }, (_, i) => i + 1).map((matchNum) => (
            <option key={matchNum} value={matchNum}>
              {matchNum}
            </option>
          ))}
        </select>
        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>matches</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Current max points: {maxPossibleScore}
      </p>

      {error && <div style={{ color: '#cc0000', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p>Loading rankings...</p>
      ) : rankings.length === 0 ? (
        <p>No rankings available.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 'bold' }}>Rank</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 'bold' }}>Name</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>Group</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>R32</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>R16</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>QF</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>SF</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>Final</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>3rd</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>Winner</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>Total</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem' }}>Winner</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((user) => {
                // Find rank: count how many users have a higher score, then add 1
                const rank = 1 + rankings.filter((u) => u.totalScore > user.totalScore).length;
                const isLoggedInUser = user.first_name === localStorage.getItem('firstName') &&
                                       user.last_name === localStorage.getItem('lastName');
                const isGoldUser = user.first_name === 'Martin' && user.last_name === 'Gjerstad';
                return (
                  <tr key={user.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem', textAlign: 'left' }}>{rank}</td>
                    <td className={isGoldUser ? 'user-gold' : ''} style={{ padding: '0.5rem', textAlign: 'left', fontWeight: isLoggedInUser ? 'bold' : 'normal' }}>
                      {user.first_name} {user.last_name}{user.paymentStatus === 'NO' ? '*' : ''}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.groupStageScore}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.r32Score + user.advancementScore}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.r16Score}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.qfScore}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.sfScore}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.finalScore}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.thirdPlaceScore}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.winnerScore}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--accent)' }}>
                      {user.totalScore}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.9rem', textDecoration: user.koWinnerActive === false ? 'line-through' : 'none' }}>
                      {user.koWinner || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem' }}>
            * Not entering the paid competition
          </p>
        </>
      )}
    </div>
  );
}

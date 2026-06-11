import { useState, useEffect } from 'react';
import { get } from '../api/client';

interface UserRanking {
  user_id: string;
  first_name: string;
  last_name: string;
  groupStageScore: number;
  r32Score: number;
  r16Score: number;
  qfScore: number;
  sfScore: number;
  finalScore: number;
  thirdPlaceScore: number;
  winnerScore: number;
  totalScore: number;
  maxPossibleScore: number;
}

export default function RankingPage() {
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    get<UserRanking[]>('/ranking')
      .then(setRankings)
      .catch((err) => {
        console.error('Failed to fetch rankings:', err);
        setError('Failed to load rankings');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Rankings</h1>

      {error && <div style={{ color: '#cc0000', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p>Loading rankings...</p>
      ) : rankings.length === 0 ? (
        <p>No rankings available.</p>
      ) : (
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
              <th style={{ textAlign: 'right', padding: '0.5rem', fontWeight: 'bold', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Max</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((user) => {
              // Find rank: count how many users have a higher score, then add 1
              const rank = 1 + rankings.filter((u) => u.totalScore > user.totalScore).length;
              const isLoggedInUser = user.first_name === localStorage.getItem('firstName') &&
                                     user.last_name === localStorage.getItem('lastName');
              return (
                <tr key={user.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.5rem', textAlign: 'left' }}>{rank}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'left', fontWeight: isLoggedInUser ? 'bold' : 'normal' }}>
                    {user.first_name} {user.last_name}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.groupStageScore}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.r32Score}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.r16Score}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.qfScore}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.sfScore}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.finalScore}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.thirdPlaceScore}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.winnerScore}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--accent)' }}>
                    {user.totalScore}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {user.maxPossibleScore}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

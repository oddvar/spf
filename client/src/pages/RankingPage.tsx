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
  r16BonusScore: number;
  qfScore: number;
  qfBonusScore: number;
  sfScore: number;
  sfBonusScore: number;
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
  const [cutoffMatchNumber, setCutoffMatchNumber] = useState<number | null | string>('all');
  const [oddvarR32TeamCount, setOddvarR32TeamCount] = useState(0);
  const [groupStageMaxPoints, setGroupStageMaxPoints] = useState(0);
  const [oddvarR16TeamCount, setOddvarR16TeamCount] = useState(0);
  const [oddvarQFTeamCount, setOddvarQFTeamCount] = useState(0);
  const [oddvarSFTeamCount, setOddvarSFTeamCount] = useState(0);

  useEffect(() => {
    // Log event when page loads
    post('/events/log', {
      event_type: 'ranking_page_loaded',
      description: 'User loaded the ranking page',
    }).catch(() => {
      // Silently fail if event logging fails
    });

    // Fetch oddvar's r32 teams to calculate max advancement points
    get<any>('/knockout/oddvar-r32')
      .then((data) => {
        if (data.r32Predictions) {
          const teams = new Set<string>();
          for (const m of data.r32Predictions) {
            if (m.home_team && m.home_team !== '?') teams.add(m.home_team);
            if (m.away_team && m.away_team !== '?') teams.add(m.away_team);
          }
          setOddvarR32TeamCount(teams.size);
        }
      })
      .catch(() => {
        // Silently fail
      });

    // Fetch oddvar's r16 teams to calculate max r16 bonus points
    get<any>('/knockout/oddvar-r16')
      .then((data) => {
        if (data.r16Predictions) {
          const teams = new Set<string>();
          for (const m of data.r16Predictions) {
            if (m.home_team && m.home_team !== '?') teams.add(m.home_team);
            if (m.away_team && m.away_team !== '?') teams.add(m.away_team);
          }
          setOddvarR16TeamCount(teams.size);
        }
      })
      .catch(() => {
        // Silently fail
      });

    // Fetch oddvar's qf teams to calculate max qf bonus points
    get<any>('/knockout/oddvar-qf')
      .then((data) => {
        if (data.qfPredictions) {
          const teams = new Set<string>();
          for (const m of data.qfPredictions) {
            if (m.home_team && m.home_team !== '?') teams.add(m.home_team);
            if (m.away_team && m.away_team !== '?') teams.add(m.away_team);
          }
          setOddvarQFTeamCount(teams.size);
        }
      })
      .catch(() => {
        // Silently fail
      });

    // Fetch oddvar's sf teams to calculate max sf bonus points
    get<any>('/knockout/oddvar-sf')
      .then((data) => {
        if (data.sfPredictions) {
          const teams = new Set<string>();
          for (const m of data.sfPredictions) {
            if (m.home_team && m.home_team !== '?') teams.add(m.home_team);
            if (m.away_team && m.away_team !== '?') teams.add(m.away_team);
          }
          setOddvarSFTeamCount(teams.size);
        }
      })
      .catch(() => {
        // Silently fail
      });
  }, []);

  useEffect(() => {
    // Log event when cutoff selection changes (skip logging on initial mount)
    post('/events/log', {
      event_type: 'ranking_cutoff_changed',
      description: `User selected ranking cutoff: ${cutoffMatchNumber}`,
    }).catch(() => {
      // Silently fail if event logging fails
    });
  }, [cutoffMatchNumber]);

  useEffect(() => {
    let url = '/ranking';
    if (cutoffMatchNumber) {
      url = `/ranking?cutoff=${encodeURIComponent(cutoffMatchNumber)}`;
    }
    setLoading(true);

    // When showing options that need additional data, fetch it
    const fetchData = async () => {
      try {
        const data = await get<{ rankings: UserRanking[]; maxMatchesWithResults: number; groupStageMaxPoints: number }>(url);
        setRankings(data.rankings);
        setMaxMatchesWithResults(data.maxMatchesWithResults);

        // If showing options that need group stage max, fetch group-only ranking
        if (cutoffMatchNumber === '' || cutoffMatchNumber === 'all+r32' || cutoffMatchNumber === 'all+r32+r16' || cutoffMatchNumber === 'qf+r16+r32+group' || cutoffMatchNumber === 'sf+qf+r16+r32+group' || cutoffMatchNumber === 'f+sf+qf+r16+r32+group' || cutoffMatchNumber === 'all') {
          const groupData = await get<{ groupStageMaxPoints: number }>('/ranking');
          setGroupStageMaxPoints(groupData.groupStageMaxPoints);
        } else {
          setGroupStageMaxPoints(data.groupStageMaxPoints);
        }
      } catch (err) {
        console.error('Failed to fetch rankings:', err);
        setError('Failed to load rankings');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [cutoffMatchNumber]);

  const maxPossibleScore = rankings.length > 0 ? rankings[0].maxPossibleScore : 0;

  const getMaxPointsDisplay = () => {
    if (cutoffMatchNumber === '' && groupStageMaxPoints > 0) {
      // Group only
      return `${groupStageMaxPoints}`;
    }
    if (cutoffMatchNumber === 'all' && rankings.length > 0 && groupStageMaxPoints > 0) {
      // Display group stage max + r32 advancement max + r16 bonus max + QF bonus max + SF bonus max
      const r32AdvancementMax = oddvarR32TeamCount * 2;
      const r16BonusMax = oddvarR16TeamCount * 3;
      const qfBonusMax = oddvarQFTeamCount * 4;
      const sfBonusMax = oddvarSFTeamCount * 5;
      const total = groupStageMaxPoints + r32AdvancementMax + r16BonusMax + qfBonusMax + sfBonusMax;
      return `${groupStageMaxPoints}+${r32AdvancementMax}+${r16BonusMax}+${qfBonusMax}+${sfBonusMax}=${total}`;
    }
    if (cutoffMatchNumber === 'qf+r16+r32+group' && rankings.length > 0 && groupStageMaxPoints > 0) {
      // Display group stage max + r32 advancement max + r16 bonus max + QF bonus max
      const r32AdvancementMax = oddvarR32TeamCount * 2;
      const r16BonusMax = oddvarR16TeamCount * 3;
      const qfBonusMax = oddvarQFTeamCount * 4;
      const total = groupStageMaxPoints + r32AdvancementMax + r16BonusMax + qfBonusMax;
      return `${groupStageMaxPoints}+${r32AdvancementMax}+${r16BonusMax}+${qfBonusMax}=${total}`;
    }
    if (cutoffMatchNumber === 'sf+qf+r16+r32+group' && rankings.length > 0 && groupStageMaxPoints > 0) {
      // Display group stage max + r32 advancement max + r16 bonus max + QF bonus max + SF bonus max
      const r32AdvancementMax = oddvarR32TeamCount * 2;
      const r16BonusMax = oddvarR16TeamCount * 3;
      const qfBonusMax = oddvarQFTeamCount * 4;
      const sfBonusMax = oddvarSFTeamCount * 5;
      const total = groupStageMaxPoints + r32AdvancementMax + r16BonusMax + qfBonusMax + sfBonusMax;
      return `${groupStageMaxPoints}+${r32AdvancementMax}+${r16BonusMax}+${qfBonusMax}+${sfBonusMax}=${total}`;
    }
    if (cutoffMatchNumber === 'f+sf+qf+r16+r32+group' && rankings.length > 0 && groupStageMaxPoints > 0) {
      // Display group stage max + r32 advancement max + r16 bonus max + QF bonus max + SF bonus max + Final + 3rd place + Winner
      const r32AdvancementMax = oddvarR32TeamCount * 2;
      const r16BonusMax = oddvarR16TeamCount * 3;
      const qfBonusMax = oddvarQFTeamCount * 4;
      const sfBonusMax = oddvarSFTeamCount * 5;
      const finalMax = 6;
      const thirdPlaceMax = 7;
      const winnerMax = 15;
      const total = groupStageMaxPoints + r32AdvancementMax + r16BonusMax + qfBonusMax + sfBonusMax + finalMax + thirdPlaceMax + winnerMax;
      return `${groupStageMaxPoints}+${r32AdvancementMax}+${r16BonusMax}+${qfBonusMax}+${sfBonusMax}+${finalMax}+${thirdPlaceMax}+${winnerMax}=${total}`;
    }
    if (cutoffMatchNumber === 'all+r32+r16' && rankings.length > 0 && groupStageMaxPoints > 0) {
      // Display group stage max + r32 advancement max + r16 bonus max
      const r32AdvancementMax = oddvarR32TeamCount * 2;
      const r16BonusMax = oddvarR16TeamCount * 3;
      const total = groupStageMaxPoints + r32AdvancementMax + r16BonusMax;
      return `${groupStageMaxPoints}+${r32AdvancementMax}+${r16BonusMax}=${total}`;
    }
    if (cutoffMatchNumber === 'all+r32' && rankings.length > 0 && groupStageMaxPoints > 0) {
      // Display group stage max + r32 advancement max
      const r32AdvancementMax = oddvarR32TeamCount * 2;
      const total = groupStageMaxPoints + r32AdvancementMax;
      return `${groupStageMaxPoints}+${r32AdvancementMax}=${total}`;
    }
    return maxPossibleScore.toString();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Rankings</h1>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Show ranking after</span>
        <select
          value={cutoffMatchNumber ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '') setCutoffMatchNumber(null);
            else if (val === 'all') setCutoffMatchNumber('all');
            else if (val === 'all+r32') setCutoffMatchNumber('all+r32');
            else if (val === 'all+r32+r16') setCutoffMatchNumber('all+r32+r16');
            else if (val === 'qf+r16+r32+group') setCutoffMatchNumber('qf+r16+r32+group');
            else if (val === 'sf+qf+r16+r32+group') setCutoffMatchNumber('sf+qf+r16+r32+group');
            else if (val === 'f+sf+qf+r16+r32+group') setCutoffMatchNumber('f+sf+qf+r16+r32+group');
            else setCutoffMatchNumber(parseInt(val));
          }}
          style={{ padding: '0.5rem', fontSize: '1rem' }}
        >
          <option value="all">all</option>
          <option value="">group</option>
          <option value="all+r32">group and r32</option>
          <option value="all+r32+r16">group, r32 and r16</option>
          <option value="qf+r16+r32+group">group, r32, r16 and qf</option>
          <option value="sf+qf+r16+r32+group">group, r32, r16, qf and sf</option>
          <option value="f+sf+qf+r16+r32+group">group, r32, r16, qf, sf and final</option>
          {Array.from({ length: maxMatchesWithResults }, (_, i) => i + 1).map((matchNum) => (
            <option key={matchNum} value={matchNum}>
              {matchNum}
            </option>
          ))}
        </select>
        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>matches</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Current max points: {getMaxPointsDisplay()}
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
                    <td className={isGoldUser ? 'user-gold' : ''} style={{ padding: '0.5rem', textAlign: 'left', fontWeight: isLoggedInUser ? 'bold' : 'normal', fontSize: isLoggedInUser ? '0.95rem' : '0.9rem' }}>
                      {user.first_name} {user.last_name}{user.paymentStatus === 'NO' ? '*' : ''}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.groupStageScore}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{user.r32Score + user.advancementScore}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {(cutoffMatchNumber === 'all' || cutoffMatchNumber === 'all+r32+r16' || cutoffMatchNumber === 'qf+r16+r32+group' || cutoffMatchNumber === 'sf+qf+r16+r32+group') ? user.r16Score + user.r16BonusScore : user.r16Score}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {(cutoffMatchNumber === 'all' || cutoffMatchNumber === 'qf+r16+r32+group' || cutoffMatchNumber === 'sf+qf+r16+r32+group') ? user.qfScore + user.qfBonusScore : user.qfScore}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                      {(cutoffMatchNumber === 'all' || cutoffMatchNumber === 'sf+qf+r16+r32+group') ? user.sfScore + user.sfBonusScore : user.sfScore}
                    </td>
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

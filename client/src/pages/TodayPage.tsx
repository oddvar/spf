import { useState, useEffect } from 'react';
import { get, post } from '../api/client';
import { VENUE_LINKS } from '../utils/venues';

interface UserPrediction {
  user_id: string;
  first_name: string;
  last_name: string;
  prediction: 'H' | 'A' | 'D' | null;
}

interface Match {
  id: number;
  match_number: number | null;
  ko_number: number | null;
  home_team: string;
  away_team: string;
  match_datetime: string;
  location: string | null;
  stage: string | null;
  result: 'H' | 'D' | 'A' | null;
  predictions: UserPrediction[];
  nextStageInfo?: {
    nextStagePredictions: {
      home: UserPrediction[];
      away: UserPrediction[];
    };
  };
  resolvedHomeTeam?: string;
  resolvedAwayTeam?: string;
}

export default function TodayPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Log event when page loads
    post('/events/log', {
      event_type: 'today_page_loaded',
      description: 'User loaded the next matches page',
    }).catch(() => {
      // Silently fail if event logging fails
    });
  }, []);

  useEffect(() => {
    const findNextDateWithMatches = async () => {
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() + i);
        const dateStr = checkDate.toLocaleDateString('en-CA');
        try {
          const matchesForDate = await get<Match[]>(`/today?date=${dateStr}`);
          if (matchesForDate.length > 0) {
            setDate(dateStr);
            return;
          }
        } catch {
          // Continue searching
        }
      }
    };
    findNextDateWithMatches();
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    get<Match[]>(`/today?date=${date}`)
      .then(setMatches)
      .catch((err) => {
        console.error('Failed to fetch matches:', err);
        setError('Failed to load matches');
      })
      .finally(() => setLoading(false));
  }, [date]);

  const matchTime = (datetime: string) => {
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimeZone,
    });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Next match{matches.length !== 1 ? 'es' : ''}</h1>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Select Date:
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }}
        />
      </div>

      {error && <div style={{ color: '#cc0000', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p>Loading matches...</p>
      ) : matches.length === 0 ? (
        <p>No matches scheduled for this date.</p>
      ) : (
        <div>
          {matches.map((match) => (
            <div
              key={match.id}
              style={{
                marginBottom: '2rem',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1.5rem',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  {match.stage === 'r32' ? 'Round of 32' : match.stage === 'r16' ? 'Round of 16' : match.stage === 'qf' ? 'Quarter-final' : match.stage === 'sf' ? 'Semi-final' : match.stage === 'f' ? 'Final' : match.stage === 'tp' ? 'Third place playoff' : 'Group Stage'} • {matchTime(match.match_datetime)}
                  {match.location && (
                    <>
                      {' • '}
                      {VENUE_LINKS[match.location] ? (
                        <a href={VENUE_LINKS[match.location]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                          {match.location}
                        </a>
                      ) : (
                        match.location
                      )}
                    </>
                  )}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {match.resolvedHomeTeam ? match.resolvedHomeTeam : match.home_team} <span style={{ color: 'var(--text-secondary)' }}>vs</span> {match.resolvedAwayTeam ? match.resolvedAwayTeam : match.away_team}
                  {match.result && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      ({match.result === 'H' ? 'Home win' : match.result === 'D' ? 'Draw' : 'Away win'})
                    </span>
                  )}
                </div>
              </div>

              {(() => {
                const homeTeam = match.resolvedHomeTeam || match.home_team;
                const awayTeam = match.resolvedAwayTeam || match.away_team;
                const bothTeamsUnknown = homeTeam === '?' && awayTeam === '?';
                const homeTeamKnown = homeTeam !== '?';
                const awayTeamKnown = awayTeam !== '?';

                if (bothTeamsUnknown) {
                  return <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Teams not yet known</p>;
                }

                if (match.predictions.length === 0) {
                  return <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No predictions yet</p>;
                }

                if (match.match_number) {
                  // Group stage match: show only predictions for known teams
                  const validPredTypes = (
                    homeTeamKnown && awayTeamKnown ? ['H', 'D', 'A'] :
                    homeTeamKnown ? ['H'] :
                    awayTeamKnown ? ['A'] :
                    []
                  ) as ('H' | 'D' | 'A')[];

                  if (validPredTypes.length === 0) {
                    return <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No predictions yet</p>;
                  }

                  const gridCols = validPredTypes.length === 1 ? '1fr' : validPredTypes.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr';

                  return (
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                        {match.predictions.length} prediction{match.predictions.length !== 1 ? 's' : ''}:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '1rem' }}>
                        {validPredTypes.map((predType) => {
                          const predictions = match.predictions
                            .filter((p) => p.prediction === predType)
                            .sort((a, b) => a.last_name.localeCompare(b.last_name));
                          return (
                            <div key={predType}>
                              <div
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  color: 'var(--text-secondary)',
                                  marginBottom: '0.5rem',
                                  paddingBottom: '0.5rem',
                                  borderBottom: '2px solid var(--border)',
                                }}
                              >
                                {predType === 'H' ? 'Home' : predType === 'D' ? 'Draw' : 'Away'} ({predictions.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                                {predictions.length === 0 ? (
                                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>—</span>
                                ) : (
                                  predictions.map((pred) => {
                                    const isLoggedInUser = pred.first_name === localStorage.getItem('firstName') &&
                                                           pred.last_name === localStorage.getItem('lastName');
                                    const isGoldUser = pred.first_name === 'Martin' && pred.last_name === 'Gjerstad';
                                    return (
                                      <div
                                        key={pred.user_id}
                                        className={isGoldUser ? 'user-gold' : ''}
                                        style={{
                                          fontSize: '0.75rem',
                                          fontWeight: isLoggedInUser ? 'bold' : 'normal',
                                        }}
                                      >
                                        {pred.first_name} {pred.last_name}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
              {!match.match_number && ((() => {
                const homeTeam = match.resolvedHomeTeam || match.home_team;
                const awayTeam = match.resolvedAwayTeam || match.away_team;
                return homeTeam === '?' && awayTeam === '?';
              })() ? null : match.nextStageInfo ? (
                // Knockout match: show users who have the advancing team in next stage (only if team is known)
                (() => {
                  const homeTeam = match.resolvedHomeTeam || match.home_team;
                  const awayTeam = match.resolvedAwayTeam || match.away_team;
                  const homeTeamKnown = homeTeam && homeTeam !== '?';
                  const awayTeamKnown = awayTeam && awayTeam !== '?';

                  if (!homeTeamKnown && !awayTeamKnown) {
                    return <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Teams not yet decided</p>;
                  }

                  return (
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                        {(!homeTeamKnown || !awayTeamKnown) ? 'Users with advancing team in next stage (where teams are decided):' : 'Users with advancing team in next stage:'}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.5rem',
                              paddingBottom: '0.5rem',
                              borderBottom: '2px solid var(--border)',
                            }}
                          >
                            Home {!homeTeamKnown && '(not yet decided)'} ({homeTeamKnown ? match.nextStageInfo.nextStagePredictions.home.length : 0})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {!homeTeamKnown ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Team not yet decided</span>
                            ) : match.nextStageInfo.nextStagePredictions.home.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>—</span>
                            ) : (
                              [...match.nextStageInfo.nextStagePredictions.home]
                                .sort((a, b) => a.last_name.localeCompare(b.last_name))
                                .map((pred) => {
                                  const isLoggedInUser = pred.first_name === localStorage.getItem('firstName') &&
                                                         pred.last_name === localStorage.getItem('lastName');
                                  return (
                                    <div
                                      key={pred.user_id}
                                      style={{
                                        fontSize: '0.75rem',
                                        fontWeight: isLoggedInUser ? 'bold' : 'normal',
                                      }}
                                    >
                                      {pred.first_name} {pred.last_name}
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.5rem',
                              paddingBottom: '0.5rem',
                              borderBottom: '2px solid var(--border)',
                            }}
                          >
                            Away {!awayTeamKnown && '(not yet decided)'} ({awayTeamKnown ? match.nextStageInfo.nextStagePredictions.away.length : 0})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {!awayTeamKnown ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Team not yet decided</span>
                            ) : match.nextStageInfo.nextStagePredictions.away.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>—</span>
                            ) : (
                              [...match.nextStageInfo.nextStagePredictions.away]
                                .sort((a, b) => a.last_name.localeCompare(b.last_name))
                                .map((pred) => {
                                  const isLoggedInUser = pred.first_name === localStorage.getItem('firstName') &&
                                                         pred.last_name === localStorage.getItem('lastName');
                                  return (
                                    <div
                                      key={pred.user_id}
                                      style={{
                                        fontSize: '0.75rem',
                                        fontWeight: isLoggedInUser ? 'bold' : 'normal',
                                      }}
                                    >
                                      {pred.first_name} {pred.last_name}
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()

              ) : match.ko_number && (!match.resolvedHomeTeam || !match.resolvedAwayTeam) ? (
                // Knockout match with unresolved teams: don't show predictions
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>The teams in this match have not yet been decided</p>
              ) : (() => {
                const homeTeam = match.resolvedHomeTeam || match.home_team;
                const awayTeam = match.resolvedAwayTeam || match.away_team;
                return homeTeam === '?' && awayTeam === '?';
              })() ? null : match.stage === 'r16' ? null : (
                // Knockout match fallback: show in two columns (H, A)
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                    {match.predictions.length} prediction{match.predictions.length !== 1 ? 's' : ''}:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {(['H', 'A'] as const).map((predType) => {
                      const predictions = match.predictions
                        .filter((p) => p.prediction === predType)
                        .sort((a, b) => a.last_name.localeCompare(b.last_name));
                      return (
                        <div key={predType}>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              color: 'var(--text-secondary)',
                              marginBottom: '0.5rem',
                              paddingBottom: '0.5rem',
                              borderBottom: '2px solid var(--border)',
                            }}
                          >
                            {predType === 'H' ? 'Home' : 'Away'} ({predictions.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            {predictions.length === 0 ? (
                              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>—</span>
                            ) : (
                              predictions.map((pred) => {
                                const isLoggedInUser = pred.first_name === localStorage.getItem('firstName') &&
                                                       pred.last_name === localStorage.getItem('lastName');
                                const isGoldUser = pred.first_name === 'Martin' && pred.last_name === 'Gjerstad';
                                return (
                                  <div
                                    key={pred.user_id}
                                    className={isGoldUser ? 'user-gold' : ''}
                                    style={{
                                      fontSize: '0.75rem',
                                      fontWeight: isLoggedInUser ? 'bold' : 'normal',
                                    }}
                                  >
                                    {pred.first_name} {pred.last_name}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

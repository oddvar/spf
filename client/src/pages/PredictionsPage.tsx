import { useState, useEffect, useTransition } from 'react';
import { post } from '../api/client';

type Prediction = 'H' | 'D' | 'A';
type SortMode = 'group' | 'date';

interface Match {
  id: number;
  match_number: number;
  group_name: string;
  home_team: string;
  away_team: string;
  match_date: string;
  prediction: Prediction | null;
}

const LABELS: Record<Prediction, string> = { H: 'Home', D: 'Draw', A: 'Away' };

export default function PredictionsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/matches', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` },
    })
      .then((r) => r.json())
      .then((data: Match[]) => {
        setMatches(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load matches');
        setLoading(false);
      });
  }, []);

  function predict(matchId: number, prediction: Prediction) {
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, prediction } : m)));
    setSavingId(matchId);
    startTransition(async () => {
      try {
        await post(`/predictions/${matchId}`, { prediction });
      } catch {
        setMatches((prev) =>
          prev.map((m) => (m.id === matchId ? { ...m, prediction: m.prediction } : m)),
        );
      } finally {
        setSavingId(null);
      }
    });
  }

  if (loading) return <div className="predictions-loading">Loading matches…</div>;
  if (error) return <div className="predictions-loading">{error}</div>;

  const sections =
    sortMode === 'group'
      ? groupBy(matches, (m) => m.group_name, (k) => `Group ${k}`, (a, b) => a.match_number - b.match_number)
      : groupBy(matches, (m) => m.match_date.slice(0, 10), formatDateHeading, (a, b) => a.match_number - b.match_number);

  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <div>
          <h1>Group Stage Predictions</h1>
          <p className="predictions-subtitle">
            Pick <strong>H</strong>ome win, <strong>D</strong>raw, or <strong>A</strong>way win for each match.
          </p>
        </div>
        <div className="sort-toggle" role="group" aria-label="Sort matches by">
          <button
            className={`sort-btn${sortMode === 'group' ? ' sort-btn--active' : ''}`}
            onClick={() => setSortMode('group')}
          >
            By group
          </button>
          <button
            className={`sort-btn${sortMode === 'date' ? ' sort-btn--active' : ''}`}
            onClick={() => setSortMode('date')}
          >
            By date
          </button>
        </div>
      </div>

      {sections.map(({ key, heading, items }) => (
        <section key={key} className="group-section">
          <h2 className="group-heading">{heading}</h2>
          <div className="match-list">
            {items.map((match) => (
              <div key={match.id} className="match-row">
                {sortMode === 'group' ? (
                  <span className="match-date">{formatDate(match.match_date)}</span>
                ) : (
                  <span className="match-date">Group {match.group_name}</span>
                )}
                <div className="match-teams">
                  <span className="team home">{match.home_team}</span>
                  <span className="vs">vs</span>
                  <span className="team away">{match.away_team}</span>
                </div>
                <div className="prediction-btns" aria-label={`Prediction for ${match.home_team} vs ${match.away_team}`}>
                  {(['H', 'D', 'A'] as Prediction[]).map((p) => (
                    <button
                      key={p}
                      className={`pred-btn${match.prediction === p ? ' pred-btn--selected' : ''}`}
                      onClick={() => predict(match.id, p)}
                      disabled={savingId === match.id && isPending}
                      aria-pressed={match.prediction === p}
                      title={LABELS[p]}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function groupBy(
  matches: Match[],
  keyFn: (m: Match) => string,
  headingFn: (key: string) => string,
  sortFn: (a: Match, b: Match) => number,
): { key: string; heading: string; items: Match[] }[] {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const k = keyFn(m);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(m);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({ key, heading: headingFn(key), items: [...items].sort(sortFn) }));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDateHeading(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

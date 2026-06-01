import { useState, useEffect, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put, ApiError } from '../api/client';

type Prediction = 'H' | 'D' | 'A';
type SortMode = 'group' | 'date';

interface Match {
  id: number;
  match_number: number;
  group_name: string;
  home_team: string;
  away_team: string;
  match_datetime: string; // UTC ISO 8601
  location: string | null;
  prediction: Prediction | null;
}

const LABELS: Record<Prediction, string> = { H: 'Home', D: 'Draw', A: 'Away' };


export default function PredictionsPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>(
    () => (localStorage.getItem('sortMode') as SortMode | null) ?? 'date',
  );

  function updateSortMode(mode: SortMode) {
    setSortMode(mode);
    localStorage.setItem('sortMode', mode);
  }
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    get<{ matches: Match[]; canEdit: boolean }>('/matches')
      .then(({ matches, canEdit }) => {
        setMatches(matches);
        setCanEdit(canEdit);
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
        await put(`/predictions/${matchId}`, { prediction });
      } catch (err) {
        setMatches((prev) =>
          prev.map((m) => (m.id === matchId ? { ...m, prediction: m.prediction } : m)),
        );
        if (err instanceof ApiError && err.status === 403) {
          setSaveError('The deadline for submitting predictions has now passed.');
          setCanEdit(false);
        }
      } finally {
        setSavingId(null);
      }
    });
  }

  const firstName = localStorage.getItem('firstName') ?? '';
  const lastName = localStorage.getItem('lastName') ?? '';

  if (loading) return <div className="predictions-loading">Loading matches…</div>;
  if (error) return <div className="predictions-loading">{error}</div>;

  const sections =
    sortMode === 'group'
      ? groupBy(
          matches,
          (m) => m.group_name,
          (k) => `Group ${k}`,
          (a, b) => a.match_number - b.match_number,
        )
      : groupBy(
          matches,
          (m) => localDateKey(m.match_datetime),
          (key) => localDateHeading(key),
          (a, b) => new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime(),
        );

  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <div>
          <p className="predictions-greeting">Hello, {firstName} {lastName}</p>
          <h1>Group Stage Predictions</h1>
          <p className="predictions-subtitle">
            Pick <strong>H</strong>ome win, <strong>D</strong>raw, or <strong>A</strong>way win for each match. Please note that changing these predictions will reset the best thirds selections on the next page.
          </p>
        </div>
        <div className="sort-toggle" role="group" aria-label="Sort matches by">
          <button
            className={`sort-btn${sortMode === 'group' ? ' sort-btn--active' : ''}`}
            onClick={() => updateSortMode('group')}
          >
            By group
          </button>
          <button
            className={`sort-btn${sortMode === 'date' ? ' sort-btn--active' : ''}`}
            onClick={() => updateSortMode('date')}
          >
            By date
          </button>
        </div>
      </div>

      {saveError && <p className="form-error">{saveError}</p>}

      {(() => {
        const predicted = matches.filter((m) => m.prediction !== null).length;
        const total = matches.length;
        const allDone = predicted === total;
        return (
          <div className="predictions-progress">
            <span className="predictions-count">{predicted} / {total} predicted</span>
            <button className="btn-primary" disabled={!allDone} onClick={() => navigate('/best-thirds')}>
              Next
            </button>
          </div>
        );
      })()}

      {sections.map(({ key, heading, items }) => (
        <section key={key} className="group-section">
          <h2 className="group-heading">{heading}</h2>
          <div className="match-list">
            {items.map((match) => (
              <div key={match.id} className="match-row">
                <div className="match-meta">
                  {sortMode === 'group' ? (
                    <span className="match-date">{formatDate(match.match_datetime)}</span>
                  ) : (
                    <span className="match-date">Group {match.group_name}</span>
                  )}
                  <span className="match-time">{formatTime(match.match_datetime)}</span>
                </div>
                <div className="match-teams">
                  <span className="team home">{match.home_team}</span>
                  <span className="vs">vs</span>
                  <span className="team away">{match.away_team}</span>
                  {match.location && (
                    <span className="match-location">{match.location}</span>
                  )}
                </div>
                <div className="prediction-btns" aria-label={`Prediction for ${match.home_team} vs ${match.away_team}`}>
                  {canEdit ? (
                    (['H', 'D', 'A'] as Prediction[]).map((p) => (
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
                    ))
                  ) : (
                    match.prediction
                      ? <span className="pred-readonly">{match.prediction}</span>
                      : <span className="pred-readonly pred-readonly--empty">—</span>
                  )}
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

// Returns "YYYY-MM-DD" in the user's local timezone
function localDateKey(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString('en-CA');
}

function localDateHeading(key: string): string {
  // Parse as local noon to avoid any DST edge cases at midnight
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

// Date shown in the left column (by group mode) — user's local timezone
function formatDate(isoUtc: string): string {
  return new Date(isoUtc).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Kickoff time in the user's detected timezone
function formatTime(isoUtc: string): string {
  return new Date(isoUtc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

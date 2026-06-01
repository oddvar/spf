import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put } from '../api/client';
import { calcStandings, type GroupMatch } from '../utils/standings';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
const REQUIRED = 8;

interface Match extends GroupMatch {
  id: number;
  match_number: number;
  match_datetime: string;
}

export default function BestThirdsPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [selections, setSelections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      get<{ matches: Match[]; canEdit: boolean }>('/matches'),
      get<{ selections: string[] }>('/best-thirds'),
    ]).then(([{ matches }, { selections }]) => {
      setMatches(matches);
      setSelections(new Set(selections));
      setLoading(false);
    });
  }, []);

  async function toggle(group: string) {
    const next = new Set(selections);
    if (next.has(group)) {
      next.delete(group);
    } else {
      if (next.size >= REQUIRED) return;
      next.add(group);
    }
    setSelections(next);
    setSaving(true);
    try {
      await put('/best-thirds', { selections: Array.from(next) });
    } finally {
      setSaving(false);
    }
  }

  const count = selections.size;
  const allDone = count === REQUIRED;

  // Determine which groups' 3rd-place teams are eligible (top 8 by points)
  const thirdPoints = new Map(GROUPS.map((g) => [g, calcStandings(matches, g)[2]?.points ?? 0]));
  const sortedThirdPoints = Array.from(thirdPoints.values()).sort((a, b) => b - a);
  const threshold = sortedThirdPoints[REQUIRED - 1] ?? 0;
  const eligibleGroups = new Set(GROUPS.filter((g) => (thirdPoints.get(g) ?? 0) >= threshold));

  if (loading) return <div className="predictions-loading">Loading…</div>;

  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <div>
          <p className="predictions-greeting">
            {localStorage.getItem('firstName')} {localStorage.getItem('lastName')}
          </p>
          <h1>Best Third-Placed Teams</h1>
          <p className="predictions-subtitle">
            Select the <strong>{REQUIRED}</strong> groups whose third-placed team will advance to the Round of 32.
            Click a third-place row to select it.
          </p>
        </div>
      </div>

      <div className="predictions-progress">
        <span className="predictions-count">{count} / {REQUIRED} selected</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => navigate('/predictions')}>
            Previous
          </button>
          <button className="btn-primary" disabled={!allDone} onClick={() => navigate('/knockout')}>
            Next
          </button>
        </div>
      </div>

      <div className="best-thirds-groups">
        {GROUPS.map((group) => {
          const standings = calcStandings(matches, group);
          const selected = selections.has(group);
          const eligible = eligibleGroups.has(group);
          const maxReached = !selected && count >= REQUIRED;
          return (
            <div key={group} className="group-standing">
              <h2 className="group-heading">Group {group}</h2>
              <table className="standing-table">
                <thead>
                  <tr>
                    <th className="st-pos"></th>
                    <th className="st-team">Team</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => {
                    const isThird = i === 2;
                    return (
                      <tr
                        key={s.team}
                        className={
                          isThird
                            ? eligible
                              ? `third-row${selected ? ' third-row--selected' : ''}${maxReached ? ' third-row--disabled' : ''}`
                              : 'non-qualifier-row'
                            : i < 2 ? 'qualifier-row' : 'non-qualifier-row'
                        }
                        onClick={isThird && eligible && !maxReached && !saving ? () => toggle(group) : undefined}
                        style={isThird && eligible && !maxReached ? { cursor: 'pointer' } : undefined}
                      >
                        <td className="st-pos">{i + 1}</td>
                        <td className="st-team">{s.team}</td>
                        <td>{s.played > 0 ? s.won : '—'}</td>
                        <td>{s.played > 0 ? s.drawn : '—'}</td>
                        <td>{s.played > 0 ? s.lost : '—'}</td>
                        <td className="st-pts">{s.played > 0 ? s.points : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

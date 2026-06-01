import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put } from '../api/client';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
const REQUIRED = 8;

type Prediction = 'H' | 'D' | 'A';

interface Match {
  id: number;
  match_number: number;
  group_name: string;
  home_team: string;
  away_team: string;
  match_datetime: string;
  prediction: Prediction | null;
}

interface Standing {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

function calcStandings(matches: Match[], group: string): Standing[] {
  const groupMatches = matches.filter((m) => m.group_name === group);
  const table = new Map<string, Standing>();

  for (const m of groupMatches) {
    for (const team of [m.home_team, m.away_team]) {
      if (!table.has(team)) table.set(team, { team, played: 0, won: 0, drawn: 0, lost: 0, points: 0 });
    }
    if (!m.prediction) continue;
    const home = table.get(m.home_team)!;
    const away = table.get(m.away_team)!;
    home.played++;
    away.played++;
    if (m.prediction === 'H') {
      home.won++; home.points += 3; away.lost++;
    } else if (m.prediction === 'D') {
      home.drawn++; home.points++; away.drawn++; away.points++;
    } else {
      away.won++; away.points += 3; home.lost++;
    }
  }

  return Array.from(table.values()).sort((a, b) => b.points - a.points || b.won - a.won);
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
        <div className="predictions-progress" style={{ border: 'none', padding: '0', marginBottom: '0' }}>
          <span className="predictions-count">{count} / {REQUIRED} selected</span>
          <button className="btn-primary" disabled={!allDone} onClick={() => navigate('/dashboard')}>
            Next
          </button>
        </div>
      </div>

      <div className="best-thirds-groups">
        {GROUPS.map((group) => {
          const standings = calcStandings(matches, group);
          const selected = selections.has(group);
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
                            ? `third-row${selected ? ' third-row--selected' : ''}${maxReached ? ' third-row--disabled' : ''}`
                            : i < 2 ? 'qualifier-row' : 'non-qualifier-row'
                        }
                        onClick={isThird && !maxReached && !saving ? () => toggle(group) : undefined}
                        style={isThird && !maxReached ? { cursor: 'pointer' } : undefined}
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

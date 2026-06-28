import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put, ApiError } from '../api/client';
import { orderedStandings, loadCustomOrders, type GroupMatch, type Standing, type CustomOrders } from '../utils/standings';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
const REQUIRED = 8;
const LS_KEY = (g: string) => `spf2026_order_${g}`;

interface Match extends GroupMatch {
  id: number;
  match_number: number;
  match_datetime: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
}

export default function BestThirdsPage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [selections, setSelections] = useState<Set<string>>(new Set());
  const [customOrders, setCustomOrders] = useState<CustomOrders>(() => loadCustomOrders());
  const [oddvarCustomOrders, setOddvarCustomOrders] = useState<CustomOrders>({});
  const [canEdit, setCanEdit] = useState(true);
  const [canViewOthers, setCanViewOthers] = useState(false);
  const [lockedMessage, setLockedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>(
    () => localStorage.getItem('selectedUserId') ?? '',
  );

  const updateSelectedUserId = (userId: string) => {
    setSelectedUserId(userId);
    localStorage.setItem('selectedUserId', userId);
  };

  useEffect(() => {
    get<{ can_view_others?: boolean }>('/settings')
      .then(({ can_view_others }) => {
        setCanViewOthers(!!can_view_others);
      })
      .catch(() => {
        // Silently fail
      });
  }, []);

  useEffect(() => {
    if (!canViewOthers) {
      return;
    }

    get<User[]>('/users/list')
      .then((usersList) => {
        const loggedInUserId = localStorage.getItem('userId') || '';
        const loggedInUser: User = {
          id: '',
          first_name: localStorage.getItem('firstName') || '',
          last_name: localStorage.getItem('lastName') || '',
        };
        const otherUsers = usersList.filter((u) => u.id !== loggedInUserId);

        // Add oddvar as a special reference user
        const oddvarUser: User = {
          id: 'oddvar@geheb.com',
          first_name: 'Correct',
          last_name: 'results',
        };

        setUsers([loggedInUser, ...otherUsers, oddvarUser]);
      })
      .catch(() => {
        console.error('Failed to fetch users');
      });
  }, [canViewOthers]);

  useEffect(() => {
    setLoading(true);
    if (selectedUserId) {
      // Fetch selected user's best-thirds
      get<{ selections: string[]; matches: Match[]; customOrders?: CustomOrders }>(`/users/${selectedUserId}/best-thirds`)
        .then(({ selections, matches, customOrders }) => {
          setMatches(matches);
          setSelections(new Set(selections));
          setCanEdit(false);
          setOddvarCustomOrders(customOrders || {});
          setLoading(false);
        })
        .catch(() => {
          console.error('Failed to fetch user best-thirds');
          setLoading(false);
        });
    } else {
      // Fetch own best-thirds
      setOddvarCustomOrders({});
      Promise.all([
        get<{ matches: Match[]; canEdit: boolean }>('/matches'),
        get<{ selections: string[] }>('/best-thirds'),
      ])
        .then(([{ matches, canEdit }, { selections }]) => {
          setMatches(matches);
          setCanEdit(canEdit);
          setSelections(new Set(selections));
          setLoading(false);
        })
        .catch(() => {
          console.error('Failed to fetch best-thirds');
          setLoading(false);
        });
    }
  }, [selectedUserId]);

  function getStandings(group: string): Standing[] {
    // Use oddvar's custom orders if viewing oddvar's predictions
    const orders = selectedUserId === 'oddvar@geheb.com' ? oddvarCustomOrders : customOrders;
    return orderedStandings(matches, group, orders);
  }

  async function moveTeam(group: string, standings: Standing[], idx: number, dir: 'up' | 'down') {
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= standings.length) return;
    if (standings[swapIdx].points !== standings[idx].points) return;

    const next = [...standings];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    const order = next.map((s) => s.team);

    localStorage.setItem(LS_KEY(group), JSON.stringify(order));
    setCustomOrders((prev) => ({ ...prev, [group]: order }));

    // Save to database
    try {
      await put(`/best-thirds/${group}/order`, { order });
    } catch (err) {
      console.error('Failed to save group order:', err);
    }
  }

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
    } catch (err) {
      setSelections(selections);
      if (err instanceof ApiError && err.status === 403) {
        setLockedMessage('The deadline for submitting selections has now passed.');
      }
    } finally {
      setSaving(false);
    }
  }

  const count = selections.size;
  const allDone = count === REQUIRED;
  const canNavigate = allDone || !!selectedUserId;

  // Determine which groups' 3rd-place teams are eligible (top 8 by points)
  const thirdPoints = new Map(GROUPS.map((g) => [g, getStandings(g)[2]?.points ?? 0]));
  const sortedThirdPoints = Array.from(thirdPoints.values()).sort((a, b) => b - a);
  const threshold = sortedThirdPoints[REQUIRED - 1] ?? 0;
  const eligibleGroups = new Set(GROUPS.filter((g) => (thirdPoints.get(g) ?? 0) >= threshold));

  if (loading) return <div className="predictions-loading">Loading…</div>;

  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <div>
          <h1>Group tables and best third-placed teams</h1>
          <p className="predictions-subtitle">
            These are the tables based on your group match predictions. Select the <strong>{REQUIRED}</strong> third-placed teams who will advance to the Round of 32.
            Click a third-place row to select it. Use ▲▼ to break ties. Please note that these selections will reset if you change your group stage predictions.
          </p>
        </div>
      </div>

      {canViewOthers && users.length > 0 && (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem 2rem', borderBottom: '1px solid var(--border)' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
            View selections for:
          </label>
          <select
            value={selectedUserId}
            onChange={(e) => updateSelectedUserId(e.target.value)}
            style={{ padding: '0.5rem', fontSize: '1rem', maxWidth: '300px' }}
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="predictions-progress">
        <span className="predictions-count">{count} / {REQUIRED} selected</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => navigate('/predictions')}>
            Previous
          </button>
          <button className="btn-primary" disabled={!canNavigate} onClick={() => navigate('/knockout')}>
            Next
          </button>
        </div>
      </div>

      {lockedMessage && <p className="form-error" style={{ marginBottom: '16px' }}>{lockedMessage}</p>}

      <div className="best-thirds-groups">
        {GROUPS.map((group) => {
          const standings = getStandings(group);
          const selected = selections.has(group);
          const eligible = eligibleGroups.has(group);
          const maxReached = !selected && count >= REQUIRED;
          const hasTies = standings.some((s, i) => i > 0 && s.points === standings[i - 1].points);

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
                    {hasTies && <th className="st-sort"></th>}
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => {
                    const isThird = i === 2;
                    const canMoveUp   = hasTies && i > 0 && standings[i - 1].points === s.points;
                    const canMoveDown = hasTies && i < standings.length - 1 && standings[i + 1].points === s.points;
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
                        onClick={isThird && eligible && canEdit && !maxReached && !saving ? () => toggle(group) : undefined}
                        style={isThird && eligible && canEdit && !maxReached ? { cursor: 'pointer' } : undefined}
                      >
                        <td className="st-pos">{i + 1}</td>
                        <td className="st-team">{s.team}</td>
                        <td>{s.played > 0 ? s.won : '—'}</td>
                        <td>{s.played > 0 ? s.drawn : '—'}</td>
                        <td>{s.played > 0 ? s.lost : '—'}</td>
                        <td className="st-pts">{s.played > 0 ? s.points : '—'}</td>
                        {hasTies && (
                          <td className="st-sort" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="sort-arrow"
                              disabled={!canMoveUp || !canEdit || !!selectedUserId}
                              onClick={() => moveTeam(group, standings, i, 'up')}
                              title="Move up"
                            >▲</button>
                            <button
                              className="sort-arrow"
                              disabled={!canMoveDown || !canEdit || !!selectedUserId}
                              onClick={() => moveTeam(group, standings, i, 'down')}
                              title="Move down"
                            >▼</button>
                          </td>
                        )}
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

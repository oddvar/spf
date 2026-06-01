import { useState, useEffect, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put, ApiError } from '../api/client';
import { resolveSlot, type GroupMatch } from '../utils/standings';

// ─── Layout constants ────────────────────────────────────────────────────────
const SLOT   = 64;   // px height per R32 slot
const BOX_H  = 48;   // px match box height (2 × 24 team rows)
const BOX_W  = 160;  // px match box width
const COL_GAP = 28;  // px column gap (holds connector lines)
const TOTAL_H = 16 * SLOT;                       // 1024px
const TOTAL_W = 5 * BOX_W + 4 * COL_GAP + 1;    // 941px

// Vertical centre of a match box
function boxCy(round: number, idx: number): number {
  const m = Math.pow(2, round);
  return (m * idx + m / 2) * SLOT;
}
function boxTop(round: number, idx: number): number {
  return boxCy(round, idx) - BOX_H / 2;
}
function boxLeft(round: number): number {
  return round * (BOX_W + COL_GAP);
}

// ─── R32 bracket order (top → bottom) ────────────────────────────────────────
// Derived from the official bracket:
//   ko3+ko6 → R16 match 0   ko1+ko4 → R16 match 1
//   ko2+ko5 → R16 match 2   ko7+ko8 → R16 match 3
//   ko12+ko11 → R16 match 4  ko10+ko9 → R16 match 5
//   ko15+ko14 → R16 match 6  ko13+ko16 → R16 match 7
const R32 = [3, 6, 1, 4, 2, 5, 7, 8, 12, 11, 10, 9, 15, 14, 13, 16];

// ─── Types ────────────────────────────────────────────────────────────────────
type KoPred = 'H' | 'A';

interface GroupMatchFull extends GroupMatch {
  id: number; match_number: number; match_datetime: string; location: string | null;
}

interface KoMatch {
  id: number; ko_number: number;
  home_team: string; away_team: string;
  match_datetime: string; location: string | null;
  prediction: KoPred | null;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function KnockoutPage() {
  const navigate = useNavigate();
  const [koMatches, setKoMatches] = useState<KoMatch[]>([]);
  const [groupMatches, setGroupMatches] = useState<GroupMatchFull[]>([]);
  const [bestThirds, setBestThirds] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      get<{ matches: KoMatch[]; canEdit: boolean }>('/knockout/matches'),
      get<{ matches: GroupMatchFull[]; canEdit: boolean }>('/matches'),
      get<{ selections: string[] }>('/best-thirds'),
    ]).then(([ko, group, thirds]) => {
      setKoMatches(ko.matches);
      setCanEdit(ko.canEdit);
      setGroupMatches(group.matches.filter((m) => m.group_name));
      setBestThirds(thirds.selections);
      setLoading(false);
    });
  }, []);

  function predict(matchId: number, pred: KoPred) {
    setKoMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, prediction: pred } : m)));
    setSavingId(matchId);
    startTransition(async () => {
      try {
        await put(`/knockout/${matchId}`, { prediction: pred });
      } catch (err) {
        setKoMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, prediction: m.prediction } : m)));
        if (err instanceof ApiError && err.status === 403) {
          setSaveError('The deadline for submitting predictions has now passed.');
          setCanEdit(false);
        }
      } finally {
        setSavingId(null);
      }
    });
  }

  const predicted = koMatches.filter((m) => m.prediction !== null).length;
  const allDone = predicted === koMatches.length && koMatches.length > 0;

  if (loading) return <div className="predictions-loading">Loading…</div>;

  // ── Name resolution helpers ────────────────────────────────────────────────
  function slot(s: string): string {
    return resolveSlot(s, groupMatches, bestThirds);
  }

  function r32Winner(koNum: number): string {
    const m = koMatches.find((x) => x.ko_number === koNum);
    if (!m?.prediction) return '?';
    return m.prediction === 'H' ? slot(m.home_team) : slot(m.away_team);
  }

  // Returns [homeTeam, awayTeam] for any bracket position
  function teams(round: number, idx: number): [string, string] {
    if (round === 0) {
      const m = koMatches.find((x) => x.ko_number === R32[idx]);
      return m ? [slot(m.home_team), slot(m.away_team)] : ['?', '?'];
    }
    if (round === 1) {
      return [r32Winner(R32[idx * 2]), r32Winner(R32[idx * 2 + 1])];
    }
    return ['?', '?'];
  }

  // ── SVG connector lines ────────────────────────────────────────────────────
  type Line = { x1: number; y1: number; x2: number; y2: number };
  const lines: Line[] = [];

  for (let r = 0; r < 4; r++) {
    const pairs = 8 / Math.pow(2, r); // pairs per round: 8,4,2,1
    const rx = boxLeft(r) + BOX_W;    // right edge of match boxes in this round
    const midX = rx + COL_GAP / 2;   // vertical line x
    const nx = boxLeft(r + 1);        // left edge of next round

    for (let p = 0; p < pairs; p++) {
      const cy0 = boxCy(r, p * 2);     // upper match centre
      const cy1 = boxCy(r, p * 2 + 1); // lower match centre
      const cyn = boxCy(r + 1, p);     // next-round match centre

      lines.push({ x1: rx, y1: cy0, x2: midX, y2: cy0 });  // H stub upper
      lines.push({ x1: rx, y1: cy1, x2: midX, y2: cy1 });  // H stub lower
      lines.push({ x1: midX, y1: cy0, x2: midX, y2: cy1 }); // V connector
      lines.push({ x1: midX, y1: cyn, x2: nx, y2: cyn });   // H to next match
    }
  }

  // ── Round labels ──────────────────────────────────────────────────────────
  const ROUND_LABELS = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <div>
          <p className="predictions-greeting">
            {localStorage.getItem('firstName')} {localStorage.getItem('lastName')}
          </p>
          <h1>Knockout Stage</h1>
          <p className="predictions-subtitle">
            Click a team to pick them as the winner. No draws in the knockout stage.
          </p>
        </div>
      </div>

      <div className="predictions-progress">
        <span className="predictions-count">{predicted} / {koMatches.length} predicted</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => navigate('/best-thirds')}>Previous</button>
          <button className="btn-primary" disabled={!allDone} onClick={() => navigate('/dashboard')}>Next</button>
        </div>
      </div>

      {saveError && <p className="form-error" style={{ marginBottom: '12px' }}>{saveError}</p>}

      {/* Round labels row */}
      <div style={{ position: 'relative', height: 24, marginBottom: 6, width: TOTAL_W }}>
        {ROUND_LABELS.map((lbl, r) => (
          <span
            key={r}
            style={{
              position: 'absolute',
              left: boxLeft(r),
              width: BOX_W,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text)',
            }}
          >
            {lbl}
          </span>
        ))}
      </div>

      {/* Bracket */}
      <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
        <div style={{ position: 'relative', width: TOTAL_W, height: TOTAL_H }}>

          {/* Connector SVG */}
          <svg
            style={{ position: 'absolute', inset: 0, width: TOTAL_W, height: TOTAL_H, pointerEvents: 'none' }}
            aria-hidden
          >
            {lines.map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                stroke="var(--border)" strokeWidth={1.5} />
            ))}
          </svg>

          {/* Match boxes – all 31 bracket slots */}
          {([0, 1, 2, 3, 4] as const).flatMap((round) => {
            const count = Math.max(1, 16 / Math.pow(2, round));
            return Array.from({ length: count }, (_, idx) => {
              const [home, away] = teams(round, idx);
              const koNum = round === 0 ? R32[idx] : undefined;
              const koMatch = koNum !== undefined ? koMatches.find((m) => m.ko_number === koNum) : undefined;
              const pred = koMatch?.prediction ?? null;
              const isSaving = savingId === koMatch?.id && isPending;

              return (
                <div
                  key={`${round}-${idx}`}
                  style={{
                    position: 'absolute',
                    top: boxTop(round, idx),
                    left: boxLeft(round),
                    width: BOX_W,
                    height: BOX_H,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  className="bracket-box"
                >
                  {/* Home row */}
                  <div
                    className={`bracket-team${pred === 'H' ? ' bracket-team--winner' : ''}${koMatch && canEdit ? ' bracket-team--clickable' : ''}`}
                    onClick={koMatch && canEdit && !isSaving ? () => predict(koMatch.id, 'H') : undefined}
                  >
                    <span className="bracket-team-name">{home}</span>
                    {pred === 'H' && <span className="bracket-check">✓</span>}
                  </div>
                  {/* Away row */}
                  <div
                    className={`bracket-team${pred === 'A' ? ' bracket-team--winner' : ''}${koMatch && canEdit ? ' bracket-team--clickable' : ''}`}
                    onClick={koMatch && canEdit && !isSaving ? () => predict(koMatch.id, 'A') : undefined}
                  >
                    <span className="bracket-team-name">{away}</span>
                    {pred === 'A' && <span className="bracket-check">✓</span>}
                  </div>
                </div>
              );
            });
          })}

        </div>
      </div>
    </div>
  );
}

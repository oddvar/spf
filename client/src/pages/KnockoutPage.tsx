import { useState, useEffect, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, put, ApiError } from '../api/client';
import { resolveSlot, type GroupMatch } from '../utils/standings';

// ─── Layout constants ────────────────────────────────────────────────────────
const SLOT   = 64;   // px height per R32 slot
const BOX_H  = 48;   // px match box height (2 × 24 team rows)
const BOX_W  = 160;  // px match box width
const COL_GAP = 28;  // px column gap (holds connector lines)
const TOTAL_H = 16 * SLOT + 80;                  // 1104px (extra room for 3rd place)
const TOTAL_W = 5 * BOX_W + 4 * COL_GAP + 1;    // 941px
const THIRD_PLACE_TOP = 16 * SLOT - 20;          // 1004px — below SF2, same column as Final

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
  const [r16Preds, setR16Preds] = useState<(string | null)[]>(Array(8).fill(null));
  const [qfPreds,  setQfPreds]  = useState<(string | null)[]>(Array(4).fill(null));
  const [sfPreds,  setSfPreds]  = useState<(string | null)[]>(Array(2).fill(null));
  const [fPred,    setFPred]    = useState<string | null>(null);
  const [thirdPred, setThirdPred] = useState<string | null>(null);
  const [groupMatches, setGroupMatches] = useState<GroupMatchFull[]>([]);
  const [bestThirds, setBestThirds] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      get<{ matches: KoMatch[]; canEdit: boolean; r16Predictions: (string | null)[]; qfPredictions: (string | null)[]; sfPredictions: (string | null)[]; fPredictions: (string | null)[]; thirdPrediction: string | null }>('/knockout/matches'),
      get<{ matches: GroupMatchFull[]; canEdit: boolean }>('/matches'),
      get<{ selections: string[] }>('/best-thirds'),
    ]).then(([ko, group, thirds]) => {
      setKoMatches(ko.matches);
      setR16Preds(ko.r16Predictions);
      setQfPreds(ko.qfPredictions);
      setSfPreds(ko.sfPredictions);
      setFPred(ko.fPredictions[0] ?? null);
      setThirdPred(ko.thirdPrediction);
      setCanEdit(ko.canEdit);
      setGroupMatches(group.matches.filter((m) => m.group_name));
      setBestThirds(thirds.selections);
      setLoading(false);
    });
  }, []);

  function predictThird(pred: KoPred) {
    setThirdPred(pred);
    startTransition(async () => {
      try {
        await put('/knockout/third', { prediction: pred });
      } catch (err) {
        setThirdPred(null);
        if (err instanceof ApiError && err.status === 403) {
          setSaveError('The deadline for submitting predictions has now passed.');
          setCanEdit(false);
        }
      }
    });
  }

  function predictFinal(pred: KoPred) {
    setFPred(pred);
    startTransition(async () => {
      try {
        await put('/knockout/final', { prediction: pred });
      } catch (err) {
        setFPred(null);
        if (err instanceof ApiError && err.status === 403) {
          setSaveError('The deadline for submitting predictions has now passed.');
          setCanEdit(false);
        }
      }
    });
  }

  function predictSF(pairIdx: number, pred: KoPred) {
    setSfPreds((prev) => { const next = [...prev]; next[pairIdx] = pred; return next; });
    startTransition(async () => {
      try {
        await put(`/knockout/sf/${pairIdx}`, { prediction: pred });
      } catch (err) {
        setSfPreds((prev) => { const next = [...prev]; next[pairIdx] = null; return next; });
        if (err instanceof ApiError && err.status === 403) {
          setSaveError('The deadline for submitting predictions has now passed.');
          setCanEdit(false);
        }
      }
    });
  }

  function predictQF(pairIdx: number, pred: KoPred) {
    setQfPreds((prev) => { const next = [...prev]; next[pairIdx] = pred; return next; });
    startTransition(async () => {
      try {
        await put(`/knockout/qf/${pairIdx}`, { prediction: pred });
      } catch (err) {
        setQfPreds((prev) => { const next = [...prev]; next[pairIdx] = null; return next; });
        if (err instanceof ApiError && err.status === 403) {
          setSaveError('The deadline for submitting predictions has now passed.');
          setCanEdit(false);
        }
      }
    });
  }

  function predictR16(pairIdx: number, pred: KoPred) {
    setR16Preds((prev) => { const next = [...prev]; next[pairIdx] = pred; return next; });
    startTransition(async () => {
      try {
        await put(`/knockout/r16/${pairIdx}`, { prediction: pred });
      } catch (err) {
        setR16Preds((prev) => { const next = [...prev]; next[pairIdx] = null; return next; });
        if (err instanceof ApiError && err.status === 403) {
          setSaveError('The deadline for submitting predictions has now passed.');
          setCanEdit(false);
        }
      }
    });
  }

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

  function r16Winner(pairIdx: number): string {
    const pred = r16Preds[pairIdx] as KoPred | null;
    if (!pred) return '?';
    return pred === 'H' ? r32Winner(R32[pairIdx * 2]) : r32Winner(R32[pairIdx * 2 + 1]);
  }

  function qfWinner(pairIdx: number): string {
    const pred = qfPreds[pairIdx] as KoPred | null;
    if (!pred) return '?';
    return pred === 'H' ? r16Winner(pairIdx * 2) : r16Winner(pairIdx * 2 + 1);
  }

  function sfWinner(pairIdx: number): string {
    const pred = sfPreds[pairIdx] as KoPred | null;
    if (!pred) return '?';
    return pred === 'H' ? qfWinner(pairIdx * 2) : qfWinner(pairIdx * 2 + 1);
  }

  function sfLoser(pairIdx: number): string {
    const pred = sfPreds[pairIdx] as KoPred | null;
    if (!pred) return '?';
    return pred === 'H' ? qfWinner(pairIdx * 2 + 1) : qfWinner(pairIdx * 2);
  }

  // Returns [homeTeam, awayTeam] for any bracket position
  function teams(round: number, idx: number): [string, string] {
    if (round === 0) {
      const m = koMatches.find((x) => x.ko_number === R32[idx]);
      return m ? [slot(m.home_team), slot(m.away_team)] : ['?', '?'];
    }
    if (round === 1) return [r32Winner(R32[idx * 2]), r32Winner(R32[idx * 2 + 1])];
    if (round === 2) return [r16Winner(idx * 2), r16Winner(idx * 2 + 1)];
    if (round === 3) return [qfWinner(idx * 2), qfWinner(idx * 2 + 1)];
    if (round === 4) return [sfWinner(0), sfWinner(1)];
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
            {/* Dashed connectors from SF losers to 3rd place */}
            {(() => {
              const sf1Cy = boxCy(3, 0); // SF1 centre (256px)
              const sf2Cy = boxCy(3, 1); // SF2 centre (768px)
              const tpCy  = THIRD_PLACE_TOP + BOX_H / 2; // 3rd place centre
              const sfRx  = boxLeft(3) + BOX_W;           // right edge of SF column
              const midX  = sfRx + COL_GAP / 2;           // midpoint x
              const tpLx  = boxLeft(4);                    // left edge of Final column
              return (
                <>
                  {/* SF1 loser → 3rd place (dashed) */}
                  <line x1={sfRx} y1={sf1Cy} x2={midX} y2={sf1Cy} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                  <line x1={midX} y1={sf1Cy} x2={midX} y2={tpCy}  stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                  {/* SF2 loser → 3rd place (dashed) */}
                  <line x1={sfRx} y1={sf2Cy} x2={midX} y2={sf2Cy} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                  <line x1={midX} y1={sf2Cy} x2={midX} y2={tpCy}  stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                  {/* Horizontal from midpoint to 3rd place box */}
                  <line x1={midX} y1={tpCy} x2={tpLx} y2={tpCy} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
                </>
              );
            })()}
          </svg>

          {/* Match boxes – all 31 bracket slots */}
          {([0, 1, 2, 3, 4] as const).flatMap((round) => {
            const count = Math.max(1, 16 / Math.pow(2, round));
            return Array.from({ length: count }, (_, idx) => {
              const [home, away] = teams(round, idx);

              // R32
              const koNum   = round === 0 ? R32[idx] : undefined;
              const koMatch = koNum !== undefined ? koMatches.find((m) => m.ko_number === koNum) : undefined;

              // R16
              const isR16      = round === 1;
              const r16Pred    = isR16 ? (r16Preds[idx] as KoPred | null) : null;
              const r16Enabled = isR16 && canEdit &&
                koMatches.find((m) => m.ko_number === R32[idx * 2])?.prediction != null &&
                koMatches.find((m) => m.ko_number === R32[idx * 2 + 1])?.prediction != null;

              // QF
              const isQF      = round === 2;
              const qfPred    = isQF ? (qfPreds[idx] as KoPred | null) : null;
              const qfEnabled = isQF && canEdit &&
                r16Preds[idx * 2] != null && r16Preds[idx * 2 + 1] != null;

              // SF
              const isSF      = round === 3;
              const sfPred    = isSF ? (sfPreds[idx] as KoPred | null) : null;
              const sfEnabled = isSF && canEdit &&
                qfPreds[idx * 2] != null && qfPreds[idx * 2 + 1] != null;

              // Final
              const isFinal    = round === 4;
              const finalPred  = isFinal ? (fPred as KoPred | null) : null;
              const finalEnabled = isFinal && canEdit &&
                sfPreds[0] != null && sfPreds[1] != null;

              const pred     = koMatch?.prediction ?? r16Pred ?? qfPred ?? sfPred ?? finalPred ?? null;
              const isSaving = savingId === koMatch?.id && isPending;

              const homeClick =
                koMatch && canEdit && !isSaving ? () => predict(koMatch.id, 'H') :
                r16Enabled   ? () => predictR16(idx, 'H')  :
                qfEnabled    ? () => predictQF(idx, 'H')   :
                sfEnabled    ? () => predictSF(idx, 'H')   :
                finalEnabled ? () => predictFinal('H')     : undefined;
              const awayClick =
                koMatch && canEdit && !isSaving ? () => predict(koMatch.id, 'A') :
                r16Enabled   ? () => predictR16(idx, 'A')  :
                qfEnabled    ? () => predictQF(idx, 'A')   :
                sfEnabled    ? () => predictSF(idx, 'A')   :
                finalEnabled ? () => predictFinal('A')     : undefined;

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
                  <div
                    className={`bracket-team${pred === 'H' ? ' bracket-team--winner' : ''}${homeClick ? ' bracket-team--clickable' : ''}`}
                    onClick={homeClick}
                  >
                    <span className="bracket-team-name">{home}</span>
                    {pred === 'H' && <span className="bracket-check">✓</span>}
                  </div>
                  <div
                    className={`bracket-team${pred === 'A' ? ' bracket-team--winner' : ''}${awayClick ? ' bracket-team--clickable' : ''}`}
                    onClick={awayClick}
                  >
                    <span className="bracket-team-name">{away}</span>
                    {pred === 'A' && <span className="bracket-check">✓</span>}
                  </div>
                </div>
              );
            });
          })}

          {/* 3rd place label */}
          <span
            style={{
              position: 'absolute',
              top: THIRD_PLACE_TOP - 18,
              left: boxLeft(4),
              width: BOX_W,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text)',
            }}
          >
            3rd place
          </span>

          {/* 3rd place match box */}
          {(() => {
            const home = sfLoser(0);
            const away = sfLoser(1);
            const bothSFDone = sfPreds[0] != null && sfPreds[1] != null;
            const tpEnabled  = bothSFDone && canEdit;
            return (
              <div
                style={{
                  position: 'absolute',
                  top: THIRD_PLACE_TOP,
                  left: boxLeft(4),
                  width: BOX_W,
                  height: BOX_H,
                  display: 'flex',
                  flexDirection: 'column',
                }}
                className="bracket-box"
              >
                <div
                  className={`bracket-team${thirdPred === 'H' ? ' bracket-team--winner' : ''}${tpEnabled ? ' bracket-team--clickable' : ''}`}
                  onClick={tpEnabled ? () => predictThird('H') : undefined}
                >
                  <span className="bracket-team-name">{home}</span>
                  {thirdPred === 'H' && <span className="bracket-check">✓</span>}
                </div>
                <div
                  className={`bracket-team${thirdPred === 'A' ? ' bracket-team--winner' : ''}${tpEnabled ? ' bracket-team--clickable' : ''}`}
                  onClick={tpEnabled ? () => predictThird('A') : undefined}
                >
                  <span className="bracket-team-name">{away}</span>
                  {thirdPred === 'A' && <span className="bracket-check">✓</span>}
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}

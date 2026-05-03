import predictorData from "../data/predictor-data.json";

export type PredictorRow = {
  score: number;
  rank: number;
  from: number;
  to: number;
};

export type PredictionResult = {
  inputScore: number;
  matchedScore: number;
  predictedRank: number;
  predictedFrom: number;
  predictedTo: number;
  exactMatch: boolean;
};

const rows = predictorData as PredictorRow[];
const PUBLIC_MIN = 0;
const PUBLIC_MAX = 720;

/**
 * Dynamic rank band — uses score to determine variation width.
 * Higher score → smaller spread (more certainty).
 * Lower score  → larger spread (more uncertainty).
 * Band is always asymmetric and from < to, never equal.
 */
function calcRankBand(score: number, rank: number): { from: number; to: number } {
  // Variation percentages by score tier
  let loPct: number;
  let hiPct: number;

  if (score >= 620) {
    loPct = 0.03; hiPct = 0.05;   // ±3–5 %  (toppers — very tight)
  } else if (score >= 560) {
    loPct = 0.05; hiPct = 0.09;   // ±5–9 %
  } else if (score >= 500) {
    loPct = 0.08; hiPct = 0.13;   // ±8–13 %
  } else if (score >= 430) {
    loPct = 0.11; hiPct = 0.17;   // ±11–17 %
  } else if (score >= 350) {
    loPct = 0.15; hiPct = 0.22;   // ±15–22 %
  } else if (score >= 250) {
    loPct = 0.19; hiPct = 0.28;   // ±19–28 %
  } else {
    loPct = 0.23; hiPct = 0.34;   // ±23–34 %  (low scorers — widest band)
  }

  // Minimum absolute gap so band never looks trivial
  const minGap = rank < 5_000 ? 150 : rank < 50_000 ? 2_000 : rank < 3_00_000 ? 10_000 : 25_000;

  const loVar = Math.max(Math.round(rank * loPct), Math.round(minGap * 0.4));
  const hiVar = Math.max(Math.round(rank * hiPct), minGap);

  const from = Math.max(1, rank - loVar);
  const to   = rank + hiVar;

  // Guarantee from ≠ to (edge case guard)
  if (from === to) return { from: Math.max(1, from - 1), to: to + 1 };

  return { from, to };
}

export function getPredictorStats() {
  const visible = rows.filter((r) => r.score >= PUBLIC_MIN);
  return {
    totalScores: visible.length,
    highestSupportedScore: visible[visible.length - 1]?.score ?? PUBLIC_MAX,
    lowestSupportedScore: visible[0]?.score ?? PUBLIC_MIN,
    bestRank: visible.reduce((b, r) => Math.min(b, r.rank), Number.MAX_SAFE_INTEGER),
  };
}

export function validateScore(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed))
    throw new Error("Please enter a whole-number NEET score.");
  if (parsed < PUBLIC_MIN || parsed > PUBLIC_MAX)
    throw new Error(`Score must be between ${PUBLIC_MIN} and ${PUBLIC_MAX}.`);
  return parsed;
}

export function findNearestPrediction(inputScore: number): PredictionResult {
  let low = 0;
  let high = rows.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const cur = rows[mid];

    if (cur.score === inputScore) {
      const band = calcRankBand(inputScore, cur.rank);
      return {
        inputScore,
        matchedScore: cur.score,
        predictedRank: cur.rank,
        predictedFrom: band.from,
        predictedTo:   band.to,
        exactMatch: true,
      };
    }

    if (cur.score < inputScore) low = mid + 1;
    else high = mid - 1;
  }

  const upper = rows[Math.min(low, rows.length - 1)];
  const lower = rows[Math.max(high, 0)];
  const best =
    Math.abs(lower.score - inputScore) <= Math.abs(upper.score - inputScore)
      ? lower
      : upper;

  const band = calcRankBand(inputScore, best.rank);
  return {
    inputScore,
    matchedScore: best.score,
    predictedRank: best.rank,
    predictedFrom: band.from,
    predictedTo:   band.to,
    exactMatch: false,
  };
}

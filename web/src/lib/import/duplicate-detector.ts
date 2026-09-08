import { haversineMeters, hasCoordinates } from "@/lib/geo";
import {
  comparisonKey,
  foldCompare,
  rawDedupKey,
} from "@/lib/import/normalizer";
import {
  DEFAULT_DUPLICATE_THRESHOLDS,
  type DuplicateMatch,
  type DuplicateThresholds,
  type DuplicateType,
} from "@/lib/import/types";
import type { FloodProneArea, FloodProneAreaInput } from "@/lib/types";

const WEIGHTS = {
  city_municipality: 0.2,
  barangay: 0.2,
  road_name: 0.25,
  deo: 0.1,
  region: 0.05,
  address: 0.1,
  coordinates: 0.1,
};

export function diceSimilarity(a: string, b: string) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return Math.max(0.82, shorter / longer);
  }
  const grams = (value: string) => {
    const padded = ` ${value} `;
    const set = new Map<string, number>();
    for (let i = 0; i < padded.length - 1; i += 1) {
      const gram = padded.slice(i, i + 2);
      set.set(gram, (set.get(gram) ?? 0) + 1);
    }
    return set;
  };
  const left = grams(a);
  const right = grams(b);
  let overlap = 0;
  for (const [gram, count] of left) {
    overlap += Math.min(count, right.get(gram) ?? 0);
  }
  const total = [...left.values()].reduce((sum, value) => sum + value, 0)
    + [...right.values()].reduce((sum, value) => sum + value, 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

export function coordinateScore(
  a: Pick<FloodProneAreaInput, "latitude" | "longitude">,
  b: Pick<FloodProneArea, "latitude" | "longitude">,
) {
  if (!hasCoordinates(a.latitude, a.longitude) || !hasCoordinates(b.latitude, b.longitude)) {
    return null;
  }
  const meters = haversineMeters(
    [a.latitude as number, a.longitude as number],
    [b.latitude as number, b.longitude as number],
  );
  if (meters <= 25) return 1;
  if (meters >= 500) return 0;
  return 1 - (meters - 25) / (500 - 25);
}

function fieldScore(imported: string | null | undefined, existing: string | null | undefined) {
  return diceSimilarity(foldCompare(imported), foldCompare(existing));
}

export function scoreCandidate(
  imported: FloodProneAreaInput,
  existing: FloodProneArea,
): DuplicateMatch {
  const parts = [
    {
      key: "city_municipality",
      weight: WEIGHTS.city_municipality,
      score: fieldScore(imported.city_municipality, existing.city_municipality),
      present: Boolean(foldCompare(imported.city_municipality) || foldCompare(existing.city_municipality)),
    },
    {
      key: "barangay",
      weight: WEIGHTS.barangay,
      score: fieldScore(imported.barangay, existing.barangay),
      present: Boolean(foldCompare(imported.barangay) || foldCompare(existing.barangay)),
    },
    {
      key: "road_name",
      weight: WEIGHTS.road_name,
      score: fieldScore(imported.road_name, existing.road_name),
      present: Boolean(foldCompare(imported.road_name) || foldCompare(existing.road_name)),
    },
    {
      key: "deo",
      weight: WEIGHTS.deo,
      score: fieldScore(imported.deo, existing.deo),
      present: Boolean(foldCompare(imported.deo) || foldCompare(existing.deo)),
    },
    {
      key: "region",
      weight: WEIGHTS.region,
      score: fieldScore(imported.region, existing.region),
      present: Boolean(foldCompare(imported.region) || foldCompare(existing.region)),
    },
    {
      key: "address",
      weight: WEIGHTS.address,
      score: fieldScore(imported.address, existing.address),
      present: Boolean(foldCompare(imported.address) || foldCompare(existing.address)),
    },
  ];

  const coord = coordinateScore(imported, existing);
  if (coord != null) {
    parts.push({
      key: "coordinates",
      weight: WEIGHTS.coordinates,
      score: coord,
      present: true,
    });
  }

  const used = parts.filter((part) => part.present);
  const totalWeight = used.reduce((sum, part) => sum + part.weight, 0);
  const confidence =
    totalWeight === 0 ? 0 : used.reduce((sum, part) => sum + part.score * part.weight, 0) / totalWeight;

  const fieldScores = Object.fromEntries(parts.map((part) => [part.key, part.present ? part.score : 0]));
  const exact = rawDedupKey(imported) === rawDedupKey(existing);
  const normalized = comparisonKey(imported) === comparisonKey(existing);
  const type: DuplicateType = exact ? "exact" : normalized ? "normalized" : "fuzzy";

  return {
    record: existing,
    confidence,
    type,
    reasons: duplicateReasons(imported, existing, fieldScores, coord),
    fieldScores,
  };
}

export function duplicateReasons(
  imported: FloodProneAreaInput,
  existing: FloodProneArea,
  fieldScores: Record<string, number>,
  coord: number | null,
) {
  const reasons: string[] = [];
  if ((fieldScores.city_municipality ?? 0) >= 0.9) {
    reasons.push(`Same municipality (${existing.city_municipality}).`);
  } else if ((fieldScores.city_municipality ?? 0) >= 0.6) {
    reasons.push(
      `Municipalities are similar (${imported.city_municipality} vs ${existing.city_municipality}).`,
    );
  }
  if ((fieldScores.barangay ?? 0) >= 0.9) {
    reasons.push("Barangay names match after normalizing Brgy./Barangay prefixes.");
  } else if ((fieldScores.barangay ?? 0) >= 0.6) {
    reasons.push(`Barangay names are similar (${imported.barangay} vs ${existing.barangay}).`);
  }
  if ((fieldScores.road_name ?? 0) >= 0.9) {
    reasons.push("Road names are equivalent after expanding abbreviations such as Hwy./Rd./St.");
  } else if ((fieldScores.road_name ?? 0) >= 0.6) {
    reasons.push(`Road names are similar (${imported.road_name} vs ${existing.road_name}).`);
  }
  if ((fieldScores.deo ?? 0) >= 0.9 && imported.deo) {
    reasons.push(`Same DEO (${existing.deo}).`);
  }
  if ((fieldScores.region ?? 0) >= 0.9 && imported.region) {
    reasons.push(`Same region (${existing.region}).`);
  }
  if (coord != null && hasCoordinates(imported.latitude, imported.longitude) && hasCoordinates(existing.latitude, existing.longitude)) {
    const meters = Math.round(
      haversineMeters(
        [imported.latitude as number, imported.longitude as number],
        [existing.latitude as number, existing.longitude as number],
      ),
    );
    if (meters <= 50) reasons.push(`Coordinates are very close (${meters} m apart).`);
    else if (meters <= 250) reasons.push(`Coordinates are nearby (${meters} m apart).`);
    else reasons.push(`Coordinates are ${meters} m apart.`);
  }
  if (reasons.length === 0) {
    reasons.push("No strong field overlap was found.");
  }
  return reasons;
}

export function classifyDuplicate(confidence: number, type: DuplicateType, thresholds = DEFAULT_DUPLICATE_THRESHOLDS) {
  if (type === "exact" || type === "normalized" || confidence >= thresholds.likelyDuplicate) {
    return "duplicate" as const;
  }
  if (confidence >= thresholds.reviewRecommended) {
    return "possible_duplicate" as const;
  }
  return "new" as const;
}

export function narrowCandidates(imported: FloodProneAreaInput, existing: FloodProneArea[]) {
  const city = foldCompare(imported.city_municipality);
  const barangay = foldCompare(imported.barangay);
  const road = foldCompare(imported.road_name);
  const deo = foldCompare(imported.deo);
  const region = foldCompare(imported.region);

  const filtered = existing.filter((row) => {
    const rowCity = foldCompare(row.city_municipality);
    const rowBarangay = foldCompare(row.barangay);
    const rowRoad = foldCompare(row.road_name);
    const rowDeo = foldCompare(row.deo);
    const rowRegion = foldCompare(row.region);
    if (city && rowCity && (city === rowCity || city.includes(rowCity) || rowCity.includes(city))) return true;
    if (barangay && rowBarangay && barangay === rowBarangay && region && rowRegion === region) return true;
    if (road && rowRoad && road === rowRoad && (city === rowCity || deo === rowDeo)) return true;
    return false;
  });

  return filtered.length > 0 ? filtered : existing.slice(0, 25);
}

export function findDuplicate(
  imported: FloodProneAreaInput,
  existing: FloodProneArea[],
  thresholds = DEFAULT_DUPLICATE_THRESHOLDS,
): DuplicateMatch | null {
  const importedKey = rawDedupKey(imported);
  const importedNormalized = comparisonKey(imported);

  for (const row of existing) {
    if (rawDedupKey(row) === importedKey) {
      const scored = scoreCandidate(imported, row);
      return { ...scored, type: "exact", confidence: Math.max(scored.confidence, 1) };
    }
  }

  for (const row of existing) {
    if (comparisonKey(row) === importedNormalized) {
      const scored = scoreCandidate(imported, row);
      return { ...scored, type: "normalized", confidence: Math.max(scored.confidence, 0.97) };
    }
  }

  const candidates = narrowCandidates(imported, existing);
  let best: DuplicateMatch | null = null;
  for (const row of candidates) {
    const scored = scoreCandidate(imported, row);
    if (!best || scored.confidence > best.confidence) best = scored;
  }

  if (!best || classifyDuplicate(best.confidence, best.type, thresholds) === "new") {
    return best && best.confidence >= thresholds.reviewRecommended ? best : null;
  }
  return best;
}

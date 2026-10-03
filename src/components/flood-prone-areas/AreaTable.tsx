import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Thead, Tbody, Th, Td } from "@/components/ui/Table";
import { LocationBadge } from "./LocationBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { FloodProneArea } from "@/lib/types";

// Rendering all ~1,763 rows at once means ~16,000 DOM nodes and a long, janky first paint on phones.
// Draw a first screenful-plus and append more as the user scrolls toward the end.
const INITIAL_ROWS = 80;
const ROWS_PER_STEP = 150;

const COLUMNS = ["Province", "Municipality/City", "Barangay", "Road / Waterway", "DEO", "Location"];

function AreaTableImpl({
  items,
  selectedId,
  onSelect,
  resetKey,
}: {
  items: FloodProneArea[];
  selectedId?: number | null;
  onSelect?: (area: FloodProneArea) => void;
  /** Changes when the filters change, so the list starts from the top chunk again (but not when a row merely gains a location). */
  resetKey?: string;
}) {
  const [limit, setLimit] = useState(INITIAL_ROWS);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setLimit(INITIAL_ROWS);
  }

  const tableRef = useRef<HTMLTableElement>(null);
  // A new filter result starts at the top (the table's parent is the scroll region).
  useEffect(() => {
    tableRef.current?.parentElement?.scrollTo({ top: 0 });
  }, [resetKey]);

  const sentinelRef = useRef<HTMLTableRowElement>(null);
  const hasMore = limit < items.length;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + ROWS_PER_STEP);
      },
      { rootMargin: "800px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, limit]);

  if (items.length === 0) {
    return <EmptyState title="No flood-prone areas match these filters" description="Try widening the region, province, or search term." />;
  }

  return (
    // No wrapping overflow container: the parent scroll region owns both scroll axes so the sticky header works.
    <table ref={tableRef} className="w-full min-w-[660px] divide-y divide-slate-200 text-xs">
      <Thead>
        <tr>
          {COLUMNS.map((name) => (
            <Th key={name} className="sticky top-0 z-10">
              {name}
            </Th>
          ))}
        </tr>
      </Thead>
      <Tbody>
        {items.slice(0, limit).map((item) => (
          <tr
            key={item.rowIndex}
            onClick={onSelect ? () => onSelect(item) : undefined}
            aria-selected={item.rowIndex === selectedId}
            className={`${onSelect ? "cursor-pointer" : ""} ${item.rowIndex === selectedId ? "bg-brand-50" : "hover:bg-navy-50"}`}
          >
            <Td className="whitespace-nowrap">{item.province}</Td>
            <Td className="whitespace-nowrap">{item.municipalityCity}</Td>
            <Td className="min-w-[110px]">{item.barangay}</Td>
            <Td className="min-w-[140px]">
              <Link href={`/flood-prone-areas/${item.rowIndex}`} onClick={(e) => e.stopPropagation()} className="font-medium text-navy-700 hover:underline">
                {item.roadNameWaterways}
              </Link>
            </Td>
            <Td className="whitespace-nowrap">{item.deo}</Td>
            <Td className="whitespace-nowrap">{item.location ? <LocationBadge accuracy={item.location.accuracy} /> : null}</Td>
          </tr>
        ))}
        {hasMore ? (
          <tr ref={sentinelRef} aria-hidden>
            <td colSpan={COLUMNS.length} className="py-3 text-center text-[11px] text-slate-400">
              Loading more…
            </td>
          </tr>
        ) : null}
      </Tbody>
    </table>
  );
}

/** Placeholder shown while the dataset loads: same header and row rhythm as the real table, so nothing jumps. */
export function AreaTableSkeleton() {
  return (
    <table className="w-full min-w-[660px] divide-y divide-slate-200 text-xs" aria-busy="true" aria-label="Loading flood-prone areas">
      <Thead>
        <tr>
          {COLUMNS.map((name) => (
            <Th key={name} className="sticky top-0 z-10">
              {name}
            </Th>
          ))}
        </tr>
      </Thead>
      <Tbody>
        {Array.from({ length: 12 }, (_, i) => (
          <tr key={i}>
            {COLUMNS.map((name, j) => (
              <Td key={name}>
                <div className="h-3 animate-pulse rounded bg-navy-100" style={{ width: `${[55, 80, 60, 90, 50, 70][j]}%` }} />
              </Td>
            ))}
          </tr>
        ))}
      </Tbody>
    </table>
  );
}

// ~1,763 rows: skip re-rendering them unless the data or selection actually changes.
export const AreaTable = memo(AreaTableImpl);

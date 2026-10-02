import Link from "next/link";
import { Thead, Tbody, Th, Td } from "@/components/ui/Table";
import { LocationBadge } from "./LocationBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { FloodProneArea } from "@/lib/types";

export function AreaTable({
  items,
  selectedId,
  onSelect,
}: {
  items: FloodProneArea[];
  selectedId?: number | null;
  onSelect?: (area: FloodProneArea) => void;
}) {
  if (items.length === 0) {
    return <EmptyState title="No flood-prone areas match these filters" description="Try widening the region, province, or search term." />;
  }

  return (
    // No wrapping overflow container: the parent scroll region owns both scroll axes so the sticky header works.
    <table className="w-full min-w-[720px] divide-y divide-slate-200 text-sm">
      <Thead>
        <tr>
          <Th className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_#e2e8f0]">Province</Th>
          <Th className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_#e2e8f0]">Municipality/City</Th>
          <Th className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_#e2e8f0]">Barangay</Th>
          <Th className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_#e2e8f0]">Road / Waterway</Th>
          <Th className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_#e2e8f0]">DEO</Th>
          <Th className="sticky top-0 z-10 bg-slate-50 shadow-[inset_0_-1px_0_#e2e8f0]">Location</Th>
        </tr>
      </Thead>
      <Tbody>
        {items.map((item) => (
          <tr
            key={item.rowIndex}
            onClick={onSelect ? () => onSelect(item) : undefined}
            aria-selected={item.rowIndex === selectedId}
            className={`${onSelect ? "cursor-pointer" : ""} ${item.rowIndex === selectedId ? "bg-sky-50" : "hover:bg-slate-50"}`}
          >
            <Td>{item.province}</Td>
            <Td>{item.municipalityCity}</Td>
            <Td>{item.barangay}</Td>
            <Td>
              <Link href={`/flood-prone-areas/${item.rowIndex}`} onClick={(e) => e.stopPropagation()} className="text-sky-700 hover:underline">
                {item.roadNameWaterways}
              </Link>
            </Td>
            <Td>{item.deo}</Td>
            <Td>{item.location ? <LocationBadge accuracy={item.location.accuracy} /> : null}</Td>
          </tr>
        ))}
      </Tbody>
    </table>
  );
}

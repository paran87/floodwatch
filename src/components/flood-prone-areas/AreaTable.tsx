import Link from "next/link";
import { Table, Thead, Tbody, Th, Td } from "@/components/ui/Table";
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
    <Table>
      <Thead>
        <tr>
          <Th>Province</Th>
          <Th>Municipality/City</Th>
          <Th>Barangay</Th>
          <Th>Road / Waterway</Th>
          <Th>DEO</Th>
          <Th>Location</Th>
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
    </Table>
  );
}

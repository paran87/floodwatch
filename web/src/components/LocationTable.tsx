"use client";

import type { MutableRefObject } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { FloodProneArea } from "@/lib/types";

export function LocationTable({
  areas,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  rowRefs,
}: {
  areas: FloodProneArea[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (area: FloodProneArea) => void;
  onDelete: (id: string) => void;
  rowRefs: MutableRefObject<Record<string, HTMLElement | null>>;
}) {
  return (
    <div className="data-table-wrap min-h-0 flex-1 overflow-auto scrollbar-thin">
      <table className="data-table">
        <thead>
          <tr>
            <th>Region</th>
            <th>Municipality/City</th>
            <th>Barangay</th>
            <th>Road Name</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => {
            const active = area.id === selectedId;
            return (
              <tr
                key={area.id}
                ref={(node) => {
                  rowRefs.current[area.id] = node;
                }}
                className={active ? "is-selected" : undefined}
                onClick={() => onSelect(area.id)}
              >
                <td>{area.region || "—"}</td>
                <td>{area.city_municipality || "—"}</td>
                <td>{area.barangay || "—"}</td>
                <td>{area.road_name || area.name || "—"}</td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="table-btn table-btn-edit"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(area);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="table-btn table-btn-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(area.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

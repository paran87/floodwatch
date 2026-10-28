import { LayoutDashboard, MapPinned, FileWarning, Table2 } from "lucide-react";

export const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/flood-prone-areas", label: "Flood-Prone Areas", icon: MapPinned },
  { href: "/list", label: "List", icon: Table2 },
  { href: "/reports", label: "Reports", icon: FileWarning, Table2 },
];

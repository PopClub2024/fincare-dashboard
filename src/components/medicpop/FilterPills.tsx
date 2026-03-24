import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, Plus } from "lucide-react";
import { STATUS_COLORS } from "./design-tokens";

interface PillOption {
  key: string;
  label: string;
  color?: { bg: string; text: string; border: string };
  count?: number;
}

interface FilterPillsProps {
  pills: PillOption[];
  activePill: string;
  onPillChange: (key: string) => void;
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  onFilterClick?: () => void;
  actionLabel?: string;
  onActionClick?: () => void;
  extraActions?: React.ReactNode;
}

const DEFAULT_PILLS: PillOption[] = [
  { key: "todos", label: "Todos" },
  { key: "aberto", label: "Em aberto", color: { bg: "transparent", text: "#378ADD", border: "rgba(55,138,221,0.3)" } },
  { key: "pago", label: "Pagos", color: { bg: "transparent", text: "#1D9E75", border: "rgba(29,158,117,0.3)" } },
  { key: "vencido", label: "Vencidos", color: { bg: "transparent", text: "#E24B4A", border: "rgba(226,75,74,0.3)" } },
];

export default function FilterPills({
  pills = DEFAULT_PILLS,
  activePill,
  onPillChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar por nome, CPF ou nº...",
  onFilterClick,
  actionLabel,
  onActionClick,
  extraActions,
}: FilterPillsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Pills */}
      {pills.map((pill) => {
        const isActive = activePill === pill.key;
        const isAll = pill.key === "todos";
        return (
          <button
            key={pill.key}
            onClick={() => onPillChange(pill.key)}
            className="rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all"
            style={
              isActive
                ? isAll
                  ? { background: "#2C3E50", color: "white", border: "none" }
                  : { background: pill.color?.bg || "transparent", color: pill.color?.text || "#666", border: `0.5px solid ${pill.color?.border || "#CCC"}`, fontWeight: 500 }
                : { background: "transparent", color: "#666", border: "0.5px solid #CCC" }
            }
          >
            {pill.label}{pill.count !== undefined ? ` (${pill.count})` : ""}
          </button>
        );
      })}

      {/* Busca */}
      <div className="relative ml-auto">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" style={{ color: "#666" }} />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-[220px] pl-8 text-[13px] rounded-lg"
          style={{ borderRadius: 8 }}
        />
      </div>

      {/* Filtros avançados */}
      {onFilterClick && (
        <Button variant="outline" size="sm" onClick={onFilterClick} className="h-9 gap-1.5 text-[13px]">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
        </Button>
      )}

      {extraActions}

      {/* Ação primária */}
      {actionLabel && onActionClick && (
        <Button
          size="sm"
          onClick={onActionClick}
          className="h-9 gap-1.5 text-[13px] font-semibold"
          style={{ background: "#1B5E7B", color: "white" }}
        >
          <Plus className="h-3.5 w-3.5" /> {actionLabel}
        </Button>
      )}
    </div>
  );
}

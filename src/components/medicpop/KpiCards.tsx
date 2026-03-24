import { formatCurrency } from "./design-tokens";

interface KpiItem {
  label: string;
  value: number | string;
  sublabel?: string;
  sublabelColor?: string;
  isCurrency?: boolean;
}

interface KpiCardsProps {
  items: KpiItem[];
}

export default function KpiCards({ items }: KpiCardsProps) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 6)}, 1fr)` }}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg p-4"
          style={{ background: "#F5F5F5" }}
        >
          <p className="text-xs font-medium" style={{ color: "#666666" }}>{item.label}</p>
          <p className="text-[22px] font-bold mt-1" style={{ color: "#2C3E50", fontVariantNumeric: "tabular-nums" }}>
            {item.isCurrency !== false && typeof item.value === "number" ? formatCurrency(item.value) : item.value}
          </p>
          {item.sublabel && (
            <p className="text-[11px] mt-0.5" style={{ color: item.sublabelColor || "#666666" }}>
              {item.sublabel}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

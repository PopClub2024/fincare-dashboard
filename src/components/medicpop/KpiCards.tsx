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
          className="rounded-lg p-4 bg-muted"
        >
          <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
          <p className="text-[22px] font-bold mt-1 text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
            {item.isCurrency !== false && typeof item.value === "number" ? formatCurrency(item.value) : item.value}
          </p>
          {item.sublabel && (
            <p className="text-[11px] mt-0.5" style={{ color: item.sublabelColor || undefined }}>
              {!item.sublabelColor && <span className="text-muted-foreground">{item.sublabel}</span>}
              {item.sublabelColor && item.sublabel}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

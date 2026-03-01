import { useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DashboardFilterValues {
  dateFrom: Date;
  dateTo: Date;
  basCalculo: "competencia" | "caixa";
}

interface Props {
  filters: DashboardFilterValues;
  onFilterChange: (filters: DashboardFilterValues) => void;
}

export const defaultFilters: DashboardFilterValues = {
  dateFrom: startOfMonth(subMonths(new Date(), 11)),
  dateTo: endOfMonth(new Date()),
  basCalculo: "competencia",
};

const quickRanges = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
];

export default function DashboardFilters({ filters, onFilterChange }: Props) {
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const applyRange = (months: number) => {
    onFilterChange({
      ...filters,
      dateFrom: startOfMonth(subMonths(new Date(), months - 1)),
      dateTo: endOfMonth(new Date()),
    });
  };

  return (
    <div className="sticky top-0 z-20 -mx-4 -mt-2 mb-2 px-4 pt-2 pb-3 backdrop-blur-md bg-background/80 border-b border-border/50">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">Filtros</span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Quick ranges */}
        <div className="flex gap-1">
          {quickRanges.map((r) => (
            <Button
              key={r.label}
              variant="ghost"
              size="sm"
              className="h-7 px-2.5 text-xs font-medium"
              onClick={() => applyRange(r.months)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Date pickers */}
        <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal">
              <CalendarIcon className="h-3 w-3" />
              {format(filters.dateFrom, "dd/MM/yy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => { if (d) { onFilterChange({ ...filters, dateFrom: d }); setDateFromOpen(false); } }} locale={ptBR} />
          </PopoverContent>
        </Popover>

        <span className="text-[11px] text-muted-foreground">→</span>

        <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal">
              <CalendarIcon className="h-3 w-3" />
              {format(filters.dateTo, "dd/MM/yy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => { if (d) { onFilterChange({ ...filters, dateTo: d }); setDateToOpen(false); } }} locale={ptBR} />
          </PopoverContent>
        </Popover>

        <div className="h-4 w-px bg-border" />

        {/* Base de cálculo */}
        <Select value={filters.basCalculo} onValueChange={(v) => onFilterChange({ ...filters, basCalculo: v as "competencia" | "caixa" })}>
          <SelectTrigger className="h-7 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="competencia">Competência</SelectItem>
            <SelectItem value="caixa">Regime Caixa</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

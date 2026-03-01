import { useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function DashboardFilters({ filters, onFilterChange }: Props) {
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <Filter className="h-4 w-4 text-muted-foreground" />

      <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal", !filters.dateFrom && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(filters.dateFrom, "dd/MM/yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={filters.dateFrom} onSelect={(d) => { if (d) { onFilterChange({ ...filters, dateFrom: d }); setDateFromOpen(false); } }} locale={ptBR} />
        </PopoverContent>
      </Popover>

      <span className="text-sm text-muted-foreground">até</span>

      <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(filters.dateTo, "dd/MM/yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={filters.dateTo} onSelect={(d) => { if (d) { onFilterChange({ ...filters, dateTo: d }); setDateToOpen(false); } }} locale={ptBR} />
        </PopoverContent>
      </Popover>

      <Select value={filters.basCalculo} onValueChange={(v) => onFilterChange({ ...filters, basCalculo: v as "competencia" | "caixa" })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="competencia">Competência</SelectItem>
          <SelectItem value="caixa">Caixa</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

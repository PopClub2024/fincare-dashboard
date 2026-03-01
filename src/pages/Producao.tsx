import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, { DashboardFilterValues } from "@/components/dashboard/DashboardFilters";
import TabProducao from "@/components/dashboard/TabProducao";
import { startOfMonth, endOfMonth } from "date-fns";

const producaoDefaultFilters: DashboardFilterValues = {
  dateFrom: startOfMonth(new Date(2026, 0, 1)),
  dateTo: endOfMonth(new Date()),
  basCalculo: "competencia",
};

export default function Producao() {
  const [filters, setFilters] = useState<DashboardFilterValues>(producaoDefaultFilters);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produção</h1>
          <p className="text-sm text-muted-foreground">Consultas, exames e procedimentos realizados</p>
        </div>
        <DashboardFilters filters={filters} onFilterChange={setFilters} />
        <TabProducao dateFrom={filters.dateFrom} dateTo={filters.dateTo} />
      </div>
    </DashboardLayout>
  );
}

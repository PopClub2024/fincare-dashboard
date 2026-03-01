import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, { DashboardFilterValues, defaultFilters } from "@/components/dashboard/DashboardFilters";
import TabProducao from "@/components/dashboard/TabProducao";

export default function Producao() {
  const [filters, setFilters] = useState<DashboardFilterValues>(defaultFilters);

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

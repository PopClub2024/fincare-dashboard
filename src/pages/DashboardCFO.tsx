import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, { DashboardFilterValues, defaultFilters } from "@/components/dashboard/DashboardFilters";
import KpiCards from "@/components/dashboard/KpiCards";
import TabDRE from "@/components/dashboard/TabDRE";
import TabCaixa from "@/components/dashboard/TabCaixa";
import TabCapitalGiro from "@/components/dashboard/TabCapitalGiro";
import TabAR from "@/components/dashboard/TabAR";
import TabAP from "@/components/dashboard/TabAP";
import TabOperacional from "@/components/dashboard/TabOperacional";
import TabGrowth from "@/components/dashboard/TabGrowth";
import TabConsultas from "@/components/dashboard/TabConsultas";

export default function DashboardCFO() {
  const [filters, setFilters] = useState<DashboardFilterValues>(defaultFilters);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard CFO</h1>
          <p className="text-sm text-muted-foreground">Visão financeira consolidada da clínica</p>
        </div>

        <DashboardFilters filters={filters} onFilterChange={setFilters} />
        <KpiCards dateFrom={filters.dateFrom} dateTo={filters.dateTo} />

        <Tabs defaultValue="dre" className="space-y-4">
          <TabsList className="grid w-full grid-cols-8 bg-muted">
            <TabsTrigger value="dre">DRE</TabsTrigger>
            <TabsTrigger value="caixa">Caixa</TabsTrigger>
            <TabsTrigger value="consultas">Consultas</TabsTrigger>
            <TabsTrigger value="capital">Capital Giro</TabsTrigger>
            <TabsTrigger value="ar">AR / Aging</TabsTrigger>
            <TabsTrigger value="ap">AP</TabsTrigger>
            <TabsTrigger value="operacional">Operacional</TabsTrigger>
            <TabsTrigger value="growth">Growth</TabsTrigger>
          </TabsList>

          <TabsContent value="dre"><TabDRE dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="caixa"><TabCaixa dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="consultas"><TabConsultas dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="capital"><TabCapitalGiro dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="ar"><TabAR dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="ap"><TabAP dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="operacional"><TabOperacional dateFrom={filters.dateFrom} dateTo={filters.dateTo} /></TabsContent>
          <TabsContent value="growth"><TabGrowth /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

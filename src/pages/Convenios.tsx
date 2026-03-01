import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, { DashboardFilterValues, defaultFilters } from "@/components/dashboard/DashboardFilters";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConvenioVisaoGeral from "@/components/convenios/ConvenioVisaoGeral";
import ConvenioFaturamento from "@/components/convenios/ConvenioFaturamento";
import ConvenioProducao from "@/components/convenios/ConvenioProducao";
import ConvenioGlosas from "@/components/convenios/ConvenioGlosas";
import ConvenioConfiguracoes from "@/components/convenios/ConvenioConfiguracoes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { startOfMonth } from "date-fns";

interface Convenio {
  id: string;
  nome: string;
}

export default function Convenios() {
  const { clinicaId } = useAuth();
  const [filters, setFilters] = useState<DashboardFilterValues>({
    ...defaultFilters,
    dateFrom: startOfMonth(new Date(2026, 0, 1)),
  });
  const [convenioId, setConvenioId] = useState<string | null>(null);
  const [convenios, setConvenios] = useState<Convenio[]>([]);

  useEffect(() => {
    if (!clinicaId) return;
    supabase
      .from("convenios")
      .select("id, nome")
      .eq("clinica_id", clinicaId)
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        if (data) setConvenios(data);
      });
  }, [clinicaId]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Convênios</h1>
            <p className="text-sm text-muted-foreground">
              Controle de faturamento, NFs, glosas e recebimentos
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Select
              value={convenioId || "all"}
              onValueChange={(v) => setConvenioId(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os convênios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os convênios</SelectItem>
                {convenios.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DashboardFilters filters={filters} onFilterChange={setFilters} />

        <Tabs defaultValue="visao-geral" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="faturamento">Faturamento / NFs</TabsTrigger>
            <TabsTrigger value="producao">Produção</TabsTrigger>
            <TabsTrigger value="glosas">Glosas</TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral">
            <ConvenioVisaoGeral dateFrom={filters.dateFrom} dateTo={filters.dateTo} convenioId={convenioId} />
          </TabsContent>
          <TabsContent value="faturamento">
            <ConvenioFaturamento dateFrom={filters.dateFrom} dateTo={filters.dateTo} convenioId={convenioId} />
          </TabsContent>
          <TabsContent value="producao">
            <ConvenioProducao dateFrom={filters.dateFrom} dateTo={filters.dateTo} convenioId={convenioId} />
          </TabsContent>
          <TabsContent value="glosas">
            <ConvenioGlosas dateFrom={filters.dateFrom} dateTo={filters.dateTo} convenioId={convenioId} />
          </TabsContent>
          <TabsContent value="configuracoes">
            <ConvenioConfiguracoes />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  dateFrom: Date;
  dateTo: Date;
  convenioId: string | null;
}

interface ProducaoRow {
  procedimento_nome: string | null;
  especialidade: string | null;
  medico_nome: string | null;
  quantidade: number;
  valor_bruto: number;
  desconto: number;
  valor_liquido: number;
}

export default function ConvenioProducao({ dateFrom, dateTo, convenioId }: Props) {
  const { clinicaId } = useAuth();
  const [rows, setRows] = useState<ProducaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!clinicaId) return;
    fetchData();
  }, [clinicaId, dateFrom, dateTo, convenioId]);

  const fetchData = async () => {
    setLoading(true);
    // Query transacoes_vendas grouped by procedimento/medico for convenio records
    let q = supabase
      .from("transacoes_vendas")
      .select("procedimento, especialidade, medicos(nome), valor_bruto, desconto, valor_liquido, quantidade")
      .eq("clinica_id", clinicaId!)
      .not("convenio_id", "is", null)
      .gte("data_competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("data_competencia", format(dateTo, "yyyy-MM-dd"));

    if (convenioId) q = q.eq("convenio_id", convenioId);

    const { data } = await q;
    if (data) {
      // Group by procedimento + especialidade + medico
      const grouped: Record<string, ProducaoRow> = {};
      data.forEach((v: any) => {
        const key = `${v.procedimento || "Sem procedimento"}|${v.especialidade || ""}|${v.medicos?.nome || ""}`;
        if (!grouped[key]) {
          grouped[key] = {
            procedimento_nome: v.procedimento || "Sem procedimento",
            especialidade: v.especialidade,
            medico_nome: v.medicos?.nome || null,
            quantidade: 0,
            valor_bruto: 0,
            desconto: 0,
            valor_liquido: 0,
          };
        }
        grouped[key].quantidade += Number(v.quantidade || 1);
        grouped[key].valor_bruto += Number(v.valor_bruto || 0);
        grouped[key].desconto += Number(v.desconto || 0);
        grouped[key].valor_liquido += Number(v.valor_liquido || 0);
      });
      setRows(Object.values(grouped).sort((a, b) => b.valor_bruto - a.valor_bruto));
    }
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("sync-feegow", {
        body: {
          clinica_id: clinicaId,
          start_date: format(dateFrom, "yyyy-MM-dd"),
          end_date: format(dateTo, "yyyy-MM-dd"),
        },
      });
      if (error) throw error;
      toast.success("Sincronização Feegow concluída");
      fetchData();
    } catch {
      toast.error("Erro na sincronização");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({
      qtd: acc.qtd + r.quantidade,
      bruto: acc.bruto + r.valor_bruto,
      desc: acc.desc + r.desconto,
      liq: acc.liq + r.valor_liquido,
    }),
    { qtd: 0, bruto: 0, desc: 0, liq: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Re-sincronizar Feegow"}
        </Button>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Produção por Procedimento / Médico</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Médico</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Bruto</TableHead>
                  <TableHead className="text-right">Desconto</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Sem dados de produção. Clique em "Re-sincronizar Feegow" para buscar.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{r.procedimento_nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.especialidade || "—"}</TableCell>
                    <TableCell className="text-sm">{r.medico_nome || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{r.quantidade}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.valor_bruto)}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{fmt(r.desconto)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(r.valor_liquido)}</TableCell>
                  </TableRow>
                ))}
                {rows.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">{totals.qtd}</TableCell>
                    <TableCell className="text-right">{fmt(totals.bruto)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(totals.desc)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.liq)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

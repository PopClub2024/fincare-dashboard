import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, XCircle, AlertTriangle, ClipboardCheck } from "lucide-react";

export default function DebugOperacaoPage() {
  const { clinicaId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Array<{ label: string; status: "ok" | "warning" | "error" | "pending"; detail: string }>>([]);

  const runChecks = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    const results: typeof checks = [];

    // 1. Feegow OK
    const { data: feegow } = await supabase
      .from("integracoes")
      .select("status, ultima_sincronizacao")
      .eq("clinica_id", clinicaId)
      .eq("tipo", "feegow")
      .maybeSingle();
    results.push({
      label: "Feegow conectado",
      status: feegow?.status === "ativo" ? "ok" : "error",
      detail: feegow?.status === "ativo" ? `Última sync: ${feegow.ultima_sincronizacao ? new Date(feegow.ultima_sincronizacao).toLocaleString("pt-BR") : "—"}` : "Não conectado",
    });

    // 2. Vendas Jan/2026
    const { count: vendasCount } = await supabase
      .from("transacoes_vendas")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId)
      .gte("data_competencia", "2026-01-01")
      .lte("data_competencia", "2026-01-31");
    results.push({
      label: "Vendas Jan/2026 carregadas",
      status: (vendasCount || 0) > 0 ? "ok" : "error",
      detail: `${vendasCount || 0} vendas encontradas`,
    });

    // 3. Repasses médicos Jan/2026
    const { data: plano } = await supabase
      .from("plano_contas")
      .select("id")
      .eq("clinica_id", clinicaId)
      .eq("codigo_estruturado", "19.1")
      .maybeSingle();

    let repasseDias = 0;
    if (plano) {
      const { count } = await supabase
        .from("contas_pagar_lancamentos")
        .select("id", { count: "exact", head: true })
        .eq("clinica_id", clinicaId)
        .eq("plano_contas_id", plano.id)
        .gte("ref_dia_trabalhado", "2026-01-01")
        .lte("ref_dia_trabalhado", "2026-01-31");
      repasseDias = count || 0;
    }
    results.push({
      label: "Repasses médicos Jan/2026",
      status: repasseDias >= 20 ? "ok" : repasseDias > 0 ? "warning" : "error",
      detail: repasseDias > 0 ? `${repasseDias} lançamentos (cobertura ${Math.round(repasseDias / 22 * 100)}% dos dias úteis)` : "Nenhum repasse lançado",
    });

    // 4. Banco importado Jan/2026
    const { count: bancoCount } = await supabase
      .from("transacoes_bancarias" as any)
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId)
      .gte("data_transacao", "2026-01-01")
      .lte("data_transacao", "2026-01-31");
    results.push({
      label: "Extrato bancário Jan/2026",
      status: (bancoCount || 0) > 0 ? "ok" : "pending",
      detail: (bancoCount || 0) > 0 ? `${bancoCount} transações importadas` : "Aguardando importação via Make.com",
    });

    // 5. Getnet importado Jan/2026
    const { count: getnetCount } = await supabase
      .from("getnet_transacoes")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId)
      .gte("data_venda", "2026-01-01T00:00:00")
      .lte("data_venda", "2026-01-31T23:59:59");
    results.push({
      label: "Getnet Jan/2026",
      status: (getnetCount || 0) > 0 ? "ok" : "pending",
      detail: (getnetCount || 0) > 0 ? `${getnetCount} transações importadas` : "Aguardando importação via Make.com",
    });

    // 6. Conciliação executada
    const { count: concCount } = await supabase
      .from("conciliacoes")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId);
    results.push({
      label: "Conciliação executada",
      status: (concCount || 0) > 0 ? "ok" : "pending",
      detail: (concCount || 0) > 0 ? `${concCount} registros conciliados` : "Pendente — rodar após importações",
    });

    // 7. DRE mapeamento repasses
    const { count: dreMap } = await supabase
      .from("dre_mapeamento_contas")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", clinicaId)
      .eq("linha_dre", "repasses_medicos")
      .eq("ativo", true);
    results.push({
      label: "DRE mapeamento repasses médicos",
      status: (dreMap || 0) > 0 ? "ok" : "error",
      detail: (dreMap || 0) > 0 ? `${dreMap} conta(s) mapeada(s) para repasses_medicos` : "Nenhum mapeamento — DRE não refletirá repasses",
    });

    setChecks(results);
    setLoading(false);
  }, [clinicaId]);

  useEffect(() => { runChecks(); }, [runChecks]);

  const statusIcon = (s: string) => {
    if (s === "ok") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    if (s === "warning") return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    if (s === "error") return <XCircle className="h-5 w-5 text-destructive" />;
    return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </DashboardLayout>
    );
  }

  const allOk = checks.every(c => c.status === "ok");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6" /> Checklist Operacional — Jan/2026
          </h1>
          <p className="text-sm text-muted-foreground">Verificação de completude do pipeline de dados</p>
        </div>

        {allOk && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                <div>
                  <p className="font-bold text-emerald-700">Tudo OK! Pipeline completo.</p>
                  <p className="text-sm text-emerald-600">Todos os checks passaram para Janeiro/2026.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {checks.map((check, i) => (
            <Card key={i} className={check.status === "error" ? "border-destructive/30" : check.status === "warning" ? "border-amber-300" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  {statusIcon(check.status)}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{check.label}</p>
                    <p className="text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                  <Badge variant={check.status === "ok" ? "default" : check.status === "error" ? "destructive" : "secondary"}>
                    {check.status === "ok" ? "✓" : check.status === "error" ? "✗" : check.status === "warning" ? "!" : "?"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

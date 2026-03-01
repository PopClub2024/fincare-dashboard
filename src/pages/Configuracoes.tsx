import { useState, useEffect } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { RefreshCw, Upload, CheckCircle2, XCircle, Clock, Wifi } from "lucide-react";

interface IntegracaoInfo {
  id: string;
  tipo: string;
  status: string;
  ultima_sincronizacao: string | null;
}

interface SyncLogEntry {
  id: string;
  inicio: string;
  fim: string | null;
  status: string;
  registros_processados: number | null;
  detalhes: string | null;
}

export default function Configuracoes() {
  const { clinicaId } = useAuth();
  const [integracoes, setIntegracoes] = useState<IntegracaoInfo[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loadingOFX, setLoadingOFX] = useState(false);

  useEffect(() => {
    if (!clinicaId) return;
    fetchIntegracoes();
    fetchSyncLogs();
  }, [clinicaId]);

  const fetchIntegracoes = async () => {
    const { data } = await supabase
      .from("integracoes")
      .select("id, tipo, status, ultima_sincronizacao")
      .eq("clinica_id", clinicaId!);
    setIntegracoes(data || []);
  };

  const fetchSyncLogs = async () => {
    const { data } = await supabase
      .from("sync_log")
      .select("id, inicio, fim, status, registros_processados, detalhes")
      .eq("clinica_id", clinicaId!)
      .order("inicio", { ascending: false })
      .limit(10);
    setSyncLogs(data || []);
  };

  const handleSyncFeegow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-feegow", {
        body: { clinica_id: clinicaId },
      });
      if (error) throw error;
      toast.success(
        `Sincronização concluída! ${data?.result?.medicos || 0} médicos, ${data?.result?.agendamentos || 0} agendamentos processados.`
      );
      fetchIntegracoes();
      fetchSyncLogs();
    } catch (e: any) {
      toast.error("Erro na sincronização: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleOFXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Selecione um arquivo .OFX válido");
      return;
    }
    setLoadingOFX(true);
    // For now, just show a success message - OFX parsing would be handled server-side
    toast.info("Upload OFX recebido. Processamento em desenvolvimento.");
    setLoadingOFX(false);
    e.target.value = "";
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "ativo":
      case "sucesso":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "erro":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "ativo":
      case "sucesso":
        return "default" as const;
      case "erro":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const feegowInteg = integracoes.find((i) => i.tipo === "feegow");
  const getnetInteg = integracoes.find((i) => i.tipo === "getnet");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie integrações, importe dados e configure parâmetros
          </p>
        </div>

        {/* Integrations */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Feegow Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-secondary" />
                  <CardTitle className="text-lg">Feegow</CardTitle>
                </div>
                <Badge variant={statusBadgeVariant(feegowInteg?.status || "inativo")}>
                  {feegowInteg?.status || "inativo"}
                </Badge>
              </div>
              <CardDescription>
                Sincroniza médicos, salas, convênios, pacientes e agendamentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {feegowInteg?.ultima_sincronizacao && (
                <p className="text-xs text-muted-foreground">
                  Última sincronização:{" "}
                  {new Date(feegowInteg.ultima_sincronizacao).toLocaleString("pt-BR")}
                </p>
              )}
              <Button onClick={handleSyncFeegow} disabled={syncing} className="w-full gap-2">
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Sincronizando..." : "Sincronizar Agora"}
              </Button>
            </CardContent>
          </Card>

          {/* Getnet Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-secondary" />
                  <CardTitle className="text-lg">Getnet</CardTitle>
                </div>
                <Badge variant={statusBadgeVariant(getnetInteg?.status || "inativo")}>
                  {getnetInteg?.status || "inativo"}
                </Badge>
              </div>
              <CardDescription>
                Conciliação automática de recebimentos de cartão
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getnetInteg?.ultima_sincronizacao && (
                <p className="text-xs text-muted-foreground mb-3">
                  Última sincronização:{" "}
                  {new Date(getnetInteg.ultima_sincronizacao).toLocaleString("pt-BR")}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Integração disponível em breve.
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* OFX Upload */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-secondary" />
              <CardTitle className="text-lg">Importar Extrato OFX</CardTitle>
            </div>
            <CardDescription>
              Importe extratos bancários no formato OFX para conciliação automática
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Label
                htmlFor="ofx-upload"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 px-6 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                <Upload className="h-4 w-4" />
                {loadingOFX ? "Processando..." : "Selecionar arquivo .OFX"}
              </Label>
              <Input
                id="ofx-upload"
                type="file"
                accept=".ofx"
                className="hidden"
                onChange={handleOFXUpload}
                disabled={loadingOFX}
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Sync History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Sincronizações</CardTitle>
          </CardHeader>
          <CardContent>
            {syncLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada.</p>
            ) : (
              <div className="space-y-3">
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon(log.status)}
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(log.inicio).toLocaleString("pt-BR")}
                        </p>
                        <p className="text-xs text-muted-foreground">{log.detalhes || "—"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={statusBadgeVariant(log.status)} className="text-xs">
                        {log.status}
                      </Badge>
                      {log.registros_processados != null && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {log.registros_processados} registros
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

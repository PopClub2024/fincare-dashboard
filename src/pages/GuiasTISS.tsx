import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ACCEPT_PLANILHAS, ACCEPT_DOCUMENTOS } from "@/lib/file-upload";
import {
  FileText, ClipboardCheck, Download, Upload, Eye, Printer,
  Search, Filter, CheckCircle, XCircle, Clock, AlertTriangle,
} from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

const STATUS_COLOR: Record<string, any> = {
  gerada: "secondary",
  lancada_portal: "default",
  confirmada: "default",
  glosada: "destructive",
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function GuiasTISS() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedGuia, setSelectedGuia] = useState<any>(null);

  const { data: guias = [] } = useQuery({
    queryKey: ["guias-tiss", clinicaId, statusFilter, tipoFilter],
    queryFn: async () => {
      if (!clinicaId) return [];
      let q = supabase
        .from("guias_tiss")
        .select("*, pacientes(nome, cpf, carteirinha, data_nascimento), medicos(nome, crm, especialidade), convenios(nome)")
        .eq("clinica_id", clinicaId)
        .order("created_at", { ascending: false });
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      if (tipoFilter !== "todos") q = q.eq("tipo_guia", tipoFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const stats = {
    geradas: guias.filter((g: any) => g.status === "gerada").length,
    lancadas: guias.filter((g: any) => g.status === "lancada_portal").length,
    confirmadas: guias.filter((g: any) => g.status === "confirmada").length,
    glosadas: guias.filter((g: any) => g.status === "glosada").length,
    consultas: guias.filter((g: any) => g.tipo_guia === "consulta" || g.tipo === "consulta").length,
    sadt: guias.filter((g: any) => g.tipo_guia === "sadt").length,
    valorTotal: guias.reduce((s: number, g: any) => s + Number(g.valor_total || 0), 0),
  };

  const filtered = guias.filter((g: any) =>
    (g as any).pacientes?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    g.numero_carteirinha?.includes(search) ||
    g.codigo_procedimento?.includes(search)
  );

  const atualizarStatus = async (id: string, novoStatus: string) => {
    await supabase.from("guias_tiss").update({ status: novoStatus } as any).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["guias-tiss"] });
    toast.success(`Status atualizado para: ${novoStatus}`);
  };

  const imprimirGuia = (guia: any) => {
    const pac = guia.pacientes || {};
    const med = guia.medicos || {};
    const conv = guia.convenios || {};
    const isSADT = guia.tipo_guia === "sadt";
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Guia TISS — ${isSADT ? "SP/SADT" : "Consulta"}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:11px;}
      h1{font-size:14px;text-align:center;margin-bottom:5px;}
      h2{font-size:12px;background:#eee;padding:4px 8px;margin:10px 0 5px;}
      table{width:100%;border-collapse:collapse;margin-bottom:10px;}
      td,th{border:1px solid #ccc;padding:3px 6px;text-align:left;}
      th{background:#f5f5f5;font-size:10px;}
      .header{display:flex;justify-content:space-between;border:1px solid #333;padding:8px;margin-bottom:10px;}
      .campo{margin:2px 0;}
      .campo label{font-weight:bold;font-size:10px;color:#666;}
      @media print{body{padding:5px;}}
    </style></head><body>
    <div class="header">
      <div><strong>GUIA DE ${isSADT ? "SP/SADT" : "CONSULTA"}</strong><br/>Padrao TISS — ANS</div>
      <div>N. Guia Prestador: ${guia.numero_guia || "AUTO"}<br/>Data: ${guia.data_atendimento || format(new Date(guia.created_at), "dd/MM/yyyy")}</div>
    </div>
    <h2>1 — Registro ANS</h2>
    <div class="campo"><label>Operadora:</label> ${conv.nome || "—"}</div>
    <h2>2 — Dados do Beneficiario</h2>
    <table><tr><th>Carteirinha</th><th>Nome</th><th>CPF</th><th>Nascimento</th></tr>
    <tr><td>${guia.numero_carteirinha || pac.carteirinha || ""}</td><td>${pac.nome || guia.nome_paciente || ""}</td><td>${pac.cpf || guia.cpf_paciente || ""}</td><td>${pac.data_nascimento || guia.data_nascimento_paciente || ""}</td></tr></table>
    <h2>3 — Dados do Contratado Executante</h2>
    <table><tr><th>CNES</th><th>Nome</th></tr>
    <tr><td>${guia.codigo_contratado || ""}</td><td>${guia.nome_contratado || ""}</td></tr></table>
    <h2>4 — Dados do Profissional Executante</h2>
    <table><tr><th>Conselho</th><th>N. Conselho</th><th>UF</th><th>Nome</th><th>CBO</th></tr>
    <tr><td>${guia.conselho_profissional || "CRM"}</td><td>${med.crm || guia.crm_medico || ""}</td><td>${guia.uf_conselho || ""}</td><td>${med.nome || guia.nome_profissional || ""}</td><td>${guia.codigo_cbo || ""}</td></tr></table>
    <h2>5 — Dados do Atendimento</h2>
    <table><tr><th>Tabela</th><th>Cod. Procedimento</th><th>Descricao</th><th>Qtd</th><th>Valor Unit.</th><th>Valor Total</th></tr>
    <tr><td>${guia.codigo_tabela || "22"}</td><td>${guia.codigo_procedimento || ""}</td><td>${isSADT ? "SP/SADT" : "Consulta em consultorio"}</td><td>${guia.quantidade || 1}</td><td>${formatCurrency(Number(guia.valor_procedimento || 0))}</td><td>${formatCurrency(Number(guia.valor_total || 0))}</td></tr></table>
    <div class="campo"><label>Tipo Atendimento:</label> ${guia.tipo_atendimento || "05"} | <label>Carater:</label> ${guia.carater_atendimento || "1"} | <label>Regime:</label> ${guia.regime_atendimento || "01"}</div>
    ${guia.token ? `<div class="campo"><label>Token:</label> ${guia.token}</div>` : ""}
    ${guia.indicacao_clinica ? `<div class="campo"><label>Indicacao Clinica:</label> ${guia.indicacao_clinica}</div>` : ""}
    <div style="margin-top:40px;text-align:center;font-size:10px;color:#999;">Guia gerada pelo Medic Pop — ${format(new Date(), "dd/MM/yyyy HH:mm")}</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Faturamento TISS</h1>
          <p className="text-sm text-muted-foreground">Guias de Consulta e SP/SADT — Padrao ANS/TISS. Geradas automaticamente no check-in de convenio.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-7 gap-3">
          {[
            { label: "Geradas", value: stats.geradas, color: "text-blue-600" },
            { label: "Lancadas", value: stats.lancadas, color: "text-yellow-600" },
            { label: "Confirmadas", value: stats.confirmadas, color: "text-green-600" },
            { label: "Glosadas", value: stats.glosadas, color: "text-red-600" },
            { label: "Consultas", value: stats.consultas, color: "text-purple-600" },
            { label: "SP/SADT", value: stats.sadt, color: "text-teal-600" },
            { label: "Valor Total", value: formatCurrency(stats.valorTotal), color: "text-emerald-600" },
          ].map((k) => (
            <Card key={k.label}><CardContent className="p-3 text-center"><p className={`text-lg font-bold ${k.color}`}>{k.value}</p><p className="text-[10px] text-muted-foreground">{k.label}</p></CardContent></Card>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar paciente, carteirinha, procedimento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="gerada">Geradas</SelectItem>
              <SelectItem value="lancada_portal">Lancadas Portal</SelectItem>
              <SelectItem value="confirmada">Confirmadas</SelectItem>
              <SelectItem value="glosada">Glosadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos tipos</SelectItem>
              <SelectItem value="consulta">Consulta</SelectItem>
              <SelectItem value="sadt">SP/SADT</SelectItem>
            </SelectContent>
          </Select>
          <ExportButtons data={flattenForExport(filtered, { Data: (r: any) => r.data_atendimento || "", Tipo: "tipo_guia", Paciente: (r: any) => r.pacientes?.nome, Carteirinha: "numero_carteirinha", Medico: (r: any) => r.medicos?.nome, Convenio: (r: any) => r.convenios?.nome, Procedimento: "codigo_procedimento", Token: "token", Valor: "valor_total", Status: "status" })} filename="guias-tiss" titulo="Faturamento TISS" />
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">
            <Upload className="h-4 w-4" /> Importar Relatorio
            <input type="file" accept={ACCEPT_PLANILHAS + "," + ACCEPT_DOCUMENTOS} multiple className="hidden" onChange={(e) => {
              if (e.target.files?.length) toast.info(`${e.target.files.length} arquivo(s) para importacao`);
              e.target.value = "";
            }} />
          </label>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Carteirinha</TableHead>
                  <TableHead>Medico</TableHead>
                  <TableHead>Convenio</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8">Nenhuma guia encontrada</TableCell></TableRow>
                ) : filtered.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell className="text-xs">{g.data_atendimento || format(new Date(g.created_at), "dd/MM/yy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {g.tipo_guia === "sadt" ? "SP/SADT" : "Consulta"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{(g as any).pacientes?.nome || g.nome_paciente}</TableCell>
                    <TableCell className="text-xs font-mono">{g.numero_carteirinha || "—"}</TableCell>
                    <TableCell className="text-xs">{(g as any).medicos?.nome || g.nome_profissional}</TableCell>
                    <TableCell className="text-xs">{(g as any).convenios?.nome || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{g.codigo_procedimento}</TableCell>
                    <TableCell>
                      {g.token ? (
                        <Badge variant="default" className="text-[10px]">{g.token}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{g.valor_total ? formatCurrency(Number(g.valor_total)) : "—"}</TableCell>
                    <TableCell><Badge variant={STATUS_COLOR[g.status] as any || "outline"}>{g.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => imprimirGuia(g)} title="Imprimir guia TISS">
                          <Printer className="h-3 w-3" />
                        </Button>
                        {g.status === "gerada" && (
                          <Button size="sm" variant="outline" onClick={() => atualizarStatus(g.id, "lancada_portal")} title="Marcar como lancada no portal">
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                        {g.status === "lancada_portal" && (
                          <Button size="sm" variant="outline" onClick={() => atualizarStatus(g.id, "confirmada")} title="Confirmar">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Info sobre fluxo */}
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="p-4">
            <p className="font-semibold text-sm text-blue-800 mb-2">Fluxo automatico TISS:</p>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal pl-4">
              <li>Paciente de <strong>convenio</strong> faz check-in na recepcao</li>
              <li>Sistema gera automaticamente a guia TISS com todos os dados pre-preenchidos (carteirinha, CRM, codigo 10101012, dados ANS)</li>
              <li>Operador acessa o checklist, valida os dados e copia para o portal do convenio</li>
              <li>Marca como "Lancada Portal" e depois "Confirmada" quando o convenio processar</li>
              <li>Para SP/SADT: crie guias manualmente com codigo de procedimento especifico (exames, fisioterapia, etc.)</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

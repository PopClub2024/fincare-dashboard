import { useState, useEffect, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
  Tooltip as RTooltip, PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, Target, AlertTriangle, Plus, Settings2,
  FileText, CheckCircle2, XCircle, RefreshCw, ChevronRight, Percent,
  Calculator, BarChart3, Layers,
} from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface Premissas {
  id: string;
  cf_total_mensal: number;
  aliquota_lp_pct: number;
  taxa_cartao_pct: number;
  comissao_faturista_pct: number;
  meta_lucro_ideal: number;
  meta_lucro_saudavel: number;
  meta_lucro_conservador: number;
  meta_lucro_excelente: number;
}

interface Pagador {
  id: string;
  nome: string;
  tipo: string;
  usa_taxa_cartao: boolean;
  usa_comissao_faturista: boolean;
  comissao_faturista_pct: number;
  cf_alocado_pct: number;
  cf_alocado_valor: number;
  ativo: boolean;
}

interface Procedimento {
  id: string;
  nome: string;
  tipo: string;
  especialidade: string | null;
}

interface PrecoItem {
  id: string;
  pagador_id: string;
  procedimento_id: string;
  preco_bruto: number;
  repasse_medico: number;
  repasse_medico_pct: number | null;
  custo_variavel: number;
  vigente_de: string;
  vigente_ate: string | null;
  status: string;
  observacao: string | null;
}

interface Rascunho {
  id: string;
  nome_cenario: string;
  descricao: string | null;
  status: string;
  created_at: string;
}

interface RascunhoItem {
  id: string;
  rascunho_id: string;
  pagador_id: string;
  procedimento_id: string;
  novo_preco_bruto: number;
  novo_repasse: number | null;
  vigente_de: string;
  observacao: string | null;
  status_sync_feegow: string;
}

// ==================== HELPER: MC calculation ====================
function calcMC(preco: number, repasse: number, custoVar: number, aliquotaLP: number, taxaCartao: number, usaCartao: boolean, comissaoFat: number, usaFaturista: boolean) {
  const tributos = preco * (aliquotaLP / 100);
  const cartao = usaCartao ? preco * (taxaCartao / 100) : 0;
  const faturista = usaFaturista ? preco * (comissaoFat / 100) : 0;
  const mc = preco - repasse - custoVar - tributos - cartao - faturista;
  const mcPct = preco > 0 ? (mc / preco) * 100 : 0;
  return { mc, mcPct, tributos, cartao, faturista };
}

function calcPE(cfAlocado: number, mcPctMedia: number, precoMedio: number) {
  if (mcPctMedia <= 0 || precoMedio <= 0) return { peFinR: 0, peFinQtd: 0 };
  const mcMedia = precoMedio * (mcPctMedia / 100);
  const peFinQtd = Math.ceil(cfAlocado / mcMedia);
  const peFinR = cfAlocado / (mcPctMedia / 100);
  return { peFinR, peFinQtd };
}

function calcPELucro(cfAlocado: number, mcPctMedia: number, lucroPct: number) {
  if (mcPctMedia <= 0) return 0;
  return cfAlocado / ((mcPctMedia - lucroPct) / 100);
}

// ==================== MAIN COMPONENT ====================
export default function Precificacao() {
  const { clinicaId } = useAuth();
  const [premissas, setPremissas] = useState<Premissas | null>(null);
  const [pagadores, setPagadores] = useState<Pagador[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [precos, setPrecos] = useState<PrecoItem[]>([]);
  const [rascunhos, setRascunhos] = useState<Rascunho[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("painel");
  const [selectedPagador, setSelectedPagador] = useState<string | null>(null);
  const [showNewRascunho, setShowNewRascunho] = useState(false);
  const [newRascunhoNome, setNewRascunhoNome] = useState("");
  const [editingPremissas, setEditingPremissas] = useState(false);
  const [premissasForm, setPremissasForm] = useState<Partial<Premissas>>({});

  const fetchAll = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    const [prem, pag, proc, prec, rasc] = await Promise.all([
      supabase.from("premissas_precificacao").select("*").eq("clinica_id", clinicaId).maybeSingle(),
      supabase.from("pagadores").select("*").eq("clinica_id", clinicaId).eq("ativo", true).order("nome"),
      supabase.from("procedimentos").select("*").eq("clinica_id", clinicaId).eq("ativo", true).order("nome"),
      supabase.from("precos_procedimento").select("*").eq("clinica_id", clinicaId).eq("status", "publicado").is("vigente_ate", null),
      supabase.from("precos_rascunho").select("*").eq("clinica_id", clinicaId).neq("status", "cancelado").order("created_at", { ascending: false }),
    ]);
    setPremissas((prem.data as any) || null);
    setPagadores((pag.data as any[]) || []);
    setProcedimentos((proc.data as any[]) || []);
    setPrecos((prec.data as any[]) || []);
    setRascunhos((rasc.data as any[]) || []);
    setLoading(false);
  }, [clinicaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Initialize premissas if not present
  const initPremissas = async () => {
    if (premissas || !clinicaId) return;
    const { data, error } = await supabase.from("premissas_precificacao").insert({
      clinica_id: clinicaId,
      cf_total_mensal: 76683.03,
      aliquota_lp_pct: 7.93,
      taxa_cartao_pct: 3.16,
      comissao_faturista_pct: 1.50,
    } as any).select().single();
    if (!error) setPremissas(data as any);
  };

  useEffect(() => { if (!loading && !premissas) initPremissas(); }, [loading, premissas]);

  const savePremissas = async () => {
    if (!premissas) return;
    const { error } = await supabase.from("premissas_precificacao").update(premissasForm as any).eq("id", premissas.id);
    if (error) toast.error(error.message);
    else { toast.success("Premissas salvas!"); setEditingPremissas(false); fetchAll(); }
  };

  // Computed: prices grouped by pagador
  const precosByPagador = useMemo(() => {
    const map: Record<string, PrecoItem[]> = {};
    precos.forEach((p) => {
      if (!map[p.pagador_id]) map[p.pagador_id] = [];
      map[p.pagador_id].push(p);
    });
    return map;
  }, [precos]);

  // Computed: summary per pagador
  const pagadorSummary = useMemo(() => {
    if (!premissas) return [];
    return pagadores.map((pag) => {
      const items = precosByPagador[pag.id] || [];
      if (items.length === 0) return { ...pag, precoMedio: 0, mcMedia: 0, mcPctMedia: 0, peFinR: 0, peFinQtd: 0, qtdProcs: 0 };
      const procMap = new Map(procedimentos.map(p => [p.id, p]));
      let totalPreco = 0, totalMC = 0;
      items.forEach((item) => {
        const { mc } = calcMC(item.preco_bruto, item.repasse_medico, item.custo_variavel, premissas.aliquota_lp_pct, premissas.taxa_cartao_pct, pag.usa_taxa_cartao, premissas.comissao_faturista_pct, pag.usa_comissao_faturista);
        totalPreco += item.preco_bruto;
        totalMC += mc;
      });
      const precoMedio = totalPreco / items.length;
      const mcMedia = totalMC / items.length;
      const mcPctMedia = precoMedio > 0 ? (mcMedia / precoMedio) * 100 : 0;
      const cfAlocado = pag.cf_alocado_valor || (premissas.cf_total_mensal * (pag.cf_alocado_pct / 100));
      const { peFinR, peFinQtd } = calcPE(cfAlocado, mcPctMedia, precoMedio);
      return { ...pag, precoMedio, mcMedia, mcPctMedia, peFinR, peFinQtd, qtdProcs: items.length, cfAlocado };
    }).filter(p => p.qtdProcs > 0);
  }, [pagadores, precosByPagador, premissas, procedimentos]);

  // Computed: global summary
  const globalSummary = useMemo(() => {
    if (!premissas || pagadorSummary.length === 0) return { mcPctMedia: 0, peFinR: 0, pe15R: 0, pe20R: 0, pe30R: 0 };
    const totalPreco = pagadorSummary.reduce((s, p) => s + p.precoMedio * p.qtdProcs, 0);
    const totalMC = pagadorSummary.reduce((s, p) => s + p.mcMedia * p.qtdProcs, 0);
    const totalProcs = pagadorSummary.reduce((s, p) => s + p.qtdProcs, 0);
    const mcPctMedia = totalPreco > 0 ? (totalMC / totalPreco) * 100 : 0;
    const cf = premissas.cf_total_mensal;
    const peFinR = mcPctMedia > 0 ? cf / (mcPctMedia / 100) : 0;
    const pe15R = mcPctMedia > 15 ? cf / ((mcPctMedia - 15) / 100) : 0;
    const pe20R = mcPctMedia > 20 ? cf / ((mcPctMedia - 20) / 100) : 0;
    const pe30R = mcPctMedia > 30 ? cf / ((mcPctMedia - 30) / 100) : 0;
    return { mcPctMedia, peFinR, pe15R, pe20R, pe30R };
  }, [pagadorSummary, premissas]);

  const createRascunho = async () => {
    if (!newRascunhoNome || !clinicaId) return;
    const { error } = await supabase.from("precos_rascunho").insert({
      clinica_id: clinicaId,
      nome_cenario: newRascunhoNome,
      status: "rascunho",
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Cenário criado!"); setShowNewRascunho(false); setNewRascunhoNome(""); fetchAll(); }
  };

  const updateRascunhoStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("precos_rascunho").update({ status: newStatus } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`Cenário ${newStatus === "aprovado" ? "aprovado" : newStatus === "cancelado" ? "cancelado" : "atualizado"}!`); fetchAll(); }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center p-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Precificação & Ponto de Equilíbrio</h1>
            <p className="text-sm text-muted-foreground">Preços, margens, PE e simulações — dados da planilha consolidada</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap bg-muted">
            <TabsTrigger value="painel">🎯 Painel Geral</TabsTrigger>
            <TabsTrigger value="premissas">⚙️ Premissas</TabsTrigger>
            <TabsTrigger value="pagadores">📋 Por Pagador</TabsTrigger>
            <TabsTrigger value="pe">📊 PE Consolidado</TabsTrigger>
            <TabsTrigger value="margem">📈 Análise Margem</TabsTrigger>
            <TabsTrigger value="simulacoes">🔬 Simulações</TabsTrigger>
          </TabsList>

          {/* ==================== PAINEL GERAL ==================== */}
          <TabsContent value="painel" className="space-y-4">
            <PainelGeral premissas={premissas} pagadorSummary={pagadorSummary} globalSummary={globalSummary} />
          </TabsContent>

          {/* ==================== PREMISSAS ==================== */}
          <TabsContent value="premissas" className="space-y-4">
            <PremissasTab
              premissas={premissas}
              editing={editingPremissas}
              form={premissasForm}
              onEdit={() => { setEditingPremissas(true); setPremissasForm(premissas || {}); }}
              onCancel={() => setEditingPremissas(false)}
              onSave={savePremissas}
              onFormChange={setPremissasForm}
              pagadores={pagadores}
            />
          </TabsContent>

          {/* ==================== POR PAGADOR ==================== */}
          <TabsContent value="pagadores" className="space-y-4">
            <PorPagadorTab
              pagadores={pagadores}
              pagadorSummary={pagadorSummary}
              precosByPagador={precosByPagador}
              procedimentos={procedimentos}
              premissas={premissas}
              selectedPagador={selectedPagador}
              onSelectPagador={setSelectedPagador}
            />
          </TabsContent>

          {/* ==================== PE CONSOLIDADO ==================== */}
          <TabsContent value="pe" className="space-y-4">
            <PEConsolidadoTab premissas={premissas} pagadorSummary={pagadorSummary} globalSummary={globalSummary} />
          </TabsContent>

          {/* ==================== ANÁLISE MARGEM ==================== */}
          <TabsContent value="margem" className="space-y-4">
            <AnaliseMargem
              pagadorSummary={pagadorSummary}
              precosByPagador={precosByPagador}
              procedimentos={procedimentos}
              premissas={premissas}
              pagadores={pagadores}
            />
          </TabsContent>

          {/* ==================== SIMULAÇÕES ==================== */}
          <TabsContent value="simulacoes" className="space-y-4">
            <SimulacoesTab
              rascunhos={rascunhos}
              onCreateRascunho={() => setShowNewRascunho(true)}
              onUpdateStatus={updateRascunhoStatus}
              clinicaId={clinicaId}
            />
          </TabsContent>
        </Tabs>

        {/* Dialog: Novo Rascunho */}
        <Dialog open={showNewRascunho} onOpenChange={setShowNewRascunho}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cenário de Simulação</DialogTitle>
              <DialogDescription>Crie um rascunho para simular alterações de preço sem afetar os valores oficiais ou o Feegow.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome do cenário *</Label>
                <Input value={newRascunhoNome} onChange={(e) => setNewRascunhoNome(e.target.value)} placeholder="Ex: Aumento 5% consultas particulares" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewRascunho(false)}>Cancelar</Button>
              <Button onClick={createRascunho}>Criar Cenário</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// ==================== KPI CARD ====================
function KpiCard({ label, value, icon, subtitle, alert }: {
  label: string; value: string; icon: React.ReactNode; subtitle?: string; alert?: boolean;
}) {
  return (
    <Card className={`border-0 shadow-md ${alert ? "ring-2 ring-destructive/30" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className={`mt-1 text-xl font-bold ${alert ? "text-destructive" : "text-foreground"}`}>{value}</div>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ==================== PAINEL GERAL ====================
function PainelGeral({ premissas, pagadorSummary, globalSummary }: {
  premissas: Premissas | null; pagadorSummary: any[]; globalSummary: any;
}) {
  if (!premissas) return <EmptyState msg="Configure as premissas primeiro na aba ⚙️ Premissas." />;
  if (pagadorSummary.length === 0) return <EmptyState msg="Nenhum pagador com preços cadastrados. Importe os preços da planilha ou cadastre manualmente." />;

  const chartData = pagadorSummary.map((p) => ({
    name: p.nome.length > 15 ? p.nome.substring(0, 15) + "…" : p.nome,
    mc: parseFloat(p.mcPctMedia.toFixed(1)),
    cf: parseFloat((p.cfAlocado || 0).toFixed(0)),
  }));

  const COLORS = [
    "hsl(var(--primary))", "hsl(152, 60%, 40%)", "hsl(32, 85%, 50%)",
    "hsl(280, 60%, 50%)", "hsl(204, 67%, 42%)", "hsl(0, 70%, 50%)",
    "hsl(180, 50%, 40%)", "hsl(60, 70%, 45%)", "hsl(330, 60%, 50%)",
  ];

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="MC Ponderada Clínica" value={fmtPct(globalSummary.mcPctMedia)} icon={<Percent className="h-4 w-4" />} />
        <KpiCard label="PE Financeiro (0% lucro)" value={fmt(globalSummary.peFinR)} icon={<Target className="h-4 w-4" />} subtitle="Faturamento mínimo" />
        <KpiCard label="PE 15% Lucro ✅" value={fmt(globalSummary.pe15R)} icon={<TrendingUp className="h-4 w-4" />} subtitle="Meta saudável" />
        <KpiCard label="PE 20% Lucro ✅ Ideal" value={fmt(globalSummary.pe20R)} icon={<DollarSign className="h-4 w-4" />} subtitle="Meta ideal" />
      </div>

      {/* Metas por Canal */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">📋 Metas por Canal</CardTitle>
          <CardDescription>Quantidades para atingir PE e margens mensais</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Canal / Fonte</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Preço Médio</TableHead>
                <TableHead className="text-right">MC Média</TableHead>
                <TableHead className="text-right">% MC</TableHead>
                <TableHead className="text-right">CF Alocado</TableHead>
                <TableHead className="text-right">Qtd PE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagadorSummary.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell><Badge variant={p.tipo === "particular" ? "default" : "secondary"}>{p.tipo === "particular" ? "PARTICULAR" : "CONVÊNIO"}</Badge></TableCell>
                  <TableCell className="text-right">{fmt(p.precoMedio)}</TableCell>
                  <TableCell className="text-right">{fmt(p.mcMedia)}</TableCell>
                  <TableCell className={`text-right font-medium ${p.mcPctMedia < 20 ? "text-destructive" : p.mcPctMedia < 35 ? "text-amber-600" : "text-emerald-600"}`}>{fmtPct(p.mcPctMedia)}</TableCell>
                  <TableCell className="text-right">{fmt(p.cfAlocado || 0)}</TableCell>
                  <TableCell className="text-right font-medium">{p.peFinQtd}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-accent/50">
                <TableCell></TableCell>
                <TableCell>TOTAL / CLÍNICA</TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right">{fmtPct(globalSummary.mcPctMedia)}</TableCell>
                <TableCell className="text-right">{fmt(premissas.cf_total_mensal)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MC% chart */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">📊 MC% por Canal</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} className="text-xs" />
                <YAxis type="category" dataKey="name" className="text-xs" width={100} />
                <RTooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="mc" name="MC%" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== PREMISSAS TAB ====================
function PremissasTab({ premissas, editing, form, onEdit, onCancel, onSave, onFormChange, pagadores }: any) {
  if (!premissas) return <EmptyState msg="Premissas serão criadas automaticamente..." />;

  const cfItems = [
    { label: "Custo Fixo Total Mensal", key: "cf_total_mensal", fmt: "R$" },
    { label: "Alíquota Lucro Presumido", key: "aliquota_lp_pct", fmt: "%" },
    { label: "Taxa de Cartão (crédito/débito)", key: "taxa_cartao_pct", fmt: "%" },
    { label: "Comissão Faturista (convênios)", key: "comissao_faturista_pct", fmt: "%" },
    { label: "Meta Lucro — Conservador", key: "meta_lucro_conservador", fmt: "%" },
    { label: "Meta Lucro — Saudável (15%)", key: "meta_lucro_saudavel", fmt: "%" },
    { label: "Meta Lucro — Ideal (20%)", key: "meta_lucro_ideal", fmt: "%" },
    { label: "Meta Lucro — Excelente (30%)", key: "meta_lucro_excelente", fmt: "%" },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">⚙️ Premissas Globais</CardTitle>
            <CardDescription>Valores em azul são editáveis — todas as abas atualizam automaticamente</CardDescription>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={onEdit}><Settings2 className="mr-2 h-4 w-4" />Editar</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
              <Button size="sm" onClick={onSave}>Salvar</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {cfItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-lg bg-accent/50 px-4 py-3">
                <span className="text-sm font-medium">{item.label}</span>
                {editing ? (
                  <Input
                    type="number"
                    step="0.01"
                    className="w-32 text-right"
                    value={(form as any)[item.key] ?? (premissas as any)[item.key]}
                    onChange={(e) => onFormChange({ ...form, [item.key]: parseFloat(e.target.value) || 0 })}
                  />
                ) : (
                  <span className="font-bold text-primary">
                    {item.fmt === "R$" ? fmt((premissas as any)[item.key]) : `${(premissas as any)[item.key]}%`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CF Distribution */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">📊 Distribuição do CF por Canal</CardTitle>
          <CardDescription>Ajuste a % de alocação do custo fixo por pagador</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">% Alocação</TableHead>
                <TableHead className="text-right">CF Alocado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagadores.map((p: Pagador) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-right">{fmtPct(p.cf_alocado_pct)}</TableCell>
                  <TableCell className="text-right">{fmt(p.cf_alocado_valor || premissas.cf_total_mensal * (p.cf_alocado_pct / 100))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-accent/50">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right">{fmtPct(pagadores.reduce((s: number, p: Pagador) => s + (p.cf_alocado_pct || 0), 0))}</TableCell>
                <TableCell className="text-right">{fmt(premissas.cf_total_mensal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== POR PAGADOR ====================
function PorPagadorTab({ pagadores, pagadorSummary, precosByPagador, procedimentos, premissas, selectedPagador, onSelectPagador }: any) {
  const procMap = useMemo(() => new Map<string, Procedimento>(procedimentos.map((p: Procedimento) => [p.id, p])), [procedimentos]);
  const pagMap = useMemo(() => new Map<string, Pagador>(pagadores.map((p: Pagador) => [p.id, p])), [pagadores]);

  if (!premissas) return <EmptyState msg="Configure premissas primeiro." />;

  const selectedPag = selectedPagador ? pagMap.get(selectedPagador) : null;
  const selectedItems = selectedPagador ? (precosByPagador[selectedPagador] || []) : [];
  const selectedSummary = pagadorSummary.find((p: any) => p.id === selectedPagador);

  return (
    <div className="space-y-4">
      {/* Pagador selector */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Label>Pagador:</Label>
            <Select value={selectedPagador || ""} onValueChange={onSelectPagador}>
              <SelectTrigger className="w-72"><SelectValue placeholder="Selecione um pagador" /></SelectTrigger>
              <SelectContent>
                {pagadores.map((p: Pagador) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome} ({p.tipo})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedPag && selectedItems.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Preço Médio" value={fmt(selectedSummary?.precoMedio || 0)} icon={<DollarSign className="h-4 w-4" />} />
            <KpiCard label="MC Média" value={fmt(selectedSummary?.mcMedia || 0)} icon={<TrendingUp className="h-4 w-4" />} />
            <KpiCard label="% MC Média" value={fmtPct(selectedSummary?.mcPctMedia || 0)} icon={<Percent className="h-4 w-4" />} />
            <KpiCard label="PE Financeiro" value={`${selectedSummary?.peFinQtd || 0} atend.`} icon={<Target className="h-4 w-4" />} subtitle={fmt(selectedSummary?.peFinR || 0)} />
          </div>

          {/* Price table */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">{selectedPag.nome} — Tabela de Preços</CardTitle>
              <CardDescription>
                {selectedPag.usa_taxa_cartao ? "COM taxa de cartão" : "SEM taxa de cartão"} | LP {premissas.aliquota_lp_pct}%
                {selectedPag.usa_comissao_faturista ? ` | Faturista ${premissas.comissao_faturista_pct}%` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Procedimento</TableHead>
                    <TableHead className="text-right">Preço (R$)</TableHead>
                    <TableHead className="text-right">Repasse (R$)</TableHead>
                    <TableHead className="text-right">Tributos</TableHead>
                    {selectedPag.usa_taxa_cartao && <TableHead className="text-right">Cartão</TableHead>}
                    <TableHead className="text-right">MC (R$)</TableHead>
                    <TableHead className="text-right">% MC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedItems.map((item: PrecoItem, i: number) => {
                    const proc = procMap.get(item.procedimento_id);
                    const { mc, mcPct, tributos, cartao } = calcMC(
                      item.preco_bruto, item.repasse_medico, item.custo_variavel,
                      premissas.aliquota_lp_pct, premissas.taxa_cartao_pct,
                      selectedPag.usa_taxa_cartao, premissas.comissao_faturista_pct, selectedPag.usa_comissao_faturista
                    );
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{proc?.nome || "—"}</TableCell>
                        <TableCell className="text-right">{fmt(item.preco_bruto)}</TableCell>
                        <TableCell className="text-right">{fmt(item.repasse_medico)}</TableCell>
                        <TableCell className="text-right">{fmt(tributos)}</TableCell>
                        {selectedPag.usa_taxa_cartao && <TableCell className="text-right">{fmt(cartao)}</TableCell>}
                        <TableCell className={`text-right font-medium ${mc < 0 ? "text-destructive" : ""}`}>{fmt(mc)}</TableCell>
                        <TableCell className={`text-right font-medium ${mcPct < 0 ? "text-destructive" : mcPct < 20 ? "text-amber-600" : "text-emerald-600"}`}>
                          {fmtPct(mcPct)}
                          {mcPct < 0 && " ⚠️"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {selectedPagador && selectedItems.length === 0 && (
        <EmptyState msg="Nenhum preço cadastrado para este pagador." />
      )}
    </div>
  );
}

// ==================== PE CONSOLIDADO ====================
function PEConsolidadoTab({ premissas, pagadorSummary, globalSummary }: any) {
  if (!premissas) return <EmptyState msg="Configure premissas primeiro." />;

  const peData = [
    { name: "Sobrevivência (0%)", valor: globalSummary.peFinR, desc: "Zero margem" },
    { name: "Conservador (10%)", valor: globalSummary.mcPctMedia > 10 ? premissas.cf_total_mensal / ((globalSummary.mcPctMedia - 10) / 100) : 0, desc: "Equilíbrio básico" },
    { name: "Saudável (15%) ✅", valor: globalSummary.pe15R, desc: "Meta mínima" },
    { name: "Ideal (20%) ✅", valor: globalSummary.pe20R, desc: "Meta ideal" },
    { name: "Excelente (30%)", valor: globalSummary.pe30R, desc: "Alto mix particular" },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">📊 Resumo Executivo — Faturamento necessário por cenário</CardTitle>
          <CardDescription>MC Ponderada: {fmtPct(globalSummary.mcPctMedia)} | CF Total: {fmt(premissas.cf_total_mensal)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {peData.map((pe) => (
              <div key={pe.name} className="flex items-center justify-between rounded-lg bg-accent/50 px-4 py-3">
                <div>
                  <span className="font-medium">{pe.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{pe.desc}</span>
                </div>
                <span className="text-lg font-bold text-primary">{pe.valor > 0 ? fmt(pe.valor) : "Inviável"}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PE per channel */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">PE por Canal</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">% MC</TableHead>
                <TableHead className="text-right">CF Alocado</TableHead>
                <TableHead className="text-right">PE Fin. (R$)</TableHead>
                <TableHead className="text-right">PE Fin. (qtd)</TableHead>
                <TableHead className="text-right">PE 15%</TableHead>
                <TableHead className="text-right">PE 20%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagadorSummary.map((p: any) => {
                const cf = p.cfAlocado || 0;
                const pe15 = p.mcPctMedia > 15 ? cf / ((p.mcPctMedia - 15) / 100) : 0;
                const pe20 = p.mcPctMedia > 20 ? cf / ((p.mcPctMedia - 20) / 100) : 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-right">{fmtPct(p.mcPctMedia)}</TableCell>
                    <TableCell className="text-right">{fmt(cf)}</TableCell>
                    <TableCell className="text-right">{fmt(p.peFinR)}</TableCell>
                    <TableCell className="text-right font-medium">{p.peFinQtd}</TableCell>
                    <TableCell className="text-right">{pe15 > 0 ? fmt(pe15) : "—"}</TableCell>
                    <TableCell className="text-right">{pe20 > 0 ? fmt(pe20) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== ANÁLISE MARGEM ====================
function AnaliseMargem({ pagadorSummary, precosByPagador, procedimentos, premissas, pagadores }: any) {
  if (!premissas) return <EmptyState msg="Configure premissas primeiro." />;

  const procMap = new Map<string, Procedimento>(procedimentos.map((p: Procedimento) => [p.id, p]));
  const pagMap = new Map<string, Pagador>(pagadores.map((p: Pagador) => [p.id, p]));

  // Find critical items (MC < 20%)
  const criticalItems: { pagador: string; proc: string; mc: number; mcPct: number; preco: number }[] = [];
  Object.entries(precosByPagador).forEach(([pagId, items]: [string, any]) => {
    const pag = pagMap.get(pagId);
    if (!pag) return;
    (items as PrecoItem[]).forEach((item) => {
      const { mc, mcPct } = calcMC(item.preco_bruto, item.repasse_medico, item.custo_variavel,
        premissas.aliquota_lp_pct, premissas.taxa_cartao_pct, pag.usa_taxa_cartao,
        premissas.comissao_faturista_pct, pag.usa_comissao_faturista);
      if (mcPct < 20) {
        const procFound = procMap.get(item.procedimento_id);
        criticalItems.push({ pagador: pag.nome, proc: (procFound as Procedimento | undefined)?.nome || "—", mc, mcPct, preco: item.preco_bruto });
      }
    });
  });
  criticalItems.sort((a, b) => a.mcPct - b.mcPct);

  return (
    <div className="space-y-4">
      {/* Critical items */}
      <Card className="border-0 shadow-md ring-2 ring-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            ⚠️ Itens com MC Crítica ({'<'} 20%)
          </CardTitle>
          <CardDescription>{criticalItems.length} itens precisam de atenção</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {criticalItems.length === 0 ? (
            <div className="p-6 text-center text-emerald-600 font-medium">✅ Nenhum item com MC crítica!</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pagador</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">MC (R$)</TableHead>
                  <TableHead className="text-right">% MC</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {criticalItems.slice(0, 20).map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{item.pagador}</TableCell>
                    <TableCell className="font-medium">{item.proc}</TableCell>
                    <TableCell className="text-right">{fmt(item.preco)}</TableCell>
                    <TableCell className={`text-right font-medium ${item.mc < 0 ? "text-destructive" : "text-amber-600"}`}>{fmt(item.mc)}</TableCell>
                    <TableCell className={`text-right font-medium ${item.mcPct < 0 ? "text-destructive" : "text-amber-600"}`}>{fmtPct(item.mcPct)}</TableCell>
                    <TableCell>
                      {item.mcPct < 0 ? (
                        <Badge variant="destructive">PREJUÍZO</Badge>
                      ) : item.mcPct < 10 ? (
                        <Badge variant="destructive">CRÍTICA</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">BAIXA</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ranking by MC */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">🏆 Ranking de Canais por MC%</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...pagadorSummary].sort((a: any, b: any) => b.mcPctMedia - a.mcPctMedia).map((p: any, i: number) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className={`w-6 text-center font-bold ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{p.nome}</span>
                    <span className={`font-bold ${p.mcPctMedia > 40 ? "text-emerald-600" : p.mcPctMedia > 25 ? "text-foreground" : "text-amber-600"}`}>{fmtPct(p.mcPctMedia)}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${p.mcPctMedia > 40 ? "bg-emerald-500" : p.mcPctMedia > 25 ? "bg-primary" : "bg-amber-500"}`} style={{ width: `${Math.min(100, p.mcPctMedia)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== SIMULAÇÕES ====================
function SimulacoesTab({ rascunhos, onCreateRascunho, onUpdateStatus, clinicaId }: any) {
  const statusBadge = (s: string) => {
    switch (s) {
      case "rascunho": return <Badge variant="outline">Rascunho</Badge>;
      case "aprovado": return <Badge variant="default" className="bg-amber-500">Aprovado</Badge>;
      case "publicado": return <Badge variant="secondary" className="bg-emerald-500 text-white">Publicado</Badge>;
      case "cancelado": return <Badge variant="destructive">Cancelado</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">🔬 Cenários de Simulação</CardTitle>
            <CardDescription>
              Simulações não alteram preços oficiais nem o Feegow. Somente cenários "Aprovados" podem ser publicados.
            </CardDescription>
          </div>
          <Button onClick={onCreateRascunho} className="gap-2"><Plus className="h-4 w-4" />Novo Cenário</Button>
        </CardHeader>
        <CardContent>
          {rascunhos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhum cenário criado. Clique em "Novo Cenário" para simular alterações de preço.
            </div>
          ) : (
            <div className="space-y-3">
              {rascunhos.map((r: Rascunho) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.nome_cenario}</span>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criado em {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "rascunho" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => onUpdateStatus(r.id, "aprovado")}>
                          <CheckCircle2 className="mr-1 h-3 w-3" />Aprovar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onUpdateStatus(r.id, "cancelado")}>
                          <XCircle className="mr-1 h-3 w-3" />Cancelar
                        </Button>
                      </>
                    )}
                    {r.status === "aprovado" && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                        <RefreshCw className="h-3 w-3" />Publicar no Feegow
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Regras de Segurança</p>
              <ul className="mt-1 text-sm text-amber-700 dark:text-amber-300 space-y-0.5">
                <li>• Simulações <strong>nunca</strong> alteram o Feegow</li>
                <li>• Somente cenários "Aprovados" podem ser publicados</li>
                <li>• Publicação gera log de auditoria e requer confirmação</li>
                <li>• Se falhar no Feegow, itens ficam como "erro" e podem ser reprocessados</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== EMPTY STATE ====================
function EmptyState({ msg }: { msg: string }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-12 text-center text-muted-foreground">{msg}</CardContent>
    </Card>
  );
}

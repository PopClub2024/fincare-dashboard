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
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";
import {
  DollarSign, TrendingUp, Users, Plus, Pencil, Trash2, Save, X,
  AlertTriangle, ArrowUpDown, Building2, Percent,
} from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  tipo: string;
  salario_bruto: number;
  insalubridade: number;
  vale_transporte: number;
  inss_patronal_pct: number;
  fgts_pct: number;
  ferias_pct: number;
  decimo_terceiro_pct: number;
  diarias_semanais: number;
  valor_diaria: number;
  passagem_dia: number;
  semanas_mes: number;
  bolsa_mensal: number;
  auxilio_transporte: number;
  valor_mensal_prestador: number;
  ativo: boolean;
}

interface CustoFixoItem {
  id: string;
  codigo_pc: string | null;
  descricao: string;
  grupo: string;
  valor_mensal: number;
  recorrencia: string;
  observacao: string | null;
  fonte_funcionarios: boolean;
  ativo: boolean;
}

interface CaixaHistorico {
  ano: number;
  mes: number;
  saidas_custos_fixos: number;
  saidas_mao_obra: number;
  saidas_marketing: number;
}

// Calculate employee total cost
function calcFuncCost(f: Funcionario): { encargos: number; custoTotal: number } {
  if (f.tipo === "clt") {
    const base = f.salario_bruto + f.insalubridade;
    const inss = base * (f.inss_patronal_pct / 100);
    const fgts = base * (f.fgts_pct / 100);
    const ferias = base * (f.ferias_pct / 100);
    const decimo = base * (f.decimo_terceiro_pct / 100);
    const encargos = inss + fgts + ferias + decimo;
    return { encargos, custoTotal: f.salario_bruto + f.insalubridade + f.vale_transporte + encargos };
  }
  if (f.tipo === "diarista") {
    const diarias = f.diarias_semanais * f.semanas_mes * f.valor_diaria;
    const passagem = f.diarias_semanais * f.semanas_mes * f.passagem_dia;
    return { encargos: 0, custoTotal: diarias + passagem };
  }
  if (f.tipo === "estagiario") {
    return { encargos: 0, custoTotal: f.bolsa_mensal + f.auxilio_transporte };
  }
  // prestador
  return { encargos: 0, custoTotal: f.valor_mensal_prestador };
}

const GRUPO_ORDER = [
  "Pessoal e Encargos",
  "Ocupação e Infraestrutura",
  "Tecnologia e Sistemas",
  "Serviços Profissionais",
  "Marketing e Comunicação",
  "Seguros",
  "Manutenção",
  "Despesas Bancárias",
  "Obra / Expansão",
  "Taxas e Licenças",
  "Insumos Médicos",
  "Insumos Administrativos",
];

const COLORS = [
  "hsl(var(--primary))", "hsl(152, 60%, 40%)", "hsl(32, 85%, 50%)",
  "hsl(280, 60%, 50%)", "hsl(204, 67%, 42%)", "hsl(0, 70%, 50%)",
  "hsl(180, 50%, 40%)", "hsl(60, 70%, 45%)", "hsl(330, 60%, 50%)",
  "hsl(120, 40%, 50%)", "hsl(240, 50%, 60%)", "hsl(15, 80%, 55%)",
];

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function CustoFixo() {
  const { clinicaId } = useAuth();
  const isAdmin = useIsAdmin();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [itens, setItens] = useState<CustoFixoItem[]>([]);
  const [caixaHist, setCaixaHist] = useState<CaixaHistorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("resumo");
  const [editingItem, setEditingItem] = useState<CustoFixoItem | null>(null);
  const [editingFunc, setEditingFunc] = useState<Funcionario | null>(null);
  const [showNewFunc, setShowNewFunc] = useState(false);
  const [showNewItem, setShowNewItem] = useState(false);
  const [newFunc, setNewFunc] = useState<Partial<Funcionario>>({ tipo: "clt", cargo: "", nome: "" });
  const [newItem, setNewItem] = useState<Partial<CustoFixoItem>>({ grupo: "Pessoal e Encargos", recorrencia: "mensal" });
  const currentYear = new Date().getFullYear();

  const fetchAll = useCallback(async () => {
    if (!clinicaId) return;
    setLoading(true);
    const [funcRes, itensRes, caixaRes] = await Promise.all([
      supabase.from("funcionarios").select("*").eq("clinica_id", clinicaId).eq("ativo", true).order("tipo,nome" as any),
      supabase.from("custo_fixo_itens").select("*").eq("clinica_id", clinicaId).eq("ativo", true).order("grupo,descricao" as any),
      supabase.from("caixa_historico_mensal").select("ano,mes,saidas_custos_fixos,saidas_mao_obra,saidas_marketing").eq("clinica_id", clinicaId).order("ano,mes" as any),
    ]);
    setFuncionarios((funcRes.data as any[]) || []);
    setItens((itensRes.data as any[]) || []);
    setCaixaHist((caixaRes.data as any[]) || []);
    setLoading(false);
  }, [clinicaId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Total employees cost
  const totalFuncCost = useMemo(() => {
    return funcionarios.reduce((s, f) => s + calcFuncCost(f).custoTotal, 0);
  }, [funcionarios]);

  // Items with employee cost injected
  const itensComFuncionarios = useMemo(() => {
    return itens.map(item => {
      if (item.fonte_funcionarios) {
        return { ...item, valor_mensal: totalFuncCost };
      }
      return item;
    });
  }, [itens, totalFuncCost]);

  // Group summary
  const grupoSummary = useMemo(() => {
    const map: Record<string, number> = {};
    itensComFuncionarios.forEach(item => {
      map[item.grupo] = (map[item.grupo] || 0) + item.valor_mensal;
    });
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return GRUPO_ORDER
      .filter(g => map[g] !== undefined)
      .map(g => ({
        grupo: g,
        total: map[g],
        pct: total > 0 ? (map[g] / total) * 100 : 0,
      }));
  }, [itensComFuncionarios]);

  const cfTotal = useMemo(() => grupoSummary.reduce((s, g) => s + g.total, 0), [grupoSummary]);

  // Budget vs Actual comparison
  const comparacao = useMemo(() => {
    const currentYearHist = caixaHist.filter(h => h.ano === currentYear);
    const prevYearHist = caixaHist.filter(h => h.ano === currentYear - 1);
    const months = MONTH_NAMES.map((name, i) => {
      const mes = i + 1;
      const curr = currentYearHist.find(h => h.mes === mes);
      const prev = prevYearHist.find(h => h.mes === mes);
      const realCF = curr ? curr.saidas_custos_fixos + curr.saidas_mao_obra : 0;
      const realCFPrev = prev ? prev.saidas_custos_fixos + prev.saidas_mao_obra : 0;
      return {
        mes: name,
        orcado: cfTotal,
        real: realCF,
        realPrev: realCFPrev,
        diff: realCF - cfTotal,
        diffPct: cfTotal > 0 ? ((realCF - cfTotal) / cfTotal) * 100 : 0,
      };
    });
    const anualOrcado = cfTotal * 12;
    const anualReal = months.reduce((s, m) => s + m.real, 0);
    const anualRealPrev = months.reduce((s, m) => s + m.realPrev, 0);
    return { months, anualOrcado, anualReal, anualRealPrev };
  }, [cfTotal, caixaHist, currentYear]);

  // Save functions
  const saveItem = async (item: CustoFixoItem) => {
    const { error } = await supabase.from("custo_fixo_itens").update({
      descricao: item.descricao,
      grupo: item.grupo,
      valor_mensal: item.valor_mensal,
      recorrencia: item.recorrencia,
      observacao: item.observacao,
    } as any).eq("id", item.id);
    if (error) toast.error(error.message);
    else { toast.success("Item atualizado!"); setEditingItem(null); fetchAll(); }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("custo_fixo_itens").update({ ativo: false } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Item removido!"); fetchAll(); }
  };

  const addItem = async () => {
    if (!newItem.descricao || !clinicaId) return;
    const { error } = await supabase.from("custo_fixo_itens").insert({
      clinica_id: clinicaId,
      descricao: newItem.descricao,
      grupo: newItem.grupo || "Pessoal e Encargos",
      valor_mensal: newItem.valor_mensal || 0,
      recorrencia: newItem.recorrencia || "mensal",
      observacao: newItem.observacao,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Item adicionado!"); setShowNewItem(false); setNewItem({ grupo: "Pessoal e Encargos", recorrencia: "mensal" }); fetchAll(); }
  };

  const saveFunc = async (func: Funcionario) => {
    const { error } = await supabase.from("funcionarios").update({
      nome: func.nome,
      cargo: func.cargo,
      tipo: func.tipo,
      salario_bruto: func.salario_bruto,
      insalubridade: func.insalubridade,
      vale_transporte: func.vale_transporte,
      diarias_semanais: func.diarias_semanais,
      valor_diaria: func.valor_diaria,
      passagem_dia: func.passagem_dia,
      semanas_mes: func.semanas_mes,
      bolsa_mensal: func.bolsa_mensal,
      auxilio_transporte: func.auxilio_transporte,
      valor_mensal_prestador: func.valor_mensal_prestador,
    } as any).eq("id", func.id);
    if (error) toast.error(error.message);
    else { toast.success("Funcionário atualizado!"); setEditingFunc(null); fetchAll(); updatePremissasCF(); }
  };

  const deleteFunc = async (id: string) => {
    const { error } = await supabase.from("funcionarios").update({ ativo: false } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Funcionário removido!"); fetchAll(); updatePremissasCF(); }
  };

  const addFunc = async () => {
    if (!newFunc.nome || !clinicaId) return;
    const { error } = await supabase.from("funcionarios").insert({
      clinica_id: clinicaId,
      nome: newFunc.nome,
      cargo: newFunc.cargo || "",
      tipo: newFunc.tipo || "clt",
      salario_bruto: newFunc.salario_bruto || 0,
      insalubridade: newFunc.insalubridade || 0,
      vale_transporte: newFunc.vale_transporte || 0,
      valor_diaria: newFunc.valor_diaria || 0,
      diarias_semanais: newFunc.diarias_semanais || 0,
      passagem_dia: newFunc.passagem_dia || 0,
      semanas_mes: newFunc.semanas_mes || 4,
      bolsa_mensal: newFunc.bolsa_mensal || 0,
      auxilio_transporte: newFunc.auxilio_transporte || 0,
      valor_mensal_prestador: newFunc.valor_mensal_prestador || 0,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Funcionário adicionado!"); setShowNewFunc(false); setNewFunc({ tipo: "clt", cargo: "", nome: "" }); fetchAll(); updatePremissasCF(); }
  };

  // Propagate CF change to premissas_precificacao
  const updatePremissasCF = async () => {
    if (!clinicaId) return;
    // Recalculate total after a small delay to ensure data is fresh
    setTimeout(async () => {
      const { data: freshItens } = await supabase.from("custo_fixo_itens").select("*").eq("clinica_id", clinicaId).eq("ativo", true);
      const { data: freshFunc } = await supabase.from("funcionarios").select("*").eq("clinica_id", clinicaId).eq("ativo", true);
      if (!freshItens || !freshFunc) return;
      const funcTotal = (freshFunc as any[]).reduce((s: number, f: any) => s + calcFuncCost(f as Funcionario).custoTotal, 0);
      const newCF = (freshItens as any[]).reduce((s: number, item: any) => {
        return s + (item.fonte_funcionarios ? funcTotal : Number(item.valor_mensal));
      }, 0);
      await supabase.from("premissas_precificacao").update({ cf_total_mensal: newCF } as any).eq("clinica_id", clinicaId);
    }, 500);
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
            <h1 className="text-2xl font-bold text-foreground">Controle de Custo Fixo</h1>
            <p className="text-sm text-muted-foreground">Orçamento mensal, funcionários e comparação com o realizado (Fluxo de Caixa)</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="CF Total Mensal (Orçado)" value={fmt(cfTotal)} icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard label="CF Anual (Orçado)" value={fmt(cfTotal * 12)} icon={<Building2 className="h-4 w-4" />} />
          <KpiCard label="Custo Funcionários" value={fmt(totalFuncCost)} icon={<Users className="h-4 w-4" />} subtitle={`${funcionarios.length} colaboradores`} />
          <KpiCard
            label="Real vs Orçado (Ano)"
            value={comparacao.anualReal > 0 ? fmtPct(((comparacao.anualReal - comparacao.anualOrcado) / comparacao.anualOrcado) * 100) : "—"}
            icon={<ArrowUpDown className="h-4 w-4" />}
            alert={comparacao.anualReal > comparacao.anualOrcado}
            subtitle={comparacao.anualReal > 0 ? fmt(comparacao.anualReal) : "Sem dados reais"}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap bg-muted">
            <TabsTrigger value="resumo">📊 Resumo por Grupo</TabsTrigger>
            <TabsTrigger value="itens">📋 Despesas Fixas</TabsTrigger>
            <TabsTrigger value="funcionarios">👥 Funcionários</TabsTrigger>
            <TabsTrigger value="comparacao">⚖️ Orçado vs Real</TabsTrigger>
          </TabsList>

          {/* ===== RESUMO ===== */}
          <TabsContent value="resumo" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">Resumo por Grupo</CardTitle>
                  <CardDescription>% de cada grupo sobre o custo fixo total</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Grupo</TableHead>
                        <TableHead className="text-right">Total Mensal</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grupoSummary.map((g, i) => (
                        <TableRow key={g.grupo}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{g.grupo}</TableCell>
                          <TableCell className="text-right">{fmt(g.total)}</TableCell>
                          <TableCell className="text-right font-medium">{fmtPct(g.pct)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="font-bold bg-accent/50">
                        <TableCell></TableCell>
                        <TableCell>TOTAL GERAL</TableCell>
                        <TableCell className="text-right">{fmt(cfTotal)}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader><CardTitle className="text-lg">Composição do CF</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={grupoSummary}
                          dataKey="total"
                          nameKey="grupo"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          label={({ grupo, pct }) => `${grupo.substring(0, 12)}… ${pct.toFixed(0)}%`}
                          labelLine={false}
                        >
                          {grupoSummary.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <RTooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ===== ITENS ===== */}
          <TabsContent value="itens" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">📋 Mapeamento de Despesas Fixas</CardTitle>
                  <CardDescription>Edite valores para atualizar automaticamente PE, DRE e Precificação</CardDescription>
                </div>
                {isAdmin && (
                  <Button size="sm" onClick={() => setShowNewItem(true)} className="gap-1">
                    <Plus className="h-4 w-4" />Adicionar
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Código PC</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead className="text-right">Valor Mensal</TableHead>
                      <TableHead className="text-right">% do Total</TableHead>
                      <TableHead>Recorrência</TableHead>
                      {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensComFuncionarios.map((item, i) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-muted-foreground text-xs">{item.codigo_pc || "—"}</TableCell>
                        <TableCell className="font-medium">
                          {item.descricao}
                          {item.fonte_funcionarios && <Badge variant="outline" className="ml-2 text-xs">Auto</Badge>}
                        </TableCell>
                        <TableCell className="text-xs">{item.grupo}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(item.valor_mensal)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{cfTotal > 0 ? fmtPct((item.valor_mensal / cfTotal) * 100) : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{item.recorrencia}</Badge></TableCell>
                        {isAdmin && (
                          <TableCell className="text-center">
                            {!item.fonte_funcionarios && (
                              <div className="flex justify-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingItem(item)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteItem(item.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    <TableRow className="font-bold bg-accent/50">
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell>TOTAL</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{fmt(cfTotal)}</TableCell>
                      <TableCell className="text-right">100%</TableCell>
                      <TableCell></TableCell>
                      {isAdmin && <TableCell></TableCell>}
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== FUNCIONÁRIOS ===== */}
          <TabsContent value="funcionarios" className="space-y-4">
            <FuncionariosTab
              funcionarios={funcionarios}
              isAdmin={isAdmin}
              onEdit={setEditingFunc}
              onDelete={deleteFunc}
              onAdd={() => setShowNewFunc(true)}
              totalFuncCost={totalFuncCost}
            />
          </TabsContent>

          {/* ===== COMPARAÇÃO ===== */}
          <TabsContent value="comparacao" className="space-y-4">
            <ComparacaoTab comparacao={comparacao} cfTotal={cfTotal} grupoSummary={grupoSummary} currentYear={currentYear} />
          </TabsContent>
        </Tabs>

        {/* Dialog: Edit Item */}
        {editingItem && (
          <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>✏️ Editar Despesa Fixa</DialogTitle>
                <DialogDescription>Alterações atualizam automaticamente PE e Precificação.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Input value={editingItem.descricao} onChange={(e) => setEditingItem({ ...editingItem, descricao: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Grupo</Label>
                  <Select value={editingItem.grupo} onValueChange={(v) => setEditingItem({ ...editingItem, grupo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRUPO_ORDER.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Valor Mensal (R$)</Label>
                  <Input type="number" step="0.01" value={editingItem.valor_mensal} onChange={(e) => setEditingItem({ ...editingItem, valor_mensal: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
                <Button onClick={() => { saveItem(editingItem); updatePremissasCF(); }}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Dialog: New Item */}
        <Dialog open={showNewItem} onOpenChange={setShowNewItem}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>➕ Nova Despesa Fixa</DialogTitle>
              <DialogDescription>Adicione uma nova despesa ao controle de custo fixo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Descrição *</Label>
                <Input value={newItem.descricao || ""} onChange={(e) => setNewItem({ ...newItem, descricao: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Grupo</Label>
                <Select value={newItem.grupo} onValueChange={(v) => setNewItem({ ...newItem, grupo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRUPO_ORDER.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor Mensal (R$)</Label>
                <Input type="number" step="0.01" value={newItem.valor_mensal || ""} onChange={(e) => setNewItem({ ...newItem, valor_mensal: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewItem(false)}>Cancelar</Button>
              <Button onClick={() => { addItem(); updatePremissasCF(); }}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Edit Funcionário */}
        {editingFunc && (
          <EditFuncDialog func={editingFunc} onSave={saveFunc} onClose={() => setEditingFunc(null)} />
        )}

        {/* Dialog: New Funcionário */}
        <Dialog open={showNewFunc} onOpenChange={setShowNewFunc}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>➕ Novo Funcionário</DialogTitle>
              <DialogDescription>Adicione um colaborador ao quadro.</DialogDescription>
            </DialogHeader>
            <NewFuncForm form={newFunc} onChange={setNewFunc} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewFunc(false)}>Cancelar</Button>
              <Button onClick={addFunc}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// ===== KPI CARD =====
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

// ===== FUNCIONÁRIOS TAB =====
function FuncionariosTab({ funcionarios, isAdmin, onEdit, onDelete, onAdd, totalFuncCost }: {
  funcionarios: Funcionario[]; isAdmin: boolean; onEdit: (f: Funcionario) => void; onDelete: (id: string) => void; onAdd: () => void; totalFuncCost: number;
}) {
  const byType = useMemo(() => {
    const groups: Record<string, Funcionario[]> = { clt: [], diarista: [], estagiario: [], prestador: [] };
    funcionarios.forEach(f => { if (groups[f.tipo]) groups[f.tipo].push(f); });
    return groups;
  }, [funcionarios]);

  const typeLabels: Record<string, string> = {
    clt: "🟢 CLT", diarista: "🟡 Diarista", estagiario: "🔵 Estagiárias", prestador: "🟣 Prestadores",
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">👥 Quadro de Funcionários</CardTitle>
            <CardDescription>Edite salários e quantidades — impacta diretamente CF, PE e Precificação</CardDescription>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={onAdd} className="gap-1"><Plus className="h-4 w-4" />Novo Funcionário</Button>
          )}
        </CardHeader>
      </Card>

      {Object.entries(byType).filter(([, fs]) => fs.length > 0).map(([tipo, fs]) => (
        <Card key={tipo} className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-base">{typeLabels[tipo]}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nome / Cargo</TableHead>
                  {tipo === "clt" && <>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead className="text-right">Insalub.</TableHead>
                    <TableHead className="text-right">VT</TableHead>
                    <TableHead className="text-right">Encargos</TableHead>
                  </>}
                  {tipo === "diarista" && <>
                    <TableHead className="text-right">Diárias/sem</TableHead>
                    <TableHead className="text-right">Valor Diária</TableHead>
                  </>}
                  {tipo === "estagiario" && <>
                    <TableHead className="text-right">Bolsa</TableHead>
                    <TableHead className="text-right">Aux. Transp.</TableHead>
                  </>}
                  {tipo === "prestador" && <TableHead className="text-right">Valor Mensal</TableHead>}
                  <TableHead className="text-right">Custo Total</TableHead>
                  <TableHead className="text-right">% do CF</TableHead>
                  {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fs.map((f, i) => {
                  const { encargos, custoTotal } = calcFuncCost(f);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{f.nome}</div>
                        <div className="text-xs text-muted-foreground">{f.cargo}</div>
                      </TableCell>
                      {tipo === "clt" && <>
                        <TableCell className="text-right">{fmt(f.salario_bruto)}</TableCell>
                        <TableCell className="text-right">{fmt(f.insalubridade)}</TableCell>
                        <TableCell className="text-right">{fmt(f.vale_transporte)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(encargos)}</TableCell>
                      </>}
                      {tipo === "diarista" && <>
                        <TableCell className="text-right">{f.diarias_semanais}</TableCell>
                        <TableCell className="text-right">{fmt(f.valor_diaria)}</TableCell>
                      </>}
                      {tipo === "estagiario" && <>
                        <TableCell className="text-right">{fmt(f.bolsa_mensal)}</TableCell>
                        <TableCell className="text-right">{fmt(f.auxilio_transporte)}</TableCell>
                      </>}
                      {tipo === "prestador" && <TableCell className="text-right">{fmt(f.valor_mensal_prestador)}</TableCell>}
                      <TableCell className="text-right font-bold">{fmt(custoTotal)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{totalFuncCost > 0 ? fmtPct((custoTotal / totalFuncCost) * 100) : "—"}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(f)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(f.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold bg-accent/50">
                  <TableCell></TableCell>
                  <TableCell>Subtotal {typeLabels[tipo]}</TableCell>
                  {tipo === "clt" && <><TableCell /><TableCell /><TableCell /><TableCell /></>}
                  {tipo === "diarista" && <><TableCell /><TableCell /></>}
                  {tipo === "estagiario" && <><TableCell /><TableCell /></>}
                  {tipo === "prestador" && <TableCell />}
                  <TableCell className="text-right">{fmt(fs.reduce((s, f) => s + calcFuncCost(f).custoTotal, 0))}</TableCell>
                  <TableCell />
                  {isAdmin && <TableCell />}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card className="border-0 shadow-md bg-accent/30">
        <CardContent className="flex items-center justify-between p-4">
          <span className="text-lg font-bold">✅ Custo Total Mensal — Todos os Colaboradores</span>
          <span className="text-2xl font-bold text-primary">{fmt(totalFuncCost)}</span>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== COMPARAÇÃO TAB =====
function ComparacaoTab({ comparacao, cfTotal, grupoSummary, currentYear }: {
  comparacao: any; cfTotal: number; grupoSummary: any[]; currentYear: number;
}) {
  const chartData = comparacao.months.map((m: any) => ({
    mes: m.mes,
    Orçado: cfTotal,
    [`Real ${currentYear}`]: m.real,
    [`Real ${currentYear - 1}`]: m.realPrev,
  }));

  return (
    <div className="space-y-4">
      {/* Annual summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={`Orçado ${currentYear}`} value={fmt(comparacao.anualOrcado)} icon={<DollarSign className="h-4 w-4" />} />
        <KpiCard label={`Real ${currentYear}`} value={comparacao.anualReal > 0 ? fmt(comparacao.anualReal) : "—"} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label={`Real ${currentYear - 1}`} value={comparacao.anualRealPrev > 0 ? fmt(comparacao.anualRealPrev) : "—"} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard
          label="Variação Anual"
          value={comparacao.anualReal > 0 ? fmtPct(((comparacao.anualReal - comparacao.anualOrcado) / comparacao.anualOrcado) * 100) : "—"}
          icon={<Percent className="h-4 w-4" />}
          alert={comparacao.anualReal > comparacao.anualOrcado}
        />
      </div>

      {/* Chart */}
      <Card className="border-0 shadow-md">
        <CardHeader><CardTitle className="text-lg">📊 Orçado vs Real — Mensal</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                <RTooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Orçado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.4} />
                <Bar dataKey={`Real ${currentYear}`} fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey={`Real ${currentYear - 1}`} fill="hsl(32, 85%, 50%)" radius={[4, 4, 0, 0]} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly detail table */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">📋 Detalhe Mensal — Orçado vs Realizado</CardTitle>
          <CardDescription>Comparação com o fluxo de caixa (contas pagas)</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Orçado</TableHead>
                <TableHead className="text-right">Real {currentYear}</TableHead>
                <TableHead className="text-right">Δ (R$)</TableHead>
                <TableHead className="text-right">Δ (%)</TableHead>
                <TableHead className="text-right">Real {currentYear - 1}</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparacao.months.map((m: any) => (
                <TableRow key={m.mes}>
                  <TableCell className="font-medium">{m.mes}</TableCell>
                  <TableCell className="text-right">{fmt(m.orcado)}</TableCell>
                  <TableCell className="text-right">{m.real > 0 ? fmt(m.real) : "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${m.diff > 0 ? "text-destructive" : m.diff < 0 ? "text-emerald-600" : ""}`}>
                    {m.real > 0 ? fmt(m.diff) : "—"}
                  </TableCell>
                  <TableCell className={`text-right ${m.diffPct > 5 ? "text-destructive" : m.diffPct < -5 ? "text-emerald-600" : ""}`}>
                    {m.real > 0 ? fmtPct(m.diffPct) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{m.realPrev > 0 ? fmt(m.realPrev) : "—"}</TableCell>
                  <TableCell>
                    {m.real === 0 ? (
                      <Badge variant="outline" className="text-xs">Pendente</Badge>
                    ) : m.diffPct > 10 ? (
                      <Badge variant="destructive" className="text-xs">Acima +{m.diffPct.toFixed(0)}%</Badge>
                    ) : m.diffPct < -10 ? (
                      <Badge className="bg-emerald-500 text-xs">Economia</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-accent/50">
                <TableCell>ANUAL</TableCell>
                <TableCell className="text-right">{fmt(comparacao.anualOrcado)}</TableCell>
                <TableCell className="text-right">{comparacao.anualReal > 0 ? fmt(comparacao.anualReal) : "—"}</TableCell>
                <TableCell className="text-right">{comparacao.anualReal > 0 ? fmt(comparacao.anualReal - comparacao.anualOrcado) : "—"}</TableCell>
                <TableCell className="text-right">{comparacao.anualReal > 0 ? fmtPct(((comparacao.anualReal - comparacao.anualOrcado) / comparacao.anualOrcado) * 100) : "—"}</TableCell>
                <TableCell className="text-right">{comparacao.anualRealPrev > 0 ? fmt(comparacao.anualRealPrev) : "—"}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Group-level comparison */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">📊 % por Grupo — Orçado vs Real</CardTitle>
          <CardDescription>Percentual de cada categoria no custo fixo orçado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {grupoSummary.map((g, i) => (
              <div key={g.grupo} className="flex items-center gap-3">
                <div className="w-40 text-sm font-medium truncate">{g.grupo}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-muted-foreground">{fmt(g.total)}</span>
                    <span className="text-xs font-bold">{fmtPct(g.pct)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, g.pct)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
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

// ===== EDIT FUNC DIALOG =====
function EditFuncDialog({ func, onSave, onClose }: { func: Funcionario; onSave: (f: Funcionario) => void; onClose: () => void }) {
  const [form, setForm] = useState<Funcionario>({ ...func });
  const { encargos, custoTotal } = calcFuncCost(form);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✏️ Editar Funcionário</DialogTitle>
          <DialogDescription>Alterações impactam diretamente o CF, PE e Precificação.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Cargo</Label>
              <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </div>
          </div>

          {form.tipo === "clt" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Salário Bruto</Label>
                <Input type="number" step="0.01" value={form.salario_bruto} onChange={(e) => setForm({ ...form, salario_bruto: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Insalubridade</Label>
                <Input type="number" step="0.01" value={form.insalubridade} onChange={(e) => setForm({ ...form, insalubridade: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Vale Transporte</Label>
                <Input type="number" step="0.01" value={form.vale_transporte} onChange={(e) => setForm({ ...form, vale_transporte: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          )}

          {form.tipo === "diarista" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Diárias/semana</Label>
                <Input type="number" step="0.5" value={form.diarias_semanais} onChange={(e) => setForm({ ...form, diarias_semanais: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Valor Diária</Label>
                <Input type="number" step="0.01" value={form.valor_diaria} onChange={(e) => setForm({ ...form, valor_diaria: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Passagem/dia</Label>
                <Input type="number" step="0.01" value={form.passagem_dia} onChange={(e) => setForm({ ...form, passagem_dia: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          )}

          {form.tipo === "estagiario" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Bolsa Mensal</Label>
                <Input type="number" step="0.01" value={form.bolsa_mensal} onChange={(e) => setForm({ ...form, bolsa_mensal: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Auxílio Transporte</Label>
                <Input type="number" step="0.01" value={form.auxilio_transporte} onChange={(e) => setForm({ ...form, auxilio_transporte: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          )}

          {form.tipo === "prestador" && (
            <div className="space-y-1">
              <Label>Valor Mensal</Label>
              <Input type="number" step="0.01" value={form.valor_mensal_prestador} onChange={(e) => setForm({ ...form, valor_mensal_prestador: parseFloat(e.target.value) || 0 })} />
            </div>
          )}

          <Card className="bg-accent/30 border-0">
            <CardContent className="flex items-center justify-between p-3">
              <span className="text-sm font-medium">Custo Total Mensal Calculado:</span>
              <span className="text-lg font-bold text-primary">{fmt(custoTotal)}</span>
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(form)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== NEW FUNC FORM =====
function NewFuncForm({ form, onChange }: { form: Partial<Funcionario>; onChange: (f: Partial<Funcionario>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Nome *</Label>
          <Input value={form.nome || ""} onChange={(e) => onChange({ ...form, nome: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Cargo</Label>
          <Input value={form.cargo || ""} onChange={(e) => onChange({ ...form, cargo: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Tipo de Vínculo</Label>
        <Select value={form.tipo || "clt"} onValueChange={(v) => onChange({ ...form, tipo: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="clt">CLT</SelectItem>
            <SelectItem value="diarista">Diarista</SelectItem>
            <SelectItem value="estagiario">Estagiário(a)</SelectItem>
            <SelectItem value="prestador">Prestador de Serviço</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(form.tipo === "clt" || !form.tipo) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Salário Bruto</Label>
            <Input type="number" step="0.01" value={form.salario_bruto || ""} onChange={(e) => onChange({ ...form, salario_bruto: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <Label>Insalubridade</Label>
            <Input type="number" step="0.01" value={form.insalubridade || ""} onChange={(e) => onChange({ ...form, insalubridade: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <Label>Vale Transporte</Label>
            <Input type="number" step="0.01" value={form.vale_transporte || ""} onChange={(e) => onChange({ ...form, vale_transporte: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      )}
      {form.tipo === "diarista" && (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Diárias/semana</Label>
            <Input type="number" step="0.5" value={form.diarias_semanais || ""} onChange={(e) => onChange({ ...form, diarias_semanais: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <Label>Valor Diária</Label>
            <Input type="number" step="0.01" value={form.valor_diaria || ""} onChange={(e) => onChange({ ...form, valor_diaria: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <Label>Passagem/dia</Label>
            <Input type="number" step="0.01" value={form.passagem_dia || ""} onChange={(e) => onChange({ ...form, passagem_dia: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      )}
      {form.tipo === "estagiario" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Bolsa Mensal</Label>
            <Input type="number" step="0.01" value={form.bolsa_mensal || ""} onChange={(e) => onChange({ ...form, bolsa_mensal: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1">
            <Label>Auxílio Transporte</Label>
            <Input type="number" step="0.01" value={form.auxilio_transporte || ""} onChange={(e) => onChange({ ...form, auxilio_transporte: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      )}
      {form.tipo === "prestador" && (
        <div className="space-y-1">
          <Label>Valor Mensal</Label>
          <Input type="number" step="0.01" value={form.valor_mensal_prestador || ""} onChange={(e) => onChange({ ...form, valor_mensal_prestador: parseFloat(e.target.value) || 0 })} />
        </div>
      )}
    </div>
  );
}

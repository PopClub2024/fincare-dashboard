import { useState, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { KpiCards, FilterPills, StatusBadge, PageHeader, DataTable, formatCurrency, TAXAS_PADRAO } from "@/components/medicpop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInDays, isPast, addDays } from "date-fns";
import CnpjLookupInput from "@/components/CnpjLookupInput";
import { MoreHorizontal, FileText, Edit, CheckCircle, XCircle, Receipt } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

export default function ContasAReceber() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [baixaDialog, setBaixaDialog] = useState<any>(null);
  const [modo, setModo] = useState<"particular" | "convenio">("particular");
  const [form, setForm] = useState({
    paciente_id: "", convenio_id: "", especialidade: "", procedimento: "",
    forma_pagamento: "pix", valor_bruto: "", vencimento: "", parcelas: "1",
    plano_contas_id: "", observacao: "",
  });
  const [baixaForm, setBaixaForm] = useState({ data: format(new Date(), "yyyy-MM-dd"), valor: "", juros: "0", desconto: "0", obs: "" });

  // Dados
  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["contas-receber", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("contas_receber_agregado")
        .select("*")
        .eq("clinica_id", clinicaId)
        .order("data_prevista_recebimento", { ascending: true });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-cr", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("pacientes").select("id, nome, cpf").eq("clinica_id", clinicaId).order("nome").limit(500);
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: planoContas = [] } = useQuery({
    queryKey: ["plano-contas-cr", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("plano_contas").select("id, codigo_estruturado, descricao, categoria").eq("clinica_id", clinicaId).eq("ativo", true).eq("indicador", "credito").order("codigo_estruturado");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Filtro
  const filtered = useMemo(() => {
    let f = lancamentos;
    if (statusFilter !== "todos") {
      if (statusFilter === "aberto") f = f.filter((l: any) => l.status === "aberto" || l.status === "pendente");
      else if (statusFilter === "pago") f = f.filter((l: any) => l.status === "pago" || l.status === "recebido");
      else if (statusFilter === "vencido") f = f.filter((l: any) => {
        if (l.status === "pago" || l.status === "recebido") return false;
        return l.data_prevista_recebimento && isPast(new Date(l.data_prevista_recebimento));
      });
    }
    if (search) {
      const s = search.toLowerCase();
      f = f.filter((l: any) => (l.origem_ref?.paciente || l.origem_ref?.convenio || l.tipo_recebivel || "").toLowerCase().includes(s));
    }
    return f;
  }, [lancamentos, statusFilter, search]);

  // KPIs
  const kpis = useMemo(() => {
    const total = lancamentos.reduce((s: number, l: any) => s + Number(l.valor_esperado || 0), 0);
    const aberto = lancamentos.filter((l: any) => l.status !== "pago" && l.status !== "recebido").reduce((s: number, l: any) => s + Number(l.valor_esperado || 0), 0);
    const recebido = lancamentos.filter((l: any) => l.status === "pago" || l.status === "recebido").reduce((s: number, l: any) => s + Number(l.valor_recebido || 0), 0);
    const vencidos = lancamentos.filter((l: any) => l.status !== "pago" && l.status !== "recebido" && l.data_prevista_recebimento && isPast(new Date(l.data_prevista_recebimento)));
    const vencidoValor = vencidos.reduce((s: number, l: any) => s + Number(l.valor_esperado || 0), 0);
    return [
      { label: "Total a receber", value: total, sublabel: `${lancamentos.length} lançamentos` },
      { label: "Em aberto", value: aberto, sublabel: `${lancamentos.filter((l: any) => l.status !== "pago" && l.status !== "recebido").length} lançamentos`, sublabelColor: "#378ADD" },
      { label: "Recebido no mês", value: recebido, sublabel: `${lancamentos.filter((l: any) => l.status === "pago" || l.status === "recebido").length} baixas`, sublabelColor: "#1D9E75" },
      { label: "Vencidos", value: vencidoValor, sublabel: `${vencidos.length} pendentes`, sublabelColor: "#E24B4A" },
    ];
  }, [lancamentos]);

  // Cálculo resumo financeiro
  const taxa = TAXAS_PADRAO[form.forma_pagamento] || 0;
  const valorBruto = parseFloat(form.valor_bruto) || 0;
  const valorTaxa = valorBruto * (taxa / 100);
  const valorImposto = valorBruto * 0.05; // ISS 5% padrão
  const valorLiquido = valorBruto - valorTaxa - valorImposto;

  // Vencimento colorido
  const getVencimentoStyle = (dataStr: string | null, status: string) => {
    if (!dataStr || status === "pago" || status === "recebido") return { color: "#666" };
    const dias = differenceInDays(new Date(dataStr), new Date());
    if (dias < 0) return { color: "#E24B4A", fontWeight: 500 }; // vencido
    if (dias <= 7) return { color: "#BA7517" }; // próximo
    return { color: "#666" };
  };

  // Colunas da tabela
  const columns = [
    {
      key: "paciente", header: "Paciente / Origem", width: "22%",
      render: (row: any) => (
        <div>
          <p className="font-medium text-[13px]" style={{ color: "#2C3E50" }}>
            {row.origem_ref?.paciente || row.origem_ref?.convenio || row.tipo_recebivel || "—"}
          </p>
          <p className="text-[11px]" style={{ color: "#666" }}>
            {row.tipo_recebivel === "convenio" ? `Convênio · ${row.competencia}` : `Particular · ${row.bandeira || ""}`}
          </p>
        </div>
      ),
    },
    {
      key: "forma", header: "Forma", width: "14%",
      render: (row: any) => <StatusBadge status={row.meio || "outro"} type="pagamento" />,
    },
    {
      key: "emissao", header: "Emissão", width: "12%",
      render: (row: any) => <span style={{ color: "#666" }}>{row.data_base ? format(new Date(row.data_base), "dd/MM/yy") : "—"}</span>,
    },
    {
      key: "vencimento", header: "Vencimento", width: "12%",
      render: (row: any) => (
        <span style={getVencimentoStyle(row.data_prevista_recebimento, row.status)}>
          {row.data_prevista_recebimento ? format(new Date(row.data_prevista_recebimento), "dd/MM/yy") : "—"}
        </span>
      ),
    },
    {
      key: "bruto", header: "Bruto", width: "11%", align: "right" as const,
      render: (row: any) => <span className="font-medium">{formatCurrency(Number(row.valor_esperado || 0))}</span>,
    },
    {
      key: "liquido", header: "Líquido", width: "11%", align: "right" as const,
      render: (row: any) => {
        const rec = Number(row.valor_recebido || 0);
        const esp = Number(row.valor_esperado || 0);
        return (
          <div>
            <span className="font-medium">{formatCurrency(rec || esp)}</span>
            {rec > 0 && rec !== esp && (
              <p className="text-[10px]" style={{ color: "#666" }}>{((rec / esp - 1) * 100).toFixed(0)}% taxa</p>
            )}
          </div>
        );
      },
    },
    {
      key: "status", header: "Status", width: "10%", align: "center" as const,
      render: (row: any) => {
        const s = row.status;
        const isVencido = s !== "pago" && s !== "recebido" && row.data_prevista_recebimento && isPast(new Date(row.data_prevista_recebimento));
        return <StatusBadge status={isVencido ? "vencido" : (s === "recebido" ? "pago" : s)} />;
      },
    },
    {
      key: "acoes", header: "", width: "5%", align: "center" as const,
      render: (row: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem><FileText className="h-3 w-3 mr-2" /> Detalhes</DropdownMenuItem>
            <DropdownMenuItem><Edit className="h-3 w-3 mr-2" /> Editar</DropdownMenuItem>
            {row.status !== "pago" && row.status !== "recebido" && (
              <DropdownMenuItem onClick={() => { setBaixaDialog(row); setBaixaForm({ ...baixaForm, valor: String(row.valor_esperado || 0) }); }}>
                <CheckCircle className="h-3 w-3 mr-2" /> Dar baixa
              </DropdownMenuItem>
            )}
            <DropdownMenuItem><Receipt className="h-3 w-3 mr-2" /> Gerar NF</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive"><XCircle className="h-3 w-3 mr-2" /> Cancelar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <PageHeader title="Contas a Receber" subtitle="Receitas de particulares e convênios" />

        <KpiCards items={kpis} />

        <FilterPills
          pills={[
            { key: "todos", label: "Todos", count: lancamentos.length },
            { key: "aberto", label: "Em aberto", color: { bg: "transparent", text: "#378ADD", border: "rgba(55,138,221,0.3)" } },
            { key: "pago", label: "Pagos", color: { bg: "transparent", text: "#1D9E75", border: "rgba(29,158,117,0.3)" } },
            { key: "vencido", label: "Vencidos", color: { bg: "transparent", text: "#E24B4A", border: "rgba(226,75,74,0.3)" } },
          ]}
          activePill={statusFilter}
          onPillChange={setStatusFilter}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar paciente, convênio..."
          actionLabel="Nova conta"
          onActionClick={() => setDialogOpen(true)}
          extraActions={
            <ExportButtons
              data={flattenForExport(filtered, {
                "Paciente/Origem": (r: any) => r.origem_ref?.paciente || r.origem_ref?.convenio || r.tipo_recebivel,
                Forma: "meio", Emissão: "data_base", Vencimento: "data_prevista_recebimento",
                "Valor Bruto": "valor_esperado", "Valor Líquido": "valor_recebido", Status: "status",
              })}
              filename="contas-a-receber"
              titulo="Contas a Receber"
            />
          }
        />

        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          exportFilename="contas-a-receber"
          exportTitle="Contas a Receber"
          pagination={{ page, pageSize: 20, total: filtered.length, onPageChange: setPage }}
        />

        {/* Dialog Nova Conta */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="text-[18px] font-bold flex items-center justify-between" style={{ color: "#2C3E50" }}>
                Nova conta a receber
                <div className="flex gap-1">
                  {["particular", "convenio"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setModo(m as any)}
                      className="rounded-full px-3 py-1 text-[12px] font-medium"
                      style={modo === m ? { background: "#1B5E7B", color: "white" } : { background: "transparent", color: "#666", border: "0.5px solid #CCC" }}
                    >
                      {m === "particular" ? "Particular" : "Convênio"}
                    </button>
                  ))}
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Paciente / Convênio */}
              {modo === "particular" ? (
                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Paciente *</Label>
                  <Select value={form.paciente_id} onValueChange={(v) => setForm({ ...form, paciente_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                    <SelectContent>
                      {pacientes.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.cpf ? `· ${p.cpf}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Convênio *</Label>
                  <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unimed">Unimed</SelectItem>
                      <SelectItem value="klini">Klini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Especialidade + Procedimento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Especialidade</Label>
                  <Input value={form.especialidade} onChange={(e) => setForm({ ...form, especialidade: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Procedimento</Label>
                  <Input value={form.procedimento} onChange={(e) => setForm({ ...form, procedimento: e.target.value })} />
                </div>
              </div>

              {/* Pagamento */}
              {modo === "particular" && (
                <>
                  <p className="text-[13px] font-semibold pt-2" style={{ color: "#2C3E50" }}>Pagamento</p>
                  <div className="flex gap-2">
                    {[
                      { key: "pix", label: "PIX", color: "#1D9E75" },
                      { key: "dinheiro", label: "Dinheiro", color: "#5F5E5A" },
                      { key: "credito", label: "Crédito", color: "#378ADD" },
                      { key: "debito", label: "Débito", color: "#BA7517" },
                    ].map((fp) => (
                      <button
                        key={fp.key}
                        onClick={() => setForm({ ...form, forma_pagamento: fp.key })}
                        className="rounded-full px-3 py-1.5 text-[12px] font-medium transition-all"
                        style={
                          form.forma_pagamento === fp.key
                            ? { background: `${fp.color}15`, color: fp.color, border: `1px solid ${fp.color}40` }
                            : { background: "transparent", color: "#666", border: "0.5px solid #CCC" }
                        }
                      >
                        {fp.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Valor + Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Valor bruto *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.valor_bruto}
                    onChange={(e) => setForm({ ...form, valor_bruto: e.target.value })}
                    className="font-medium"
                  />
                </div>
                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Vencimento *</Label>
                  <Input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
                </div>
              </div>

              {/* Resumo financeiro */}
              {valorBruto > 0 && modo === "particular" && (
                <div className="rounded-lg p-3 space-y-1" style={{ background: "#F5F5F5" }}>
                  <div className="flex justify-between text-[12px]" style={{ color: "#666" }}>
                    <span>Valor bruto</span><span>{formatCurrency(valorBruto)}</span>
                  </div>
                  {taxa > 0 && (
                    <div className="flex justify-between text-[12px]" style={{ color: "#666" }}>
                      <span>Taxa {form.forma_pagamento} ({taxa}%)</span><span>-{formatCurrency(valorTaxa)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[12px]" style={{ color: "#666" }}>
                    <span>Imposto ISS (5%)</span><span>-{formatCurrency(valorImposto)}</span>
                  </div>
                  <div className="flex justify-between text-[13px] font-medium pt-1" style={{ borderTop: "0.5px solid #E5E5E5", color: "#1D9E75" }}>
                    <span>Receita líquida</span><span>{formatCurrency(valorLiquido)}</span>
                  </div>
                </div>
              )}

              {/* Plano de contas + Parcelas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Parcelas</Label>
                  <Select value={form.parcelas} onValueChange={(v) => setForm({ ...form, parcelas: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Plano de contas</Label>
                  <Select value={form.plano_contas_id} onValueChange={(v) => setForm({ ...form, plano_contas_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {planoContas.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.codigo_estruturado} — {p.descricao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Observação */}
              <div>
                <Label className="text-xs" style={{ color: "#666" }}>Observação</Label>
                <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 font-semibold"
                  style={{ background: "#1B5E7B", color: "white" }}
                  disabled={!form.valor_bruto}
                  onClick={() => { toast.success("Conta criada!"); setDialogOpen(false); }}
                >
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog Baixa */}
        <Dialog open={!!baixaDialog} onOpenChange={() => setBaixaDialog(null)}>
          <DialogContent className="max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="text-[16px] font-bold" style={{ color: "#2C3E50" }}>
                Confirmar recebimento
              </DialogTitle>
            </DialogHeader>
            {baixaDialog && (
              <div className="space-y-4">
                <div className="rounded-lg p-3" style={{ background: "#F5F5F5" }}>
                  <div className="flex justify-between text-[13px]">
                    <span style={{ color: "#666" }}>Valor do título</span>
                    <span className="font-bold">{formatCurrency(Number(baixaDialog.valor_esperado || 0))}</span>
                  </div>
                  <div className="flex justify-between text-[12px]" style={{ color: "#666" }}>
                    <span>Vencimento</span>
                    <span>{baixaDialog.data_prevista_recebimento ? format(new Date(baixaDialog.data_prevista_recebimento), "dd/MM/yyyy") : "—"}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Data do recebimento *</Label>
                  <Input type="date" value={baixaForm.data} onChange={(e) => setBaixaForm({ ...baixaForm, data: e.target.value })} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs" style={{ color: "#666" }}>Valor recebido *</Label>
                    <Input type="number" step="0.01" value={baixaForm.valor} onChange={(e) => setBaixaForm({ ...baixaForm, valor: e.target.value })} className="font-medium" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: "#666" }}>Juros</Label>
                    <Input type="number" step="0.01" value={baixaForm.juros} onChange={(e) => setBaixaForm({ ...baixaForm, juros: e.target.value })} placeholder="0,00" />
                  </div>
                  <div>
                    <Label className="text-xs" style={{ color: "#666" }}>Desconto</Label>
                    <Input type="number" step="0.01" value={baixaForm.desconto} onChange={(e) => setBaixaForm({ ...baixaForm, desconto: e.target.value })} placeholder="0,00" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs" style={{ color: "#666" }}>Observação</Label>
                  <Input value={baixaForm.obs} onChange={(e) => setBaixaForm({ ...baixaForm, obs: e.target.value })} />
                </div>

                <Button
                  className="w-full font-semibold"
                  style={{ background: "#1D9E75", color: "white" }}
                  onClick={() => { toast.success("Recebimento confirmado!"); setBaixaDialog(null); }}
                >
                  Confirmar recebimento
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

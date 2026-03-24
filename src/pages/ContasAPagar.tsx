import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, { DashboardFilterValues } from "@/components/dashboard/DashboardFilters";
import { startOfMonth, endOfMonth, format, isAfter, isBefore, addDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Plus, Upload, Search, FileText, CheckCircle2, Clock, AlertCircle, X, Trash2, Eye,
  Image, MoreHorizontal, Banknote, RefreshCw, ChevronDown,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  KpiCards, FilterPills, StatusBadge, PageHeader, DataTable,
  formatCurrency, CENTRO_CUSTO_TAGS,
} from "@/components/medicpop";
import CnpjLookupInput from "@/components/CnpjLookupInput";

// ======================= TYPES =======================
interface PlanoContas {
  id: string;
  codigo: number;
  codigo_estruturado: string;
  descricao: string;
  indicador: string;
  categoria: string;
  ativo: boolean;
}

interface Lancamento {
  id: string;
  descricao: string | null;
  fornecedor: string | null;
  valor: number;
  valor_pago: number | null;
  data_competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  tipo_despesa: string;
  status: string;
  forma_pagamento: string | null;
  plano_contas_id: string | null;
  ofx_transaction_id: string | null;
  banco_referencia: string | null;
  competencia_referencia: string | null;
  observacao: string | null;
  recorrente: boolean | null;
  centro_custo: string | null;
  cnpj_fornecedor: string | null;
  plano_contas?: { codigo_estruturado: string; descricao: string; categoria: string } | null;
}

const apDefaultFilters: DashboardFilterValues = {
  dateFrom: startOfMonth(new Date(2026, 0, 1)),
  dateTo: endOfMonth(new Date()),
  basCalculo: "competencia",
};

// Helper: vencimento color
function vencimentoStyle(dateStr: string | null): { color?: string; fontWeight?: string | number } {
  if (!dateStr) return {};
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = addDays(today, 7);
  if (isBefore(d, today)) return { color: "#E24B4A", fontWeight: 700 };
  if (isBefore(d, in7)) return { color: "#BA7517", fontWeight: 600 };
  return {};
}

// ======================= MAIN PAGE =======================
export default function ContasAPagar() {
  const [filters, setFilters] = useState<DashboardFilterValues>(apDefaultFilters);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <DashboardFilters filters={filters} onFilterChange={setFilters} />

        <Tabs defaultValue="lancamentos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-muted">
            <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
            <TabsTrigger value="comprovantes">Comprovantes</TabsTrigger>
            <TabsTrigger value="plano">Plano de Contas</TabsTrigger>
            <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          </TabsList>

          <TabsContent value="lancamentos">
            <TabLancamentos dateFrom={filters.dateFrom} dateTo={filters.dateTo} />
          </TabsContent>
          <TabsContent value="comprovantes"><TabComprovantes /></TabsContent>
          <TabsContent value="plano"><TabPlanoContas /></TabsContent>
          <TabsContent value="conciliacao"><TabConciliacao /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ======================= TAB: LANÇAMENTOS =======================
function TabLancamentos({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) {
  const { clinicaId } = useAuth();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoContas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPill, setFilterPill] = useState("todos");
  const [showDialog, setShowDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Nova conta form
  const [form, setForm] = useState({
    descricao: "",
    fornecedor: "",
    cnpj_fornecedor: "",
    valor: "",
    data_competencia: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    plano_contas_id: "",
    forma_pagamento: "",
    tipo_despesa: "variavel",
    centro_custo: "",
    recorrente: false,
    observacao: "",
  });

  // Baixa modal
  const [showBaixaDialog, setShowBaixaDialog] = useState(false);
  const [baixaTarget, setBaixaTarget] = useState<Lancamento | null>(null);
  const [baixaForm, setBaixaForm] = useState({
    data_pagamento: new Date().toISOString().split("T")[0],
    valor_pago: "",
    juros: "",
    desconto: "",
    banco: "",
    observacao: "",
  });
  const [baixaFile, setBaixaFile] = useState<File | null>(null);
  const [savingBaixa, setSavingBaixa] = useState(false);

  useEffect(() => {
    if (!clinicaId) return;
    fetchLancamentos();
    fetchPlano();
  }, [clinicaId, dateFrom, dateTo]);

  const fetchLancamentos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contas_pagar_lancamentos")
      .select("*, plano_contas(codigo_estruturado, descricao, categoria)")
      .eq("clinica_id", clinicaId!)
      .gte("data_competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("data_competencia", format(dateTo, "yyyy-MM-dd"))
      .order("data_competencia", { ascending: false })
      .limit(500);
    setLancamentos((data as any[]) || []);
    setLoading(false);
  };

  const fetchPlano = async () => {
    const { data } = await supabase
      .from("plano_contas")
      .select("*")
      .eq("clinica_id", clinicaId!)
      .eq("ativo", true)
      .order("codigo_estruturado");
    setPlanoContas((data as any[]) || []);
  };

  const handleCreate = async () => {
    if (!form.descricao || !form.valor) { toast.error("Preencha descrição e valor"); return; }
    const insertData = {
      clinica_id: clinicaId!,
      descricao: form.descricao,
      fornecedor: form.fornecedor || null,
      cnpj_fornecedor: form.cnpj_fornecedor || null,
      valor: parseFloat(form.valor),
      data_competencia: form.data_competencia,
      data_vencimento: form.data_vencimento || null,
      plano_contas_id: form.plano_contas_id || null,
      forma_pagamento: (form.forma_pagamento || null) as any,
      tipo_despesa: form.tipo_despesa as any,
      centro_custo: form.centro_custo || null,
      recorrente: form.recorrente,
      observacao: form.observacao || null,
      status: (form.plano_contas_id ? "classificado" : "a_classificar") as any,
    };
    const { error } = await supabase.from("contas_pagar_lancamentos").insert(insertData as any);
    if (error) toast.error(error.message);
    else {
      toast.success("Conta criada!");
      setShowDialog(false);
      setForm({
        descricao: "", fornecedor: "", cnpj_fornecedor: "", valor: "",
        data_competencia: new Date().toISOString().split("T")[0],
        data_vencimento: "", plano_contas_id: "", forma_pagamento: "",
        tipo_despesa: "variavel", centro_custo: "", recorrente: false, observacao: "",
      });
      fetchLancamentos();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contas_pagar_lancamentos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Lançamento excluído"); setLancamentos((prev) => prev.filter((l) => l.id !== id)); }
  };

  const openBaixa = (l: Lancamento) => {
    setBaixaTarget(l);
    setBaixaForm({
      data_pagamento: new Date().toISOString().split("T")[0],
      valor_pago: String(l.valor),
      juros: "",
      desconto: "",
      banco: l.banco_referencia || "",
      observacao: "",
    });
    setBaixaFile(null);
    setShowBaixaDialog(true);
  };

  const handleBaixa = async () => {
    if (!baixaTarget) return;
    setSavingBaixa(true);
    try {
      let comprovante_url: string | null = null;
      if (baixaFile) {
        const sanitizedName = baixaFile.name
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${clinicaId}/${Date.now()}_${sanitizedName}`;
        const { error: upErr } = await supabase.storage.from("comprovantes").upload(filePath, baixaFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(filePath);
          comprovante_url = urlData.publicUrl;
        }
      }

      const valorPago = parseFloat(baixaForm.valor_pago) || baixaTarget.valor;
      const juros = parseFloat(baixaForm.juros) || 0;
      const desconto = parseFloat(baixaForm.desconto) || 0;
      const valorFinal = valorPago + juros - desconto;

      const updateData: any = {
        status: "pago",
        data_pagamento: baixaForm.data_pagamento,
        valor_pago: valorFinal,
        banco_referencia: baixaForm.banco || null,
        observacao: baixaForm.observacao || null,
      };
      if (comprovante_url) updateData.comprovante_url = comprovante_url;

      const { error } = await supabase
        .from("contas_pagar_lancamentos")
        .update(updateData)
        .eq("id", baixaTarget.id);

      if (error) toast.error(error.message);
      else {
        toast.success("Baixa registrada com sucesso!");
        setShowBaixaDialog(false);
        fetchLancamentos();
      }
    } finally {
      setSavingBaixa(false);
    }
  };

  const handleUploadComprovante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const sanitizedName = file.name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${clinicaId}/${Date.now()}_${sanitizedName}`;
    const { error: upErr } = await supabase.storage.from("comprovantes").upload(filePath, file);
    if (upErr) { toast.error("Erro no upload: " + upErr.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(filePath);

    const { error: compErr } = await supabase.from("comprovantes").insert({
      clinica_id: clinicaId!,
      arquivo_url: urlData.publicUrl,
      arquivo_nome: file.name,
      tipo_arquivo: file.type,
      status: "pendente",
    }).select().single();

    if (compErr) { toast.error(compErr.message); setUploading(false); return; }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const image_base64 = btoa(binary);

    toast.info("Processando comprovante com IA...");
    const { error: fnErr } = await supabase.functions.invoke("process-comprovante", {
      body: { clinica_id: clinicaId, image_base64, filename: file.name, mime_type: file.type },
    });

    if (fnErr) toast.error("Erro no processamento: " + fnErr.message);
    else toast.success("Comprovante processado! Lançamento criado.");

    setUploading(false);
    e.target.value = "";
    fetchLancamentos();
  };

  // KPIs
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const kpiTotais = useMemo(() => {
    const total = lancamentos.reduce((s, l) => s + l.valor, 0);
    const pagoMes = lancamentos.filter((l) => l.status === "pago").reduce((s, l) => s + (l.valor_pago ?? l.valor), 0);
    const emAberto = lancamentos.filter((l) => l.status !== "pago" && l.status !== "cancelado").reduce((s, l) => s + l.valor, 0);
    const vencidos = lancamentos.filter((l) => {
      if (l.status === "pago" || l.status === "cancelado") return false;
      if (!l.data_vencimento) return false;
      return isBefore(new Date(l.data_vencimento + "T12:00:00"), today);
    }).reduce((s, l) => s + l.valor, 0);
    return { total, pagoMes, emAberto, vencidos };
  }, [lancamentos]);

  // Pill counts
  const pillCounts = useMemo(() => {
    const aberto = lancamentos.filter((l) => l.status !== "pago" && l.status !== "cancelado" && (!l.data_vencimento || !isBefore(new Date(l.data_vencimento + "T12:00:00"), today))).length;
    const pago = lancamentos.filter((l) => l.status === "pago").length;
    const vencido = lancamentos.filter((l) => {
      if (l.status === "pago" || l.status === "cancelado") return false;
      if (!l.data_vencimento) return false;
      return isBefore(new Date(l.data_vencimento + "T12:00:00"), today);
    }).length;
    return { aberto, pago, vencido };
  }, [lancamentos]);

  const filtered = useMemo(() => {
    return lancamentos.filter((l) => {
      const matchSearch = !searchTerm
        || l.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
        || l.fornecedor?.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (filterPill === "pago") return l.status === "pago";
      if (filterPill === "aberto") {
        if (l.status === "pago" || l.status === "cancelado") return false;
        if (!l.data_vencimento) return true;
        return !isBefore(new Date(l.data_vencimento + "T12:00:00"), today);
      }
      if (filterPill === "vencido") {
        if (l.status === "pago" || l.status === "cancelado") return false;
        if (!l.data_vencimento) return false;
        return isBefore(new Date(l.data_vencimento + "T12:00:00"), today);
      }
      return true;
    });
  }, [lancamentos, searchTerm, filterPill]);

  const columns = [
    {
      key: "fornecedor",
      header: "Fornecedor",
      width: "24%",
      render: (l: Lancamento) => (
        <div>
          <p className="font-semibold text-[13px] truncate max-w-[220px] text-foreground">
            {l.fornecedor || l.descricao || "—"}
          </p>
          {l.fornecedor && l.descricao && (
            <p className="text-[11px] truncate max-w-[220px] text-muted-foreground">{l.descricao}</p>
          )}
        </div>
      ),
    },
    {
      key: "centro_custo",
      header: "Categoria",
      width: "14%",
      render: (l: Lancamento) => {
        if (l.centro_custo) {
          const tag = CENTRO_CUSTO_TAGS[l.centro_custo.toLowerCase()];
          if (tag) {
            return (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap"
                style={{ background: tag.bg, color: tag.text }}
              >
                {tag.label}
              </span>
            );
          }
        }
        if (l.plano_contas) {
          return (
            <span className="text-[12px] text-muted-foreground">
              {l.plano_contas.codigo_estruturado}
            </span>
          );
        }
        return <span className="text-muted-foreground/50">—</span>;
      },
    },
    {
      key: "data_vencimento",
      header: "Vencimento",
      width: "12%",
      render: (l: Lancamento) => {
        if (!l.data_vencimento) return <span className="text-muted-foreground/50">—</span>;
        const style = vencimentoStyle(l.data_vencimento);
        return (
          <span className="text-[13px]" style={style}>
            {new Date(l.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
          </span>
        );
      },
    },
    {
      key: "valor",
      header: "Valor",
      width: "12%",
      align: "right" as const,
      render: (l: Lancamento) => (
        <span className="text-[13px] font-medium text-foreground">
          {formatCurrency(l.valor)}
        </span>
      ),
    },
    {
      key: "valor_pago",
      header: "Pago",
      width: "11%",
      align: "right" as const,
      render: (l: Lancamento) => {
        if (!l.valor_pago && l.status !== "pago") return <span className="text-muted-foreground/50">—</span>;
        const vp = l.valor_pago ?? l.valor;
        const isPartial = vp < l.valor;
        return (
          <span className={`text-[13px] font-medium ${isPartial ? "text-warning" : "text-success"}`}>
            {formatCurrency(vp)}
          </span>
        );
      },
    },
    {
      key: "forma_pagamento",
      header: "Tipo",
      width: "11%",
      render: (l: Lancamento) => l.forma_pagamento
        ? <StatusBadge status={l.forma_pagamento} type="pagamento" />
        : <span className="text-muted-foreground/50">—</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      render: (l: Lancamento) => {
        let displayStatus = l.status;
        if (l.status !== "pago" && l.status !== "cancelado" && l.data_vencimento) {
          if (isBefore(new Date(l.data_vencimento + "T12:00:00"), today)) {
            displayStatus = "vencido";
          }
        }
        return <StatusBadge status={displayStatus} type="financial" />;
      },
    },
    {
      key: "acoes",
      header: "Ações",
      width: "6%",
      align: "right" as const,
      render: (l: Lancamento) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {l.status !== "pago" && (
              <DropdownMenuItem onClick={() => openBaixa(l)}>
                <Banknote className="h-4 w-4 mr-2" /> Dar Baixa
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (confirm(`Excluir "${l.descricao || l.fornecedor}"?`)) handleDelete(l.id);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contas a Pagar"
        subtitle="Lançamentos, plano de contas e conciliação financeira"
      />

      {/* KPI Cards */}
      <KpiCards
        items={[
          { label: "Total de títulos", value: kpiTotais.total, isCurrency: true, sublabel: `${lancamentos.length} lançamentos` },
          { label: "Pago no mês", value: kpiTotais.pagoMes, isCurrency: true, sublabel: "Confirmados", sublabelColor: "#1D9E75" },
          { label: "Em aberto", value: kpiTotais.emAberto, isCurrency: true, sublabel: `${pillCounts.aberto} títulos`, sublabelColor: "#378ADD" },
          { label: "Vencidos", value: kpiTotais.vencidos, isCurrency: true, sublabel: `${pillCounts.vencido} títulos`, sublabelColor: "#E24B4A" },
        ]}
      />

      {/* Filter Pills + actions */}
      <FilterPills
        pills={[
          { key: "todos", label: "Todos" },
          { key: "aberto", label: "Em aberto", count: pillCounts.aberto, color: { bg: "transparent", text: "#378ADD", border: "rgba(55,138,221,0.3)" } },
          { key: "pago", label: "Pagos", count: pillCounts.pago, color: { bg: "transparent", text: "#1D9E75", border: "rgba(29,158,117,0.3)" } },
          { key: "vencido", label: "Vencidos", count: pillCounts.vencido, color: { bg: "transparent", text: "#E24B4A", border: "rgba(226,75,74,0.3)" } },
        ]}
        activePill={filterPill}
        onPillChange={setFilterPill}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar fornecedor ou descrição..."
        actionLabel="Nova conta"
        onActionClick={() => setShowDialog(true)}
        extraActions={
          <>
            <Label
              htmlFor="comp-upload-lc"
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "Processando..." : "Comprovante IA"}
            </Label>
            <Input
              id="comp-upload-lc"
              type="file"
              accept="image/*,.pdf,.heic,.heif,.tiff,.tif,.bmp,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf"
              className="hidden"
              onChange={handleUploadComprovante}
              disabled={uploading}
            />
          </>
        }
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="Nenhum lançamento encontrado para o período."
        exportFilename="contas_a_pagar"
        exportTitle="Contas a Pagar"
      />

      {/* Dialog: Nova Conta */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova Conta a Pagar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-1">
            {/* Fornecedor CNPJ */}
            <CnpjLookupInput
              label="CNPJ do Fornecedor"
              value={form.cnpj_fornecedor}
              onChange={(val) => setForm({ ...form, cnpj_fornecedor: val })}
              onDataFound={(data) => {
                setForm((prev) => ({
                  ...prev,
                  fornecedor: data.razao_social || data.nome_fantasia || prev.fornecedor,
                  cnpj_fornecedor: prev.cnpj_fornecedor,
                }));
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fornecedor</Label>
                <Input
                  value={form.fornecedor}
                  onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição *</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Ex: Aluguel janeiro"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Centro de Custo</Label>
                <Select value={form.centro_custo} onValueChange={(v) => setForm({ ...form, centro_custo: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CENTRO_CUSTO_TAGS).map(([key, tag]) => (
                      <SelectItem key={key} value={key}>{tag.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Plano de Contas</Label>
                <Select value={form.plano_contas_id} onValueChange={(v) => setForm({ ...form, plano_contas_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {planoContas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.codigo_estruturado} – {p.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Forma de pagamento pills */}
            <div className="space-y-1.5">
              <Label className="text-xs">Forma de Pagamento</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "pix", label: "PIX" },
                  { key: "boleto", label: "Boleto" },
                  { key: "debito_automatico", label: "Déb. automático" },
                  { key: "transferencia", label: "Transferência" },
                  { key: "cartao_credito", label: "Crédito" },
                  { key: "dinheiro", label: "Dinheiro" },
                ].map((op) => (
                  <button
                    key={op.key}
                    type="button"
                    onClick={() => setForm({ ...form, forma_pagamento: op.key })}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium transition-all border ${
                      form.forma_pagamento === op.key
                        ? "bg-secondary text-secondary-foreground border-secondary"
                        : "bg-card text-muted-foreground border-border"
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimento</Label>
                <Input
                  type="date"
                  value={form.data_vencimento}
                  onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data Competência</Label>
                <Input
                  type="date"
                  value={form.data_competencia}
                  onChange={(e) => setForm({ ...form, data_competencia: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Recorrente</p>
                  <p className="text-[11px] text-muted-foreground">Lançamento mensal automático</p>
                </div>
                <Switch
                  checked={form.recorrente}
                  onCheckedChange={(v) => setForm({ ...form, recorrente: v })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição / Observação</Label>
              <Input
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="Observações adicionais"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              <Button
                onClick={handleCreate}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
              >
                Criar Conta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Dar Baixa */}
      <Dialog open={showBaixaDialog} onOpenChange={setShowBaixaDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Dar Baixa</DialogTitle>
          </DialogHeader>
          {baixaTarget && (
            <div className="space-y-4 pt-1">
              <div className="rounded-lg p-3 bg-muted">
                <p className="text-[13px] font-semibold text-foreground">
                  {baixaTarget.fornecedor || baixaTarget.descricao}
                </p>
                <p className="text-[12px] mt-0.5 text-muted-foreground">
                  Valor original: <strong>{formatCurrency(baixaTarget.valor)}</strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Data de Pagamento</Label>
                <Input
                  type="date"
                  value={baixaForm.data_pagamento}
                  onChange={(e) => setBaixaForm({ ...baixaForm, data_pagamento: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor Pago</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={baixaForm.valor_pago}
                    onChange={(e) => setBaixaForm({ ...baixaForm, valor_pago: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Juros / Multa</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={baixaForm.juros}
                    onChange={(e) => setBaixaForm({ ...baixaForm, juros: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Desconto</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={baixaForm.desconto}
                    onChange={(e) => setBaixaForm({ ...baixaForm, desconto: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Banco / Conta</Label>
                <Input
                  value={baixaForm.banco}
                  onChange={(e) => setBaixaForm({ ...baixaForm, banco: e.target.value })}
                  placeholder="Ex: Itaú Corrente"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Comprovante</Label>
                <Input
                  type="file"
                  accept="image/*,.pdf,.heic,.heif,.tiff,.tif,.bmp,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf"
                  onChange={(e) => setBaixaFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Observação</Label>
                <Input
                  value={baixaForm.observacao}
                  onChange={(e) => setBaixaForm({ ...baixaForm, observacao: e.target.value })}
                  placeholder="Observação opcional"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setShowBaixaDialog(false)}>Cancelar</Button>
                <Button
                  onClick={handleBaixa}
                  disabled={savingBaixa}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  {savingBaixa ? "Salvando..." : "Confirmar baixa"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ======================= TAB: COMPROVANTES =======================
interface Comprovante {
  id: string;
  arquivo_url: string;
  arquivo_nome: string | null;
  tipo_arquivo: string | null;
  status: string;
  dados_extraidos: any;
  created_at: string;
  lancamento_id: string | null;
}

function TabComprovantes() {
  const { clinicaId } = useAuth();
  const [comprovantes, setComprovantes] = useState<Comprovante[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!clinicaId) return;
    fetchComprovantes();
  }, [clinicaId]);

  const fetchComprovantes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("comprovantes")
      .select("id, arquivo_url, arquivo_nome, tipo_arquivo, status, dados_extraidos, created_at, lancamento_id")
      .eq("clinica_id", clinicaId!)
      .order("created_at", { ascending: false })
      .limit(200);
    setComprovantes((data as any[]) || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const sanitizedName = file.name
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${clinicaId}/${Date.now()}_${sanitizedName}`;
        const { error: upErr } = await supabase.storage.from("comprovantes").upload(filePath, file);
        if (upErr) { toast.error("Erro no upload: " + upErr.message); continue; }

        const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(filePath);

        const { error: compErr } = await supabase.from("comprovantes").insert({
          clinica_id: clinicaId!,
          arquivo_url: urlData.publicUrl,
          arquivo_nome: file.name,
          tipo_arquivo: file.type,
          status: "pendente",
        }).select().single();

        if (compErr) { toast.error(compErr.message); continue; }

        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        const CHUNK = 8192;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        const image_base64 = btoa(binary);

        toast.info(`Processando ${file.name}...`);
        const { error: fnErr } = await supabase.functions.invoke("process-comprovante", {
          body: { clinica_id: clinicaId, image_base64, filename: file.name, mime_type: file.type },
        });

        if (fnErr) toast.error(`Erro em ${file.name}: ${fnErr.message}`);
        else toast.success(`${file.name} processado!`);
      } catch (err: any) {
        toast.error(`Erro: ${err.message}`);
      }
    }

    setUploading(false);
    e.target.value = "";
    fetchComprovantes();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("comprovantes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Comprovante excluído"); setComprovantes((prev) => prev.filter((c) => c.id !== id)); }
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return comprovantes;
    return comprovantes.filter((c) => {
      const ext = c.dados_extraidos || {};
      return (
        c.arquivo_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ext.fornecedor?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [comprovantes, searchTerm]);

  const columns = [
    {
      key: "arquivo_nome",
      header: "Arquivo",
      width: "22%",
      render: (c: Comprovante) => (
        <button
          onClick={() => setPreviewUrl(c.arquivo_url)}
          className="flex items-center gap-2 text-[13px] hover:underline text-secondary"
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="truncate max-w-[160px]">{c.arquivo_nome || "comprovante"}</span>
        </button>
      ),
    },
    {
      key: "created_at",
      header: "Data Upload",
      width: "13%",
      render: (c: Comprovante) => (
        <span className="text-[13px]">{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
      ),
    },
    {
      key: "fornecedor",
      header: "Fornecedor",
      width: "20%",
      render: (c: Comprovante) => {
        const ext = c.dados_extraidos || {};
        return <span className="text-[13px]">{ext.fornecedor || "—"}</span>;
      },
    },
    {
      key: "valor",
      header: "Valor",
      width: "12%",
      align: "right" as const,
      render: (c: Comprovante) => {
        const ext = c.dados_extraidos || {};
        return (
          <span className="text-[13px]" style={{ fontWeight: 500 }}>
            {ext.valor ? formatCurrency(ext.valor) : "—"}
          </span>
        );
      },
    },
    {
      key: "data_pagamento",
      header: "Data Pgto",
      width: "12%",
      render: (c: Comprovante) => {
        const ext = c.dados_extraidos || {};
        return <span className="text-[13px]">{ext.data_pagamento || "—"}</span>;
      },
    },
    {
      key: "classificacao",
      header: "Classificação",
      width: "14%",
      render: (c: Comprovante) => {
        const ext = c.dados_extraidos || {};
        return (
          <span className="text-[12px]" style={{ color: "#666" }}>
            {ext.plano_contas_codigo_estruturado
              ? `${ext.plano_contas_codigo_estruturado} – ${ext.descricao || ""}`
              : "—"}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "10%",
      render: (c: Comprovante) => {
        const statusMap: Record<string, string> = {
          pendente: "pendente",
          processado: "pago",
          erro: "vencido",
          vinculado: "aberto",
        };
        return <StatusBadge status={statusMap[c.status] || c.status} type="financial" label={c.status.charAt(0).toUpperCase() + c.status.slice(1)} />;
      },
    },
    {
      key: "acoes",
      header: "Ações",
      width: "7%",
      align: "right" as const,
      render: (c: Comprovante) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewUrl(c.arquivo_url)}>
            <Eye className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir comprovante?</AlertDialogTitle>
                <AlertDialogDescription>
                  {c.arquivo_nome || "Este comprovante"} será excluído permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(c.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comprovantes"
        subtitle="Suba comprovantes para identificação automática via IA"
        actions={
          <>
            <Label
              htmlFor="comp-multi-upload"
              className="flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors"
              style={{ background: "#1B5E7B" }}
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Processando..." : "Enviar Comprovantes"}
            </Label>
            <Input
              id="comp-multi-upload"
              type="file"
              accept="image/*,.pdf,.heic,.heif,.tiff,.tif,.bmp,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </>
        }
      />

      {/* Info pipeline cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: <Upload className="h-5 w-5" style={{ color: "#1B5E7B" }} />, step: "1. Upload", desc: "Envie foto ou PDF do comprovante", bg: "rgba(27,94,123,0.08)" },
          { icon: <AlertCircle className="h-5 w-5" style={{ color: "#BA7517" }} />, step: "2. IA Extrai", desc: "Campos extraídos automaticamente", bg: "rgba(186,117,23,0.08)" },
          { icon: <CheckCircle2 className="h-5 w-5" style={{ color: "#1D9E75" }} />, step: "3. Lançamento", desc: "Criado e classificado automaticamente", bg: "rgba(29,158,117,0.08)" },
        ].map((item) => (
          <div
            key={item.step}
            className="flex items-start gap-3 rounded-xl p-4"
            style={{ background: "#F5F5F5", border: "0.5px solid #E5E5E5" }}
          >
            <div className="rounded-lg p-2" style={{ background: item.bg }}>
              {item.icon}
            </div>
            <div>
              <p className="font-semibold text-[13px]" style={{ color: "#2C3E50" }}>{item.step}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "#666" }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" style={{ color: "#666" }} />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar comprovante..."
          className="h-9 pl-8 text-[13px]"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="Nenhum comprovante encontrado. Envie fotos ou PDFs para identificação automática."
        exportFilename="comprovantes"
        exportTitle="Comprovantes"
      />

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>Visualizar Comprovante</DialogTitle></DialogHeader>
          {previewUrl && (
            previewUrl.match(/\.pdf/i)
              ? <iframe src={previewUrl} className="w-full h-[70vh] rounded" />
              : <img src={previewUrl} alt="Comprovante" className="w-full max-h-[70vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ======================= TAB: PLANO DE CONTAS =======================
function TabPlanoContas() {
  const { clinicaId } = useAuth();
  const [contas, setContas] = useState<PlanoContas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!clinicaId) return;
    fetchContas();
  }, [clinicaId]);

  const fetchContas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("plano_contas")
      .select("*")
      .eq("clinica_id", clinicaId!)
      .eq("indicador", "debito")
      .order("codigo_estruturado");
    setContas((data as any[]) || []);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    if (!searchTerm) return contas;
    return contas.filter(
      (c) =>
        c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.codigo_estruturado.includes(searchTerm)
    );
  }, [contas, searchTerm]);

  const categorias = useMemo(() => {
    const map = new Map<string, PlanoContas[]>();
    for (const c of filtered) {
      const arr = map.get(c.categoria) || [];
      arr.push(c);
      map.set(c.categoria, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const columns = [
    {
      key: "codigo_estruturado",
      header: "Código",
      width: "130px",
      render: (c: PlanoContas) => (
        <span className="font-mono text-[13px]">{c.codigo_estruturado}</span>
      ),
    },
    {
      key: "descricao",
      header: "Descrição",
      render: (c: PlanoContas) => <span className="text-[13px]">{c.descricao}</span>,
    },
    {
      key: "indicador",
      header: "Indicador",
      width: "120px",
      render: (c: PlanoContas) => (
        <StatusBadge
          status={c.indicador === "credito" ? "pago" : "aberto"}
          type="financial"
          label={c.indicador === "credito" ? "Crédito" : "Débito"}
        />
      ),
    },
    {
      key: "ativo",
      header: "Ativo",
      width: "80px",
      align: "center" as const,
      render: (c: PlanoContas) => c.ativo
        ? <CheckCircle2 className="h-4 w-4 mx-auto" style={{ color: "#1D9E75" }} />
        : <X className="h-4 w-4 mx-auto" style={{ color: "#CCC" }} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <PageHeader title="Plano de Contas" subtitle="Estrutura de classificação financeira" />
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5" style={{ color: "#666" }} />
          <Input
            placeholder="Buscar no plano de contas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 pl-8 text-[13px]"
          />
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          style={{ background: "#E6F1FB", color: "#378ADD" }}
        >
          {contas.length} contas
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-transparent" style={{ borderTopColor: "#1B5E7B" }} />
        </div>
      ) : categorias.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center text-[13px]"
          style={{ border: "0.5px solid #E5E5E5", color: "#666" }}
        >
          Plano de contas vazio. Importe via Configurações ou seed automático.
        </div>
      ) : (
        <div className="space-y-4">
          {categorias.map(([cat, items]) => (
            <div key={cat}>
              <p
                className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1"
                style={{ color: "#666" }}
              >
                {cat}
              </p>
              <DataTable
                columns={columns}
                data={items}
                emptyMessage=""
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================= TAB: CONCILIAÇÃO =======================
function TabConciliacao() {
  const { clinicaId } = useAuth();
  const [importingOFX, setImportingOFX] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleOFXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".ofx")) {
      toast.error("Selecione um arquivo .OFX");
      return;
    }
    setImportingOFX(true);
    try {
      const text = await file.text();
      const { data, error } = await supabase.functions.invoke("import-ofx", {
        body: { clinica_id: clinicaId, ofx_content: text },
      });
      if (error) throw error;

      if (data.message && data.imported_count === 0) {
        setLastResult({ ...data, alreadyImported: true });
        toast.warning("Este arquivo já foi importado anteriormente.");
      } else {
        setLastResult({ ...data, alreadyImported: false });
        toast.success(
          `OFX importado! ${data.debitos_criados ?? 0} débitos (AP), ${data.creditos_criados ?? 0} créditos (AR), ${data.matched_ap ?? 0} conciliados.`
        );
      }
    } catch (err: any) {
      toast.error("Erro na importação: " + err.message);
    } finally {
      setImportingOFX(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conciliação Bancária"
        subtitle="Importe extratos OFX para conciliação automática de débitos"
      />

      {/* OFX Upload Card */}
      <div
        className="rounded-xl p-6 space-y-4"
        style={{ border: "0.5px solid #E5E5E5", background: "white" }}
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2" style={{ background: "rgba(27,94,123,0.08)" }}>
            <FileText className="h-5 w-5" style={{ color: "#1B5E7B" }} />
          </div>
          <div>
            <p className="font-semibold text-[14px]" style={{ color: "#2C3E50" }}>Importar Extrato OFX</p>
            <p className="text-[12px]" style={{ color: "#666" }}>
              Transações sem comprovante serão criadas como "A Classificar"
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Label
            htmlFor="ofx-import"
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed px-6 py-4 text-[13px] transition-colors hover:bg-gray-50"
            style={{ borderColor: "#E5E5E5", color: "#666" }}
          >
            <Upload className="h-4 w-4" />
            {importingOFX ? "Importando..." : "Selecionar arquivo (OFX, CSV, XLS)"}
          </Label>
          <Input
            id="ofx-import"
            type="file"
            accept=".ofx,.csv,.xls,.xlsx,.txt"
            className="hidden"
            onChange={handleOFXUpload}
            disabled={importingOFX}
          />
        </div>

        {lastResult && (
          <div
            className="rounded-xl p-4"
            style={{
              background: lastResult.alreadyImported ? "rgba(186,117,23,0.06)" : "rgba(29,158,117,0.06)",
              border: `0.5px solid ${lastResult.alreadyImported ? "rgba(186,117,23,0.3)" : "rgba(29,158,117,0.3)"}`,
            }}
          >
            {lastResult.alreadyImported ? (
              <>
                <p className="font-semibold text-[13px] mb-1" style={{ color: "#BA7517" }}>
                  Arquivo já importado
                </p>
                <p className="text-[12px]" style={{ color: "#666" }}>
                  Este extrato ({lastResult.duplicates_count ?? 0} transações) já foi processado.
                  As transações já estão no sistema.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-[13px] mb-3" style={{ color: "#2C3E50" }}>
                  Resultado da importação
                  {lastResult.banco && (
                    <span className="font-normal text-[12px] ml-2" style={{ color: "#666" }}>
                      Banco: {lastResult.banco}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "Total", value: (lastResult.imported_count || 0) + (lastResult.duplicates_count || 0), color: "#2C3E50" },
                    { label: "Débitos (AP)", value: lastResult.debitos_criados ?? 0, color: "#1B5E7B" },
                    { label: "Créditos (AR)", value: lastResult.creditos_criados ?? 0, color: "#378ADD" },
                    { label: "Conciliados", value: (lastResult.matched_ap ?? 0) + (lastResult.matched_ar ?? 0), color: "#1D9E75" },
                    { label: "Duplicados", value: lastResult.duplicates_count ?? 0, color: "#666" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg p-3 text-center"
                      style={{ background: "white", border: "0.5px solid #E5E5E5" }}
                    >
                      <p className="text-[11px] mb-1" style={{ color: "#666" }}>{item.label}</p>
                      <p className="text-[20px] font-bold" style={{ color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                {lastResult.errors?.length > 0 && (
                  <div className="mt-3 rounded-lg p-2 text-[12px]" style={{ background: "#FCEBEB", color: "#E24B4A" }}>
                    {lastResult.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Pipeline info */}
      <div
        className="rounded-xl p-6"
        style={{ border: "0.5px solid #E5E5E5", background: "white" }}
      >
        <p className="font-semibold text-[14px] mb-1" style={{ color: "#2C3E50" }}>Pipeline de Comprovantes</p>
        <p className="text-[12px] mb-4" style={{ color: "#666" }}>
          Upload de comprovantes com extração automática via IA. WhatsApp em breve.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: <Upload className="h-5 w-5" style={{ color: "#1B5E7B" }} />, step: "1. Upload", desc: "Envie foto ou PDF do comprovante", bg: "rgba(27,94,123,0.08)" },
            { icon: <AlertCircle className="h-5 w-5" style={{ color: "#BA7517" }} />, step: "2. IA Extrai", desc: "Campos extraídos automaticamente", bg: "rgba(186,117,23,0.08)" },
            { icon: <CheckCircle2 className="h-5 w-5" style={{ color: "#1D9E75" }} />, step: "3. Lançamento", desc: "Criado e classificado automaticamente", bg: "rgba(29,158,117,0.08)" },
          ].map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ background: "#F5F5F5", border: "0.5px solid #E5E5E5" }}
            >
              <div className="rounded-lg p-2" style={{ background: item.bg }}>
                {item.icon}
              </div>
              <div>
                <p className="font-semibold text-[13px]" style={{ color: "#2C3E50" }}>{item.step}</p>
                <p className="text-[12px] mt-0.5" style={{ color: "#666" }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

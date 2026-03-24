import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DollarSign, CheckCircle2, Search, Calendar, Banknote } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

interface VendaDia {
  id: string;
  data_competencia: string;
  descricao: string | null;
  valor_bruto: number;
  forma_pagamento: string | null;
  status_recebimento: string;
  paciente_nome?: string;
  medico_nome?: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Caixa() {
  const { clinicaId } = useAuth();
  const [vendas, setVendas] = useState<VendaDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPagamento, setFilterPagamento] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicaId) return;
    fetchVendas();
  }, [clinicaId, selectedDate]);

  const fetchVendas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transacoes_vendas")
      .select(`
        id, data_competencia, descricao, valor_bruto, forma_pagamento,
        status_recebimento,
        pacientes(nome),
        medicos(nome)
      `)
      .eq("clinica_id", clinicaId!)
      .eq("data_competencia", selectedDate)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar atendimentos");
    } else {
      setVendas(
        (data || []).map((v: any) => ({
          ...v,
          paciente_nome: v.pacientes?.nome || "—",
          medico_nome: v.medicos?.nome || "—",
        }))
      );
    }
    setLoading(false);
  };

  const handleBaixaDinheiro = async (vendaId: string) => {
    setProcessingId(vendaId);
    try {
      // Create recebimento record
      const venda = vendas.find((v) => v.id === vendaId);
      if (!venda) return;

      const { error: recError } = await supabase
        .from("transacoes_recebimentos")
        .insert({
          clinica_id: clinicaId!,
          venda_id: vendaId,
          valor: venda.valor_bruto,
          data_recebimento: selectedDate,
          origem: "caixa_manual",
        });

      if (recError) throw recError;

      // Update venda status
      const { error: updError } = await supabase
        .from("transacoes_vendas")
        .update({
          status_recebimento: "recebido",
          data_caixa: selectedDate,
        })
        .eq("id", vendaId);

      if (updError) throw updError;

      toast.success("Pagamento registrado com sucesso!");
      fetchVendas();
    } catch (e: any) {
      toast.error("Erro ao registrar pagamento: " + e.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      const matchSearch =
        !searchTerm ||
        v.paciente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.medico_nome?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchPagamento =
        filterPagamento === "todos" || v.forma_pagamento === filterPagamento;
      const matchStatus =
        filterStatus === "todos" || v.status_recebimento === filterStatus;
      return matchSearch && matchPagamento && matchStatus;
    });
  }, [vendas, searchTerm, filterPagamento, filterStatus]);

  const resumo = useMemo(() => {
    const total = filtered.reduce((s, v) => s + v.valor_bruto, 0);
    const recebido = filtered
      .filter((v) => v.status_recebimento === "recebido")
      .reduce((s, v) => s + v.valor_bruto, 0);
    const pendente = filtered
      .filter((v) => v.status_recebimento === "a_receber")
      .reduce((s, v) => s + v.valor_bruto, 0);
    return { total, recebido, pendente, count: filtered.length };
  }, [filtered]);

  const statusLabel = (s: string) => {
    switch (s) {
      case "recebido": return "Recebido";
      case "a_receber": return "A Receber";
      case "inadimplente": return "Inadimplente";
      case "glosado": return "Glosado";
      default: return s;
    }
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "recebido": return "default" as const;
      case "a_receber": return "secondary" as const;
      case "inadimplente": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caixa</h1>
          <p className="text-sm text-muted-foreground">
            Baixa manual de pagamentos em dinheiro
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-secondary/10 p-2.5">
                <Calendar className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atendimentos</p>
                <p className="text-xl font-bold">{resumo.count}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total do Dia</p>
                <p className="text-xl font-bold">{formatCurrency(resumo.total)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-emerald-500/10 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-xl font-bold">{formatCurrency(resumo.recebido)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-warning/10 p-2.5">
                <Banknote className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-xl font-bold">{formatCurrency(resumo.pendente)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente, médico ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterPagamento} onValueChange={setFilterPagamento}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="convenio">Convênio</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="a_receber">A Receber</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="inadimplente">Inadimplente</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                Nenhum atendimento encontrado para esta data.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Médico</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.paciente_nome}</TableCell>
                      <TableCell>{v.medico_nome}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {v.descricao || "—"}
                      </TableCell>
                      <TableCell>{v.forma_pagamento || "—"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(v.valor_bruto)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(v.status_recebimento)}>
                          {statusLabel(v.status_recebimento)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {v.status_recebimento === "a_receber" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBaixaDinheiro(v.id)}
                            disabled={processingId === v.id}
                            className="gap-1"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            {processingId === v.id ? "..." : "Dar Baixa"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

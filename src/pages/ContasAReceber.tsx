import { useState, useEffect, useMemo, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, { DashboardFilterValues } from "@/components/dashboard/DashboardFilters";
import { startOfMonth } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Search, CheckCircle2, Clock, AlertCircle, CreditCard, Banknote, QrCode,
} from "lucide-react";
import { Label } from "@/components/ui/label";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface CrAgregado {
  id: string;
  tipo_recebivel: string;
  competencia: string;
  data_base: string | null;
  data_prevista_recebimento: string | null;
  data_recebimento: string | null;
  meio: string;
  bandeira: string | null;
  valor_esperado: number;
  valor_recebido: number;
  status: string;
  origem_ref: any;
  origem_dado: string | null;
  nf_id: string | null;
}

const arDefaultFilters: DashboardFilterValues = {
  dateFrom: startOfMonth(new Date(2026, 0, 1)),
  dateTo: new Date(),
  basCalculo: "competencia",
};

export default function ContasAReceber() {
  const [filters, setFilters] = useState<DashboardFilterValues>(arDefaultFilters);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">
            Visão agregada por meio/dia para conciliação e baixa
          </p>
        </div>

        <DashboardFilters filters={filters} onFilterChange={setFilters} />

        <Tabs defaultValue="agregado" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="agregado">Recebíveis Agregados</TabsTrigger>
            <TabsTrigger value="dinheiro">Baixa Dinheiro</TabsTrigger>
          </TabsList>

          <TabsContent value="agregado">
            <TabAgregado dateFrom={filters.dateFrom} dateTo={filters.dateTo} />
          </TabsContent>
          <TabsContent value="dinheiro">
            <TabDinheiro dateFrom={filters.dateFrom} dateTo={filters.dateTo} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
function mapFormaPgtoToMeio(fp: string | null): string {
  if (!fp) return "dinheiro";
  if (fp === "cartao_credito") return "cartao_credito";
  if (fp === "cartao_debito") return "cartao_debito";
  if (fp === "pix") return "pix";
  if (fp === "convenio_nf") return "convenio";
  if (fp === "dinheiro") return "dinheiro";
  return "dinheiro";
}

// ======================= TAB: AGREGADO =======================
function TabAgregado({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) {
  const { clinicaId } = useAuth();
  const [items, setItems] = useState<CrAgregado[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMeio, setFilterMeio] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

  useEffect(() => {
    if (!clinicaId) return;
    fetchData();
  }, [clinicaId, dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);

    // Try canonical table first
    const { data: aggData } = await supabase
      .from("contas_receber_agregado")
      .select("*")
      .eq("clinica_id", clinicaId!)
      .gte("data_base", format(dateFrom, "yyyy-MM-dd"))
      .lte("data_base", format(dateTo, "yyyy-MM-dd"))
      .order("data_base", { ascending: false })
      .limit(500);

    if (aggData && aggData.length > 0) {
      setItems(aggData as any[]);
      setLoading(false);
      return;
    }

    // Fallback: aggregate from transacoes_vendas
    const { data: vendas } = await supabase
      .from("transacoes_vendas")
      .select("data_competencia, forma_pagamento_enum, valor_bruto, status_recebimento")
      .eq("clinica_id", clinicaId!)
      .gte("data_competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("data_competencia", format(dateTo, "yyyy-MM-dd"))
      .limit(5000);

    if (vendas && vendas.length > 0) {
      const grouped: Record<string, CrAgregado> = {};
      for (const v of vendas) {
        const meio = mapFormaPgtoToMeio(v.forma_pagamento_enum);
        const key = `${v.data_competencia}|${meio}`;
        if (!grouped[key]) {
          const comp = v.data_competencia.substring(0, 7) + "-01";
          grouped[key] = {
            id: key,
            tipo_recebivel: meio === "convenio" ? "convenio_nf" : meio === "dinheiro" ? "dinheiro" : "getnet",
            competencia: comp,
            data_base: v.data_competencia,
            data_prevista_recebimento: null,
            data_recebimento: null,
            meio,
            bandeira: null,
            valor_esperado: 0,
            valor_recebido: 0,
            status: "pendente",
            origem_ref: null,
            origem_dado: null,
            nf_id: null,
          };
        }
        grouped[key].valor_esperado += Number(v.valor_bruto) || 0;
        if (v.status_recebimento === "recebido") {
          grouped[key].valor_recebido += Number(v.valor_bruto) || 0;
        }
      }
      const result = Object.values(grouped).map(r => {
        if (r.valor_recebido >= r.valor_esperado && r.valor_esperado > 0) r.status = "recebido";
        else if (r.valor_recebido > 0) r.status = "parcial";
        return r;
      });
      result.sort((a, b) => (b.data_base || "").localeCompare(a.data_base || ""));
      setItems(result);
    } else {
      setItems([]);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return items.filter((r) => {
      const matchMeio = filterMeio === "todos" || r.meio === filterMeio;
      const matchStatus = filterStatus === "todos" || r.status === filterStatus;
      return matchMeio && matchStatus;
    });
  }, [items, filterMeio, filterStatus]);

  const totals = useMemo(() => {
    const esperado = filtered.reduce((s, r) => s + r.valor_esperado, 0);
    const recebido = filtered.reduce((s, r) => s + r.valor_recebido, 0);
    const pendente = filtered.filter(r => r.status === "pendente").reduce((s, r) => s + r.valor_esperado, 0);
    return { esperado, recebido, pendente };
  }, [filtered]);

  const meioLabel: Record<string, string> = {
    cartao_credito: "Cartão Crédito",
    cartao_debito: "Cartão Débito",
    pix: "PIX",
    dinheiro: "Dinheiro",
    convenio: "Convênio",
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "recebido": case "conciliado": return "default" as const;
      case "pendente": return "outline" as const;
      case "parcial": return "secondary" as const;
      case "divergente": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  const origemLabel: Record<string, string> = {
    feegow_caixa: "Feegow Caixa",
    feegow_invoice: "Feegow Invoice",
    getnet_vendas: "Getnet",
    banco_credito: "Banco",
    manual: "Manual",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valor Esperado</p>
            <p className="text-lg font-bold">{formatCurrency(totals.esperado)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recebido</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totals.recebido)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(totals.pendente)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterMeio} onValueChange={setFilterMeio}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Meios</SelectItem>
            <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
            <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="dinheiro">Dinheiro</SelectItem>
            <SelectItem value="convenio">Convênio</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="recebido">Recebido</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="divergente">Divergente</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} registros</Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <AlertCircle className="mx-auto mb-3 h-8 w-8" />
              <p>Nenhum recebível agregado encontrado.</p>
              <p className="text-xs mt-1">Execute a conciliação para gerar os registros agregados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead>Data Base</TableHead>
                   <TableHead>Meio</TableHead>
                   <TableHead>Bandeira</TableHead>
                   <TableHead className="text-right">Esperado</TableHead>
                   <TableHead className="text-right">Recebido</TableHead>
                   <TableHead>Origem</TableHead>
                   <TableHead>Status</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                   <TableRow key={r.id}>
                     <TableCell className="text-sm whitespace-nowrap">
                       {r.data_base ? new Date(r.data_base + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                     </TableCell>
                     <TableCell>
                       <div className="flex items-center gap-1.5">
                         {r.meio === "cartao_credito" || r.meio === "cartao_debito" ? <CreditCard className="h-3.5 w-3.5" /> :
                          r.meio === "pix" ? <QrCode className="h-3.5 w-3.5" /> :
                          r.meio === "dinheiro" ? <Banknote className="h-3.5 w-3.5" /> :
                          <Clock className="h-3.5 w-3.5" />}
                         <span className="text-xs">{meioLabel[r.meio] || r.meio}</span>
                       </div>
                     </TableCell>
                     <TableCell className="text-xs">{r.bandeira || "—"}</TableCell>
                     <TableCell className="text-right font-medium">{formatCurrency(r.valor_esperado)}</TableCell>
                     <TableCell className="text-right font-medium text-emerald-600">
                       {r.valor_recebido > 0 ? formatCurrency(r.valor_recebido) : "—"}
                     </TableCell>
                     <TableCell className="text-xs whitespace-nowrap">
                       {r.origem_dado ? (origemLabel[r.origem_dado] || r.origem_dado) : "Vendas"}
                     </TableCell>
                     <TableCell>
                       <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                     </TableCell>
                   </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ======================= TAB: BAIXA DINHEIRO =======================
function TabDinheiro({ dateFrom, dateTo }: { dateFrom: Date; dateTo: Date }) {
  const { clinicaId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [baixaDialog, setBaixaDialog] = useState<any>(null);
  const [baixaData, setBaixaData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [baixaObs, setBaixaObs] = useState("");
  const [baixaLoading, setBaixaLoading] = useState(false);

  useEffect(() => {
    if (!clinicaId) return;
    fetchDinheiro();
  }, [clinicaId, dateFrom, dateTo]);

  const fetchDinheiro = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("transacoes_vendas")
      .select("id, data_competencia, valor_bruto, descricao, procedimento, status_recebimento, pacientes(nome), medicos(nome)")
      .eq("clinica_id", clinicaId!)
      .eq("forma_pagamento_enum", "dinheiro")
      .eq("status_recebimento", "a_receber")
      .gte("data_competencia", format(dateFrom, "yyyy-MM-dd"))
      .lte("data_competencia", format(dateTo, "yyyy-MM-dd"))
      .order("data_competencia", { ascending: false })
      .limit(200);
    setItems((data as any[]) || []);
    setLoading(false);
  };

  const handleBaixa = useCallback(async () => {
    if (!baixaDialog) return;
    setBaixaLoading(true);
    const { error } = await supabase
      .from("transacoes_vendas")
      .update({
        status_recebimento: "recebido" as any,
        data_caixa: baixaData,
        observacao: baixaObs || null,
      })
      .eq("id", baixaDialog.id);

    if (error) {
      toast.error("Erro ao dar baixa: " + error.message);
    } else {
      toast.success("Baixa realizada!");
      setItems(prev => prev.filter(v => v.id !== baixaDialog.id));
    }
    setBaixaLoading(false);
    setBaixaDialog(null);
  }, [baixaDialog, baixaData, baixaObs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Banknote className="h-5 w-5 text-amber-600" />
            Dinheiro — Baixa Manual
          </CardTitle>
          <CardDescription>
            Somente recebimentos em dinheiro precisam de baixa manual. Cartão e PIX são baixados automaticamente pela conciliação.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
              <p>Nenhum recebível em dinheiro pendente.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Procedimento</TableHead>
                  <TableHead>Médico</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {new Date(r.data_competencia + "T12:00:00").toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium max-w-[150px] truncate">{r.pacientes?.nome || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{r.procedimento || r.descricao || "—"}</TableCell>
                    <TableCell className="text-sm">{r.medicos?.nome || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.valor_bruto)}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => { setBaixaDialog(r); setBaixaData(format(new Date(), "yyyy-MM-dd")); setBaixaObs(""); }}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Baixa
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!baixaDialog} onOpenChange={(open) => !open && setBaixaDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Baixa Manual — Dinheiro</DialogTitle>
            <DialogDescription>
              Confirmar recebimento de {baixaDialog ? formatCurrency(baixaDialog.valor_bruto) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="baixa-data-din">Data do recebimento</Label>
              <Input id="baixa-data-din" type="date" value={baixaData} onChange={(e) => setBaixaData(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="baixa-obs-din">Observação (opcional)</Label>
              <Textarea id="baixa-obs-din" placeholder="Ex: Recebido no caixa" value={baixaObs} onChange={(e) => setBaixaObs(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaDialog(null)}>Cancelar</Button>
            <Button onClick={handleBaixa} disabled={baixaLoading}>
              {baixaLoading ? "Processando..." : "Confirmar Baixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

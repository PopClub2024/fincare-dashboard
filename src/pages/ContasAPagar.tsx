import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Plus, Upload, Search, FileText, CheckCircle2, Clock, AlertCircle, Banknote, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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
  data_competencia: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  tipo_despesa: string;
  status: string;
  forma_pagamento: string | null;
  plano_contas_id: string | null;
  ofx_transaction_id: string | null;
  plano_contas?: { codigo_estruturado: string; descricao: string; categoria: string } | null;
}

// ======================= MAIN PAGE =======================
export default function ContasAPagar() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">
            Lançamentos, plano de contas e conciliação financeira
          </p>
        </div>

        <Tabs defaultValue="lancamentos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-muted">
            <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
            <TabsTrigger value="plano">Plano de Contas</TabsTrigger>
            <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
          </TabsList>

          <TabsContent value="lancamentos"><TabLancamentos /></TabsContent>
          <TabsContent value="plano"><TabPlanoContas /></TabsContent>
          <TabsContent value="conciliacao"><TabConciliacao /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ======================= TAB: LANÇAMENTOS =======================
function TabLancamentos() {
  const { clinicaId } = useAuth();
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoContas[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [showDialog, setShowDialog] = useState(false);
  const [uploading, setUploading] = useState(false);

  // New lancamento form
  const [form, setForm] = useState({
    descricao: "", fornecedor: "", valor: "", data_competencia: new Date().toISOString().split("T")[0],
    data_vencimento: "", plano_contas_id: "", forma_pagamento: "", tipo_despesa: "variavel",
  });

  useEffect(() => {
    if (!clinicaId) return;
    fetchLancamentos();
    fetchPlano();
  }, [clinicaId]);

  const fetchLancamentos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("contas_pagar_lancamentos")
      .select("*, plano_contas(codigo_estruturado, descricao, categoria)")
      .eq("clinica_id", clinicaId!)
      .order("data_competencia", { ascending: false })
      .limit(200);
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
      valor: parseFloat(form.valor),
      data_competencia: form.data_competencia,
      data_vencimento: form.data_vencimento || null,
      plano_contas_id: form.plano_contas_id || null,
      forma_pagamento: (form.forma_pagamento || null) as any,
      tipo_despesa: form.tipo_despesa as any,
      status: (form.plano_contas_id ? "classificado" : "a_classificar") as any,
    };
    const { error } = await supabase.from("contas_pagar_lancamentos").insert(insertData as any);
    if (error) toast.error(error.message);
    else { toast.success("Lançamento criado!"); setShowDialog(false); fetchLancamentos(); }
  };

  const handleUploadComprovante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const filePath = `${clinicaId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("comprovantes").upload(filePath, file);
    if (upErr) { toast.error("Erro no upload: " + upErr.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from("comprovantes").getPublicUrl(filePath);

    const { data: comp, error: compErr } = await supabase.from("comprovantes").insert({
      clinica_id: clinicaId!,
      arquivo_url: urlData.publicUrl,
      arquivo_nome: file.name,
      tipo_arquivo: file.type,
      status: "pendente",
    }).select().single();

    if (compErr) { toast.error(compErr.message); setUploading(false); return; }

    // Convert image to base64 for AI
    let image_base64: string | null = null;
    if (file.type.startsWith("image/")) {
      const buffer = await file.arrayBuffer();
      image_base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    toast.info("Processando comprovante com IA...");
    const { data: result, error: fnErr } = await supabase.functions.invoke("process-comprovante", {
      body: { clinica_id: clinicaId, comprovante_id: comp.id, image_base64 },
    });

    if (fnErr) toast.error("Erro no processamento: " + fnErr.message);
    else toast.success(`Comprovante processado! Lançamento criado.`);

    setUploading(false);
    e.target.value = "";
    fetchLancamentos();
  };

  const filtered = useMemo(() => {
    return lancamentos.filter((l) => {
      const matchSearch = !searchTerm
        || l.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
        || l.fornecedor?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === "todos" || l.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [lancamentos, searchTerm, filterStatus]);

  const statusLabel: Record<string, string> = {
    a_classificar: "A Classificar", classificado: "Classificado", pago: "Pago", cancelado: "Cancelado",
  };
  const statusVariant = (s: string) => {
    switch (s) {
      case "classificado": return "default" as const;
      case "pago": return "secondary" as const;
      case "a_classificar": return "outline" as const;
      case "cancelado": return "destructive" as const;
      default: return "outline" as const;
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar lançamento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="a_classificar">A Classificar</SelectItem>
            <SelectItem value="classificado">Classificado</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="comp-upload" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 px-4 py-2 text-sm transition-colors hover:bg-muted">
          <Upload className="h-4 w-4" />
          {uploading ? "Processando..." : "Comprovante"}
        </Label>
        <Input id="comp-upload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUploadComprovante} disabled={uploading} />

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Novo Lançamento</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Descrição *</Label>
                  <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Fornecedor</Label>
                  <Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Valor *</Label>
                  <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Data Competência</Label>
                  <Input type="date" value={form.data_competencia} onChange={(e) => setForm({ ...form, data_competencia: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Vencimento</Label>
                  <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Plano de Contas</Label>
                  <Select value={form.plano_contas_id} onValueChange={(v) => setForm({ ...form, plano_contas_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {planoContas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.codigo_estruturado} - {p.descricao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Forma Pagamento</Label>
                  <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                      <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                      <SelectItem value="convenio_nf">Convênio/NF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate}>Criar Lançamento</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">Nenhum lançamento encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">{new Date(l.data_competencia + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{l.descricao || "—"}</TableCell>
                    <TableCell>{l.fornecedor || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.plano_contas ? `${l.plano_contas.codigo_estruturado} - ${l.plano_contas.descricao}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(l.valor)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(l.status)}>{statusLabel[l.status] || l.status}</Badge>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar no plano de contas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{contas.length} contas</Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : categorias.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Plano de contas vazio. Importe via Configurações ou seed automático.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categorias.map(([cat, items]) => (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[100px]">Indicador</TableHead>
                      <TableHead className="w-[80px]">Ativo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.codigo_estruturado}</TableCell>
                        <TableCell>{c.descricao}</TableCell>
                        <TableCell>
                          <Badge variant={c.indicador === "credito" ? "default" : "secondary"}>
                            {c.indicador === "credito" ? "Crédito" : "Débito"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {c.ativo ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
      setLastResult(data);
      toast.success(`OFX importado! ${data.created} criados, ${data.matched} conciliados.`);
    } catch (err: any) {
      toast.error("Erro na importação: " + err.message);
    } finally {
      setImportingOFX(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-secondary" />
            <CardTitle className="text-lg">Importar Extrato OFX</CardTitle>
          </div>
          <CardDescription>
            Importe extratos bancários para conciliação automática de débitos.
            Transações sem comprovante serão criadas como "A Classificar".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label htmlFor="ofx-import" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-muted/50 px-6 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted">
              <Upload className="h-4 w-4" />
              {importingOFX ? "Importando..." : "Selecionar arquivo .OFX"}
            </Label>
            <Input id="ofx-import" type="file" accept=".ofx" className="hidden" onChange={handleOFXUpload} disabled={importingOFX} />
          </div>

          {lastResult && (
            <Card className="border-secondary/30 bg-accent/30">
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-2">Resultado da importação</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{lastResult.total}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Criados</p>
                    <p className="text-lg font-bold text-primary">{lastResult.created}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Conciliados</p>
                    <p className="text-lg font-bold text-secondary">{lastResult.matched}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ignorados</p>
                    <p className="text-lg font-bold text-muted-foreground">{lastResult.skipped}</p>
                  </div>
                </div>
                {lastResult.errors?.length > 0 && (
                  <div className="mt-3 rounded bg-destructive/10 p-2 text-xs text-destructive">
                    {lastResult.errors.map((e: string, i: number) => <p key={i}>{e}</p>)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pipeline de Comprovantes</CardTitle>
          <CardDescription>
            Upload de comprovantes com extração automática via IA. WhatsApp em breve.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-primary/10 p-2">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">1. Upload</p>
                <p className="text-xs text-muted-foreground">Envie foto ou PDF do comprovante</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-secondary/10 p-2">
                <AlertCircle className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="font-medium text-sm">2. IA Extrai</p>
                <p className="text-xs text-muted-foreground">Campos extraídos automaticamente</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-accent p-2">
                <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">3. Lançamento</p>
                <p className="text-xs text-muted-foreground">Criado e classificado automaticamente</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

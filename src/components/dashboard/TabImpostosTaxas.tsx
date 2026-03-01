import { useState, useEffect, useMemo } from "react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Plus, History, AlertTriangle } from "lucide-react";

interface TaxaConfig {
  id: string;
  tipo: string;
  codigo: string;
  nome: string;
  percentual: number;
  base_calculo: string;
  vigente_de: string;
  vigente_ate: string | null;
  ativo: boolean;
}

export default function TabImpostosTaxas() {
  const { clinicaId } = useAuth();
  const [taxas, setTaxas] = useState<TaxaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({
    tipo: "imposto",
    codigo: "",
    nome: "",
    percentual: "",
    base_calculo: "rt",
    vigente_de: "",
  });

  useEffect(() => {
    if (!clinicaId) return;
    fetchTaxas();
  }, [clinicaId]);

  const fetchTaxas = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("taxas_config")
      .select("*")
      .eq("clinica_id", clinicaId!)
      .order("codigo")
      .order("vigente_de", { ascending: false });
    setTaxas((data as any[]) || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.codigo || !form.nome || !form.percentual || !form.vigente_de) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    try {
      const { error } = await supabase.rpc("upsert_taxa_vigencia", {
        _clinica_id: clinicaId!,
        _tipo: form.tipo,
        _codigo: form.codigo,
        _nome: form.nome,
        _percentual: parseFloat(form.percentual),
        _base_calculo: form.base_calculo,
        _vigente_de: form.vigente_de,
      });
      if (error) throw error;
      toast.success("Alíquota salva! A anterior foi encerrada automaticamente.");
      setShowDialog(false);
      setForm({ tipo: "imposto", codigo: "", nome: "", percentual: "", base_calculo: "rt", vigente_de: "" });
      fetchTaxas();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, TaxaConfig[]>();
    for (const t of taxas) {
      const arr = map.get(t.codigo) || [];
      arr.push(t);
      map.set(t.codigo, arr);
    }
    return Array.from(map.entries());
  }, [taxas]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Impostos e Taxas</h3>
          <p className="text-sm text-muted-foreground">Gerencie alíquotas com histórico de vigência</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nova Alíquota</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Nova Alíquota</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imposto">Imposto</SelectItem>
                      <SelectItem value="taxa">Taxa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Código *</Label>
                  <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex: lp_total" list="codigos-list" />
                  <datalist id="codigos-list">
                    {[...new Set(taxas.map((t) => t.codigo))].map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Lucro Presumido (total)" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Percentual (%) *</Label>
                  <Input type="number" step="0.01" value={form.percentual} onChange={(e) => setForm({ ...form, percentual: e.target.value })} placeholder="7.93" />
                </div>
                <div className="space-y-1">
                  <Label>Base de Cálculo</Label>
                  <Select value={form.base_calculo} onValueChange={(v) => setForm({ ...form, base_calculo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rt">Receita Total (RT)</SelectItem>
                      <SelectItem value="receita_cartao">Receita Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Vigente a partir de *</Label>
                <Input type="date" value={form.vigente_de} onChange={(e) => setForm({ ...form, vigente_de: e.target.value })} />
              </div>
              <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>Ao salvar, a alíquota anterior do mesmo código será encerrada automaticamente (vigente_ate = dia anterior).</p>
                </div>
              </div>
              <Button onClick={handleSave}>Salvar Alíquota</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Nenhuma alíquota cadastrada. Clique em "Nova Alíquota" para começar.
          </CardContent>
        </Card>
      ) : (
        grouped.map(([codigo, items]) => {
          const current = items.find((t) => !t.vigente_ate);
          return (
            <Card key={codigo}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{items[0].nome}</CardTitle>
                    <Badge variant="outline" className="text-xs font-mono">{codigo}</Badge>
                  </div>
                  {current && (
                    <Badge variant="default" className="text-xs">
                      Vigente: {current.percentual}%
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {items[0].tipo === "imposto" ? "Imposto" : "Taxa"} • Base: {items[0].base_calculo === "rt" ? "Receita Total" : "Receita Cartão"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Percentual</TableHead>
                      <TableHead>Vigente De</TableHead>
                      <TableHead>Vigente Até</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((t) => (
                      <TableRow key={t.id} className={t.vigente_ate ? "opacity-60" : ""}>
                        <TableCell className="font-mono font-semibold">{t.percentual}%</TableCell>
                        <TableCell>{new Date(t.vigente_de + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{t.vigente_ate ? new Date(t.vigente_ate + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={t.vigente_ate ? "secondary" : "default"} className="text-xs">
                            {t.vigente_ate ? "Encerrada" : "Vigente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

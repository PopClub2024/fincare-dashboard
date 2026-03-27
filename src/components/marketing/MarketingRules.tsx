import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Zap, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function MarketingRules() {
  const { clinicaId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", condicao_campo: "cpc", condicao_operador: ">", condicao_valor: "", acao: "pausar" });

  const { data: regras = [] } = useQuery({
    queryKey: ["mkt-rules", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("marketing_automation_rules").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criar = async () => {
    if (!form.nome || !form.condicao_valor || !clinicaId) return;
    const { error } = await supabase.from("marketing_automation_rules").insert({
      clinica_id: clinicaId,
      nome: form.nome,
      condicao_campo: form.condicao_campo,
      condicao_operador: form.condicao_operador,
      condicao_valor: Number(form.condicao_valor),
      acao: form.acao,
    });
    if (error) toast.error("Erro ao criar regra");
    else { toast.success("Regra criada!"); setOpen(false); setForm({ nome: "", condicao_campo: "cpc", condicao_operador: ">", condicao_valor: "", acao: "pausar" }); qc.invalidateQueries({ queryKey: ["mkt-rules"] }); }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await supabase.from("marketing_automation_rules").update({ ativo: !ativo }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["mkt-rules"] });
  };

  const deletar = async (id: string) => {
    await supabase.from("marketing_automation_rules").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["mkt-rules"] });
    toast.success("Removida");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nova Regra</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Regra de Automação</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome da regra" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <Select value={form.condicao_campo} onValueChange={(v) => setForm({ ...form, condicao_campo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpc">CPC</SelectItem>
                    <SelectItem value="ctr">CTR (%)</SelectItem>
                    <SelectItem value="cpl">CPL</SelectItem>
                    <SelectItem value="roi">ROI (%)</SelectItem>
                    <SelectItem value="gasto">Gasto</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.condicao_operador} onValueChange={(v) => setForm({ ...form, condicao_operador: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=">">Maior que</SelectItem>
                    <SelectItem value="<">Menor que</SelectItem>
                    <SelectItem value=">=">≥</SelectItem>
                    <SelectItem value="<=">≤</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Valor" value={form.condicao_valor} onChange={(e) => setForm({ ...form, condicao_valor: e.target.value })} />
              </div>
              <Select value={form.acao} onValueChange={(v) => setForm({ ...form, acao: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pausar">Pausar campanha</SelectItem>
                  <SelectItem value="escalar">Escalar orçamento</SelectItem>
                  <SelectItem value="alertar">Enviar alerta</SelectItem>
                  <SelectItem value="reduzir">Reduzir orçamento</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={criar}>Criar Regra</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {regras.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma regra configurada</CardContent></Card>
      ) : regras.map((r: any) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className={`h-5 w-5 ${r.ativo ? "text-yellow-500" : "text-muted-foreground"}`} />
              <div>
                <p className="font-medium text-sm">{r.nome}</p>
                <p className="text-xs text-muted-foreground">
                  Se {r.condicao_campo.toUpperCase()} {r.condicao_operador} {r.condicao_valor} → <Badge variant="outline">{r.acao}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">Execuções: {r.execucoes_total}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r.id, r.ativo)} />
              <Button size="sm" variant="ghost" onClick={() => deletar(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

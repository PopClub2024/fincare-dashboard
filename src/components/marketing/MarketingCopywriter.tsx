import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Copy, Star, StarOff } from "lucide-react";
import { toast } from "sonner";

const FORMULAS = [
  { id: "aida", nome: "AIDA", desc: "Atenção → Interesse → Desejo → Ação" },
  { id: "pas", nome: "PAS", desc: "Problema → Agitação → Solução" },
  { id: "bab", nome: "BAB", desc: "Before → After → Bridge" },
  { id: "fab", nome: "FAB", desc: "Feature → Advantage → Benefit" },
];

export default function MarketingCopywriter() {
  const { clinicaId } = useAuth();
  const qc = useQueryClient();
  const [tema, setTema] = useState("");
  const [plataforma, setPlataforma] = useState("instagram");
  const [formula, setFormula] = useState("aida");
  const [resultado, setResultado] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: swipeFiles = [] } = useQuery({
    queryKey: ["mkt-swipe", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("marketing_swipe_files").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const gerarCopy = async () => {
    if (!tema.trim()) { toast.error("Informe o tema"); return; }
    setLoading(true);
    try {
      const formulaInfo = FORMULAS.find((f) => f.id === formula);
      const resp = await supabase.functions.invoke("marketing-ai-chat", {
        body: {
          messages: [{
            role: "user",
            content: `Gere 3 variações de copy para ${plataforma} usando a fórmula ${formulaInfo?.nome} (${formulaInfo?.desc}).\n\nTema/Produto: ${tema}\nContexto: Clínica médica\n\nPara cada variação, inclua:\n- Headline\n- Body copy\n- CTA\n\nSeja criativo, persuasivo e adapte ao formato da plataforma.`,
          }],
        },
      });
      if (resp.error) throw resp.error;
      const text = typeof resp.data === "string" ? resp.data : resp.data?.choices?.[0]?.message?.content || "";
      setResultado(text);
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "erro"));
    } finally {
      setLoading(false);
    }
  };

  const salvarSwipe = async () => {
    if (!resultado || !clinicaId) return;
    const { error } = await supabase.from("marketing_swipe_files").insert({
      clinica_id: clinicaId,
      titulo: tema,
      conteudo: resultado,
      plataforma,
      tipo: formula,
    });
    if (error) toast.error("Erro ao salvar");
    else { toast.success("Salvo no Swipe File!"); qc.invalidateQueries({ queryKey: ["mkt-swipe"] }); }
  };

  const toggleFav = async (id: string, atual: boolean) => {
    await supabase.from("marketing_swipe_files").update({ favorito: !atual }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["mkt-swipe"] });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Gerador de Copy com IA</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Tema ou produto (ex: Check-up preventivo)" value={tema} onChange={(e) => setTema(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={plataforma} onValueChange={setPlataforma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="google">Google Ads</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              <Select value={formula} onValueChange={setFormula}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMULAS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome} — {f.desc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={gerarCopy} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar Copy
            </Button>
          </CardContent>
        </Card>

        {resultado && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Resultado</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(resultado); toast.success("Copiado!"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={salvarSwipe}>Salvar</Button>
              </div>
            </CardHeader>
            <CardContent><pre className="text-sm whitespace-pre-wrap">{resultado}</pre></CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Swipe File ({swipeFiles.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
          {swipeFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma copy salva ainda. Gere e salve copies para montar sua biblioteca.</p>
          ) : swipeFiles.map((s: any) => (
            <div key={s.id} className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{s.titulo}</span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">{s.plataforma}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => toggleFav(s.id, s.favorito)}>
                    {s.favorito ? <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> : <StarOff className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-3">{s.conteudo}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

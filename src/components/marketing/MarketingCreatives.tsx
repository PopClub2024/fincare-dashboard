import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function MarketingCreatives() {
  const { clinicaId } = useAuth();
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [formato, setFormato] = useState("square");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: criativos = [] } = useQuery({
    queryKey: ["mkt-criativos", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("marketing_creatives").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const gerarImagem = async () => {
    if (!prompt.trim()) { toast.error("Descreva o criativo"); return; }
    setLoading(true);
    try {
      const resp = await supabase.functions.invoke("marketing-generate-creative", {
        body: { prompt, formato, clinicaId },
      });
      if (resp.error) throw resp.error;
      const imageUrl = resp.data?.imageUrl;
      if (imageUrl) {
        setPreviewUrl(imageUrl);
        toast.success("Criativo gerado!");
        qc.invalidateQueries({ queryKey: ["mkt-criativos"] });
      } else {
        toast.error("Não foi possível gerar a imagem");
      }
    } catch (e: any) {
      toast.error("Erro: " + (e.message || "erro"));
    } finally {
      setLoading(false);
    }
  };

  const deletar = async (id: string) => {
    await supabase.from("marketing_creatives").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["mkt-criativos"] });
    toast.success("Removido");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Estúdio Criativo com IA</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea placeholder="Descreva o criativo (ex: Banner moderno para clínica dermatológica, cores azul e branco, com texto 'Agende seu check-up')" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
          <div className="flex gap-2">
            <Select value={formato} onValueChange={setFormato}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="square">Quadrado (1:1)</SelectItem>
                <SelectItem value="story">Story (9:16)</SelectItem>
                <SelectItem value="landscape">Paisagem (16:9)</SelectItem>
                <SelectItem value="feed">Feed (4:5)</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={gerarImagem} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Gerar Criativo
            </Button>
          </div>
        </CardContent>
      </Card>

      {previewUrl && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
          <CardContent className="flex justify-center">
            <img src={previewUrl} alt="Criativo gerado" className="max-h-80 rounded-lg" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Galeria ({criativos.length})</CardTitle></CardHeader>
        <CardContent>
          {criativos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum criativo gerado ainda.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {criativos.map((c: any) => (
                <div key={c.id} className="border rounded-lg overflow-hidden group relative">
                  {c.image_url ? (
                    <img src={c.image_url} alt={c.titulo} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-muted flex items-center justify-center text-xs text-muted-foreground">Sem imagem</div>
                  )}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{c.titulo}</p>
                    <p className="text-xs text-muted-foreground">{c.formato}</p>
                  </div>
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="destructive" onClick={() => deletar(c.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ACCEPT_IMAGENS } from "@/lib/file-upload";
import { PIPELINE_ETAPAS } from "@/types/whatsapp";
import { useWhatsAppRealtime } from "@/hooks/useWhatsAppRealtime";
import {
  MessageSquare, Send, Search, Image, FileSpreadsheet, Bot, UserRound,
  Inbox, Mic, Volume2, X,
} from "lucide-react";

export default function WhatsAppChat() {
  const { clinicaId, user } = useAuth();
  const queryClient = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const [selectedConversa, setSelectedConversa] = useState<any>(null);
  const [msgTexto, setMsgTexto] = useState("");
  const [filtroAtendimento, setFiltroAtendimento] = useState("todos");
  const [filtroPipeline, setFiltroPipeline] = useState("todos");
  const [searchConversas, setSearchConversas] = useState("");
  const [showRespostas, setShowRespostas] = useState(false);

  // Realtime subscription
  useWhatsAppRealtime(clinicaId);

  // Conversas
  const { data: conversas = [] } = useQuery({
    queryKey: ["whatsapp-conversas", clinicaId, filtroAtendimento, filtroPipeline],
    queryFn: async () => {
      if (!clinicaId) return [];
      let q = supabase.from("whatsapp_conversas").select("*").eq("clinica_id", clinicaId).order("ultima_mensagem_em", { ascending: false }) as any;
      if (filtroAtendimento !== "todos") q = q.eq("atendimento", filtroAtendimento);
      if (filtroPipeline !== "todos") q = q.eq("pipeline_etapa", filtroPipeline);
      const { data } = await q;
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Mensagens
  const { data: chatMsgs = [] } = useQuery({
    queryKey: ["chat-msgs", selectedConversa?.id],
    queryFn: async () => {
      if (!selectedConversa?.id) return [];
      const { data } = await supabase.from("whatsapp_chat_mensagens").select("*").eq("conversa_id", selectedConversa.id).order("created_at", { ascending: true }).limit(200) as any;
      return data || [];
    },
    enabled: !!selectedConversa?.id,
    refetchInterval: 3000,
  });

  // Tags
  const { data: tags = [] } = useQuery({
    queryKey: ["whatsapp-tags", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("whatsapp_tags").select("*").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Respostas prontas
  const { data: respostasProntas = [] } = useQuery({
    queryKey: ["respostas-prontas", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await (supabase.from("whatsapp_respostas_prontas").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false }) as any);
      return data || [];
    },
    enabled: !!clinicaId,
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const enviarMsg = useMutation({
    mutationFn: async (opts?: { texto?: string; imagemUrl?: string }) => {
      if (!selectedConversa || !clinicaId) return;
      const texto = opts?.texto || msgTexto;
      if (!texto && !opts?.imagemUrl) return;
      await supabase.from("whatsapp_chat_mensagens").insert({
        clinica_id: clinicaId, conversa_id: selectedConversa.id, direcao: "enviada",
        remetente: user?.id || "sistema", tipo_conteudo: opts?.imagemUrl ? "imagem" : "texto",
        texto: texto || null, midia_url: opts?.imagemUrl || null, status: "enviada",
      } as any);
      await supabase.from("whatsapp_conversas").update({
        ultima_mensagem: texto || "[imagem]", ultima_mensagem_em: new Date().toISOString(),
      } as any).eq("id", selectedConversa.id);
    },
    onSuccess: () => {
      setMsgTexto("");
      queryClient.invalidateQueries({ queryKey: ["chat-msgs"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
  });

  const mudarPipeline = async (conversaId: string, etapa: string) => {
    await supabase.from("whatsapp_conversas").update({ pipeline_etapa: etapa } as any).eq("id", conversaId);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    toast.success(`Pipeline: ${etapa.replace("_", " ")}`);
  };

  const assumirAtendimento = async (conversaId: string) => {
    await supabase.from("whatsapp_conversas").update({ atendimento: "humano", atendente_id: user?.id } as any).eq("id", conversaId);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    toast.success("Atendimento assumido!");
  };

  const transferirHumano = async (conversaId: string) => {
    await supabase.from("whatsapp_conversas").update({ atendimento: "fila_espera" } as any).eq("id", conversaId);
    await supabase.from("whatsapp_fila_humano").insert({
      clinica_id: clinicaId, conversa_id: conversaId, motivo: "ia_nao_soube", status: "aguardando",
    } as any);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    toast.info("Conversa na fila de atendimento humano");
  };

  const toggleTag = async (conversaId: string, tagNome: string, currentTags: string[]) => {
    const newTags = currentTags.includes(tagNome) ? currentTags.filter(t => t !== tagNome) : [...currentTags, tagNome];
    await supabase.from("whatsapp_conversas").update({ tags: newTags } as any).eq("id", conversaId);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
  };

  const handleImagemChat = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clinicaId) return;
    const path = `chat/${clinicaId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("whatsapp-media").upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    enviarMsg.mutate({ imagemUrl: data.publicUrl, texto: "" });
    e.target.value = "";
  };

  const conversasFiltradas = conversas.filter((c: any) =>
    c.nome_contato?.toLowerCase().includes(searchConversas.toLowerCase()) ||
    c.telefone?.includes(searchConversas)
  );

  return (
    <div className="grid grid-cols-12 gap-0 border rounded-lg overflow-hidden h-[calc(100vh-280px)]">
      {/* Lista de conversas */}
      <div className="col-span-4 border-r flex flex-col bg-card">
        <div className="p-2 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
            <Input value={searchConversas} onChange={(e) => setSearchConversas(e.target.value)} placeholder="Buscar..." className="h-8 pl-7 text-xs" />
          </div>
          <div className="flex gap-1">
            <Select value={filtroAtendimento} onValueChange={setFiltroAtendimento}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ia">IA</SelectItem>
                <SelectItem value="humano">Humano</SelectItem>
                <SelectItem value="fila_espera">Fila</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroPipeline} onValueChange={setFiltroPipeline}>
              <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Pipeline</SelectItem>
                {PIPELINE_ETAPAS.map(e => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {conversasFiltradas.map((c: any) => (
            <div
              key={c.id}
              onClick={() => setSelectedConversa(c)}
              className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${selectedConversa?.id === c.id ? "bg-muted" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">{c.nome_contato || c.telefone}</span>
                <span className="text-[10px] text-muted-foreground">{c.ultima_mensagem_em ? format(new Date(c.ultima_mensagem_em), "HH:mm") : ""}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.ultima_mensagem || "..."}</p>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[9px] h-4" style={{ borderColor: PIPELINE_ETAPAS.find(e => e.key === c.pipeline_etapa)?.cor }}>
                  {PIPELINE_ETAPAS.find(e => e.key === c.pipeline_etapa)?.label || c.pipeline_etapa}
                </Badge>
                {c.atendimento === "humano" && <Badge className="text-[9px] h-4 bg-blue-500">Humano</Badge>}
                {c.atendimento === "fila_espera" && <Badge variant="destructive" className="text-[9px] h-4">Fila</Badge>}
                {c.nao_lidas > 0 && <Badge className="text-[9px] h-4 bg-green-500">{c.nao_lidas}</Badge>}
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat */}
      <div className="col-span-8 flex flex-col">
        {!selectedConversa ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center"><MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>Selecione uma conversa</p></div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-3 border-b flex items-center justify-between bg-card">
              <div>
                <p className="font-medium text-sm">{selectedConversa.nome_contato || selectedConversa.telefone}</p>
                <p className="text-[10px] text-muted-foreground">{selectedConversa.telefone} | {selectedConversa.atendimento === "ia" ? "IA" : selectedConversa.atendimento === "humano" ? "Humano" : "Fila"}</p>
              </div>
              <div className="flex items-center gap-1">
                <Select value={selectedConversa.pipeline_etapa} onValueChange={(v) => mudarPipeline(selectedConversa.id, v)}>
                  <SelectTrigger className="h-7 w-[140px] text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{PIPELINE_ETAPAS.map(e => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}</SelectContent>
                </Select>
                {selectedConversa.atendimento !== "humano" && (
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => assumirAtendimento(selectedConversa.id)}>
                    <UserRound className="h-3 w-3 mr-1" /> Assumir
                  </Button>
                )}
                {selectedConversa.atendimento === "ia" && (
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => transferirHumano(selectedConversa.id)}>
                    <Inbox className="h-3 w-3 mr-1" /> Fila
                  </Button>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="px-3 py-1 border-b flex gap-1 flex-wrap bg-muted/30">
              {tags.slice(0, 10).map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => toggleTag(selectedConversa.id, t.nome, selectedConversa.tags || [])}
                  className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${(selectedConversa.tags || []).includes(t.nome) ? "text-white" : "text-muted-foreground hover:bg-muted"}`}
                  style={(selectedConversa.tags || []).includes(t.nome) ? { backgroundColor: t.cor, borderColor: t.cor } : { borderColor: t.cor }}
                >
                  {t.nome}
                </button>
              ))}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {chatMsgs.map((m: any) => (
                  <div key={m.id} className={`flex ${m.direcao === "enviada" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg p-2 ${m.direcao === "enviada" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.tipo_conteudo === "imagem" && m.midia_url && <img src={m.midia_url} alt="" className="rounded max-h-48 mb-1" />}
                      {m.tipo_conteudo === "audio" && (
                        <div className="flex items-center gap-2 mb-1">
                          <Volume2 className="h-4 w-4" />
                          <span className="text-[10px]">{m.audio_duracao_segundos ? `${m.audio_duracao_segundos}s` : "audio"}</span>
                        </div>
                      )}
                      {m.texto && <p className="text-sm whitespace-pre-wrap">{m.texto}</p>}
                      {m.audio_transcricao && (
                        <p className="text-[10px] italic mt-1 opacity-80 border-t border-white/20 pt-1">
                          <Mic className="h-3 w-3 inline mr-1" /> {m.audio_transcricao}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] opacity-60">{format(new Date(m.created_at), "HH:mm")}</span>
                        {m.remetente === "ia" && <Bot className="h-3 w-3 opacity-60" />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-2 border-t bg-card">
              {showRespostas && (
                <div className="mb-2 max-h-32 overflow-auto border rounded p-2 bg-muted/30">
                  <p className="text-[10px] font-semibold mb-1">Respostas prontas:</p>
                  {respostasProntas.map((r: any) => (
                    <button key={r.id} onClick={() => { setMsgTexto(r.texto); setShowRespostas(false); }}
                      className="block w-full text-left text-xs p-1 hover:bg-muted rounded truncate">
                      <span className="font-mono text-[10px] text-muted-foreground mr-1">{r.atalho}</span> {r.titulo}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowRespostas(!showRespostas)}>
                  <FileSpreadsheet className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => imageRef.current?.click()}>
                  <Image className="h-4 w-4" />
                </Button>
                <input ref={imageRef} type="file" accept={ACCEPT_IMAGENS} className="hidden" onChange={handleImagemChat} />
                <Textarea
                  value={msgTexto}
                  onChange={(e) => setMsgTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMsg.mutate({}); } }}
                  placeholder="Digite ou use /atalho..."
                  className="min-h-[36px] max-h-[80px] text-sm resize-none"
                  rows={1}
                />
                <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => enviarMsg.mutate({})} disabled={!msgTexto.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ACCEPT_IMAGENS } from "@/lib/file-upload";
import {
  MessageSquare, Send, Clock, CheckCheck, AlertCircle, Settings,
  Wifi, WifiOff, ExternalLink, RefreshCw, Sparkles, Users,
  Upload, Image, FileSpreadsheet, Search, Filter, Megaphone,
  Plus, Trash2, Eye, X, Tag, Phone, Bot, UserRound, Mic,
  ArrowRight, Inbox, Archive, Volume2,
} from "lucide-react";

const PIPELINE_ETAPAS = [
  { key: "novo_contato", label: "Novo Contato", cor: "#3b82f6" },
  { key: "primeiro_contato", label: "1o Contato", cor: "#8b5cf6" },
  { key: "interessado", label: "Interessado", cor: "#f59e0b" },
  { key: "agendamento_pendente", label: "Agend. Pendente", cor: "#f97316" },
  { key: "agendado", label: "Agendou", cor: "#10b981" },
  { key: "confirmado", label: "Confirmou", cor: "#22c55e" },
  { key: "atendido", label: "Atendido", cor: "#14b8a6" },
  { key: "pos_atendimento", label: "Pos-Atend.", cor: "#06b6d4" },
  { key: "retorno_pendente", label: "Retorno Pend.", cor: "#a855f7" },
  { key: "cancelou", label: "Cancelou", cor: "#ef4444" },
  { key: "faltou", label: "Faltou", cor: "#f97316" },
  { key: "so_conhecendo", label: "So Conhecendo", cor: "#6b7280" },
  { key: "perdido", label: "Perdido", cor: "#9ca3af" },
];

export default function WhatsApp() {
  const { clinicaId, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState("conversas");
  const [selectedConversa, setSelectedConversa] = useState<any>(null);
  const [msgTexto, setMsgTexto] = useState("");
  const [filtroAtendimento, setFiltroAtendimento] = useState("todos");
  const [filtroPipeline, setFiltroPipeline] = useState("todos");
  const [searchConversas, setSearchConversas] = useState("");
  const [showRespostas, setShowRespostas] = useState(false);

  // Campanhas
  const [campanha, setCampanha] = useState({ nome: "", mensagem: "", imagemFile: null as File | null });
  const [contatosCampanha, setContatosCampanha] = useState<any[]>([]);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [filtroPacientes, setFiltroPacientes] = useState("todos");
  const [campanhaSearch, setCampanhaSearch] = useState("");
  const [enviandoCampanha, setEnviandoCampanha] = useState(false);
  const [progressoCampanha, setProgressoCampanha] = useState(0);

  // API status
  const { data: apiStatus } = useQuery({
    queryKey: ["whatsapp-api-status", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return null;
      const { data } = await supabase.from("api_keys").select("*").eq("clinica_id", clinicaId).eq("servico", "whatsapp_oficial").maybeSingle();
      return data;
    },
    enabled: !!clinicaId,
  });
  const isApiConnected = (apiStatus as any)?.status === "ativa";

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
    refetchInterval: 5000,
  });

  // Mensagens da conversa selecionada
  const { data: chatMsgs = [] } = useQuery({
    queryKey: ["chat-msgs", selectedConversa?.id],
    queryFn: async () => {
      if (!selectedConversa?.id) return [];
      const { data } = await supabase.from("whatsapp_chat_mensagens").select("*").eq("conversa_id", selectedConversa.id).order("created_at", { ascending: true }).limit(200);
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

  // Fila humana
  const { data: filaHumana = [] } = useQuery({
    queryKey: ["fila-humana", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await (supabase.from("whatsapp_fila_humano").select("*, whatsapp_conversas(nome_contato, telefone, tags)").eq("clinica_id", clinicaId).eq("status", "aguardando").order("prioridade").order("created_at") as any);
      return data || [];
    },
    enabled: !!clinicaId,
    refetchInterval: 5000,
  });

  // Pacientes para campanhas
  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-whatsapp", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("pacientes").select("id, nome, telefone, convenio_id, sexo").eq("clinica_id", clinicaId).not("telefone", "is", null).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Templates
  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("whatsapp_templates").select("*").eq("clinica_id", clinicaId).order("tipo");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  // Enviar mensagem no chat
  const enviarMsg = useMutation({
    mutationFn: async (opts?: { texto?: string; imagemUrl?: string; tipo?: string }) => {
      if (!selectedConversa || !clinicaId) return;
      const texto = opts?.texto || msgTexto;
      if (!texto && !opts?.imagemUrl) return;

      await supabase.from("whatsapp_chat_mensagens").insert({
        clinica_id: clinicaId,
        conversa_id: selectedConversa.id,
        direcao: "enviada",
        remetente: user?.id || "sistema",
        tipo_conteudo: opts?.imagemUrl ? "imagem" : "texto",
        texto: texto || null,
        midia_url: opts?.imagemUrl || null,
        status: "enviada",
      } as any);

      await supabase.from("whatsapp_conversas").update({
        ultima_mensagem: texto || "[imagem]",
        ultima_mensagem_em: new Date().toISOString(),
      } as any).eq("id", selectedConversa.id);
    },
    onSuccess: () => {
      setMsgTexto("");
      queryClient.invalidateQueries({ queryKey: ["chat-msgs"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    },
  });

  // Mudar pipeline
  const mudarPipeline = async (conversaId: string, etapa: string) => {
    await supabase.from("whatsapp_conversas").update({ pipeline_etapa: etapa } as any).eq("id", conversaId);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    toast.success(`Pipeline: ${etapa.replace("_", " ")}`);
  };

  // Transferir para humano
  const transferirHumano = async (conversaId: string) => {
    await supabase.from("whatsapp_conversas").update({ atendimento: "fila_espera" } as any).eq("id", conversaId);
    await supabase.from("whatsapp_fila_humano").insert({
      clinica_id: clinicaId, conversa_id: conversaId, motivo: "ia_nao_soube", status: "aguardando",
    } as any);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    queryClient.invalidateQueries({ queryKey: ["fila-humana"] });
    toast.info("Conversa na fila de atendimento humano");
  };

  // Assumir atendimento
  const assumirAtendimento = async (conversaId: string) => {
    await supabase.from("whatsapp_conversas").update({ atendimento: "humano", atendente_id: user?.id } as any).eq("id", conversaId);
    await supabase.from("whatsapp_fila_humano").update({ status: "em_atendimento", atendente_id: user?.id, atendido_em: new Date().toISOString() } as any).eq("conversa_id", conversaId).eq("status", "aguardando");
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
    queryClient.invalidateQueries({ queryKey: ["fila-humana"] });
    toast.success("Atendimento assumido!");
  };

  // Toggle tag
  const toggleTag = async (conversaId: string, tagNome: string, currentTags: string[]) => {
    const newTags = currentTags.includes(tagNome) ? currentTags.filter(t => t !== tagNome) : [...currentTags, tagNome];
    await supabase.from("whatsapp_conversas").update({ tags: newTags } as any).eq("id", conversaId);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-conversas"] });
  };

  // Upload imagem no chat
  const handleImagemChat = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !clinicaId) return;
    const path = `chat/${clinicaId}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("whatsapp-media").upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    enviarMsg.mutate({ imagemUrl: data.publicUrl, texto: "", tipo: "imagem" });
    e.target.value = "";
  };

  // Campanhas
  const carregarPacientes = () => {
    let filtrados = pacientes;
    if (filtroPacientes === "convenio") filtrados = pacientes.filter((p: any) => p.convenio_id);
    if (filtroPacientes === "particular") filtrados = pacientes.filter((p: any) => !p.convenio_id);
    const tels = new Set(contatosCampanha.map((c: any) => c.telefone));
    const novos = filtrados.filter((p: any) => !tels.has(p.telefone)).map((p: any) => ({ nome: p.nome, telefone: p.telefone, origem: "paciente", selecionado: true }));
    setContatosCampanha([...contatosCampanha, ...novos]);
    toast.success(`${novos.length} contatos adicionados`);
  };

  const importarPlanilha = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split("\n").filter(l => l.trim());
      const sep = lines[0]?.includes(";") ? ";" : ",";
      const novos: any[] = [];
      const tels = new Set(contatosCampanha.map((c: any) => c.telefone));
      for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ""));
        if (i === 0 && cols.join(" ").toLowerCase().match(/nome|telefone|phone/)) continue;
        let telefone = "", nome = "";
        for (const col of cols) {
          const d = col.replace(/\D/g, "");
          if (d.length >= 10 && !telefone) telefone = d;
          else if (col.length > 2 && !nome && !/^\d+$/.test(col)) nome = col;
        }
        if (telefone && !tels.has(telefone)) { novos.push({ nome: nome || `Contato ${i}`, telefone, origem: "importado", selecionado: true }); tels.add(telefone); }
      }
      setContatosCampanha([...contatosCampanha, ...novos]);
      toast.success(`${novos.length} importados`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const enviarCampanha = async () => {
    const selecionados = contatosCampanha.filter(c => c.selecionado);
    if (!selecionados.length || !campanha.mensagem) return;
    if (!confirm(`Enviar para ${selecionados.length} contatos?`)) return;
    setEnviandoCampanha(true);
    setProgressoCampanha(0);
    for (let i = 0; i < selecionados.length; i += 50) {
      const batch = selecionados.slice(i, i + 50);
      await supabase.from("whatsapp_mensagens").insert(batch.map(c => ({ clinica_id: clinicaId, tipo: "agendamento", telefone: c.telefone, mensagem: campanha.mensagem.replace("{{nome}}", c.nome), status: "pendente" })) as any);
      setProgressoCampanha(Math.min(((i + 50) / selecionados.length) * 100, 100));
    }
    setEnviandoCampanha(false);
    toast.success(`${selecionados.length} mensagens na fila!`);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens"] });
  };

  const conversasFiltradas = conversas.filter((c: any) =>
    c.nome_contato?.toLowerCase().includes(searchConversas.toLowerCase()) ||
    c.telefone?.includes(searchConversas)
  );

  const minhasConversas = conversas.filter((c: any) => c.atendente_id === user?.id && c.atendimento === "humano");

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">WhatsApp Inteligente</h1>
            <p className="text-sm text-muted-foreground">Conversas, pipeline, atendimento humano e campanhas</p>
          </div>
          <div className="flex items-center gap-2">
            {filaHumana.length > 0 && (
              <Badge variant="destructive" className="gap-1 animate-pulse">
                <Inbox className="h-3 w-3" /> {filaHumana.length} na fila
              </Badge>
            )}
            <Badge variant={isApiConnected ? "default" : "destructive"} className="gap-1">
              {isApiConnected ? <><Wifi className="h-3 w-3" /> API Ativa</> : <><WifiOff className="h-3 w-3" /> Offline</>}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes-sistema")}><Settings className="h-4 w-4" /></Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="conversas" className="gap-1"><MessageSquare className="h-3 w-3" /> Conversas</TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1"><ArrowRight className="h-3 w-3" /> Pipeline</TabsTrigger>
            <TabsTrigger value="fila" className="gap-1 relative">
              <Inbox className="h-3 w-3" /> Fila Humana
              {filaHumana.length > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center">{filaHumana.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="minhas" className="gap-1"><UserRound className="h-3 w-3" /> Minhas ({minhasConversas.length})</TabsTrigger>
            <TabsTrigger value="campanhas" className="gap-1"><Megaphone className="h-3 w-3" /> Campanhas</TabsTrigger>
            <TabsTrigger value="respostas" className="gap-1"><FileSpreadsheet className="h-3 w-3" /> Respostas</TabsTrigger>
          </TabsList>

          {/* ========== CONVERSAS ========== */}
          <TabsContent value="conversas" className="mt-2">
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
                        {c.tags?.slice(0, 2).map((t: string) => {
                          const tag = tags.find((tg: any) => tg.nome === t);
                          return <Badge key={t} variant="outline" className="text-[8px] h-4" style={{ borderColor: tag?.cor || "#666" }}>{t}</Badge>;
                        })}
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
                    {/* Header do chat */}
                    <div className="p-3 border-b flex items-center justify-between bg-card">
                      <div>
                        <p className="font-medium text-sm">{selectedConversa.nome_contato || selectedConversa.telefone}</p>
                        <p className="text-[10px] text-muted-foreground">{selectedConversa.telefone} | {selectedConversa.atendimento === "ia" ? "Atendido por IA" : selectedConversa.atendimento === "humano" ? "Atendimento humano" : "Na fila"}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Pipeline */}
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

                    {/* Tags bar */}
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
                              {m.tipo_conteudo === "imagem" && m.midia_url && (
                                <img src={m.midia_url} alt="" className="rounded max-h-48 mb-1" />
                              )}
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
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setShowRespostas(!showRespostas)} title="Respostas prontas">
                          <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => imageRef.current?.click()} title="Enviar imagem">
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
          </TabsContent>

          {/* ========== PIPELINE ========== */}
          <TabsContent value="pipeline" className="mt-2">
            <div className="overflow-x-auto">
              <div className="flex gap-3 min-w-[1200px]">
                {PIPELINE_ETAPAS.map(etapa => {
                  const etapaConversas = conversas.filter((c: any) => c.pipeline_etapa === etapa.key);
                  return (
                    <div key={etapa.key} className="w-[200px] shrink-0">
                      <div className="rounded-t-lg p-2 text-white text-xs font-semibold text-center" style={{ backgroundColor: etapa.cor }}>
                        {etapa.label} ({etapaConversas.length})
                      </div>
                      <div className="border border-t-0 rounded-b-lg min-h-[300px] max-h-[60vh] overflow-auto bg-card">
                        {etapaConversas.map((c: any) => (
                          <div key={c.id} className="p-2 border-b cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedConversa(c); setActiveTab("conversas"); }}>
                            <p className="text-xs font-medium truncate">{c.nome_contato || c.telefone}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{c.ultima_mensagem}</p>
                            <div className="flex gap-1 mt-1">
                              {c.tags?.slice(0, 2).map((t: string) => <Badge key={t} variant="outline" className="text-[8px] h-3">{t}</Badge>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* ========== FILA HUMANA ========== */}
          <TabsContent value="fila" className="mt-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Fila de Atendimento Humano</CardTitle>
                <CardDescription>Conversas onde a IA nao conseguiu resolver ou o paciente solicitou atendente</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Contato</TableHead><TableHead>Telefone</TableHead><TableHead>Motivo</TableHead><TableHead>Na fila ha</TableHead><TableHead>Tags</TableHead><TableHead>Acao</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filaHumana.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma conversa na fila</TableCell></TableRow>
                    ) : filaHumana.map((f: any) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.whatsapp_conversas?.nome_contato || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{f.whatsapp_conversas?.telefone}</TableCell>
                        <TableCell className="text-xs">{f.motivo}</TableCell>
                        <TableCell className="text-xs">{format(new Date(f.entrou_fila_em), "HH:mm")}</TableCell>
                        <TableCell><div className="flex gap-1">{f.whatsapp_conversas?.tags?.map((t: string) => <Badge key={t} variant="outline" className="text-[8px]">{t}</Badge>)}</div></TableCell>
                        <TableCell><Button size="sm" onClick={() => { assumirAtendimento(f.conversa_id); setSelectedConversa(conversas.find((c: any) => c.id === f.conversa_id)); setActiveTab("conversas"); }}>
                          <UserRound className="h-3 w-3 mr-1" /> Assumir
                        </Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== MINHAS CONVERSAS ========== */}
          <TabsContent value="minhas" className="mt-2">
            <div className="space-y-2">
              {minhasConversas.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma conversa atribuida a voce</CardContent></Card>
              ) : minhasConversas.map((c: any) => (
                <Card key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedConversa(c); setActiveTab("conversas"); }}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{c.nome_contato || c.telefone}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[400px]">{c.ultima_mensagem}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{PIPELINE_ETAPAS.find(e => e.key === c.pipeline_etapa)?.label}</Badge>
                      {c.nao_lidas > 0 && <Badge className="bg-green-500">{c.nao_lidas}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ========== CAMPANHAS ========== */}
          <TabsContent value="campanhas" className="mt-2 space-y-4">
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Mensagem</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Input value={campanha.nome} onChange={(e) => setCampanha({ ...campanha, nome: e.target.value })} placeholder="Nome da campanha" />
                    <Textarea rows={4} value={campanha.mensagem} onChange={(e) => setCampanha({ ...campanha, mensagem: e.target.value })} placeholder="Ola {{nome}}..." />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => imageRef.current?.click()}><Image className="h-3 w-3 mr-1" /> Imagem</Button>
                      {imagemPreview && <img src={imagemPreview} className="h-10 rounded" />}
                    </div>
                    {templates.length > 0 && (
                      <Select onValueChange={(v) => { const t = templates.find((t: any) => t.id === v); if (t) setCampanha({ ...campanha, mensagem: (t as any).mensagem }); }}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Usar template" /></SelectTrigger>
                        <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </CardContent>
                </Card>
                <Button className="w-full" onClick={enviarCampanha} disabled={enviandoCampanha || !campanha.mensagem || !contatosCampanha.filter(c => c.selecionado).length}>
                  <Send className="h-4 w-4 mr-2" /> Enviar ({contatosCampanha.filter(c => c.selecionado).length})
                </Button>
                {enviandoCampanha && <Progress value={progressoCampanha} />}
              </div>
              <div className="col-span-2 space-y-3">
                <Card>
                  <CardContent className="p-3 flex gap-2 flex-wrap">
                    <Select value={filtroPacientes} onValueChange={setFiltroPacientes}>
                      <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem><SelectItem value="convenio">Convenio</SelectItem><SelectItem value="particular">Particular</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={carregarPacientes}><Users className="h-3 w-3 mr-1" /> Pacientes</Button>
                    <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-3 w-3 mr-1" /> CSV</Button>
                    <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" className="hidden" onChange={importarPlanilha} />
                    {contatosCampanha.length > 0 && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setContatosCampanha([])}><Trash2 className="h-3 w-3" /></Button>}
                  </CardContent>
                </Card>
                <Card><CardContent className="p-0 max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-8"></TableHead><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Origem</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {contatosCampanha.filter(c => c.nome?.toLowerCase().includes(campanhaSearch.toLowerCase()) || c.telefone?.includes(campanhaSearch)).slice(0, 200).map((c: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell><Checkbox checked={c.selecionado} onCheckedChange={(v) => { const n = [...contatosCampanha]; n[contatosCampanha.indexOf(c)].selecionado = !!v; setContatosCampanha(n); }} /></TableCell>
                          <TableCell className="text-sm">{c.nome}</TableCell>
                          <TableCell className="font-mono text-xs">{c.telefone}</TableCell>
                          <TableCell><Badge variant={c.origem === "paciente" ? "default" : "secondary"} className="text-[9px]">{c.origem}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              </div>
            </div>
          </TabsContent>

          {/* ========== RESPOSTAS PRONTAS ========== */}
          <TabsContent value="respostas" className="mt-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Banco de Respostas Prontas</CardTitle>
                <CardDescription>Mensagens pre-escritas para o atendente humano usar rapidamente</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Atalho</TableHead><TableHead>Titulo</TableHead><TableHead>Categoria</TableHead><TableHead>Texto</TableHead><TableHead>Usos</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {respostasProntas.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs text-primary">{r.atalho}</TableCell>
                        <TableCell className="font-medium text-sm">{r.titulo}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{r.categoria}</Badge></TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate">{r.texto}</TableCell>
                        <TableCell className="text-xs">{r.uso_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

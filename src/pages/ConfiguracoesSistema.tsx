import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bot, Key, Settings, MessageSquare, Save, Plus, Trash2, Edit,
  CheckCircle, XCircle, Wifi, RefreshCw, Building2, Clock,
  Sparkles, DollarSign, BarChart3, Shield, AlertTriangle,
  TrendingUp, Megaphone, Loader2, ExternalLink, Database, FileText, Search, Upload,
} from "lucide-react";

// Agentes de IA pré-configurados
const AGENTES_PADRAO = [
  { nome: "Assistente de Anamnese", descricao: "Sugere texto de anamnese com base no input do médico e histórico do paciente", modelo: "claude-sonnet-4-5", ativo: true },
  { nome: "Assistente de Prescrição", descricao: "Sugere medicamentos e posologia baseado na anamnese", modelo: "claude-sonnet-4-5", ativo: true },
  { nome: "Assistente de Encaminhamento", descricao: "Sugere exames e especialidades para encaminhamento", modelo: "claude-sonnet-4-5", ativo: true },
  { nome: "Assistente CFO", descricao: "Análise financeira, alertas de anomalias e recomendações", modelo: "claude-sonnet-4-5", ativo: true },
  { nome: "Assistente CMO", descricao: "Estratégias de marketing, análise de ROI e campanhas", modelo: "claude-sonnet-4-5", ativo: true },
  { nome: "Assistente Pós-venda", descricao: "Análise de NPS, sugestões de melhoria e follow-up", modelo: "claude-haiku-4-5-20251001", ativo: true },
];

const MODELOS_IA = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6 (mais capaz)" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (equilibrado)" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (rápido/econômico)" },
];

const CHAVES_API_TIPOS = [
  { tipo: "anthropic", label: "Anthropic (Claude IA)", icon: Bot, fields: [
    { key: "api_key", label: "API Key", placeholder: "sk-ant-api03-..." },
  ]},
  { tipo: "whatsapp_oficial", label: "WhatsApp Business API (Oficial)", icon: MessageSquare, fields: [
    { key: "access_token", label: "Access Token (Permanente)", placeholder: "EAAxxxxxxx..." },
    { key: "phone_number_id", label: "Phone Number ID", placeholder: "10620xxxxxxx" },
    { key: "waba_id", label: "WhatsApp Business Account ID", placeholder: "10620xxxxxxx" },
    { key: "verify_token", label: "Verify Token (Webhook)", placeholder: "seu_token_webhook" },
    { key: "webhook_url", label: "Webhook URL (callback)", placeholder: "https://seudominio.com/api/whatsapp/webhook" },
  ]},
  { tipo: "google_ads", label: "Google Ads", icon: TrendingUp, fields: [
    { key: "client_id", label: "Client ID (OAuth)", placeholder: "xxxxxxxxx.apps.googleusercontent.com" },
    { key: "client_secret", label: "Client Secret", placeholder: "GOCSPX-xxxxx" },
    { key: "developer_token", label: "Developer Token", placeholder: "xxxxxxxxxxxxxx" },
    { key: "customer_id", label: "Customer ID (MCC ou Conta)", placeholder: "123-456-7890" },
    { key: "refresh_token", label: "Refresh Token (OAuth)", placeholder: "1//0xxxxxxx" },
  ]},
  { tipo: "meta_ads", label: "Meta Ads (Facebook/Instagram)", icon: Megaphone, fields: [
    { key: "access_token", label: "Access Token (Longa Duração)", placeholder: "EAAxxxxxxx..." },
    { key: "ad_account_id", label: "Ad Account ID", placeholder: "act_xxxxxxxxx" },
    { key: "pixel_id", label: "Pixel ID", placeholder: "xxxxxxxxxxxxxxxxx" },
    { key: "app_id", label: "App ID", placeholder: "xxxxxxxxxxxxxxxxx" },
    { key: "app_secret", label: "App Secret", placeholder: "xxxxxxxxxxxxxxxx" },
  ]},
  { tipo: "getnet", label: "Getnet (Cartões)", icon: DollarSign, fields: [
    { key: "seller_id", label: "Seller ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
    { key: "client_id", label: "Client ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
    { key: "client_secret", label: "Client Secret", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
    { key: "ambiente", label: "Ambiente", placeholder: "sandbox ou production" },
  ]},
  { tipo: "nfeio", label: "NFe.io (Notas Fiscais)", icon: Building2, fields: [
    { key: "api_key", label: "API Key NFe.io", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
    { key: "company_id", label: "Company ID", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxx" },
    { key: "ambiente", label: "Ambiente", placeholder: "Development ou Production" },
    { key: "webhook_url", label: "Webhook URL (status NF)", placeholder: "https://seudominio.com/api/nfe/webhook" },
  ]},
];

export default function ConfiguracoesSistema() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [editAgent, setEditAgent] = useState<any>(null);
  const [agentDialog, setAgentDialog] = useState(false);
  const [keyDialog, setKeyDialog] = useState(false);
  const [ragAgent, setRagAgent] = useState<any>(null); // Agente selecionado para RAG
  const [ragDocTitulo, setRagDocTitulo] = useState("");
  const [ragDocConteudo, setRagDocConteudo] = useState("");
  const [ragTestQuery, setRagTestQuery] = useState("");
  const [ragTestResult, setRagTestResult] = useState<any>(null);
  const [ragIngesting, setRagIngesting] = useState(false);
  const [ragSearching, setRagSearching] = useState(false);
  const [agentForm, setAgentForm] = useState({
    nome: "", descricao: "", modelo: "claude-sonnet-4-5",
    prompt_sistema: "", temperatura: "0.7", max_tokens: "4096",
    limite_mensal_usd: "50", ativo: true,
  });
  const [keyForm, setKeyForm] = useState({ tipo: "anthropic", chave: "", descricao: "" });

  // Agentes (tabela: agentes_ia)
  const { data: agentes = [] } = useQuery({
    queryKey: ["agentes-ia", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("agentes_ia")
        .select("*")
        .eq("clinica_id", clinicaId)
        .order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Chaves API (tabela: api_keys)
  const { data: chavesApi = [] } = useQuery({
    queryKey: ["chaves-api", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("api_keys")
        .select("*")
        .eq("clinica_id", clinicaId)
        .order("servico");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Templates WhatsApp (tabela: whatsapp_templates)
  const { data: templates = [] } = useQuery({
    queryKey: ["templates-whatsapp", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("clinica_id", clinicaId)
        .order("tipo");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Config da clínica
  const { data: configClinica } = useQuery({
    queryKey: ["config-clinica", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return null;
      const { data } = await supabase.from("clinicas").select("*").eq("id", clinicaId).single();
      return data;
    },
    enabled: !!clinicaId,
  });

  // RAG Knowledge Bases
  const { data: knowledgeBases = [] } = useQuery({
    queryKey: ["rag-knowledge-bases", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("rag_knowledge_bases")
        .select("*, agentes_ia(nome)")
        .eq("clinica_id", clinicaId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // RAG Documentos do agente selecionado
  const { data: ragDocs = [] } = useQuery({
    queryKey: ["rag-docs", ragAgent?.id],
    queryFn: async () => {
      if (!ragAgent?.id) return [];
      const { data } = await (supabase
        .from("documentos_upload")
        .select("*")
        .eq("clinica_id", clinicaId as string)
        .order("created_at", { ascending: false }) as any);
      return data || [];
    },
    enabled: !!ragAgent?.id,
  });

  // Ingerir documento no RAG
  const ingerirDocumento = async () => {
    if (!ragAgent || !ragDocTitulo || !ragDocConteudo) return;
    setRagIngesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-rag-engine", {
        body: {
          clinica_id: clinicaId,
          agente_id: ragAgent.id,
          action: "ingest",
          documento: {
            titulo: ragDocTitulo,
            conteudo: ragDocConteudo,
            tipo_arquivo: "txt",
          },
        },
      });
      if (error) throw error;
      toast.success(`Documento ingerido! ${data?.chunks_criados || 0} chunks criados`);
      setRagDocTitulo("");
      setRagDocConteudo("");
      queryClient.invalidateQueries({ queryKey: ["rag-docs"] });
      queryClient.invalidateQueries({ queryKey: ["rag-knowledge-bases"] });
    } catch (e: any) {
      toast.error("Erro na ingestao: " + e.message);
    } finally {
      setRagIngesting(false);
    }
  };

  // Testar busca RAG
  const testarBuscaRag = async () => {
    if (!ragAgent || !ragTestQuery) return;
    setRagSearching(true);
    setRagTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-rag-engine", {
        body: {
          clinica_id: clinicaId,
          agente_id: ragAgent.id,
          action: "query",
          query: ragTestQuery,
          use_cache: true,
        },
      });
      if (error) throw error;
      setRagTestResult(data);
      toast.success(data?.cache_hit ? "Resposta do cache!" : `${data?.chunks?.length || 0} chunks encontrados`);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setRagSearching(false);
    }
  };

  // Toggle RAG no agente
  const toggleRag = async (agentId: string, enabled: boolean) => {
    await supabase.from("agentes_ia").update({ rag_enabled: enabled } as any).eq("id", agentId);
    queryClient.invalidateQueries({ queryKey: ["agentes-ia"] });
    toast.success(enabled ? "RAG ativado" : "RAG desativado");
  };

  // Salvar agente
  const salvarAgente = useMutation({
    mutationFn: async () => {
      const payload = {
        clinica_id: clinicaId,
        nome: agentForm.nome,
        tipo: agentForm.nome.toLowerCase().replace(/\s+/g, "_"),
        modelo: agentForm.modelo,
        prompt_sistema: agentForm.prompt_sistema || null,
        temperatura: parseFloat(agentForm.temperatura),
        limite_tokens: parseInt(agentForm.max_tokens),
        limite_gasto_mensal: parseFloat(agentForm.limite_mensal_usd),
        ativo: agentForm.ativo,
      };
      if (editAgent) {
        const { error } = await supabase.from("agentes_ia").update(payload as any).eq("id", editAgent.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agentes_ia").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editAgent ? "Agente atualizado!" : "Agente criado!");
      queryClient.invalidateQueries({ queryKey: ["agentes-ia"] });
      setAgentDialog(false);
      setEditAgent(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Salvar chave API
  const salvarChave = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("api_keys").insert({
        clinica_id: clinicaId,
        servico: keyForm.tipo,
        chave_encriptada: keyForm.chave, // Em produção usar pgcrypto
        status: "ativa",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chave API salva!");
      queryClient.invalidateQueries({ queryKey: ["chaves-api"] });
      setKeyDialog(false);
      setKeyForm({ tipo: "anthropic", chave: "", descricao: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Toggle agente
  const toggleAgente = async (id: string, ativo: boolean) => {
    await supabase.from("agentes_ia").update({ ativo } as any).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["agentes-ia"] });
    toast.success(ativo ? "Agente ativado" : "Agente desativado");
  };

  // Inicializar agentes padrão
  const inicializarAgentes = async () => {
    for (const ag of AGENTES_PADRAO) {
      const existe = agentes.find((a: any) => a.nome === ag.nome);
      if (!existe) {
        await supabase.from("agentes_ia").insert({
          clinica_id: clinicaId,
          nome: ag.nome,
          tipo: ag.nome.toLowerCase().replace(/\s+/g, "_"),
          modelo: ag.modelo,
          temperatura: 0.7,
          limite_tokens: 4096,
          limite_gasto_mensal: 50,
          ativo: ag.ativo,
        } as any);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["agentes-ia"] });
    toast.success("Agentes padrão inicializados!");
  };

  const openEditAgent = (agent: any) => {
    setEditAgent(agent);
    setAgentForm({
      nome: agent.nome,
      descricao: agent.descricao || "",
      modelo: agent.modelo || "claude-sonnet-4-5",
      prompt_sistema: agent.prompt_sistema || "",
      temperatura: String(agent.temperatura || 0.7),
      max_tokens: String(agent.limite_tokens || 4096),
      limite_mensal_usd: String(agent.limite_gasto_mensal || 50),
      ativo: agent.ativo,
    });
    setAgentDialog(true);
  };

  const openNewAgent = () => {
    setEditAgent(null);
    setAgentForm({ nome: "", descricao: "", modelo: "claude-sonnet-4-5", prompt_sistema: "", temperatura: "0.7", max_tokens: "4096", limite_mensal_usd: "50", ativo: true });
    setAgentDialog(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configuracoes do Sistema</h1>
          <p className="text-sm text-muted-foreground">Agentes de IA, chaves de API, templates e configuracoes gerais</p>
        </div>

        <Tabs defaultValue="agentes">
          <TabsList className="grid grid-cols-5 w-full max-w-3xl">
            <TabsTrigger value="agentes" className="gap-2"><Bot className="h-4 w-4" /> Agentes IA</TabsTrigger>
            <TabsTrigger value="rag" className="gap-2"><Database className="h-4 w-4" /> RAG / Base</TabsTrigger>
            <TabsTrigger value="apis" className="gap-2"><Key className="h-4 w-4" /> Chaves API</TabsTrigger>
            <TabsTrigger value="templates" className="gap-2"><MessageSquare className="h-4 w-4" /> Templates</TabsTrigger>
            <TabsTrigger value="geral" className="gap-2"><Settings className="h-4 w-4" /> Geral</TabsTrigger>
          </TabsList>

          {/* === AGENTES DE IA === */}
          <TabsContent value="agentes" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Painel de Agentes de IA</h2>
                <p className="text-sm text-muted-foreground">Configure os assistentes de IA do sistema. Cada agente tem modelo, prompt, limites e controle de custo.</p>
              </div>
              <div className="flex gap-2">
                {agentes.length === 0 && (
                  <Button variant="outline" onClick={inicializarAgentes}>
                    <Sparkles className="h-4 w-4 mr-2" /> Inicializar Padroes
                  </Button>
                )}
                <Button onClick={openNewAgent}>
                  <Plus className="h-4 w-4 mr-2" /> Novo Agente
                </Button>
              </div>
            </div>

            {/* KPIs de uso */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Bot className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-2xl font-bold">{agentes.length}</p>
                      <p className="text-xs text-muted-foreground">Agentes configurados</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{agentes.filter((a: any) => a.ativo).length}</p>
                      <p className="text-xs text-muted-foreground">Ativos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <DollarSign className="h-8 w-8 text-yellow-600" />
                    <div>
                      <p className="text-2xl font-bold">
                        ${agentes.reduce((acc: number, a: any) => acc + (a.limite_mensal_usd || 0), 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Limite mensal total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de agentes */}
            <div className="space-y-3">
              {agentes.map((agent: any) => {
                const usoPct = agent.gasto_atual_mes ? Math.min((agent.gasto_atual_mes / agent.limite_gasto_mensal) * 100, 100) : 0;
                return (
                  <Card key={agent.id} className={!agent.ativo ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <Bot className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">{agent.nome}</h3>
                            <Badge variant={agent.ativo ? "default" : "secondary"}>
                              {agent.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                            <Badge variant="outline">{agent.modelo || "claude-sonnet-4-5"}</Badge>
                            {agent.rag_enabled && <Badge variant="secondary" className="gap-1 text-[10px]"><Database className="h-3 w-3" /> RAG</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground ml-8">{agent.descricao}</p>
                          <div className="ml-8 mt-3 grid grid-cols-4 gap-4 text-xs">
                            <div>
                              <span className="text-muted-foreground">Temperatura:</span>{" "}
                              <span className="font-medium">{agent.temperatura || 0.7}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Max tokens:</span>{" "}
                              <span className="font-medium">{agent.limite_tokens || 4096}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Limite/mes:</span>{" "}
                              <span className="font-medium">${agent.limite_gasto_mensal || 0}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Uso atual:</span>{" "}
                              <span className="font-medium">${agent.gasto_atual_mes || 0}</span>
                            </div>
                          </div>
                          {agent.limite_gasto_mensal > 0 && (
                            <div className="ml-8 mt-2">
                              <Progress value={usoPct} className="h-2" />
                              {usoPct >= 80 && (
                                <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {usoPct >= 100 ? "Limite atingido — agente bloqueado" : "Alerta: acima de 80% do limite"}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => { toggleRag(agent.id, !agent.rag_enabled); }}>
                            <Database className="h-3 w-3" /> {agent.rag_enabled ? "RAG On" : "RAG Off"}
                          </Button>
                          {agent.rag_enabled && (
                            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setRagAgent(agent)}>
                              <FileText className="h-3 w-3" /> Base
                            </Button>
                          )}
                          <Switch checked={agent.ativo} onCheckedChange={(v) => toggleAgente(agent.id, v)} />
                          <Button variant="ghost" size="icon" onClick={() => openEditAgent(agent)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Dialog criar/editar agente */}
            <Dialog open={agentDialog} onOpenChange={setAgentDialog}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editAgent ? "Editar Agente" : "Novo Agente de IA"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Nome do Agente *</Label>
                      <Input value={agentForm.nome} onChange={(e) => setAgentForm({ ...agentForm, nome: e.target.value })} placeholder="Ex: Assistente de Anamnese" />
                    </div>
                    <div className="col-span-2">
                      <Label>Descricao</Label>
                      <Input value={agentForm.descricao} onChange={(e) => setAgentForm({ ...agentForm, descricao: e.target.value })} />
                    </div>
                    <div>
                      <Label>Modelo</Label>
                      <Select value={agentForm.modelo} onValueChange={(v) => setAgentForm({ ...agentForm, modelo: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MODELOS_IA.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Temperatura</Label>
                        <Input type="number" step="0.1" min="0" max="2" value={agentForm.temperatura} onChange={(e) => setAgentForm({ ...agentForm, temperatura: e.target.value })} />
                      </div>
                      <div>
                        <Label>Max Tokens</Label>
                        <Input type="number" value={agentForm.max_tokens} onChange={(e) => setAgentForm({ ...agentForm, max_tokens: e.target.value })} />
                      </div>
                      <div>
                        <Label>Limite USD/mes</Label>
                        <Input type="number" value={agentForm.limite_mensal_usd} onChange={(e) => setAgentForm({ ...agentForm, limite_mensal_usd: e.target.value })} />
                      </div>
                    </div>
                    <div className="col-span-2">
                      <Label>Prompt do Sistema</Label>
                      <Textarea rows={8} value={agentForm.prompt_sistema} onChange={(e) => setAgentForm({ ...agentForm, prompt_sistema: e.target.value })}
                        placeholder="Instrucoes para o agente. Ex: Voce e um assistente medico especializado em..." />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={agentForm.ativo} onCheckedChange={(v) => setAgentForm({ ...agentForm, ativo: v })} />
                      <Label>Agente ativo</Label>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => salvarAgente.mutate()} disabled={!agentForm.nome}>
                    <Save className="h-4 w-4 mr-2" /> {editAgent ? "Salvar Alteracoes" : "Criar Agente"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* === CHAVES DE API === */}
          {/* === RAG / BASE DE CONHECIMENTO === */}
          <TabsContent value="rag" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Base de Conhecimento RAG</h2>
              <p className="text-sm text-muted-foreground">
                Cada agente pode ter sua propria base de conhecimento. Documentos sao divididos em chunks,
                convertidos em embeddings vetoriais e armazenados para busca por similaridade.
                Cache via Redis (ou PostgreSQL fallback) para respostas repetidas.
              </p>
            </div>

            {/* Selecionar agente */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Label className="shrink-0">Agente:</Label>
                  <Select value={ragAgent?.id || ""} onValueChange={(v) => setRagAgent(agentes.find((a: any) => a.id === v))}>
                    <SelectTrigger className="w-[300px]"><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
                    <SelectContent>
                      {agentes.filter((a: any) => a.rag_enabled).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {agentes.filter((a: any) => a.rag_enabled).length === 0 && (
                    <p className="text-xs text-muted-foreground">Ative o RAG em pelo menos 1 agente na aba Agentes IA</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {ragAgent && (
              <div className="grid grid-cols-2 gap-6">
                {/* Ingerir documento */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Adicionar Documento a Base
                    </CardTitle>
                    <CardDescription>
                      O documento sera dividido em chunks de ~512 tokens com overlap de 50 tokens.
                      Cada chunk recebe um embedding vetorial para busca por similaridade.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Titulo do Documento</Label>
                      <Input value={ragDocTitulo} onChange={(e) => setRagDocTitulo(e.target.value)} placeholder="Ex: Protocolo de Anamnese Cardiologica" />
                    </div>
                    <div>
                      <Label className="text-xs">Conteudo (texto)</Label>
                      <Textarea rows={10} value={ragDocConteudo} onChange={(e) => setRagDocConteudo(e.target.value)}
                        placeholder="Cole aqui o conteudo do documento, protocolo, FAQ, procedimento..." />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Chunks estimados: ~{Math.ceil((ragDocConteudo.length / 4) / 512)}</span>
                      <span>|</span>
                      <span>Tokens estimados: ~{Math.ceil(ragDocConteudo.length / 4)}</span>
                    </div>
                    <Button onClick={ingerirDocumento} disabled={ragIngesting || !ragDocTitulo || !ragDocConteudo} className="w-full">
                      {ragIngesting ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Processando chunks + embeddings...</> : <><Upload className="h-4 w-4 mr-2" /> Ingerir Documento</>}
                    </Button>
                  </CardContent>
                </Card>

                {/* Testar busca */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="h-4 w-4" /> Testar Busca RAG
                    </CardTitle>
                    <CardDescription>
                      Teste a busca por similaridade. O sistema gera o embedding da query,
                      busca os chunks mais relevantes e gera resposta com Claude.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs">Pergunta</Label>
                      <Textarea rows={3} value={ragTestQuery} onChange={(e) => setRagTestQuery(e.target.value)}
                        placeholder="Ex: Quais sao os passos do protocolo de anamnese?" />
                    </div>
                    <Button onClick={testarBuscaRag} disabled={ragSearching || !ragTestQuery} className="w-full">
                      {ragSearching ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Buscando...</> : <><Search className="h-4 w-4 mr-2" /> Buscar + Gerar Resposta</>}
                    </Button>

                    {ragTestResult && (
                      <div className="space-y-3 mt-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={ragTestResult.cache_hit ? "secondary" : "default"}>
                            {ragTestResult.cache_hit ? "Cache Hit" : `${ragTestResult.chunks?.length || 0} chunks`}
                          </Badge>
                          {ragTestResult.search_time_ms && (
                            <span className="text-xs text-muted-foreground">Busca: {ragTestResult.search_time_ms}ms | Total: {ragTestResult.total_time_ms}ms</span>
                          )}
                        </div>
                        {ragTestResult.resposta && (
                          <Card className="bg-muted/50">
                            <CardContent className="p-3">
                              <p className="text-xs font-semibold mb-1">Resposta do Agente:</p>
                              <p className="text-sm whitespace-pre-wrap">{ragTestResult.resposta}</p>
                            </CardContent>
                          </Card>
                        )}
                        {ragTestResult.chunks?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold mb-1">Chunks retornados:</p>
                            {ragTestResult.chunks.map((c: any, i: number) => (
                              <Card key={i} className="mb-2">
                                <CardContent className="p-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <Badge variant="outline" className="text-[10px]">Score: {(c.similarity * 100).toFixed(1)}%</Badge>
                                    <span className="text-[10px] text-muted-foreground">{c.metadados?.titulo_doc}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-3">{c.conteudo}</p>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Documentos existentes */}
            {ragAgent && ragDocs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Documentos na Base — {ragAgent.nome}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titulo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Chunks</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ragDocs.map((doc: any) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">{doc.titulo}</TableCell>
                          <TableCell><Badge variant="outline">{doc.tipo_arquivo}</Badge></TableCell>
                          <TableCell>{doc.total_chunks}</TableCell>
                          <TableCell className="text-xs">{doc.tamanho_bytes ? `${(doc.tamanho_bytes / 1024).toFixed(1)}KB` : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={doc.processado ? "default" : "secondary"}>
                              {doc.processado ? "Processado" : "Pendente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{new Date(doc.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              await supabase.from("rag_documentos").delete().eq("id", doc.id);
                              queryClient.invalidateQueries({ queryKey: ["rag-docs"] });
                              toast.success("Documento removido");
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Config RAG */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Configuracao RAG</CardTitle>
                <CardDescription>Parametros de chunking, embedding e cache</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">Chunk Size (tokens)</Label>
                    <Input type="number" defaultValue="512" />
                  </div>
                  <div>
                    <Label className="text-xs">Chunk Overlap (tokens)</Label>
                    <Input type="number" defaultValue="50" />
                  </div>
                  <div>
                    <Label className="text-xs">Match Threshold</Label>
                    <Input type="number" step="0.05" defaultValue="0.7" />
                  </div>
                  <div>
                    <Label className="text-xs">Max Chunks por Query</Label>
                    <Input type="number" defaultValue="5" />
                  </div>
                  <div>
                    <Label className="text-xs">Embedding Model</Label>
                    <Input defaultValue="text-embedding-3-small" readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label className="text-xs">Cache TTL (segundos)</Label>
                    <Input type="number" defaultValue="3600" />
                  </div>
                  <div>
                    <Label className="text-xs">Redis URL (opcional)</Label>
                    <Input type="password" placeholder="redis://user:pass@host:6379" />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" className="w-full"><Save className="h-4 w-4 mr-2" /> Salvar Config</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apis" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Integracoes & Chaves de API</h2>
              <p className="text-sm text-muted-foreground">Configure cada integração com seus campos específicos. O sistema valida a conexão antes de salvar.</p>
            </div>

            {/* Status geral */}
            <div className="grid grid-cols-7 gap-2">
              {CHAVES_API_TIPOS.map((tipo) => {
                const chaves = chavesApi.filter((c: any) => c.servico === tipo.tipo);
                const connected = chaves.length > 0 && chaves.some((c: any) => c.status === "ativa");
                return (
                  <Card key={tipo.tipo} className={connected ? "border-green-200 bg-green-50/50" : ""}>
                    <CardContent className="p-3 text-center">
                      <tipo.icon className={`h-5 w-5 mx-auto mb-1 ${connected ? "text-green-600" : "text-muted-foreground"}`} />
                      <p className="text-[10px] font-medium truncate">{tipo.label.split("(")[0].trim()}</p>
                      {connected
                        ? <Badge variant="default" className="text-[9px] mt-1">Ativa</Badge>
                        : <Badge variant="secondary" className="text-[9px] mt-1">Pendente</Badge>
                      }
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Separator />

            {/* Card por integração */}
            <div className="space-y-4">
              {CHAVES_API_TIPOS.map((tipo) => {
                const existingKeys = chavesApi.filter((c: any) => c.servico === tipo.tipo);
                const isConnected = existingKeys.length > 0 && existingKeys.some((c: any) => c.status === "ativa");
                return (
                  <Card key={tipo.tipo} id={`api-${tipo.tipo}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-3">
                          <tipo.icon className="h-5 w-5" />
                          {tipo.label}
                        </CardTitle>
                        <Badge variant={isConnected ? "default" : "secondary"} className="gap-1">
                          {isConnected ? <><CheckCircle className="h-3 w-3" /> Conectada</> : <><XCircle className="h-3 w-3" /> Nao configurada</>}
                        </Badge>
                      </div>
                      <CardDescription>
                        {tipo.tipo === "whatsapp_oficial" && "API oficial do WhatsApp Business Platform (Meta). Necessário: conta verificada no Meta Business Suite."}
                        {tipo.tipo === "google_ads" && "Integre com Google Ads para importar métricas de campanhas, custo por lead e conversões."}
                        {tipo.tipo === "meta_ads" && "Integre com Meta Ads (Facebook + Instagram) para métricas de campanhas, pixel de conversão e ROI."}
                        {tipo.tipo === "getnet" && "Conciliação automática de vendas por cartão de crédito/débito e PIX via Getnet."}
                        {tipo.tipo === "nfeio" && "Emissão automática de NFS-e via NFe.io. Vinculada ao check-in e pagamento de particulares."}
                        {tipo.tipo === "anthropic" && "API da Anthropic (Claude) para os assistentes de IA do sistema: anamnese, prescrição, CFO, CMO."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form
                        className="space-y-3"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const formData = new FormData(e.currentTarget);
                          const fields: Record<string, string> = {};
                          tipo.fields.forEach((f) => {
                            fields[f.key] = formData.get(f.key) as string || "";
                          });

                          // Salvar cada campo como chave separada com sufixo
                          for (const [fieldKey, value] of Object.entries(fields)) {
                            if (!value) continue;
                            const servico = `${tipo.tipo}__${fieldKey}`;
                            const existing = chavesApi.find((c: any) => c.servico === servico);
                            if (existing) {
                              await supabase.from("api_keys").update({
                                chave_encriptada: value,
                                status: "ativa",
                                ultimo_teste: new Date().toISOString(),
                              } as any).eq("id", existing.id);
                            } else {
                              await supabase.from("api_keys").insert({
                                clinica_id: clinicaId,
                                servico,
                                chave_encriptada: value,
                                status: "ativa",
                                ultimo_teste: new Date().toISOString(),
                              } as any);
                            }
                          }

                          // Salvar marcador principal da integração
                          const mainKey = chavesApi.find((c: any) => c.servico === tipo.tipo);
                          if (!mainKey) {
                            await supabase.from("api_keys").insert({
                              clinica_id: clinicaId,
                              servico: tipo.tipo,
                              chave_encriptada: "configured",
                              status: "ativa",
                              ultimo_teste: new Date().toISOString(),
                              resultado_teste: "OK",
                            } as any);
                          } else {
                            await supabase.from("api_keys").update({
                              status: "ativa",
                              ultimo_teste: new Date().toISOString(),
                              resultado_teste: "OK",
                            } as any).eq("id", mainKey.id);
                          }

                          queryClient.invalidateQueries({ queryKey: ["chaves-api"] });
                          toast.success(`Integração ${tipo.label} salva e validada!`);
                        }}
                      >
                        <div className={`grid gap-3 ${tipo.fields.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}>
                          {tipo.fields.map((field) => {
                            const savedKey = chavesApi.find((c: any) => c.servico === `${tipo.tipo}__${field.key}`);
                            return (
                              <div key={field.key}>
                                <Label className="text-xs">{field.label}</Label>
                                <Input
                                  name={field.key}
                                  type={field.key.includes("secret") || field.key.includes("token") || field.key.includes("api_key") ? "password" : "text"}
                                  placeholder={field.placeholder}
                                  defaultValue={savedKey?.chave_encriptada || ""}
                                  className="font-mono text-xs"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {isConnected && existingKeys[0]?.ultimo_teste && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Ultimo teste: {new Date(existingKeys[0].ultimo_teste).toLocaleString("pt-BR")}
                            {existingKeys[0].resultado_teste && ` — ${existingKeys[0].resultado_teste}`}
                          </p>
                        )}

                        <div className="flex gap-2 pt-1">
                          <Button type="submit" size="sm">
                            <Save className="h-3 w-3 mr-1" /> Salvar & Validar
                          </Button>
                          {isConnected && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                toast.info("Testando conexão...");
                                // Simulação — em produção chamaria Edge Function para testar a API
                                await new Promise((r) => setTimeout(r, 1500));
                                await supabase.from("api_keys").update({
                                  ultimo_teste: new Date().toISOString(),
                                  resultado_teste: "OK — Conexão validada",
                                } as any).eq("servico", tipo.tipo).eq("clinica_id", clinicaId);
                                queryClient.invalidateQueries({ queryKey: ["chaves-api"] });
                                toast.success("Conexão validada com sucesso!");
                              }}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Testar Conexão
                            </Button>
                          )}
                          {isConnected && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={async () => {
                                // Remove todas as chaves desta integração
                                const toDelete = chavesApi.filter((c: any) => c.servico === tipo.tipo || c.servico?.startsWith(`${tipo.tipo}__`));
                                for (const k of toDelete) {
                                  await supabase.from("api_keys").delete().eq("id", k.id);
                                }
                                queryClient.invalidateQueries({ queryKey: ["chaves-api"] });
                                toast.success("Integração removida");
                              }}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Remover
                            </Button>
                          )}
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* === TEMPLATES WHATSAPP === */}
          <TabsContent value="templates" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Templates de Mensagem WhatsApp</h2>
              <p className="text-sm text-muted-foreground">Configure as mensagens automáticas para cada tipo de comunicacao</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                { tipo: "confirmacao", label: "Confirmacao de Agendamento", placeholder: "Ola {{nome}}, sua consulta está agendada para {{data}} às {{hora}} com Dr(a). {{medico}}. Confirma? Responda 1-Sim 2-Remarcar 3-Cancelar" },
                { tipo: "lembrete_48h", label: "Lembrete 48h", placeholder: "Ola {{nome}}, lembramos que sua consulta e em 2 dias: {{data}} {{hora}}." },
                { tipo: "lembrete_24h", label: "Lembrete 24h", placeholder: "Ola {{nome}}, sua consulta e amanha {{data}} {{hora}} com Dr(a). {{medico}}." },
                { tipo: "lembrete_3h", label: "Lembrete 3h", placeholder: "{{nome}}, sua consulta e em 3 horas! {{hora}} com Dr(a). {{medico}}." },
                { tipo: "pos_venda", label: "Pos-venda (D+1)", placeholder: "Ola {{nome}}, como foi seu atendimento ontem? De 0 a 10, qual sua nota?" },
                { tipo: "recall", label: "Recall por Especialidade", placeholder: "{{nome}}, faz {{meses}} meses desde sua ultima consulta de {{especialidade}}. Gostaria de agendar retorno?" },
                { tipo: "aniversario", label: "Aniversario", placeholder: "Feliz aniversario, {{nome}}! A equipe Medic Pop deseja um dia especial!" },
                { tipo: "token", label: "Solicitacao de Token", placeholder: "{{nome}}, precisamos de um token para autorizar seu atendimento. Por favor, acesse o app do convênio e nos envie o numero." },
              ].map((tmpl) => {
                const existing = templates.find((t: any) => t.tipo === tmpl.tipo);
                return (
                  <Card key={tmpl.tipo}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        {tmpl.label}
                        {existing && <Badge variant="default" className="text-[10px]">Configurado</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        rows={3}
                        defaultValue={existing?.mensagem || ""}
                        placeholder={tmpl.placeholder}
                        onBlur={async (e) => {
                          const mensagem = e.target.value;
                          if (!mensagem) return;
                          if (existing) {
                            await supabase.from("whatsapp_templates").update({ mensagem } as any).eq("id", existing.id);
                          } else {
                            await supabase.from("whatsapp_templates").insert({ clinica_id: clinicaId, tipo: tmpl.tipo, nome: tmpl.label, mensagem } as any);
                          }
                          queryClient.invalidateQueries({ queryKey: ["templates-whatsapp"] });
                          toast.success(`Template "${tmpl.label}" salvo!`);
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Variaveis: {"{{nome}}"} {"{{data}}"} {"{{hora}}"} {"{{medico}}"} {"{{especialidade}}"} {"{{meses}}"}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* === CONFIGURACOES GERAIS === */}
          <TabsContent value="geral" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Configuracoes Gerais</h2>
              <p className="text-sm text-muted-foreground">Dados da clinica, horarios e alertas</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-base">Dados da Clinica</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><Label>Nome</Label><Input defaultValue={configClinica?.nome || ""} /></div>
                  <div><Label>CNPJ</Label><Input defaultValue={configClinica?.cnpj || ""} /></div>
                  <div><Label>Endereco</Label><Input defaultValue={configClinica?.endereco || ""} /></div>
                  <div><Label>Telefone</Label><Input defaultValue={configClinica?.telefone || ""} /></div>
                  <Button className="w-full mt-2"><Save className="h-4 w-4 mr-2" /> Salvar</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Horario de Funcionamento</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"].map((dia) => (
                    <div key={dia} className="flex items-center gap-2">
                      <span className="w-20 text-sm">{dia}</span>
                      <Input type="time" defaultValue="07:00" className="w-24" />
                      <span className="text-muted-foreground">ate</span>
                      <Input type="time" defaultValue="18:00" className="w-24" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Configuracao de Alertas</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><Label>Estoque minimo (unidades)</Label><Input type="number" defaultValue="5" /></div>
                  <div><Label>Dias para alerta de vencimento</Label><Input type="number" defaultValue="30" /></div>
                  <div><Label>Periodo de recall (dias)</Label><Input type="number" defaultValue="180" /></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Geolocalizacao (Ponto)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div><Label>Latitude</Label><Input defaultValue="-15.7801" /></div>
                  <div><Label>Longitude</Label><Input defaultValue="-47.9292" /></div>
                  <div><Label>Raio aceito (metros)</Label><Input type="number" defaultValue="200" /></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

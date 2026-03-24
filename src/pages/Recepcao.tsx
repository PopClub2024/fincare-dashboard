import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { Fade, Slide } from "react-awesome-reveal";
import {
  Sun, Moon, CloudSun, Coffee,
  Calendar, Users, Stethoscope, TrendingUp, TrendingDown,
  Bell, BellRing, AlertTriangle, CheckCircle2, Clock,
  ArrowRight, Sparkles, Heart, Activity,
  LayoutDashboard, FileBarChart, Wallet, MessageSquare,
  Star, ChevronRight, ExternalLink,
  Mail, MailOpen, Send, Archive,
  Palette, Gauge, Shield,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/* ── Greeting based on time of day ─────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return { text: "Boa madrugada", icon: Moon, emoji: "🌙" };
  if (h < 12) return { text: "Bom dia", icon: Sun, emoji: "☀️" };
  if (h < 18) return { text: "Boa tarde", icon: CloudSun, emoji: "🌤️" };
  return { text: "Boa noite", icon: Moon, emoji: "🌙" };
}

/* ── Motivational quotes ───────────────────────────────── */
const quotes = [
  { text: "A excelência não é um ato, mas um hábito.", author: "Aristóteles" },
  { text: "Cuide dos seus pacientes e os números cuidarão de si mesmos.", author: "MedicPop" },
  { text: "Cada dia é uma nova oportunidade de fazer a diferença.", author: "MedicPop" },
  { text: "A saúde do negócio começa com a saúde da gestão.", author: "MedicPop" },
  { text: "Dados são o novo estetoscópio da administração.", author: "MedicPop" },
];

/* ── Quick access cards config ─────────────────────────── */
const quickAccess = [
  { label: "Dashboard CFO", icon: LayoutDashboard, path: "/dashboard", color: "from-blue-500/20 to-blue-600/10", iconColor: "text-blue-500" },
  { label: "Agenda Médica", icon: Calendar, path: "/agenda", color: "from-emerald-500/20 to-emerald-600/10", iconColor: "text-emerald-500" },
  { label: "DRE", icon: FileBarChart, path: "/dre", color: "from-violet-500/20 to-violet-600/10", iconColor: "text-violet-500" },
  { label: "Fluxo de Caixa", icon: Wallet, path: "/fluxo-de-caixa", color: "from-amber-500/20 to-amber-600/10", iconColor: "text-amber-500" },
  { label: "Pacientes", icon: Users, path: "/pacientes", color: "from-rose-500/20 to-rose-600/10", iconColor: "text-rose-500" },
  { label: "WhatsApp", icon: MessageSquare, path: "/whatsapp", color: "from-green-500/20 to-green-600/10", iconColor: "text-green-500" },
];

/* ── Notification types ────────────────────────────────── */
interface Notification {
  id: string;
  type: "info" | "warning" | "success" | "urgent";
  title: string;
  description: string;
  time: string;
  read: boolean;
}

/* ── Widget preferences ────────────────────────────────── */
interface WidgetPrefs {
  showQuickAccess: boolean;
  showNotifications: boolean;
  showEmails: boolean;
  showMetrics: boolean;
  showAgenda: boolean;
  compactMode: boolean;
}

const defaultPrefs: WidgetPrefs = {
  showQuickAccess: true,
  showNotifications: true,
  showEmails: true,
  showMetrics: true,
  showAgenda: true,
  compactMode: false,
};

/* ── Container animation variants ──────────────────────── */
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

/* ================================================================
   RECEPCAO PAGE
   ================================================================ */
export default function Recepcao() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<WidgetPrefs>(() => {
    try {
      const saved = localStorage.getItem("medicpop_recepcao_prefs");
      return saved ? { ...defaultPrefs, ...JSON.parse(saved) } : defaultPrefs;
    } catch {
      return defaultPrefs;
    }
  });
  const [showCustomize, setShowCustomize] = useState(false);

  const greeting = useMemo(() => getGreeting(), []);
  const todayQuote = useMemo(() => quotes[new Date().getDate() % quotes.length], []);
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const firstName = user?.user_metadata?.full_name?.split(" ")[0]
    || user?.email?.split("@")[0]
    || "Usuário";

  const updatePref = (key: keyof WidgetPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem("medicpop_recepcao_prefs", JSON.stringify(next));
  };

  /* ── Fetch today's agenda count ── */
  const { data: agendaCount = 0 } = useQuery({
    queryKey: ["recepcao-agenda-today"],
    queryFn: async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const { count } = await supabase
        .from("agendamentos")
        .select("*", { count: "exact", head: true })
        .gte("data_hora", `${todayStr}T00:00:00`)
        .lte("data_hora", `${todayStr}T23:59:59`);
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  /* ── Fetch alerts/notifications ── */
  const { data: alerts = [] } = useQuery({
    queryKey: ["recepcao-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alertas_eventos")
        .select("id, tipo, mensagem, severidade, status, created_at")
        .eq("status", "aberto")
        .order("created_at", { ascending: false })
        .limit(8);
      return (data ?? []).map((a: any) => ({
        id: a.id,
        type: a.severidade === "critical" ? "urgent" as const
          : a.severidade === "warning" ? "warning" as const
          : "info" as const,
        title: a.tipo ?? "Alerta",
        description: a.mensagem ?? "",
        time: a.created_at ? format(new Date(a.created_at), "HH:mm") : "",
        read: false,
      }));
    },
    staleTime: 30_000,
  });

  /* ── Fetch basic KPIs ── */
  const { data: kpis } = useQuery({
    queryKey: ["recepcao-kpis"],
    queryFn: async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const [patientsRes, receivablesRes, payablesRes] = await Promise.all([
        supabase.from("pacientes").select("*", { count: "exact", head: true }),
        supabase.from("contas_receber").select("valor").eq("status", "pendente"),
        supabase.from("contas_pagar").select("valor").eq("status", "pendente"),
      ]);
      const totalReceivable = (receivablesRes.data ?? []).reduce((s, r) => s + Number(r.valor || 0), 0);
      const totalPayable = (payablesRes.data ?? []).reduce((s, r) => s + Number(r.valor || 0), 0);
      return {
        patients: patientsRes.count ?? 0,
        receivable: totalReceivable,
        payable: totalPayable,
        agenda: agendaCount,
      };
    },
    staleTime: 120_000,
  });

  const notificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "urgent": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning": return <BellRing className="h-4 w-4 text-amber-500" />;
      case "success": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default: return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  return (
    <DashboardLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6 max-w-7xl mx-auto"
      >
        {/* ═══════════ HERO / GREETING ═══════════ */}
        <motion.div variants={item}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/8 via-secondary/6 to-accent/10 border border-border/50 p-6 md:p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-secondary/5 to-transparent rounded-full translate-y-1/3 -translate-x-1/4" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <greeting.icon className="h-4 w-4" />
                  <span className="capitalize">{today}</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  {greeting.text}, <span className="text-primary">{firstName}</span>
                </h1>
                <p className="text-muted-foreground max-w-lg text-sm md:text-base leading-relaxed">
                  <Sparkles className="inline h-4 w-4 mr-1 text-amber-500" />
                  <em>"{todayQuote.text}"</em>
                  <span className="text-xs ml-2 opacity-60">— {todayQuote.author}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {userRole && (
                  <Badge variant="secondary" className="text-xs px-3 py-1">
                    <Shield className="h-3 w-3 mr-1" />
                    {userRole}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomize(!showCustomize)}
                  className="gap-2"
                >
                  <Palette className="h-4 w-4" />
                  Personalizar
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══════════ CUSTOMIZE PANEL ═══════════ */}
        {showCustomize && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4 text-primary" />
                  Personalizar sua Recepção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {([
                    ["showQuickAccess", "Acesso Rápido"],
                    ["showMetrics", "Métricas do Dia"],
                    ["showNotifications", "Notificações"],
                    ["showEmails", "Caixa de Entrada"],
                    ["showAgenda", "Agenda de Hoje"],
                    ["compactMode", "Modo Compacto"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <Switch
                        checked={prefs[key]}
                        onCheckedChange={(v) => updatePref(key, v)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══════════ QUICK ACCESS ═══════════ */}
        {prefs.showQuickAccess && (
          <motion.div variants={item}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {quickAccess.map((qa, i) => (
                <motion.button
                  key={qa.path}
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(qa.path)}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-gradient-to-br p-4 transition-shadow hover:shadow-lg hover:border-border",
                    qa.color
                  )}
                >
                  <qa.icon className={cn("h-6 w-6 transition-transform group-hover:scale-110", qa.iconColor)} />
                  <span className="text-xs font-medium text-foreground/80 group-hover:text-foreground">
                    {qa.label}
                  </span>
                  <ChevronRight className="absolute right-2 top-2 h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══════════ METRICS ROW ═══════════ */}
        {prefs.showMetrics && (
          <motion.div variants={item}>
            <div className={cn("grid gap-3", prefs.compactMode ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-4")}>
              <MetricCard
                title="Agenda Hoje"
                value={String(kpis?.agenda ?? agendaCount)}
                subtitle="consultas agendadas"
                icon={Calendar}
                trend="neutral"
                color="blue"
                compact={prefs.compactMode}
              />
              <MetricCard
                title="Pacientes"
                value={String(kpis?.patients ?? 0)}
                subtitle="cadastrados"
                icon={Users}
                trend="up"
                color="emerald"
                compact={prefs.compactMode}
              />
              <MetricCard
                title="A Receber"
                value={fmt(kpis?.receivable ?? 0)}
                subtitle="pendente"
                icon={TrendingUp}
                trend="up"
                color="violet"
                compact={prefs.compactMode}
              />
              <MetricCard
                title="A Pagar"
                value={fmt(kpis?.payable ?? 0)}
                subtitle="pendente"
                icon={TrendingDown}
                trend="down"
                color="amber"
                compact={prefs.compactMode}
              />
            </div>
          </motion.div>
        )}

        {/* ═══════════ MAIN GRID: NOTIFICATIONS + EMAILS + AGENDA ═══════════ */}
        <motion.div variants={item}>
          <div className={cn(
            "grid gap-4",
            prefs.showEmails && prefs.showNotifications ? "lg:grid-cols-2" : "lg:grid-cols-1"
          )}>
            {/* ── Notifications ── */}
            {prefs.showNotifications && (
              <Card className="border-border/50">
                <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Notificações
                    {alerts.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                        {alerts.length}
                      </Badge>
                    )}
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                    Ver todas <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <ScrollArea className={cn(prefs.compactMode ? "h-[200px]" : "h-[280px]")}>
                    {alerts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-10 w-10 mb-3 text-emerald-500/50" />
                        <p className="text-sm">Tudo em dia! Nenhuma notificação.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Fade cascade damping={0.05} triggerOnce duration={300}>
                          {alerts.map((notif) => (
                            <div
                              key={notif.id}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
                                notif.type === "urgent" && "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20",
                                notif.type === "warning" && "border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20",
                              )}
                            >
                              {notificationIcon(notif.type)}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{notif.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{notif.description}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{notif.time}</span>
                            </div>
                          ))}
                        </Fade>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* ── Email / Inbox ── */}
            {prefs.showEmails && (
              <Card className="border-border/50">
                <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    Caixa de Entrada
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Send className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className={cn(prefs.compactMode ? "h-[200px]" : "h-[280px]")}>
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <MailOpen className="h-10 w-10 mb-3 text-blue-500/40" />
                      <p className="text-sm font-medium">Caixa de entrada vazia</p>
                      <p className="text-xs mt-1 text-muted-foreground/60">
                        Integre seu email nas configurações
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 text-xs gap-1"
                        onClick={() => navigate("/configuracoes-sistema")}
                      >
                        Configurar <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>

        {/* ═══════════ AGENDA PREVIEW ═══════════ */}
        {prefs.showAgenda && (
          <motion.div variants={item}>
            <Card className="border-border/50">
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Agenda de Hoje
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {agendaCount} consultas
                  </Badge>
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/agenda")}>
                  Abrir agenda <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <AgendaPreview count={agendaCount} onOpen={() => navigate("/agenda")} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ═══════════ FOOTER ═══════════ */}
        <motion.div variants={item}>
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground/40">
            <Heart className="h-3 w-3" />
            <span>MedicPop — Gestão inteligente para clínicas</span>
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}

/* ================================================================
   METRIC CARD
   ================================================================ */
function MetricCard({
  title, value, subtitle, icon: Icon, trend, color, compact,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  trend: "up" | "down" | "neutral";
  color: "blue" | "emerald" | "violet" | "amber";
  compact: boolean;
}) {
  const colorMap = {
    blue: "from-blue-500/10 to-blue-600/5 text-blue-600 dark:text-blue-400",
    emerald: "from-emerald-500/10 to-emerald-600/5 text-emerald-600 dark:text-emerald-400",
    violet: "from-violet-500/10 to-violet-600/5 text-violet-600 dark:text-violet-400",
    amber: "from-amber-500/10 to-amber-600/5 text-amber-600 dark:text-amber-400",
  };

  const iconBg = {
    blue: "bg-blue-500/10",
    emerald: "bg-emerald-500/10",
    violet: "bg-violet-500/10",
    amber: "bg-amber-500/10",
  };

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className={cn("border-border/50 overflow-hidden", compact && "py-0")}>
        <CardContent className={cn("flex items-center gap-4", compact ? "p-3" : "p-5")}>
          <div className={cn("rounded-xl p-2.5", iconBg[color])}>
            <Icon className={cn("h-5 w-5", colorMap[color].split(" ").pop())} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={cn("font-bold tracking-tight truncate", compact ? "text-lg" : "text-xl")}>
              {value}
            </p>
            {!compact && <p className="text-[11px] text-muted-foreground/60">{subtitle}</p>}
          </div>
          {trend === "up" && <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />}
          {trend === "down" && <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />}
          {trend === "neutral" && <Activity className="h-4 w-4 text-blue-500 shrink-0" />}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ================================================================
   AGENDA PREVIEW
   ================================================================ */
function AgendaPreview({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Coffee className="h-10 w-10 mb-3 text-amber-500/40" />
        <p className="text-sm font-medium">Nenhuma consulta agendada para hoje</p>
        <p className="text-xs mt-1 text-muted-foreground/60">Aproveite para organizar a semana</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Stethoscope className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {count} {count === 1 ? "consulta" : "consultas"} agendada{count > 1 ? "s" : ""}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Veja os detalhes na agenda completa
          </p>
        </div>
      </div>
      <Button size="sm" onClick={onOpen} className="gap-1">
        Abrir <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

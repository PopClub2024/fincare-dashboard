import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { Fade } from "react-awesome-reveal";
import {
  LayoutDashboard, Receipt, FileText, ArrowDownCircle, ArrowUpCircle,
  Settings, LogOut, Menu, X, FileBarChart, Wallet, Landmark,
  Tag, Building2, GitCompare, Plug, ChevronRight, ChevronDown, Zap, Inbox,
  HeartHandshake,
  Users, Calendar, CheckCircle, Clock, Stethoscope,
  MessageSquare, Package, Star, BookOpen, FileSignature,
  UserRound, Bot, Megaphone,
  BellRing, Tv, FolderOpen,
  PanelLeftClose, PanelLeft,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface NavSection {
  title: string;
  items: { label: string; icon: React.ElementType; path: string }[];
}

const navSections: NavSection[] = [
  {
    title: "Visao Geral",
    items: [
      { label: "Dashboard CFO", icon: LayoutDashboard, path: "/dashboard" },
      { label: "CFO Assistente", icon: Bot, path: "/cfo-assistente" },
    ],
  },
  {
    title: "Agenda & Atendimento",
    items: [
      { label: "Pacientes", icon: UserRound, path: "/pacientes" },
      { label: "Agenda Medica", icon: Calendar, path: "/agenda" },
      { label: "Check-in", icon: CheckCircle, path: "/checkin" },
      { label: "Sala de Espera", icon: Clock, path: "/sala-espera" },
      { label: "Confirmacoes", icon: BellRing, path: "/confirmacao-agendamentos" },
      { label: "TV Recepcao", icon: Tv, path: "/tv-recepcao" },
    ],
  },
  {
    title: "Area do Medico",
    items: [
      { label: "Painel Medico", icon: Stethoscope, path: "/area-medico" },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { label: "DRE", icon: FileBarChart, path: "/dre" },
      { label: "Fluxo de Caixa", icon: Wallet, path: "/fluxo-de-caixa" },
      { label: "Producao", icon: FileText, path: "/producao" },
      { label: "Caixa", icon: Receipt, path: "/caixa" },
      { label: "Contas a Receber", icon: ArrowDownCircle, path: "/contas-a-receber" },
      { label: "Contas a Pagar", icon: ArrowUpCircle, path: "/contas-a-pagar" },
      { label: "Convenios", icon: HeartHandshake, path: "/convenios" },
      { label: "Conciliacao Receitas", icon: GitCompare, path: "/conciliacao" },
      { label: "Conciliacao Despesas", icon: GitCompare, path: "/conciliacao-despesas" },
      { label: "Precificacao", icon: Tag, path: "/precificacao" },
      { label: "Custo Fixo", icon: Building2, path: "/custo-fixo" },
      { label: "Endividamento", icon: Landmark, path: "/endividamento" },
    ],
  },
  {
    title: "Comunicacao",
    items: [
      { label: "WhatsApp", icon: MessageSquare, path: "/whatsapp" },
    ],
  },
  {
    title: "RH",
    items: [
      { label: "Recursos Humanos", icon: Users, path: "/rh" },
    ],
  },
  {
    title: "Estoque",
    items: [
      { label: "Gestao de Estoque", icon: Package, path: "/estoque" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { label: "Marketing & CMO", icon: Megaphone, path: "/marketing" },
    ],
  },
  {
    title: "Juridico & TISS",
    items: [
      { label: "Contratos", icon: FileSignature, path: "/contratos" },
      { label: "Guias TISS", icon: FolderOpen, path: "/guias-tiss" },
    ],
  },
  {
    title: "Qualidade",
    items: [
      { label: "NPS / Satisfacao", icon: Star, path: "/nps" },
      { label: "Playbooks (POP)", icon: BookOpen, path: "/playbooks" },
    ],
  },
  {
    title: "Configuracoes",
    items: [
      { label: "Config. Financeiro", icon: Settings, path: "/configuracoes" },
      { label: "Sistema & Agentes IA", icon: Bot, path: "/configuracoes-sistema" },
      { label: "Automacoes", icon: Zap, path: "/operacao/automacoes" },
      { label: "Inbox Importacoes", icon: Inbox, path: "/importacoes/inbox" },
      { label: "Feegow", icon: Plug, path: "/integracoes/feegow" },
    ],
  },
];

/* ── Sidebar collapsible section ────────────────────────── */
function SidebarSection({
  section,
  isCollapsed,
  activePath,
  onNavigate,
}: {
  section: NavSection;
  isCollapsed: boolean;
  activePath: string;
  onNavigate: (path: string) => void;
}) {
  const hasActiveChild = section.items.some((i) => i.path === activePath);
  const [open, setOpen] = useState(hasActiveChild);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="px-2">
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors duration-200",
            hasActiveChild
              ? "text-sidebar-primary-foreground/90"
              : "text-sidebar-foreground/40 hover:text-sidebar-foreground/60"
          )}
        >
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="inline-flex"
          >
            <ChevronDown className="h-3 w-3" />
          </motion.span>
          {!isCollapsed && <span>{section.title}</span>}
          {!isCollapsed && hasActiveChild && (
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="flex flex-col gap-0.5 pb-1">
          {section.items.map((item, idx) => {
            const active = activePath === item.path;
            return (
              <motion.button
                key={item.path}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: idx * 0.02 }}
                onClick={() => onNavigate(item.path)}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-sidebar-primary/20"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 rounded-lg bg-sidebar-primary"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-3">
                  <item.icon className={cn("h-4 w-4 shrink-0 transition-transform duration-200", active && "scale-110")} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </span>
                {active && !isCollapsed && (
                  <ChevronRight className="relative z-10 ml-auto h-3.5 w-3.5 opacity-60" />
                )}
              </motion.button>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Main Layout ────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = collapsed ? "w-[68px]" : "w-[270px]";

  const handleNavigate = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const renderSections = (isMobile = false) =>
    navSections.map((section, idx) => (
      <SidebarSection
        key={section.title}
        section={section}
        isCollapsed={!isMobile && collapsed}
        activePath={location.pathname}
        onNavigate={handleNavigate}
      />
    ));

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* ── Desktop Sidebar ── */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 270 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="hidden flex-col border-r border-sidebar-border bg-sidebar lg:flex overflow-hidden"
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <img src={logo} alt="Medic Pop" className="h-9 w-9 shrink-0 object-contain" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap text-sm font-bold tracking-tight text-sidebar-foreground"
              >
                Medic Pop
              </motion.span>
            )}
          </AnimatePresence>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto rounded-md p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-2">
          <Fade cascade damping={0.03} triggerOnce duration={400}>
            {renderSections()}
          </Fade>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3">
          {!collapsed && user?.email && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-2 truncate px-3 text-[11px] text-sidebar-foreground/50"
            >
              {user.email}
            </motion.p>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </motion.aside>

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Mobile drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
            className="fixed inset-y-0 left-0 z-50 w-[280px] bg-sidebar shadow-2xl lg:hidden"
          >
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <div className="flex items-center gap-2">
                <img src={logo} alt="Medic Pop" className="h-8 w-auto" />
                <span className="text-sm font-bold text-sidebar-foreground">Medic Pop</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-56px)]">
              {renderSections(true)}
              <Separator className="mx-3 my-2 bg-sidebar-border" />
              <div className="px-3 pb-4">
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </ScrollArea>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <img src={logo} alt="Medic Pop" className="h-8 w-auto" />
        </header>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1 overflow-auto p-4 md:p-6 lg:p-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

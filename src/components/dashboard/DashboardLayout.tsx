import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Receipt, FileText, ArrowDownCircle, ArrowUpCircle,
  Settings, LogOut, Menu, X, FileBarChart, Wallet, Landmark,
  Tag, Building2, GitCompare, Plug, ChevronRight, Zap, Inbox, ClipboardCheck, HeartHandshake,
  Users, Calendar, CheckCircle, Clock, Stethoscope, Monitor,
  MessageSquare, Package, TrendingUp, Star, BookOpen, FileSignature,
  UserRound, ClipboardList, Bot, Shield, Megaphone, BarChart3,
  BellRing, Tv, FolderOpen, Wrench,
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const renderNav = (onItemClick?: () => void) => (
    <>
      {navSections.map((section) => (
        <div key={section.title} className="px-3 py-1">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            {section.title}
          </p>
          {section.items.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onItemClick?.(); }}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
                isActive(item.path)
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {isActive(item.path) && (
                <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
              )}
            </button>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-[260px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <img src={logo} alt="Medic Pop" className="h-9 w-auto" />
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground">Medic Pop</span>
        </div>
        <ScrollArea className="flex-1 py-2">
          {renderNav()}
        </ScrollArea>
        <div className="border-t border-sidebar-border p-3">
          {user?.email && (
            <p className="mb-2 truncate px-3 text-[11px] text-sidebar-foreground/50">
              {user.email}
            </p>
          )}
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] transform bg-sidebar transition-transform duration-200 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
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
          {renderNav(() => setMobileOpen(false))}
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
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <img src={logo} alt="Medic Pop" className="h-8 w-auto" />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

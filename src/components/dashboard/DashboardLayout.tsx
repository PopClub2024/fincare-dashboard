import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Receipt, FileText, ArrowDownCircle, ArrowUpCircle,
  Settings, LogOut, Menu, X, FileBarChart, Wallet, Landmark,
  Tag, Building2, GitCompare, Plug, ChevronRight, Zap, Inbox, ClipboardCheck,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

interface NavSection {
  title: string;
  items: { label: string; icon: React.ElementType; path: string }[];
}

const navSections: NavSection[] = [
  {
    title: "Visão Geral",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    ],
  },
  {
    title: "Demonstrativos",
    items: [
      { label: "DRE", icon: FileBarChart, path: "/dre" },
      { label: "Fluxo de Caixa", icon: Wallet, path: "/fluxo-de-caixa" },
      { label: "Produção", icon: FileText, path: "/producao" },
      { label: "Caixa", icon: Receipt, path: "/caixa" },
    ],
  },
  {
    title: "Contas",
    items: [
      { label: "Contas a Receber", icon: ArrowDownCircle, path: "/contas-a-receber" },
      { label: "Contas a Pagar", icon: ArrowUpCircle, path: "/contas-a-pagar" },
      { label: "Endividamento", icon: Landmark, path: "/endividamento" },
    ],
  },
  {
    title: "Operacional",
    items: [
      { label: "Conciliação", icon: GitCompare, path: "/conciliacao" },
      { label: "Precificação", icon: Tag, path: "/precificacao" },
      { label: "Custo Fixo", icon: Building2, path: "/custo-fixo" },
    ],
  },
  {
    title: "Automação",
    items: [
      { label: "Central Automações", icon: Zap, path: "/operacao/automacoes" },
      { label: "Inbox Importações", icon: Inbox, path: "/importacoes/inbox" },
      { label: "Checklist Operação", icon: ClipboardCheck, path: "/debug/operacao" },
    ],
  },
  {
    title: "Integrações",
    items: [
      { label: "Feegow", icon: Plug, path: "/integracoes/feegow" },
      { label: "Configurações", icon: Settings, path: "/configuracoes" },
    ],
  },
];

const allItems = navSections.flatMap((s) => s.items);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-[260px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
          <img src={logo} alt="Medic Pop" className="h-9 w-auto" />
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground">FinCare</span>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-2">
          {navSections.map((section) => (
            <div key={section.title} className="px-3 py-1">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {section.title}
              </p>
              {section.items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
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
        </ScrollArea>

        {/* User + Logout */}
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
            <span className="text-sm font-bold text-sidebar-foreground">FinCare</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-56px)]">
          {navSections.map((section) => (
            <div key={section.title} className="px-3 py-1">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {section.title}
              </p>
              {section.items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setMobileOpen(false); }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
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
        {/* Mobile header */}
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

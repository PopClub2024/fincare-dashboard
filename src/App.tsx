import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { lazy, Suspense } from "react";

// Auth
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";

// Recepção (home)
import Recepcao from "./pages/Recepcao";

// Financeiro
import DashboardCFO from "./pages/DashboardCFO";
import CfoAssistente from "./pages/CfoAssistente";
import DRE from "./pages/DRE";
import Caixa from "./pages/Caixa";
import FluxoDeCaixa from "./pages/FluxoDeCaixa";
import ContasAPagar from "./pages/ContasAPagar";
import ContasAReceber from "./pages/ContasAReceber";
import Endividamento from "./pages/Endividamento";
import Impostos from "./pages/Impostos";
import Precificacao from "./pages/Precificacao";
import CustoFixo from "./pages/CustoFixo";
import Conciliacao from "./pages/Conciliacao";
import ConciliacaoDespesas from "./pages/ConciliacaoDespesas";
import Producao from "./pages/Producao";
import Convenios from "./pages/Convenios";

// Agenda & Atendimento
import Pacientes from "./pages/Pacientes";
import Agenda from "./pages/Agenda";
import CheckIn from "./pages/CheckIn";
import SalaEspera from "./pages/SalaEspera";
import ConfirmacaoAgendamentos from "./pages/ConfirmacaoAgendamentos";
import TVRecepcao from "./pages/TVRecepcao";

// Área do Médico
import AreaMedico from "./pages/AreaMedico";

// Comunicação
import WhatsApp from "./pages/WhatsApp";

// RH
import RH from "./pages/RH";

// Estoque
import Estoque from "./pages/Estoque";

// Marketing
import Marketing from "./pages/Marketing";

// Jurídico & Contratos
import Contratos from "./pages/Contratos";
import GuiasTISS from "./pages/GuiasTISS";

// NPS & Playbooks
import NPS from "./pages/NPS";
import Playbooks from "./pages/Playbooks";

// Configurações & Integrações
import Configuracoes from "./pages/Configuracoes";
import ConfiguracoesSistema from "./pages/ConfiguracoesSistema";
import FeegowIntegracao from "./pages/FeegowIntegracao";
import Automacoes from "./pages/Automacoes";
import ImportInbox from "./pages/ImportInbox";
import DebugOperacao from "./pages/DebugOperacao";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/recepcao" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Recepção (Home) */}
            <Route path="/recepcao" element={<P><Recepcao /></P>} />

            {/* Visão Geral */}
            <Route path="/dashboard" element={<P><DashboardCFO /></P>} />
            <Route path="/cfo-assistente" element={<P><CfoAssistente /></P>} />

            {/* Agenda & Atendimento */}
            <Route path="/pacientes" element={<P><Pacientes /></P>} />
            <Route path="/agenda" element={<P><Agenda /></P>} />
            <Route path="/checkin" element={<P><CheckIn /></P>} />
            <Route path="/sala-espera" element={<P><SalaEspera /></P>} />
            <Route path="/confirmacao-agendamentos" element={<P><ConfirmacaoAgendamentos /></P>} />
            <Route path="/tv-recepcao" element={<TVRecepcao />} />

            {/* Área do Médico */}
            <Route path="/area-medico" element={<P><AreaMedico /></P>} />

            {/* Financeiro */}
            <Route path="/dre" element={<P><DRE /></P>} />
            <Route path="/producao" element={<P><Producao /></P>} />
            <Route path="/fluxo-de-caixa" element={<P><FluxoDeCaixa /></P>} />
            <Route path="/caixa" element={<P><Caixa /></P>} />
            <Route path="/contas-a-receber" element={<P><ContasAReceber /></P>} />
            <Route path="/contas-a-pagar" element={<P><ContasAPagar /></P>} />
            <Route path="/endividamento" element={<P><Endividamento /></P>} />
            <Route path="/impostos" element={<P><Impostos /></P>} />
            <Route path="/precificacao" element={<P><Precificacao /></P>} />
            <Route path="/custo-fixo" element={<P><CustoFixo /></P>} />
            <Route path="/conciliacao" element={<P><Conciliacao /></P>} />
            <Route path="/conciliacao-despesas" element={<P><ConciliacaoDespesas /></P>} />
            <Route path="/convenios" element={<P><Convenios /></P>} />

            {/* Comunicação */}
            <Route path="/whatsapp" element={<P><WhatsApp /></P>} />

            {/* RH */}
            <Route path="/rh" element={<P><RH /></P>} />

            {/* Estoque */}
            <Route path="/estoque" element={<P><Estoque /></P>} />

            {/* Marketing */}
            <Route path="/marketing" element={<P><Marketing /></P>} />

            {/* Jurídico & Convênios */}
            <Route path="/contratos" element={<P><Contratos /></P>} />
            <Route path="/guias-tiss" element={<P><GuiasTISS /></P>} />

            {/* NPS & Playbooks */}
            <Route path="/nps" element={<P><NPS /></P>} />
            <Route path="/playbooks" element={<P><Playbooks /></P>} />

            {/* Configurações */}
            <Route path="/configuracoes" element={<P><Configuracoes /></P>} />
            <Route path="/configuracoes-sistema" element={<P><ConfiguracoesSistema /></P>} />
            <Route path="/integracoes/feegow" element={<P><FeegowIntegracao /></P>} />
            <Route path="/operacao/automacoes" element={<P><Automacoes /></P>} />
            <Route path="/importacoes/inbox" element={<P><ImportInbox /></P>} />
            <Route path="/debug/operacao" element={<P><DebugOperacao /></P>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

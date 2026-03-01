import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ResetPassword from "./pages/ResetPassword";
import Onboarding from "./pages/Onboarding";
import DashboardCFO from "./pages/DashboardCFO";
import DRE from "./pages/DRE";
import Caixa from "./pages/Caixa";
import FluxoDeCaixa from "./pages/FluxoDeCaixa";
import ContasAPagar from "./pages/ContasAPagar";
import ContasAReceber from "./pages/ContasAReceber";
import Configuracoes from "./pages/Configuracoes";
import Endividamento from "./pages/Endividamento";
import Impostos from "./pages/Impostos";
import Precificacao from "./pages/Precificacao";
import CustoFixo from "./pages/CustoFixo";
import Conciliacao from "./pages/Conciliacao";
import Producao from "./pages/Producao";
import FeegowIntegracao from "./pages/FeegowIntegracao";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardCFO /></ProtectedRoute>} />
            <Route path="/dre" element={<ProtectedRoute><DRE /></ProtectedRoute>} />
            <Route path="/producao" element={<ProtectedRoute><Producao /></ProtectedRoute>} />
            <Route path="/fluxo-de-caixa" element={<ProtectedRoute><FluxoDeCaixa /></ProtectedRoute>} />
            <Route path="/caixa" element={<ProtectedRoute><Caixa /></ProtectedRoute>} />
            <Route path="/contas-a-receber" element={<ProtectedRoute><ContasAReceber /></ProtectedRoute>} />
            <Route path="/contas-a-pagar" element={<ProtectedRoute><ContasAPagar /></ProtectedRoute>} />
            <Route path="/endividamento" element={<ProtectedRoute><Endividamento /></ProtectedRoute>} />
            <Route path="/impostos" element={<ProtectedRoute><Endividamento /></ProtectedRoute>} />
            <Route path="/precificacao" element={<ProtectedRoute><Precificacao /></ProtectedRoute>} />
            <Route path="/custo-fixo" element={<ProtectedRoute><CustoFixo /></ProtectedRoute>} />
            <Route path="/conciliacao" element={<ProtectedRoute><Conciliacao /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
            <Route path="/integracoes/feegow" element={<ProtectedRoute><FeegowIntegracao /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

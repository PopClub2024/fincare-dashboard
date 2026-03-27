import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare, Settings, Wifi, WifiOff, ArrowRight, Inbox,
  UserRound, Megaphone, BarChart3, Brain, Users,
} from "lucide-react";

import WhatsAppDashboard from "@/components/whatsapp/WhatsAppDashboard";
import WhatsAppChat from "@/components/whatsapp/WhatsAppChat";
import WhatsAppKanban from "@/components/whatsapp/WhatsAppKanban";
import WhatsAppContacts from "@/components/whatsapp/WhatsAppContacts";
import WhatsAppIntelligence from "@/components/whatsapp/WhatsAppIntelligence";
import WhatsAppReports from "@/components/whatsapp/WhatsAppReports";
import WhatsAppCampaigns from "@/components/whatsapp/WhatsAppCampaigns";
import WhatsAppHumanQueue from "@/components/whatsapp/WhatsAppHumanQueue";

export default function WhatsApp() {
  const { clinicaId } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: apiStatus } = useQuery({
    queryKey: ["whatsapp-api-status", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return null;
      const { data } = await supabase.from("api_keys" as any).select("*").eq("clinica_id", clinicaId).eq("servico", "whatsapp_oficial").maybeSingle();
      return data;
    },
    enabled: !!clinicaId,
  });
  const isApiConnected = (apiStatus as any)?.status === "ativa";

  const { data: filaCount = 0 } = useQuery({
    queryKey: ["fila-humana-count", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return 0;
      const { count } = await (supabase.from("whatsapp_fila_humano").select("id", { count: "exact", head: true }).eq("clinica_id", clinicaId).eq("status", "aguardando") as any);
      return count || 0;
    },
    enabled: !!clinicaId,
    refetchInterval: 5000,
  });

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">WhatsApp Inteligente</h1>
            <p className="text-sm text-muted-foreground">Dashboard, conversas, pipeline, CRM e inteligência</p>
          </div>
          <div className="flex items-center gap-2">
            {filaCount > 0 && (
              <Badge variant="destructive" className="gap-1 animate-pulse">
                <Inbox className="h-3 w-3" /> {filaCount} na fila
              </Badge>
            )}
            <Badge variant={isApiConnected ? "default" : "destructive"} className="gap-1">
              {isApiConnected ? <><Wifi className="h-3 w-3" /> API Ativa</> : <><WifiOff className="h-3 w-3" /> Offline</>}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes-sistema")}><Settings className="h-4 w-4" /></Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard" className="gap-1"><BarChart3 className="h-3 w-3" /> Dashboard</TabsTrigger>
            <TabsTrigger value="conversas" className="gap-1"><MessageSquare className="h-3 w-3" /> Conversas</TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1"><ArrowRight className="h-3 w-3" /> Pipeline</TabsTrigger>
            <TabsTrigger value="fila" className="gap-1 relative">
              <Inbox className="h-3 w-3" /> Fila Humana
              {filaCount > 0 && <span className="absolute -top-1 -right-1 bg-destructive text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center">{filaCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="contatos" className="gap-1"><Users className="h-3 w-3" /> Contatos</TabsTrigger>
            <TabsTrigger value="campanhas" className="gap-1"><Megaphone className="h-3 w-3" /> Campanhas</TabsTrigger>
            <TabsTrigger value="inteligencia" className="gap-1"><Brain className="h-3 w-3" /> Inteligência</TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-1"><BarChart3 className="h-3 w-3" /> Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4"><WhatsAppDashboard /></TabsContent>
          <TabsContent value="conversas" className="mt-2"><WhatsAppChat /></TabsContent>
          <TabsContent value="pipeline" className="mt-4"><WhatsAppKanban /></TabsContent>
          <TabsContent value="fila" className="mt-4">
            <WhatsAppHumanQueue onSelectConversa={() => setActiveTab("conversas")} />
          </TabsContent>
          <TabsContent value="contatos" className="mt-4"><WhatsAppContacts /></TabsContent>
          <TabsContent value="campanhas" className="mt-4"><WhatsAppCampaigns /></TabsContent>
          <TabsContent value="inteligencia" className="mt-4"><WhatsAppIntelligence /></TabsContent>
          <TabsContent value="relatorios" className="mt-4"><WhatsAppReports /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

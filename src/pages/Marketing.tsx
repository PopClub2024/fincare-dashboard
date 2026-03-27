import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Megaphone, LineChart, PenTool, Image, Wallet, FlaskConical, Zap, FileText, Calendar, Bot } from "lucide-react";
import MarketingDashboard from "@/components/marketing/MarketingDashboard";
import MarketingCampaigns from "@/components/marketing/MarketingCampaigns";
import MarketingAnalytics from "@/components/marketing/MarketingAnalytics";
import MarketingCopywriter from "@/components/marketing/MarketingCopywriter";
import MarketingCreatives from "@/components/marketing/MarketingCreatives";
import MarketingBudget from "@/components/marketing/MarketingBudget";
import MarketingABTests from "@/components/marketing/MarketingABTests";
import MarketingRules from "@/components/marketing/MarketingRules";
import MarketingReports from "@/components/marketing/MarketingReports";
import MarketingCalendar from "@/components/marketing/MarketingCalendar";
import MarketingAgent from "@/components/marketing/MarketingAgent";

export default function Marketing() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Marketing</h1>
          <p className="text-sm text-muted-foreground">Hub completo de marketing digital com IA</p>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="text-xs"><BarChart3 className="h-3.5 w-3.5 mr-1" />Dashboard</TabsTrigger>
            <TabsTrigger value="campanhas" className="text-xs"><Megaphone className="h-3.5 w-3.5 mr-1" />Campanhas</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs"><LineChart className="h-3.5 w-3.5 mr-1" />Analytics</TabsTrigger>
            <TabsTrigger value="copywriter" className="text-xs"><PenTool className="h-3.5 w-3.5 mr-1" />Copywriter</TabsTrigger>
            <TabsTrigger value="criativos" className="text-xs"><Image className="h-3.5 w-3.5 mr-1" />Criativos</TabsTrigger>
            <TabsTrigger value="orcamento" className="text-xs"><Wallet className="h-3.5 w-3.5 mr-1" />Orçamento</TabsTrigger>
            <TabsTrigger value="abtests" className="text-xs"><FlaskConical className="h-3.5 w-3.5 mr-1" />A/B Tests</TabsTrigger>
            <TabsTrigger value="regras" className="text-xs"><Zap className="h-3.5 w-3.5 mr-1" />Regras</TabsTrigger>
            <TabsTrigger value="relatorios" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Relatórios</TabsTrigger>
            <TabsTrigger value="calendario" className="text-xs"><Calendar className="h-3.5 w-3.5 mr-1" />Calendário</TabsTrigger>
            <TabsTrigger value="agent" className="text-xs"><Bot className="h-3.5 w-3.5 mr-1" />MIDAS</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><MarketingDashboard /></TabsContent>
          <TabsContent value="campanhas"><MarketingCampaigns /></TabsContent>
          <TabsContent value="analytics"><MarketingAnalytics /></TabsContent>
          <TabsContent value="copywriter"><MarketingCopywriter /></TabsContent>
          <TabsContent value="criativos"><MarketingCreatives /></TabsContent>
          <TabsContent value="orcamento"><MarketingBudget /></TabsContent>
          <TabsContent value="abtests"><MarketingABTests /></TabsContent>
          <TabsContent value="regras"><MarketingRules /></TabsContent>
          <TabsContent value="relatorios"><MarketingReports /></TabsContent>
          <TabsContent value="calendario"><MarketingCalendar /></TabsContent>
          <TabsContent value="agent"><MarketingAgent /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

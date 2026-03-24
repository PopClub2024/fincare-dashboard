import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Target, DollarSign, MousePointer, Plus, Calendar } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function Marketing() {
  const { clinicaId } = useAuth();

  const { data: campanhas = [] } = useQuery({
    queryKey: ["campanhas", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("campanhas_marketing").select("*").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: postagens = [] } = useQuery({
    queryKey: ["postagens", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("calendario_postagens").select("*").eq("clinica_id", clinicaId).order("data_publicacao");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const totalImpress = campanhas.reduce((s: number, c: any) => s + (c.impressoes || 0), 0);
  const totalCliques = campanhas.reduce((s: number, c: any) => s + (c.cliques || 0), 0);
  const totalLeads = campanhas.reduce((s: number, c: any) => s + (c.leads || 0), 0);
  const totalConv = campanhas.reduce((s: number, c: any) => s + (c.agendamentos_convertidos || 0), 0);
  const totalGasto = campanhas.reduce((s: number, c: any) => s + (c.orcamento || 0), 0);
  const cpl = totalLeads > 0 ? totalGasto / totalLeads : 0;

  const canalData = campanhas.reduce((acc: any[], c: any) => {
    const existing = acc.find(a => a.canal === c.canal);
    if (existing) { existing.leads += c.leads || 0; existing.gasto += c.orcamento || 0; }
    else acc.push({ canal: c.canal || "Outro", leads: c.leads || 0, gasto: c.orcamento || 0 });
    return acc;
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">Marketing</h1><p className="text-sm text-muted-foreground">Campanhas, métricas e ROI</p></div>
          <div className="flex gap-2">
            <ExportButtons data={flattenForExport(campanhas, { Nome: "nome", Canal: "canal", Orcamento: "orcamento", Impressoes: "impressoes", Leads: "leads", Conversoes: "agendamentos_convertidos", ROI: "roi", Status: "status" })} filename="marketing" titulo="Campanhas de Marketing" />
            <Button><Plus className="h-4 w-4 mr-2" /> Nova Campanha</Button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Impressões", value: totalImpress.toLocaleString(), icon: TrendingUp, color: "text-blue-600" },
            { label: "Cliques", value: totalCliques.toLocaleString(), icon: MousePointer, color: "text-green-600" },
            { label: "Leads", value: totalLeads, icon: Target, color: "text-yellow-600" },
            { label: "Conversões", value: totalConv, icon: Target, color: "text-emerald-600" },
            { label: "Custo/Lead", value: `R$ ${cpl.toFixed(2)}`, icon: DollarSign, color: "text-red-600" },
          ].map((k) => (
            <Card key={k.label}><CardContent className="p-4"><k.icon className={`h-6 w-6 ${k.color} mb-2`} /><p className="text-xl font-bold">{k.value}</p><p className="text-xs text-muted-foreground">{k.label}</p></CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="campanhas">
          <TabsList>
            <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
            <TabsTrigger value="metricas">Métricas por Canal</TabsTrigger>
            <TabsTrigger value="calendario">Calendário</TabsTrigger>
          </TabsList>

          <TabsContent value="campanhas">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Campanha</TableHead><TableHead>Canal</TableHead><TableHead>Orçamento</TableHead><TableHead>Impressões</TableHead><TableHead>Leads</TableHead><TableHead>Conversões</TableHead><TableHead>ROI</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {campanhas.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell><Badge variant="outline">{c.canal}</Badge></TableCell>
                      <TableCell>R$ {Number(c.orcamento || 0).toFixed(2)}</TableCell>
                      <TableCell>{c.impressoes?.toLocaleString()}</TableCell>
                      <TableCell>{c.leads}</TableCell>
                      <TableCell>{c.agendamentos_convertidos}</TableCell>
                      <TableCell className={Number(c.roi) > 0 ? "text-green-600" : "text-red-600"}>{c.roi ? `${c.roi}%` : "—"}</TableCell>
                      <TableCell><Badge variant={c.status === "ativa" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="metricas">
            <div className="grid grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="text-sm">Leads por Canal</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={canalData}><XAxis dataKey="canal" /><YAxis /><Tooltip /><Bar dataKey="leads" fill="#3b82f6" radius={[4,4,0,0]} /></BarChart>
                </ResponsiveContainer>
              </CardContent></Card>
              <Card><CardHeader><CardTitle className="text-sm">Distribuição de Gasto</CardTitle></CardHeader><CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart><Pie data={canalData} dataKey="gasto" nameKey="canal" cx="50%" cy="50%" outerRadius={100} label>
                    {canalData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="calendario">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Título</TableHead><TableHead>Rede</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {postagens.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Nenhuma postagem agendada</TableCell></TableRow>
                  ) : postagens.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.data_publicacao), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="font-medium">{p.titulo}</TableCell>
                      <TableCell><Badge variant="outline">{p.rede_social}</Badge></TableCell>
                      <TableCell>{p.tipo}</TableCell>
                      <TableCell><Badge variant={p.publicado ? "default" : "secondary"}>{p.publicado ? "Publicado" : "Agendado"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

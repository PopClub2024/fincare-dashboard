import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ThumbsUp, ThumbsDown, Minus, TrendingUp } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

const COLORS = { promotor: "#10b981", neutro: "#f59e0b", detrator: "#ef4444" };

export default function NPS() {
  const { clinicaId } = useAuth();

  const { data: respostas = [] } = useQuery({
    queryKey: ["nps", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("nps_respostas").select("*, medicos(nome), pacientes(nome)").eq("clinica_id", clinicaId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const promotores = respostas.filter((r: any) => r.nota >= 9).length;
  const neutros = respostas.filter((r: any) => r.nota >= 7 && r.nota <= 8).length;
  const detratores = respostas.filter((r: any) => r.nota <= 6).length;
  const total = respostas.length;
  const npsScore = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : 0;

  const pieData = [
    { name: "Promotores", value: promotores, color: COLORS.promotor },
    { name: "Neutros", value: neutros, color: COLORS.neutro },
    { name: "Detratores", value: detratores, color: COLORS.detrator },
  ];

  // NPS por médico
  const npsPorMedico = respostas.reduce((acc: any, r: any) => {
    const nome = (r as any).medicos?.nome || "Sem médico";
    if (!acc[nome]) acc[nome] = { nome, notas: [] };
    acc[nome].notas.push(r.nota);
    return acc;
  }, {});

  const medicoData = Object.values(npsPorMedico).map((m: any) => {
    const p = m.notas.filter((n: number) => n >= 9).length;
    const d = m.notas.filter((n: number) => n <= 6).length;
    const t = m.notas.length;
    return { nome: m.nome, nps: t > 0 ? Math.round(((p - d) / t) * 100) : 0, total: t };
  }).sort((a: any, b: any) => b.nps - a.nps);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">NPS e Satisfacao</h1><p className="text-sm text-muted-foreground">Net Promoter Score da clinica</p></div>
          <ExportButtons data={flattenForExport(respostas, { Paciente: (r: any) => r.pacientes?.nome, Medico: (r: any) => r.medicos?.nome, Nota: "nota", Comentario: "comentario", Data: "created_at" })} filename="nps" titulo="NPS e Satisfacao" />
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card className="border-2"><CardContent className="p-6 text-center">
            <p className={`text-5xl font-bold ${npsScore >= 50 ? "text-green-600" : npsScore >= 0 ? "text-yellow-600" : "text-red-600"}`}>{npsScore}</p>
            <p className="text-sm text-muted-foreground mt-1">NPS Score</p>
          </CardContent></Card>
          {[
            { label: "Promotores (9-10)", value: promotores, icon: ThumbsUp, color: "text-green-600" },
            { label: "Neutros (7-8)", value: neutros, icon: Minus, color: "text-yellow-600" },
            { label: "Detratores (0-6)", value: detratores, icon: ThumbsDown, color: "text-red-600" },
          ].map((k) => (
            <Card key={k.label}><CardContent className="p-4 flex items-center gap-3"><k.icon className={`h-8 w-8 ${k.color}`} /><div><p className="text-2xl font-bold">{k.value}</p><p className="text-xs text-muted-foreground">{k.label}</p></div></CardContent></Card>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Card><CardHeader><CardTitle className="text-sm">Distribuição</CardTitle></CardHeader><CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </CardContent></Card>

          <Card><CardHeader><CardTitle className="text-sm">NPS por Médico</CardTitle></CardHeader><CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={medicoData}><XAxis dataKey="nome" /><YAxis /><Tooltip /><Bar dataKey="nps" fill="#3b82f6" radius={[4,4,0,0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent></Card>
        </div>

        {/* Últimos comentários */}
        <Card><CardHeader><CardTitle className="text-sm">Últimos Comentários</CardTitle></CardHeader><CardContent>
          <div className="space-y-3">
            {respostas.filter((r: any) => r.comentario).slice(0, 10).map((r: any) => (
              <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge variant={r.nota >= 9 ? "default" : r.nota >= 7 ? "secondary" : "destructive"}>{r.nota}</Badge>
                <div>
                  <p className="text-sm">{r.comentario}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(r as any).pacientes?.nome} — {(r as any).medicos?.nome}</p>
                </div>
              </div>
            ))}
            {respostas.filter((r: any) => r.comentario).length === 0 && (
              <p className="text-center text-muted-foreground py-4">Nenhum comentário ainda</p>
            )}
          </div>
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}

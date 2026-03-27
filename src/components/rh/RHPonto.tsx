import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Calendar, Search } from "lucide-react";

export default function RHPonto() {
  const { clinicaId } = useAuth();
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchColab, setSearchColab] = useState("");

  const { data: registros = [] } = useQuery({
    queryKey: ["registros-ponto", clinicaId, dateFilter],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("registros_ponto")
        .select("*, colaboradores(nome)")
        .eq("clinica_id", clinicaId)
        .gte("data_hora", dateFilter)
        .lt("data_hora", dateFilter + "T23:59:59")
        .order("data_hora", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const weekStart = format(startOfWeek(new Date(), { locale: ptBR }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { locale: ptBR }), "yyyy-MM-dd");

  const { data: registrosSemana = [] } = useQuery({
    queryKey: ["registros-ponto-semana", clinicaId, weekStart],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("registros_ponto")
        .select("*, colaboradores(nome)")
        .eq("clinica_id", clinicaId)
        .gte("data_hora", weekStart)
        .lte("data_hora", weekEnd + "T23:59:59")
        .order("data_hora", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const filtered = registros.filter((r: any) => {
    if (!searchColab) return true;
    return (r as any).colaboradores?.nome?.toLowerCase().includes(searchColab.toLowerCase());
  });

  const uniqueColabs = [...new Set(registrosSemana.map((r: any) => (r as any).colaboradores?.nome))].filter(Boolean);
  const totalRegistrosHoje = registros.length;
  const colabsHoje = new Set(registros.map((r: any) => r.colaborador_id)).size;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="h-6 w-6 text-blue-600" /><div><p className="text-xl font-bold">{totalRegistrosHoje}</p><p className="text-xs text-muted-foreground">Registros Hoje</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Calendar className="h-6 w-6 text-green-600" /><div><p className="text-xl font-bold">{colabsHoje}</p><p className="text-xs text-muted-foreground">Colaboradores Hoje</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="h-6 w-6 text-purple-600" /><div><p className="text-xl font-bold">{registrosSemana.length}</p><p className="text-xs text-muted-foreground">Registros Semana</p></div></CardContent></Card>
      </div>

      <div className="flex gap-3 items-center">
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-48" />
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar colaborador..." value={searchColab} onChange={(e) => setSearchColab(e.target.value)} className="pl-10" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Registros de {format(parseISO(dateFilter), "dd/MM/yyyy")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Perímetro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum registro nesta data</TableCell></TableRow>
              ) : filtered.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{(r as any).colaboradores?.nome || "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.tipo}</Badge></TableCell>
                  <TableCell>{format(new Date(r.data_hora), "HH:mm")}</TableCell>
                  <TableCell>
                    {r.dentro_perimetro === true ? <Badge variant="default">OK</Badge> : r.dentro_perimetro === false ? <Badge variant="destructive">Fora</Badge> : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {uniqueColabs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo Semanal</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {uniqueColabs.map((nome) => {
                const count = registrosSemana.filter((r: any) => (r as any).colaboradores?.nome === nome).length;
                return (
                  <div key={nome as string} className="rounded-lg border p-3">
                    <p className="font-medium text-sm truncate">{nome as string}</p>
                    <p className="text-xs text-muted-foreground">{count} registros</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { Send, CheckCircle, MessageSquare, Phone } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

export default function ConfirmacaoAgendamentos() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [dateFilter, setDateFilter] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["confirmacao-agendamentos", clinicaId, dateFilter],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("agendamentos")
        .select("*, pacientes(nome, telefone), medicos(nome, especialidade)")
        .eq("clinica_id", clinicaId)
        .gte("data_hora", dateFilter)
        .lt("data_hora", format(addDays(new Date(dateFilter), 1), "yyyy-MM-dd"))
        .order("data_hora");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const confirmarLote = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      for (const id of ids) {
        await supabase.from("agendamentos").update({ status: "confirmado" } as any).eq("id", id);
      }
    },
    onSuccess: () => {
      toast.success(`${selected.size} agendamento(s) confirmado(s)!`);
      queryClient.invalidateQueries({ queryKey: ["confirmacao-agendamentos"] });
      setSelected(new Set());
    },
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === agendamentos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(agendamentos.map((a: any) => a.id)));
    }
  };

  const stats = {
    total: agendamentos.length,
    confirmados: agendamentos.filter((a: any) => a.status === "confirmado").length,
    pendentes: agendamentos.filter((a: any) => a.status === "agendado" || a.status === "nao_confirmado").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Confirmação de Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Envio em lote de confirmação via WhatsApp</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Agendados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.pendentes}</p>
              <p className="text-xs text-muted-foreground">A confirmar</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats.confirmados}</p>
              <p className="text-xs text-muted-foreground">Confirmados ({stats.total > 0 ? Math.round(stats.confirmados / stats.total * 100) : 0}%)</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Ações */}
        <div className="flex items-center gap-4">
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-[200px]" />
          <Button variant="outline" onClick={selectAll}>
            {selected.size === agendamentos.length ? "Desmarcar todos" : "Selecionar todos"}
          </Button>
          <Button onClick={() => confirmarLote.mutate()} disabled={selected.size === 0}>
            <Send className="h-4 w-4 mr-2" /> Enviar Confirmação ({selected.size})
          </Button>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Médico</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : agendamentos.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Nenhum agendamento para esta data</TableCell></TableRow>
                ) : agendamentos.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleSelect(a.id)} />
                    </TableCell>
                    <TableCell className="font-mono">{format(new Date(a.data_hora), "HH:mm")}</TableCell>
                    <TableCell className="font-medium">{(a as any).pacientes?.nome}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {(a as any).pacientes?.telefone || "—"}
                      </span>
                    </TableCell>
                    <TableCell>{(a as any).medicos?.nome}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === "confirmado" ? "default" : "secondary"}>
                        {a.status === "confirmado" ? "Confirmado" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost">
                        <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, CheckCircle, Clock, DollarSign, Receipt, Printer, FileText } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function CheckIn() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("confirmado");
  const [reciboDialog, setReciboDialog] = useState(false);
  const [reciboData, setReciboData] = useState<any>(null);
  const [reciboTexto, setReciboTexto] = useState("");
  const reciboRef = useRef<HTMLDivElement>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  // Config da clínica
  const { data: clinica } = useQuery({
    queryKey: ["clinica-config", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return null;
      const { data } = await supabase.from("clinicas").select("*").eq("id", clinicaId).single();
      return data;
    },
    enabled: !!clinicaId,
  });

  const { data: agendamentos = [], isLoading } = useQuery({
    queryKey: ["checkin-agendamentos", clinicaId, today, statusFilter],
    queryFn: async () => {
      if (!clinicaId) return [];
      let q = supabase
        .from("agendamentos")
        .select("*, pacientes(id, nome, cpf, telefone, convenio_id, carteirinha, data_nascimento, email), medicos(id, nome, crm, especialidade)")
        .eq("clinica_id", clinicaId)
        .gte("data_hora", today)
        .lt("data_hora", today + "T23:59:59")
        .order("data_hora");
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      const { data } = await q;
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const fazerCheckin = useMutation({
    mutationFn: async ({ agendamento, formaPag, valorBruto }: { agendamento: any; formaPag: string; valorBruto: number }) => {
      const pac = agendamento.pacientes;
      const med = agendamento.medicos;
      const isConvenio = !!pac.convenio_id;

      // 1. Atualiza status do agendamento
      await supabase.from("agendamentos").update({ status: "checkin" } as any).eq("id", agendamento.id);

      // 2. Cria check-in
      const { data: checkin, error: chkErr } = await supabase.from("checkins").insert({
        clinica_id: clinicaId,
        agendamento_id: agendamento.id,
        paciente_id: pac.id,
        medico_id: med.id,
        sala_id: agendamento.sala_id,
        tipo_pagamento: formaPag,
        valor_bruto: valorBruto,
        pago: !isConvenio, // Particular paga no ato
      } as any).select("id").single();
      if (chkErr) throw chkErr;

      // 3. Registrar na conta do paciente
      await supabase.from("conta_paciente").insert({
        clinica_id: clinicaId,
        paciente_id: pac.id,
        checkin_id: checkin!.id,
        agendamento_id: agendamento.id,
        tipo: "pagamento",
        descricao: `Consulta ${med.especialidade} — Dr(a). ${med.nome}`,
        medico_nome: med.nome,
        especialidade: med.especialidade,
        procedimento: agendamento.procedimento_id ? "Procedimento" : "Consulta",
        valor_bruto: valorBruto,
        forma_pagamento: formaPag,
        data_pagamento: today,
        pago: !isConvenio,
      } as any);

      // 4. Se convênio: gerar guia TISS automaticamente
      if (isConvenio) {
        await supabase.from("guias_tiss").insert({
          clinica_id: clinicaId,
          paciente_id: pac.id,
          medico_id: med.id,
          convenio_id: pac.convenio_id,
          agendamento_id: agendamento.id,
          checkin_id: checkin!.id,
          tipo: "consulta",
          tipo_guia: "consulta",
          codigo_procedimento: "10101012", // Consulta em consultório
          numero_carteirinha: pac.carteirinha || "",
          crm_medico: med.crm || "",
          nome_paciente: pac.nome,
          cpf_paciente: pac.cpf,
          data_nascimento_paciente: pac.data_nascimento,
          nome_profissional: med.nome,
          uf_conselho: "DF",
          nome_contratado: clinica?.nome || "Medic Pop",
          data_atendimento: today,
          tipo_consulta: "primeira",
          codigo_tabela: "22",
          valor_procedimento: valorBruto,
          quantidade: 1,
          valor_total: valorBruto,
          tipo_atendimento: "05",
          carater_atendimento: "1",
          regime_atendimento: "01",
          status: "gerada",
          dados_preenchidos: {
            paciente: { nome: pac.nome, cpf: pac.cpf, carteirinha: pac.carteirinha, nascimento: pac.data_nascimento },
            medico: { nome: med.nome, crm: med.crm, especialidade: med.especialidade },
            procedimento: { codigo: "10101012", descricao: "Consulta em consultório", tabela: "22" },
          },
        } as any);
      }

      return { checkinId: checkin!.id, agendamento, isConvenio };
    },
    onSuccess: (result) => {
      toast.success("Check-in realizado!" + (result.isConvenio ? " Guia TISS gerada automaticamente." : ""));
      queryClient.invalidateQueries({ queryKey: ["checkin-agendamentos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Gerar recibo
  const gerarRecibo = async (agendamento: any, tipo: "paciente" | "medico") => {
    const pac = agendamento.pacientes;
    const med = agendamento.medicos;
    const valor = agendamento.valor_previsto || 0;

    const textoDefault = tipo === "paciente"
      ? `Recebi de ${pac.nome}, CPF ${pac.cpf || "___"}, a quantia de ${formatCurrency(valor)} referente a consulta de ${med.especialidade} realizada em ${format(new Date(), "dd/MM/yyyy")} pelo(a) Dr(a). ${med.nome}, CRM ${med.crm || "___"}.`
      : `Recibo de honorários médicos. Dr(a). ${med.nome}, CRM ${med.crm || "___"}, recebeu a quantia de ${formatCurrency(valor)} referente ao atendimento de ${pac.nome} em ${format(new Date(), "dd/MM/yyyy")}, especialidade ${med.especialidade}.`;

    setReciboData({ agendamento, tipo, pac, med, valor });
    setReciboTexto(textoDefault);
    setReciboDialog(true);
  };

  const salvarRecibo = async () => {
    if (!reciboData || !clinicaId) return;
    const { pac, med, valor, tipo, agendamento } = reciboData;

    const { data: recibo, error } = await supabase.from("recibos").insert({
      clinica_id: clinicaId,
      paciente_id: pac.id,
      medico_id: med.id,
      valor,
      tipo,
      procedimento: `Consulta ${med.especialidade}`,
      descricao: `Consulta — ${med.especialidade}`,
      forma_pagamento: agendamento.tipo_pagamento || "particular_dinheiro",
      nome_paciente: pac.nome,
      cpf_paciente: pac.cpf,
      nome_medico: med.nome,
      crm_medico: med.crm,
      especialidade: med.especialidade,
      data_atendimento: today,
      texto_corpo: reciboTexto,
    } as any).select("id").single();

    if (error) { toast.error(error.message); return; }

    // Vincular na conta do paciente
    await supabase.from("conta_paciente")
      .update({ recibo_id: recibo!.id } as any)
      .eq("paciente_id", pac.id)
      .eq("agendamento_id", agendamento.id);

    toast.success("Recibo salvo no histórico!");
    setReciboDialog(false);
  };

  const imprimirRecibo = () => {
    if (!reciboRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const { pac, med, valor, tipo } = reciboData;
    win.document.write(`
      <html><head><title>Recibo</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { font-size: 18px; margin: 0; }
        .header p { font-size: 12px; color: #666; margin: 4px 0 0; }
        .recibo-num { text-align: right; font-size: 12px; color: #999; margin-bottom: 20px; }
        .corpo { font-size: 14px; line-height: 1.8; margin: 20px 0; }
        .valor { font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .dados { font-size: 11px; color: #666; margin-top: 30px; }
        .dados div { margin: 4px 0; }
        .assinatura { margin-top: 60px; text-align: center; }
        .assinatura .linha { border-top: 1px solid #333; width: 300px; margin: 0 auto; padding-top: 5px; font-size: 12px; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <h1>${clinica?.nome || "Medic Pop"}</h1>
        <p>${clinica?.endereco || ""} ${clinica?.telefone ? "| " + clinica.telefone : ""}</p>
        <p>CNPJ: ${clinica?.cnpj || "___"}</p>
      </div>
      <div class="recibo-num">Recibo ${tipo === "paciente" ? "ao Paciente" : "Médico"}</div>
      <div class="valor">${formatCurrency(valor)}</div>
      <div class="corpo">${reciboTexto}</div>
      <div class="dados">
        <div><strong>Paciente:</strong> ${pac.nome} | CPF: ${pac.cpf || "___"}</div>
        <div><strong>Médico(a):</strong> Dr(a). ${med.nome} | CRM: ${med.crm || "___"} | ${med.especialidade}</div>
        <div><strong>Data:</strong> ${format(new Date(), "dd/MM/yyyy")}</div>
      </div>
      <div class="assinatura">
        <div class="linha">${tipo === "paciente" ? clinica?.nome || "Clínica" : `Dr(a). ${med.nome} — CRM ${med.crm || "___"}`}</div>
      </div>
      <div class="footer">Documento gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} — ${clinica?.nome || "Medic Pop"}</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const filtered = agendamentos.filter((a: any) =>
    (a as any).pacientes?.nome?.toLowerCase().includes(search.toLowerCase()) ||
    (a as any).pacientes?.cpf?.includes(search)
  );

  const stats = {
    total: agendamentos.length,
    confirmados: agendamentos.filter((a: any) => a.status === "confirmado").length,
    checkins: agendamentos.filter((a: any) => a.status === "checkin").length,
    atendidos: agendamentos.filter((a: any) => a.status === "atendido").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Check-in de Pacientes</h1>
          <p className="text-sm text-muted-foreground">Recepcao — {format(new Date(), "dd/MM/yyyy")} | Gera automaticamente: registro financeiro + guia TISS (convenio)</p>
        </div>
        <ExportButtons data={flattenForExport(filtered, { Horario: (r: any) => format(new Date(r.data_hora), "HH:mm"), Paciente: (r: any) => r.pacientes?.nome, Medico: (r: any) => r.medicos?.nome, Tipo: (r: any) => r.pacientes?.convenio_id ? "Convenio" : "Particular", Valor: "valor_previsto", Status: "status" })} filename="checkin" titulo="Check-in" />

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Agendados", value: stats.total, icon: Clock, color: "text-blue-600" },
            { label: "Confirmados", value: stats.confirmados, icon: CheckCircle, color: "text-green-600" },
            { label: "Check-ins", value: stats.checkins, icon: CheckCircle, color: "text-teal-600" },
            { label: "Atendidos", value: stats.atendidos, icon: DollarSign, color: "text-emerald-600" },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
                <div><p className="text-2xl font-bold">{kpi.value}</p><p className="text-xs text-muted-foreground">{kpi.label}</p></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="confirmado">Confirmados</SelectItem>
              <SelectItem value="agendado">Agendados</SelectItem>
              <SelectItem value="checkin">Check-in feito</SelectItem>
              <SelectItem value="atendido">Atendidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Horario</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8">Nenhum agendamento</TableCell></TableRow>
                ) : filtered.map((a: any) => {
                  const pac = (a as any).pacientes;
                  const med = (a as any).medicos;
                  const isConvenio = !!pac?.convenio_id;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{format(new Date(a.data_hora), "HH:mm")}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{pac?.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{pac?.cpf}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{med?.nome}</p>
                          <p className="text-[10px] text-muted-foreground">{med?.especialidade}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isConvenio ? "default" : "outline"}>
                          {isConvenio ? "Convenio" : "Particular"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{a.valor_previsto ? formatCurrency(Number(a.valor_previsto)) : "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{a.status?.replace("_", " ")}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(a.status === "confirmado" || a.status === "agendado") && (
                            <Button size="sm" onClick={() => fazerCheckin.mutate({
                              agendamento: a,
                              formaPag: isConvenio ? "convenio" : "particular_dinheiro",
                              valorBruto: Number(a.valor_previsto) || 0,
                            })}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Check-in
                            </Button>
                          )}
                          {(a.status === "checkin" || a.status === "atendido") && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => gerarRecibo(a, "paciente")}>
                                <Receipt className="h-3 w-3 mr-1" /> Recibo Pac.
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => gerarRecibo(a, "medico")}>
                                <FileText className="h-3 w-3 mr-1" /> Recibo Med.
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Dialog de Recibo */}
        <Dialog open={reciboDialog} onOpenChange={setReciboDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {reciboData?.tipo === "paciente" ? "Recibo ao Paciente" : "Recibo Medico"}
              </DialogTitle>
            </DialogHeader>
            {reciboData && (
              <div className="space-y-4" ref={reciboRef}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><Label className="text-xs">Paciente</Label><p className="font-medium">{reciboData.pac.nome}</p></div>
                  <div><Label className="text-xs">CPF</Label><p>{reciboData.pac.cpf || "—"}</p></div>
                  <div><Label className="text-xs">Medico(a)</Label><p className="font-medium">Dr(a). {reciboData.med.nome}</p></div>
                  <div><Label className="text-xs">CRM</Label><p>{reciboData.med.crm || "—"}</p></div>
                  <div><Label className="text-xs">Especialidade</Label><p>{reciboData.med.especialidade}</p></div>
                  <div><Label className="text-xs">Valor</Label><p className="text-lg font-bold">{formatCurrency(reciboData.valor)}</p></div>
                </div>

                <div>
                  <Label className="text-xs">Texto do recibo (editavel)</Label>
                  <Textarea rows={5} value={reciboTexto} onChange={(e) => setReciboTexto(e.target.value)} />
                </div>

                <div className="flex gap-2">
                  <Button onClick={async () => { await salvarRecibo(); }} className="flex-1">
                    <Receipt className="h-4 w-4 mr-2" /> Salvar Recibo
                  </Button>
                  <Button variant="outline" onClick={() => { salvarRecibo().then(() => imprimirRecibo()); }}>
                    <Printer className="h-4 w-4 mr-2" /> Salvar & Imprimir
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

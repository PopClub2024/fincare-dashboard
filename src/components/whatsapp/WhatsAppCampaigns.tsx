import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Send, Users, FileSpreadsheet, Image, Trash2, X } from "lucide-react";

export default function WhatsAppCampaigns() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  const [campanha, setCampanha] = useState({ nome: "", mensagem: "", imagemFile: null as File | null });
  const [contatosCampanha, setContatosCampanha] = useState<any[]>([]);
  const [filtroPacientes, setFiltroPacientes] = useState("todos");
  const [enviandoCampanha, setEnviandoCampanha] = useState(false);
  const [progressoCampanha, setProgressoCampanha] = useState(0);

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes-whatsapp", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("pacientes").select("id, nome, telefone, convenio_id, sexo").eq("clinica_id", clinicaId).not("telefone", "is", null).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp-templates", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("whatsapp_templates").select("*").eq("clinica_id", clinicaId).order("tipo");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const carregarPacientes = () => {
    let filtrados = pacientes;
    if (filtroPacientes === "convenio") filtrados = pacientes.filter((p: any) => p.convenio_id);
    if (filtroPacientes === "particular") filtrados = pacientes.filter((p: any) => !p.convenio_id);
    const tels = new Set(contatosCampanha.map((c: any) => c.telefone));
    const novos = filtrados.filter((p: any) => !tels.has(p.telefone)).map((p: any) => ({ nome: p.nome, telefone: p.telefone, origem: "paciente", selecionado: true }));
    setContatosCampanha([...contatosCampanha, ...novos]);
    toast.success(`${novos.length} contatos adicionados`);
  };

  const importarPlanilha = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = (ev.target?.result as string).split("\n").filter(l => l.trim());
      const sep = lines[0]?.includes(";") ? ";" : ",";
      const novos: any[] = [];
      const tels = new Set(contatosCampanha.map((c: any) => c.telefone));
      for (let i = 0; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/"/g, ""));
        if (i === 0 && cols.join(" ").toLowerCase().match(/nome|telefone|phone/)) continue;
        let telefone = "", nome = "";
        for (const col of cols) {
          const d = col.replace(/\D/g, "");
          if (d.length >= 10 && !telefone) telefone = d;
          else if (col.length > 2 && !nome && !/^\d+$/.test(col)) nome = col;
        }
        if (telefone && !tels.has(telefone)) { novos.push({ nome: nome || `Contato ${i}`, telefone, origem: "importado", selecionado: true }); tels.add(telefone); }
      }
      setContatosCampanha([...contatosCampanha, ...novos]);
      toast.success(`${novos.length} importados`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const enviarCampanha = async () => {
    const selecionados = contatosCampanha.filter(c => c.selecionado);
    if (!selecionados.length || !campanha.mensagem) return;
    if (!confirm(`Enviar para ${selecionados.length} contatos?`)) return;
    setEnviandoCampanha(true);
    setProgressoCampanha(0);
    for (let i = 0; i < selecionados.length; i += 50) {
      const batch = selecionados.slice(i, i + 50);
      await supabase.from("whatsapp_mensagens").insert(batch.map(c => ({
        clinica_id: clinicaId, tipo: "agendamento", telefone: c.telefone,
        mensagem: campanha.mensagem.replace("{{nome}}", c.nome), status: "pendente"
      })) as any);
      setProgressoCampanha(Math.min(((i + 50) / selecionados.length) * 100, 100));
    }
    setEnviandoCampanha(false);
    toast.success(`${selecionados.length} mensagens na fila!`);
    queryClient.invalidateQueries({ queryKey: ["whatsapp-mensagens"] });
  };

  const selecionados = contatosCampanha.filter(c => c.selecionado);

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mensagem</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={campanha.nome} onChange={(e) => setCampanha({ ...campanha, nome: e.target.value })} placeholder="Nome da campanha" />
            <Textarea rows={4} value={campanha.mensagem} onChange={(e) => setCampanha({ ...campanha, mensagem: e.target.value })} placeholder="Olá {{nome}}..." />
            {templates.length > 0 && (
              <Select onValueChange={(v) => { const t = templates.find((t: any) => t.id === v); if (t) setCampanha({ ...campanha, mensagem: (t as any).mensagem }); }}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Usar template" /></SelectTrigger>
                <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
        <Button className="w-full" onClick={enviarCampanha} disabled={enviandoCampanha || !campanha.mensagem || !selecionados.length}>
          <Send className="h-4 w-4 mr-2" /> Enviar ({selecionados.length})
        </Button>
        {enviandoCampanha && <Progress value={progressoCampanha} />}
      </div>

      <div className="col-span-2 space-y-3">
        <Card>
          <CardContent className="p-3 flex gap-2 flex-wrap">
            <Select value={filtroPacientes} onValueChange={setFiltroPacientes}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="convenio">Convênio</SelectItem>
                <SelectItem value="particular">Particular</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={carregarPacientes}><Users className="h-3 w-3 mr-1" /> Pacientes</Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-3 w-3 mr-1" /> CSV</Button>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" className="hidden" onChange={importarPlanilha} />
            {contatosCampanha.length > 0 && (
              <>
                <Badge variant="outline" className="text-xs">{selecionados.length}/{contatosCampanha.length} selecionados</Badge>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setContatosCampanha([])}>
                  <Trash2 className="h-3 w-3 mr-1" /> Limpar
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {contatosCampanha.length > 0 && (
          <Card>
            <CardContent className="p-0 max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contatosCampanha.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Checkbox checked={c.selecionado} onCheckedChange={(v) => {
                          const novo = [...contatosCampanha];
                          novo[i].selecionado = !!v;
                          setContatosCampanha(novo);
                        }} />
                      </TableCell>
                      <TableCell className="text-xs">{c.nome}</TableCell>
                      <TableCell className="text-xs font-mono">{c.telefone}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px]">{c.origem}</Badge></TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setContatosCampanha(contatosCampanha.filter((_, j) => j !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

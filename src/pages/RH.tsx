import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Users, Plus, Clock, Calendar, FileText, MapPin, Search, Upload, Eye, Trash2 } from "lucide-react";
import { ACCEPT_DOCUMENTOS, uploadFile } from "@/lib/file-upload";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

export default function RH() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", cpf: "", cargo: "", area: "", tipo_vinculo: "clt", salario: "", data_admissao: "", telefone: "", email: "" });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("colaboradores").select("*").eq("clinica_id", clinicaId).order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: registrosPonto = [] } = useQuery({
    queryKey: ["registros-ponto", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase.from("registros_ponto").select("*, colaboradores(nome)").eq("clinica_id", clinicaId).gte("data_hora", today).order("data_hora", { ascending: false });
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const criarColaborador = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("colaboradores").insert({
        clinica_id: clinicaId,
        nome: form.nome,
        cpf: form.cpf || null,
        cargo: form.cargo || null,
        area: form.area || null,
        tipo_vinculo: form.tipo_vinculo,
        salario: form.salario ? parseFloat(form.salario) : null,
        data_admissao: form.data_admissao || null,
        telefone: form.telefone || null,
        email: form.email || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["colaboradores"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const stats = {
    ativos: colaboradores.filter((c: any) => c.status === "ativo").length,
    ferias: colaboradores.filter((c: any) => c.status === "ferias").length,
    afastados: colaboradores.filter((c: any) => c.status === "afastado").length,
    total: colaboradores.length,
  };

  const filtered = colaboradores.filter((c: any) => c.nome?.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Recursos Humanos</h1>
            <p className="text-sm text-muted-foreground">Gestão de colaboradores, escalas e ponto</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Colaborador</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Cadastrar Colaborador</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
                <div><Label>Cargo</Label><Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
                <div><Label>Área</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></div>
                <div>
                  <Label>Vínculo</Label>
                  <Select value={form.tipo_vinculo} onValueChange={(v) => setForm({ ...form, tipo_vinculo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clt">CLT</SelectItem>
                      <SelectItem value="pj">PJ</SelectItem>
                      <SelectItem value="autonomo">Autônomo</SelectItem>
                      <SelectItem value="estagiario">Estagiário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Salário</Label><Input type="number" value={form.salario} onChange={(e) => setForm({ ...form, salario: e.target.value })} /></div>
                <div><Label>Admissão</Label><Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <Button onClick={() => criarColaborador.mutate()} disabled={!form.nome} className="mt-4 w-full">Cadastrar</Button>
            </DialogContent>
          </Dialog>
        </div>

        <ExportButtons data={flattenForExport(colaboradores, { Nome: "nome", Cargo: "cargo", Area: "area", Vinculo: "tipo_vinculo", Status: "status" })} filename="rh-colaboradores" titulo="Colaboradores" />
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, icon: Users, color: "text-blue-600" },
            { label: "Ativos", value: stats.ativos, icon: Users, color: "text-green-600" },
            { label: "Férias", value: stats.ferias, icon: Calendar, color: "text-yellow-600" },
            { label: "Afastados", value: stats.afastados, icon: Users, color: "text-red-600" },
          ].map((k) => (
            <Card key={k.label}><CardContent className="p-4 flex items-center gap-3"><k.icon className={`h-8 w-8 ${k.color}`} /><div><p className="text-2xl font-bold">{k.value}</p><p className="text-xs text-muted-foreground">{k.label}</p></div></CardContent></Card>
          ))}
        </div>

        <Tabs defaultValue="colaboradores">
          <TabsList>
            <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
            <TabsTrigger value="ponto">Ponto Hoje</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="escalas">Escalas</TabsTrigger>
          </TabsList>

          <TabsContent value="colaboradores">
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Área</TableHead>
                      <TableHead>Vínculo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Admissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell>{c.cargo || "—"}</TableCell>
                        <TableCell>{c.area || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{c.tipo_vinculo}</Badge></TableCell>
                        <TableCell><Badge variant={c.status === "ativo" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                        <TableCell>{c.data_admissao ? format(new Date(c.data_admissao), "dd/MM/yyyy") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ponto">
            <Card>
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
                    {registrosPonto.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8">Nenhum registro hoje</TableCell></TableRow>
                    ) : registrosPonto.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{(r as any).colaboradores?.nome}</TableCell>
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
          </TabsContent>

          <TabsContent value="documentos">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Repositorio de Documentos</CardTitle>
                <p className="text-sm text-muted-foreground">Upload de contratos, RG, CPF, CTPS, ASO, CRM, certificados, diplomas por colaborador</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="rh-doc-upload" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    <Upload className="h-5 w-5" />
                    Enviar documentos (PDF, DOC, imagens, fotos, HEIC, TIFF, qualquer formato)
                  </Label>
                  <Input
                    id="rh-doc-upload"
                    type="file"
                    accept={ACCEPT_DOCUMENTOS}
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files || !clinicaId) return;
                      for (const file of Array.from(files)) {
                        try {
                          const result = await uploadFile("documentos", clinicaId, file, "rh");
                          await supabase.from("colaborador_documentos").insert({
                            clinica_id: clinicaId,
                            nome: file.name,
                            tipo: file.type,
                            url: result.url,
                            tamanho: file.size,
                          } as any);
                          toast.success(`${file.name} enviado!`);
                        } catch (err: any) {
                          toast.error(err.message);
                        }
                      }
                      e.target.value = "";
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Aceita: PDF, DOC, DOCX, XLS, XLSX, imagens (JPG, PNG, HEIC, TIFF, BMP, WebP), TXT, RTF, ODS, ODT</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="escalas">
            <Card><CardContent className="p-8 text-center text-muted-foreground">Calendario de escalas — configure escalas por colaborador, turno e dia da semana.</CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

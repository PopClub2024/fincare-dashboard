import { useState, useRef } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ACCEPT_DOCUMENTOS } from "@/lib/file-upload";
import { uploadFile } from "@/lib/file-upload";
import { FileText, Plus, AlertTriangle, Search, Upload, Eye, Trash2, Download, FileSignature } from "lucide-react";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

const STATUS_COLOR: Record<string, string> = { vigente: "default", vencido: "destructive", proximo_vencimento: "secondary", irregular: "destructive" };

export default function Contratos() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedContrato, setSelectedContrato] = useState<any>(null);
  const [form, setForm] = useState({
    nome_prestador: "", cnpj: "", tipo: "", data_assinatura: "",
    data_vigencia: "", valor: "", crm: "", seguro_rc: "",
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("contratos_prestadores").select("*, medicos(nome)").eq("clinica_id", clinicaId).order("data_vigencia");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Documentos do contrato selecionado
  const { data: documentos = [] } = useQuery({
    queryKey: ["contrato-docs", selectedContrato?.id],
    queryFn: async () => {
      if (!selectedContrato?.id || !clinicaId) return [];
      const { data } = await supabase
        .from("contrato_documentos")
        .select("*")
        .eq("contrato_id", selectedContrato.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedContrato?.id,
  });

  const criarContrato = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contratos_prestadores").insert({
        clinica_id: clinicaId,
        nome_prestador: form.nome_prestador,
        cnpj: form.cnpj || null,
        tipo: form.tipo || null,
        data_assinatura: form.data_assinatura || null,
        data_vigencia: form.data_vigencia || null,
        valor: form.valor ? parseFloat(form.valor) : null,
        crm: form.crm || null,
        seguro_rc: form.seguro_rc || null,
        status: "vigente",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contrato cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedContrato || !clinicaId) return;
    const files = e.target.files;
    if (!files) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      try {
        const result = await uploadFile("documentos", clinicaId, file, `contratos/${selectedContrato.id}`);
        await supabase.from("contrato_documentos").insert({
          clinica_id: clinicaId,
          contrato_id: selectedContrato.id,
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

    setUploading(false);
    e.target.value = "";
    queryClient.invalidateQueries({ queryKey: ["contrato-docs"] });
  };

  const vencidos = contratos.filter((c: any) => c.status === "vencido" || (c.data_vigencia && new Date(c.data_vigencia) < new Date()));
  const proximos = contratos.filter((c: any) => c.data_vigencia && differenceInDays(new Date(c.data_vigencia), new Date()) <= 30 && differenceInDays(new Date(c.data_vigencia), new Date()) > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">Contratos de Prestadores</h1><p className="text-sm text-muted-foreground">Gestao administrativo-juridica com repositorio digital</p></div>
          <div className="flex gap-2">
            {vencidos.length > 0 && <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />{vencidos.length} vencido(s)</Badge>}
            {proximos.length > 0 && <Badge variant="secondary">{proximos.length} proximo(s)</Badge>}
            <ExportButtons data={flattenForExport(contratos, { Prestador: "nome_prestador", CNPJ: "cnpj", Tipo: "tipo", Vigencia: "data_vigencia", Valor: "valor", Status: "status" })} filename="contratos" titulo="Contratos de Prestadores" />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Novo Contrato</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Cadastrar Contrato</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><Label>Prestador *</Label><Input value={form.nome_prestador} onChange={(e) => setForm({ ...form, nome_prestador: e.target.value })} /></div>
                  <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
                  <div><Label>CRM</Label><Input value={form.crm} onChange={(e) => setForm({ ...form, crm: e.target.value })} /></div>
                  <div><Label>Tipo</Label><Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="PJ, CLT, Autônomo" /></div>
                  <div><Label>Seguro RC</Label><Input value={form.seguro_rc} onChange={(e) => setForm({ ...form, seguro_rc: e.target.value })} /></div>
                  <div><Label>Data Assinatura</Label><Input type="date" value={form.data_assinatura} onChange={(e) => setForm({ ...form, data_assinatura: e.target.value })} /></div>
                  <div><Label>Vigencia</Label><Input type="date" value={form.data_vigencia} onChange={(e) => setForm({ ...form, data_vigencia: e.target.value })} /></div>
                  <div><Label>Valor (R$)</Label><Input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
                </div>
                <Button onClick={() => criarContrato.mutate()} disabled={!form.nome_prestador} className="w-full mt-4">Cadastrar</Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>

        <div className="grid grid-cols-3 gap-6">
          {/* Lista de contratos */}
          <div className="col-span-2">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Prestador</TableHead><TableHead>CNPJ</TableHead><TableHead>Vigencia</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {contratos.filter((c: any) => c.nome_prestador?.toLowerCase().includes(search.toLowerCase())).map((c: any) => (
                    <TableRow key={c.id} className={selectedContrato?.id === c.id ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{c.nome_prestador}</TableCell>
                      <TableCell className="text-xs">{c.cnpj || "—"}</TableCell>
                      <TableCell className="text-xs">{c.data_vigencia ? format(new Date(c.data_vigencia), "dd/MM/yy") : "—"}</TableCell>
                      <TableCell>{c.valor ? `R$ ${Number(c.valor).toFixed(2)}` : "—"}</TableCell>
                      <TableCell><Badge variant={STATUS_COLOR[c.status] as any || "outline"}>{c.status}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedContrato(c)}>
                          <FileText className="h-3 w-3 mr-1" /> Docs
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </div>

          {/* Documentos do contrato */}
          <div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileSignature className="h-4 w-4" />
                  {selectedContrato ? `Documentos — ${selectedContrato.nome_prestador}` : "Selecione um contrato"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedContrato && (
                  <>
                    <div>
                      <Label htmlFor="contrato-doc-upload" className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                        <Upload className="h-4 w-4" />
                        {uploading ? "Enviando..." : "Enviar documentos (contrato, CNPJ, CRM, seguro RC, aditivos...)"}
                      </Label>
                      <Input
                        id="contrato-doc-upload"
                        type="file"
                        accept={ACCEPT_DOCUMENTOS}
                        multiple
                        className="hidden"
                        onChange={handleUploadDoc}
                        disabled={uploading}
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Aceita: PDF, DOC, DOCX, XLS, imagens, fotos (JPG, PNG, HEIC, TIFF, BMP, WebP)</p>
                    </div>
                    {documentos.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum documento</p>
                    ) : documentos.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between rounded border p-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs truncate">{doc.nome}</span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(doc.url, "_blank")}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={async () => {
                            await supabase.from("contrato_documentos").delete().eq("id", doc.id);
                            queryClient.invalidateQueries({ queryKey: ["contrato-docs"] });
                            toast.success("Removido");
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, ArrowLeft, Cake, Receipt, Printer, Phone, Mail, MapPin, User,
  ClipboardList, Calendar, Clock, FileText, DollarSign, Search
} from "lucide-react";
import { format, differenceInYears, parseISO } from "date-fns";
import { KpiCards, FilterPills, StatusBadge, PageHeader, DataTable, formatCurrency } from "@/components/medicpop";
import CnpjLookupInput from "@/components/CnpjLookupInput";
import { buscarCEP } from "@/lib/cnpj-lookup";
import ExportButtons from "@/components/ExportButtons";
import { flattenForExport } from "@/lib/export-utils";

// -------------------------------------------------------
// Types
// -------------------------------------------------------
type SidebarSection = "dados" | "conta" | "agendamentos" | "recibos" | "timeline";

const SIDEBAR_ITEMS: { key: SidebarSection; label: string; icon: React.ReactNode }[] = [
  { key: "dados", label: "Dados Principais", icon: <User className="h-4 w-4" /> },
  { key: "conta", label: "Conta", icon: <DollarSign className="h-4 w-4" /> },
  { key: "agendamentos", label: "Agendamentos", icon: <Calendar className="h-4 w-4" /> },
  { key: "recibos", label: "Recibos", icon: <Receipt className="h-4 w-4" /> },
  { key: "timeline", label: "Linha do Tempo", icon: <Clock className="h-4 w-4" /> },
];

// -------------------------------------------------------
// Avatar with initials
// -------------------------------------------------------
function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
  return (
    <div
      className="flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: "#1B5E7B", fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

// -------------------------------------------------------
// Section block used inside Dados Principais
// -------------------------------------------------------
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "#1B5E7B" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[12px]" style={{ color: "#666" }}>{label}</Label>
      {children}
    </div>
  );
}

// -------------------------------------------------------
// Main component
// -------------------------------------------------------
export default function Pacientes() {
  const { clinicaId } = useAuth();
  const queryClient = useQueryClient();

  // List state
  const [search, setSearch] = useState("");
  const [activePill, setActivePill] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);

  // New patient form
  const [form, setForm] = useState({
    nome: "", cpf: "", telefone: "", email: "", data_nascimento: "", sexo: "",
    convenio_id: "", carteirinha: "", observacoes: "",
    cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
  });
  const [cepLoading, setCepLoading] = useState(false);

  // Detail view state
  const [selectedPaciente, setSelectedPaciente] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<SidebarSection>("dados");

  // Edit form for patient detail
  const [editForm, setEditForm] = useState<any>(null);
  const [editCepLoading, setEditCepLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------
  // Queries
  // -------------------------------------------------------
  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ["pacientes", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("pacientes")
        .select("*")
        .eq("clinica_id", clinicaId)
        .order("nome");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const { data: contaPaciente = [] } = useQuery({
    queryKey: ["conta-paciente", selectedPaciente?.id],
    queryFn: async () => {
      if (!selectedPaciente?.id) return [];
      const { data } = await supabase
        .from("conta_paciente")
        .select("*, recibos(id, texto_corpo, arquivo_url)")
        .eq("paciente_id", selectedPaciente.id)
        .order("data_pagamento", { ascending: false });
      return data || [];
    },
    enabled: !!selectedPaciente?.id,
  });

  const { data: recibosPaciente = [] } = useQuery({
    queryKey: ["recibos-paciente", selectedPaciente?.id],
    queryFn: async () => {
      if (!selectedPaciente?.id) return [];
      const { data } = await supabase
        .from("recibos")
        .select("*")
        .eq("paciente_id", selectedPaciente.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedPaciente?.id,
  });

  const { data: agendamentosPaciente = [] } = useQuery({
    queryKey: ["agendamentos-paciente", selectedPaciente?.id],
    queryFn: async () => {
      if (!selectedPaciente?.id) return [];
      const { data } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", selectedPaciente.id)
        .order("data_hora", { ascending: false });
      return data || [];
    },
    enabled: !!selectedPaciente?.id,
  });

  // -------------------------------------------------------
  // Mutations
  // -------------------------------------------------------
  const createPaciente = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pacientes").insert({
        clinica_id: clinicaId,
        nome: form.nome,
        cpf: form.cpf || null,
        telefone: form.telefone || null,
        email: form.email || null,
        data_nascimento: form.data_nascimento || null,
        sexo: form.sexo || null,
        carteirinha: form.carteirinha || null,
        observacoes: form.observacoes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paciente cadastrado!");
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      setDialogOpen(false);
      setForm({
        nome: "", cpf: "", telefone: "", email: "", data_nascimento: "", sexo: "",
        convenio_id: "", carteirinha: "", observacoes: "",
        cep: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "",
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // -------------------------------------------------------
  // Derived data
  // -------------------------------------------------------
  const aniversariantes = pacientes.filter((p: any) => {
    if (!p.data_nascimento) return false;
    const d = parseISO(p.data_nascimento);
    const today = new Date();
    return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  });

  const convenioCount = pacientes.filter((p: any) => p.convenio_id).length;
  const particularCount = pacientes.filter((p: any) => !p.convenio_id).length;

  const filtered = pacientes.filter((p: any) => {
    const matchSearch =
      p.nome?.toLowerCase().includes(search.toLowerCase()) ||
      p.cpf?.includes(search) ||
      p.telefone?.includes(search);
    if (!matchSearch) return false;
    if (activePill === "convenio") return !!p.convenio_id;
    if (activePill === "particular") return !p.convenio_id;
    if (activePill === "aniversariantes") {
      if (!p.data_nascimento) return false;
      const d = parseISO(p.data_nascimento);
      const today = new Date();
      return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    }
    return true;
  });

  // -------------------------------------------------------
  // CEP auto-fill (new patient dialog)
  // -------------------------------------------------------
  const handleCepBuscar = async () => {
    if (!form.cep) return;
    setCepLoading(true);
    try {
      const result = await buscarCEP(form.cep);
      if (result) {
        setForm((f) => ({
          ...f,
          endereco: result.logradouro || f.endereco,
          bairro: result.bairro || f.bairro,
          cidade: result.cidade || f.cidade,
          estado: result.uf || f.estado,
        }));
        toast.success("Endereço preenchido!");
      } else {
        toast.error("CEP não encontrado");
      }
    } finally {
      setCepLoading(false);
    }
  };

  // -------------------------------------------------------
  // CEP auto-fill (edit form)
  // -------------------------------------------------------
  const handleEditCepBuscar = async () => {
    if (!editForm?.cep) return;
    setEditCepLoading(true);
    try {
      const result = await buscarCEP(editForm.cep);
      if (result) {
        setEditForm((f: any) => ({
          ...f,
          endereco: result.logradouro || f.endereco,
          bairro: result.bairro || f.bairro,
          cidade: result.cidade || f.cidade,
          estado: result.uf || f.estado,
        }));
        toast.success("Endereço preenchido!");
      } else {
        toast.error("CEP não encontrado");
      }
    } finally {
      setEditCepLoading(false);
    }
  };

  // -------------------------------------------------------
  // Save patient edits
  // -------------------------------------------------------
  const handleSavePaciente = async () => {
    if (!editForm || !selectedPaciente?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pacientes")
        .update({
          nome: editForm.nome,
          cpf: editForm.cpf || null,
          telefone: editForm.telefone || null,
          celular: editForm.celular || null,
          email: editForm.email || null,
          data_nascimento: editForm.data_nascimento || null,
          sexo: editForm.sexo || null,
          carteirinha: editForm.carteirinha || null,
          observacoes: editForm.observacoes || null,
          cep: editForm.cep || null,
          endereco: editForm.endereco || null,
          numero: editForm.numero || null,
          complemento: editForm.complemento || null,
          bairro: editForm.bairro || null,
          cidade: editForm.cidade || null,
          estado: editForm.estado || null,
          plano: editForm.plano || null,
          matricula: editForm.matricula || null,
          token_convenio: editForm.token_convenio || null,
          validade_convenio: editForm.validade_convenio || null,
          titular: editForm.titular || null,
          avisos: editForm.avisos || null,
        } as any)
        .eq("id", selectedPaciente.id);
      if (error) throw error;
      toast.success("Paciente atualizado!");
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      setSelectedPaciente({ ...selectedPaciente, ...editForm });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------
  // Open patient detail
  // -------------------------------------------------------
  const openPaciente = (p: any) => {
    setSelectedPaciente(p);
    setActiveSection("dados");
    setEditForm({ ...p });
  };

  // -------------------------------------------------------
  // Columns for main DataTable
  // -------------------------------------------------------
  const columns = [
    {
      key: "nome",
      header: "Nome",
      render: (row: any) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.nome || "?"} size={32} />
          <span className="font-medium text-[13px]" style={{ color: "#2C3E50" }}>{row.nome}</span>
          {aniversariantes.some((a: any) => a.id === row.id) && (
            <Cake className="h-3.5 w-3.5" style={{ color: "#EC4899" }} />
          )}
        </div>
      ),
    },
    { key: "cpf", header: "CPF" },
    { key: "telefone", header: "Telefone" },
    { key: "email", header: "E-mail" },
    {
      key: "data_nascimento",
      header: "Idade",
      render: (row: any) =>
        row.data_nascimento
          ? `${differenceInYears(new Date(), parseISO(row.data_nascimento))} anos`
          : "—",
    },
    {
      key: "convenio_id",
      header: "Tipo",
      render: (row: any) =>
        row.convenio_id ? (
          <StatusBadge status="roxo" label="Convênio" />
        ) : (
          <StatusBadge status="neutro" label="Particular" />
        ),
    },
  ];

  // -------------------------------------------------------
  // Render detail view
  // -------------------------------------------------------
  const renderDetail = () => {
    if (!selectedPaciente || !editForm) return null;
    const age = editForm.data_nascimento
      ? differenceInYears(new Date(), parseISO(editForm.data_nascimento))
      : null;

    return (
      <div className="flex gap-0 rounded-xl overflow-hidden" style={{ border: "0.5px solid #E5E5E5", minHeight: 600 }}>
        {/* Sidebar */}
        <div className="w-[200px] shrink-0 py-4" style={{ background: "#F5F5F5", borderRight: "0.5px solid #E5E5E5" }}>
          {/* Patient header in sidebar */}
          <div className="px-4 pb-4 mb-2" style={{ borderBottom: "0.5px solid #E5E5E5" }}>
            <div className="flex flex-col items-center gap-2">
              <Avatar name={selectedPaciente.nome || "?"} size={52} />
              <p className="text-[12px] font-semibold text-center leading-tight" style={{ color: "#2C3E50" }}>
                {selectedPaciente.nome}
              </p>
              {age !== null && (
                <p className="text-[11px]" style={{ color: "#666" }}>{age} anos</p>
              )}
            </div>
          </div>
          {/* Nav items */}
          <nav className="space-y-0.5 px-2">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveSection(item.key)}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors text-left"
                style={
                  activeSection === item.key
                    ? { background: "#1B5E7B", color: "white", fontWeight: 600 }
                    : { color: "#2C3E50" }
                }
              >
                <span style={activeSection === item.key ? { color: "white" } : { color: "#666" }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto">
          {/* Detail header */}
          <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10 bg-white" style={{ borderBottom: "0.5px solid #E5E5E5" }}>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPaciente(null)}
                className="h-8 gap-1 text-[13px]"
                style={{ color: "#666" }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <span className="text-[14px] font-semibold" style={{ color: "#2C3E50" }}>
                {SIDEBAR_ITEMS.find((s) => s.key === activeSection)?.label}
              </span>
            </div>
            {activeSection === "dados" && (
              <Button
                size="sm"
                onClick={handleSavePaciente}
                disabled={saving}
                className="h-8 px-5 text-[13px] font-semibold"
                style={{ background: "#1B5E7B", color: "white" }}
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </div>

          {/* Section content */}
          <div className="p-6">
            {activeSection === "dados" && renderDadosPrincipais(editForm, setEditForm, age, editCepLoading, handleEditCepBuscar)}
            {activeSection === "conta" && renderConta()}
            {activeSection === "agendamentos" && renderAgendamentos()}
            {activeSection === "recibos" && renderRecibos()}
            {activeSection === "timeline" && renderTimeline()}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------
  // Dados Principais
  // -------------------------------------------------------
  function renderDadosPrincipais(
    ef: any,
    setEf: (v: any) => void,
    age: number | null,
    cepLd: boolean,
    onCepBuscar: () => void
  ) {
    const set = (key: string, val: string) => setEf((f: any) => ({ ...f, [key]: val }));
    return (
      <div className="space-y-8 max-w-3xl">
        {/* Identificação */}
        <FormSection title="1. Identificação">
          <div className="flex items-start gap-6">
            {/* Photo circle */}
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{ width: 120, height: 120, background: "#E5E5E5", border: "2px dashed #CCC" }}
            >
              <Avatar name={ef.nome || "?"} size={100} />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Nome completo *">
                  <Input value={ef.nome || ""} onChange={(e) => set("nome", e.target.value)} className="h-8 text-[13px]" />
                </Field>
              </div>
              <Field label="Data de Nascimento">
                <div className="flex items-center gap-2">
                  <Input type="date" value={ef.data_nascimento || ""} onChange={(e) => set("data_nascimento", e.target.value)} className="h-8 text-[13px]" />
                  {age !== null && (
                    <span className="text-[12px] shrink-0" style={{ color: "#666" }}>{age} anos</span>
                  )}
                </div>
              </Field>
              <Field label="CPF">
                <Input value={ef.cpf || ""} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" className="h-8 text-[13px]" />
              </Field>
              <Field label="Sexo">
                <Select value={ef.sexo || ""} onValueChange={(v) => set("sexo", v)}>
                  <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="O">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nº Prontuário">
                <Input value={ef.prontuario || ""} readOnly placeholder="Auto" className="h-8 text-[13px] bg-gray-50" />
              </Field>
            </div>
          </div>
        </FormSection>

        {/* Contato */}
        <FormSection title="2. Contato">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Telefone">
              <div className="relative">
                <Phone className="absolute left-2.5 top-2 h-3.5 w-3.5" style={{ color: "#666" }} />
                <Input value={ef.telefone || ""} onChange={(e) => set("telefone", e.target.value)} placeholder="(00) 0000-0000" className="h-8 text-[13px] pl-8" />
              </div>
            </Field>
            <Field label="Celular">
              <div className="relative">
                <Phone className="absolute left-2.5 top-2 h-3.5 w-3.5" style={{ color: "#666" }} />
                <Input value={ef.celular || ""} onChange={(e) => set("celular", e.target.value)} placeholder="(00) 00000-0000" className="h-8 text-[13px] pl-8" />
              </div>
            </Field>
            <Field label="E-mail">
              <div className="relative">
                <Mail className="absolute left-2.5 top-2 h-3.5 w-3.5" style={{ color: "#666" }} />
                <Input type="email" value={ef.email || ""} onChange={(e) => set("email", e.target.value)} className="h-8 text-[13px] pl-8" />
              </div>
            </Field>
          </div>
        </FormSection>

        {/* Endereço */}
        <FormSection title="3. Endereço">
          <div className="grid grid-cols-3 gap-3">
            <Field label="CEP">
              <div className="flex gap-2">
                <Input value={ef.cep || ""} onChange={(e) => set("cep", e.target.value)} placeholder="00000-000" className="h-8 text-[13px]" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onCepBuscar}
                  disabled={cepLd}
                  className="h-8 px-3 text-[12px] shrink-0"
                >
                  {cepLd ? "..." : "Buscar"}
                </Button>
              </div>
            </Field>
            <div className="col-span-2">
              <Field label="Endereço">
                <Input value={ef.endereco || ""} onChange={(e) => set("endereco", e.target.value)} className="h-8 text-[13px]" />
              </Field>
            </div>
            <Field label="Número">
              <Input value={ef.numero || ""} onChange={(e) => set("numero", e.target.value)} className="h-8 text-[13px]" />
            </Field>
            <Field label="Complemento">
              <Input value={ef.complemento || ""} onChange={(e) => set("complemento", e.target.value)} className="h-8 text-[13px]" />
            </Field>
            <Field label="Bairro">
              <Input value={ef.bairro || ""} onChange={(e) => set("bairro", e.target.value)} className="h-8 text-[13px]" />
            </Field>
            <div className="col-span-2">
              <Field label="Cidade">
                <Input value={ef.cidade || ""} onChange={(e) => set("cidade", e.target.value)} className="h-8 text-[13px]" />
              </Field>
            </div>
            <Field label="Estado (UF)">
              <Input value={ef.estado || ""} onChange={(e) => set("estado", e.target.value)} maxLength={2} className="h-8 text-[13px]" />
            </Field>
          </div>
        </FormSection>

        {/* Convênio */}
        <FormSection title="4. Convênio">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Convênio">
              <Input value={ef.convenio_nome || ""} onChange={(e) => set("convenio_nome", e.target.value)} placeholder="Nome do convênio" className="h-8 text-[13px]" />
            </Field>
            <Field label="Plano">
              <Input value={ef.plano || ""} onChange={(e) => set("plano", e.target.value)} className="h-8 text-[13px]" />
            </Field>
            <Field label="Matrícula / Carteirinha">
              <Input value={ef.carteirinha || ""} onChange={(e) => set("carteirinha", e.target.value)} className="h-8 text-[13px]" />
            </Field>
            <Field label="Token">
              <Input value={ef.token_convenio || ""} onChange={(e) => set("token_convenio", e.target.value)} className="h-8 text-[13px]" />
            </Field>
            <Field label="Validade">
              <Input type="date" value={ef.validade_convenio || ""} onChange={(e) => set("validade_convenio", e.target.value)} className="h-8 text-[13px]" />
            </Field>
            <Field label="Titular">
              <Input value={ef.titular || ""} onChange={(e) => set("titular", e.target.value)} placeholder="Nome do titular" className="h-8 text-[13px]" />
            </Field>
          </div>
        </FormSection>

        {/* Observações */}
        <FormSection title="5. Observações">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Observações">
              <Textarea
                value={ef.observacoes || ""}
                onChange={(e) => set("observacoes", e.target.value)}
                rows={4}
                className="text-[13px] resize-none"
              />
            </Field>
            <Field label="Avisos / Pendências">
              <Textarea
                value={ef.avisos || ""}
                onChange={(e) => set("avisos", e.target.value)}
                rows={4}
                className="text-[13px] resize-none"
                placeholder="Ex: Alergia a dipirona, pendência de documentos..."
              />
            </Field>
          </div>
        </FormSection>
      </div>
    );
  }

  // -------------------------------------------------------
  // Conta tab
  // -------------------------------------------------------
  function renderConta() {
    const totalPago = contaPaciente
      .filter((c: any) => c.pago)
      .reduce((s: number, c: any) => s + Number(c.valor_bruto || 0), 0);

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px]" style={{ color: "#666" }}>Total pago</p>
            <p className="text-[22px] font-bold" style={{ color: "#1D9E75", fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(totalPago)}
            </p>
          </div>
        </div>

        <DataTable
          columns={[
            { key: "data_pagamento", header: "Data", render: (r: any) => format(new Date(r.data_pagamento), "dd/MM/yyyy") },
            { key: "descricao", header: "Descrição" },
            { key: "medico_nome", header: "Médico" },
            {
              key: "forma_pagamento",
              header: "Forma Pgto",
              render: (r: any) => r.forma_pagamento ? <StatusBadge status={r.forma_pagamento} type="pagamento" /> : <span style={{ color: "#999" }}>—</span>,
            },
            {
              key: "valor_bruto",
              header: "Valor",
              align: "right",
              render: (r: any) => formatCurrency(Number(r.valor_bruto || 0)),
            },
            {
              key: "pago",
              header: "Status",
              render: (r: any) => <StatusBadge status={r.pago ? "pago" : "pendente"} />,
            },
            {
              key: "recibo_id",
              header: "Recibo",
              render: (r: any) =>
                r.recibo_id ? (
                  <span className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5" style={{ background: "#E6F1FB", color: "#378ADD" }}>
                    <Receipt className="h-3 w-3" /> Emitido
                  </span>
                ) : (
                  <span style={{ color: "#999" }}>—</span>
                ),
            },
          ]}
          data={contaPaciente}
          emptyMessage="Nenhum registro financeiro"
        />
      </div>
    );
  }

  // -------------------------------------------------------
  // Agendamentos tab
  // -------------------------------------------------------
  function renderAgendamentos() {
    return (
      <DataTable
        columns={[
          {
            key: "data_hora",
            header: "Data / Hora",
            render: (r: any) => r.data_hora ? format(new Date(r.data_hora), "dd/MM/yyyy HH:mm") : "—",
          },
          { key: "medico_nome", header: "Médico" },
          { key: "especialidade", header: "Especialidade" },
          {
            key: "status",
            header: "Status",
            render: (r: any) => r.status ? <StatusBadge status={r.status} type="agendamento" /> : <span style={{ color: "#999" }}>—</span>,
          },
          { key: "observacoes", header: "Obs." },
        ]}
        data={agendamentosPaciente}
        emptyMessage="Nenhum agendamento encontrado"
      />
    );
  }

  // -------------------------------------------------------
  // Recibos tab
  // -------------------------------------------------------
  function renderRecibos() {
    return (
      <DataTable
        columns={[
          { key: "numero_recibo", header: "#" },
          { key: "created_at", header: "Data", render: (r: any) => format(new Date(r.created_at), "dd/MM/yyyy") },
          { key: "tipo", header: "Tipo", render: (r: any) => <StatusBadge status="neutro" label={r.tipo} /> },
          { key: "nome_medico", header: "Médico", render: (r: any) => `Dr(a). ${r.nome_medico || ""}` },
          {
            key: "valor",
            header: "Valor",
            align: "right",
            render: (r: any) => formatCurrency(Number(r.valor || 0)),
          },
          {
            key: "acoes",
            header: "Ações",
            render: (r: any) => (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[12px] gap-1"
                style={{ color: "#1B5E7B" }}
                onClick={() => {
                  const win = window.open("", "_blank");
                  if (!win) return;
                  win.document.write(
                    `<html><head><title>Recibo</title><style>body{font-family:Arial;padding:40px;max-width:700px;margin:0 auto;}.valor{font-size:20px;font-weight:bold;text-align:center;margin:20px 0;padding:15px;border:1px solid #ddd;border-radius:8px;}</style></head><body><h2>Recibo ${r.tipo === "paciente" ? "ao Paciente" : "Médico"}</h2><div class="valor">${formatCurrency(Number(r.valor))}</div><p>${r.texto_corpo || ""}</p><br/><p><small>Paciente: ${r.nome_paciente} | Médico: Dr(a). ${r.nome_medico} CRM ${r.crm_medico || ""}</small></p></body></html>`
                  );
                  win.document.close();
                  win.print();
                }}
              >
                <Printer className="h-3 w-3" /> Imprimir
              </Button>
            ),
          },
        ]}
        data={recibosPaciente}
        emptyMessage="Nenhum recibo emitido"
      />
    );
  }

  // -------------------------------------------------------
  // Timeline tab
  // -------------------------------------------------------
  function renderTimeline() {
    const events = [
      ...agendamentosPaciente.map((a: any) => ({
        date: a.data_hora,
        type: "agendamento",
        label: `Consulta — ${a.status || "agendado"}`,
        sub: a.medico_nome,
      })),
      ...contaPaciente.map((c: any) => ({
        date: c.data_pagamento,
        type: "financeiro",
        label: c.descricao || "Pagamento",
        sub: formatCurrency(Number(c.valor_bruto || 0)),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (events.length === 0) {
      return (
        <p className="text-center py-16 text-[13px]" style={{ color: "#999" }}>Nenhum evento registrado</p>
      );
    }

    return (
      <div className="space-y-3 max-w-xl">
        {events.map((ev, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className="h-3 w-3 rounded-full mt-1 shrink-0"
                style={{ background: ev.type === "agendamento" ? "#1B5E7B" : "#1D9E75" }}
              />
              {i < events.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: "#E5E5E5" }} />}
            </div>
            <div className="pb-4">
              <p className="text-[12px]" style={{ color: "#666" }}>
                {ev.date ? format(new Date(ev.date), "dd/MM/yyyy") : "—"}
              </p>
              <p className="text-[13px] font-medium" style={{ color: "#2C3E50" }}>{ev.label}</p>
              {ev.sub && <p className="text-[12px]" style={{ color: "#666" }}>{ev.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // -------------------------------------------------------
  // Pills definition
  // -------------------------------------------------------
  const pills = [
    { key: "todos", label: "Todos", count: pacientes.length },
    { key: "convenio", label: "Convênio", count: convenioCount, color: { bg: "transparent", text: "#534AB7", border: "rgba(83,74,183,0.3)" } },
    { key: "particular", label: "Particular", count: particularCount, color: { bg: "transparent", text: "#1D9E75", border: "rgba(29,158,117,0.3)" } },
    {
      key: "aniversariantes",
      label: "Aniversariantes",
      count: aniversariantes.length,
      color: { bg: "transparent", text: "#EC4899", border: "rgba(236,72,153,0.3)" },
    },
  ];

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Page header */}
        <PageHeader
          title="Pacientes"
          subtitle="Banco de pacientes da clínica"
          actions={
            <>
              {aniversariantes.length > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium"
                  style={{ background: "rgba(236,72,153,0.1)", color: "#EC4899" }}
                >
                  <Cake className="h-3.5 w-3.5" />
                  {aniversariantes.length} aniversariante{aniversariantes.length > 1 ? "s" : ""} hoje
                </span>
              )}
              <ExportButtons
                data={flattenForExport(filtered, {
                  Nome: "nome",
                  CPF: "cpf",
                  Telefone: "telefone",
                  Email: "email",
                  "Data Nasc.": "data_nascimento",
                  Sexo: "sexo",
                })}
                filename="pacientes"
                titulo="Pacientes"
              />
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="h-9 gap-1.5 text-[13px] font-semibold"
                    style={{ background: "#1B5E7B", color: "white" }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Novo Paciente
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Cadastrar Paciente</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div className="col-span-2">
                      <Field label="Nome *">
                        <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="h-8 text-[13px]" />
                      </Field>
                    </div>
                    <Field label="CPF">
                      <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" className="h-8 text-[13px]" />
                    </Field>
                    <Field label="Telefone">
                      <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" className="h-8 text-[13px]" />
                    </Field>
                    <Field label="E-mail">
                      <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" className="h-8 text-[13px]" />
                    </Field>
                    <Field label="Data Nascimento">
                      <Input value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} type="date" className="h-8 text-[13px]" />
                    </Field>
                    <Field label="Sexo">
                      <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
                        <SelectTrigger className="h-8 text-[13px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Feminino</SelectItem>
                          <SelectItem value="O">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Carteirinha">
                      <Input value={form.carteirinha} onChange={(e) => setForm({ ...form, carteirinha: e.target.value })} className="h-8 text-[13px]" />
                    </Field>
                    {/* CEP com auto-fill */}
                    <Field label="CEP">
                      <div className="flex gap-2">
                        <Input
                          value={form.cep}
                          onChange={(e) => setForm({ ...form, cep: e.target.value })}
                          placeholder="00000-000"
                          className="h-8 text-[13px]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleCepBuscar}
                          disabled={cepLoading}
                          className="h-8 px-3 text-[12px] shrink-0"
                        >
                          {cepLoading ? "..." : "CEP"}
                        </Button>
                      </div>
                    </Field>
                    <div className="col-span-2">
                      <Field label="Endereço">
                        <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} className="h-8 text-[13px]" />
                      </Field>
                    </div>
                    <Field label="Número">
                      <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="h-8 text-[13px]" />
                    </Field>
                    <Field label="Bairro">
                      <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} className="h-8 text-[13px]" />
                    </Field>
                    <Field label="Cidade">
                      <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className="h-8 text-[13px]" />
                    </Field>
                    <Field label="Estado (UF)">
                      <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} maxLength={2} className="h-8 text-[13px]" />
                    </Field>
                    <div className="col-span-2">
                      <Field label="Observações">
                        <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="h-8 text-[13px]" />
                      </Field>
                    </div>
                  </div>
                  <Button
                    onClick={() => createPaciente.mutate()}
                    disabled={!form.nome || createPaciente.isPending}
                    className="mt-4 w-full font-semibold"
                    style={{ background: "#1B5E7B", color: "white" }}
                  >
                    {createPaciente.isPending ? "Cadastrando..." : "Cadastrar Paciente"}
                  </Button>
                </DialogContent>
              </Dialog>
            </>
          }
        />

        {/* KPI Cards — only shown when not in detail view */}
        {!selectedPaciente && (
          <KpiCards
            items={[
              { label: "Total de Pacientes", value: pacientes.length, isCurrency: false },
              { label: "Convênio", value: convenioCount, isCurrency: false },
              { label: "Particular", value: particularCount, isCurrency: false },
              {
                label: "Aniversariantes Hoje",
                value: aniversariantes.length,
                isCurrency: false,
                sublabel: aniversariantes.length > 0 ? aniversariantes.map((a: any) => a.nome).slice(0, 2).join(", ") : "Nenhum hoje",
                sublabelColor: aniversariantes.length > 0 ? "#EC4899" : "#666",
              },
            ]}
          />
        )}

        {/* Filter pills + search — only shown when not in detail view */}
        {!selectedPaciente && (
          <FilterPills
            pills={pills}
            activePill={activePill}
            onPillChange={setActivePill}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por nome, CPF ou telefone..."
          />
        )}

        {/* Main content: either detail view or list */}
        {selectedPaciente ? (
          renderDetail()
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            loading={isLoading}
            emptyMessage={
              activePill === "aniversariantes"
                ? "Nenhum aniversariante hoje"
                : "Nenhum paciente encontrado"
            }
            onRowClick={openPaciente}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

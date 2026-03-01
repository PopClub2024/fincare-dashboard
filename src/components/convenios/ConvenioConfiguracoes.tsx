import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Save } from "lucide-react";
import { toast } from "sonner";

interface ConvenioConfig {
  id: string;
  nome: string;
  feegow_id: string | null;
  prazo_repasse_dias: number | null;
  ativo: boolean;
}

export default function ConvenioConfiguracoes() {
  const { clinicaId } = useAuth();
  const [convenios, setConvenios] = useState<ConvenioConfig[]>([]);
  const [editing, setEditing] = useState<Record<string, { prazo: string; feegow_id: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicaId) return;
    supabase
      .from("convenios")
      .select("id, nome, feegow_id, prazo_repasse_dias, ativo")
      .eq("clinica_id", clinicaId)
      .order("nome")
      .then(({ data }) => {
        if (data) setConvenios(data);
        setLoading(false);
      });
  }, [clinicaId]);

  const handleEdit = (id: string, field: "prazo" | "feegow_id", value: string) => {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = async (conv: ConvenioConfig) => {
    const edits = editing[conv.id];
    if (!edits) return;
    const updates: any = {};
    if (edits.prazo !== undefined) updates.prazo_repasse_dias = parseInt(edits.prazo) || null;
    if (edits.feegow_id !== undefined) updates.feegow_id = edits.feegow_id || null;

    const { error } = await supabase.from("convenios").update(updates).eq("id", conv.id);
    if (error) toast.error("Erro ao salvar");
    else {
      toast.success(`${conv.nome} atualizado`);
      setEditing((prev) => { const n = { ...prev }; delete n[conv.id]; return n; });
      // refresh
      const { data } = await supabase
        .from("convenios")
        .select("id, nome, feegow_id, prazo_repasse_dias, ativo")
        .eq("clinica_id", clinicaId!)
        .order("nome");
      if (data) setConvenios(data);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Configurações de Convênios</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Feegow ID</TableHead>
                  <TableHead className="text-right">Prazo Repasse (dias)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convenios.map((c) => {
                  const edits = editing[c.id];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>
                        <Input
                          className="h-7 w-32 text-sm"
                          defaultValue={c.feegow_id || ""}
                          onChange={(e) => handleEdit(c.id, "feegow_id", e.target.value)}
                          placeholder="insurance_id"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          className="h-7 w-20 text-sm text-right ml-auto"
                          defaultValue={c.prazo_repasse_dias?.toString() || "30"}
                          onChange={(e) => handleEdit(c.id, "prazo", e.target.value)}
                          type="number"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge className={c.ativo ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}>
                          {c.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {edits && (
                          <Button size="sm" variant="ghost" onClick={() => handleSave(c)}>
                            <Save className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

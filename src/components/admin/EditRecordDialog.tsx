import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FieldDef {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "date";
  options?: { value: string; label: string }[];
  step?: string;
}

interface EditRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  table: string;
  recordId: string;
  fields: FieldDef[];
  initialValues: Record<string, any>;
  onSaved: () => void;
}

export default function EditRecordDialog({
  open, onOpenChange, title, table, recordId, fields, initialValues, onSaved,
}: EditRecordDialogProps) {
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ ...initialValues });
  }, [open, initialValues]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      fields.forEach((f) => {
        const val = form[f.key];
        if (f.type === "number") {
          updates[f.key] = val === "" || val === null || val === undefined ? 0 : Number(val);
        } else {
          updates[f.key] = val;
        }
      });

      const { error } = await supabase
        .from(table as any)
        .update(updates as any)
        .eq("id", recordId);

      if (error) throw error;
      toast.success("Registro atualizado com sucesso!");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>✏️ {title}</DialogTitle>
          <DialogDescription>Edite os valores e clique em Salvar. Apenas administradores podem editar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs font-medium">{f.label}</Label>
              {f.type === "select" && f.options ? (
                <Select value={form[f.key] || ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                  step={f.step || (f.type === "number" ? "0.01" : undefined)}
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

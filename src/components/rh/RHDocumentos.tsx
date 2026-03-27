import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { ACCEPT_DOCUMENTOS, uploadFile } from "@/lib/file-upload";

export default function RHDocumentos() {
  const { clinicaId } = useAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Repositório de Documentos</CardTitle>
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
                    arquivo_url: result.url,
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
  );
}

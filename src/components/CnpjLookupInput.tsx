import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { buscarCNPJ, type CnpjData } from "@/lib/cnpj-lookup";
import { toast } from "sonner";
import { Search, Loader2, CheckCircle, Building2 } from "lucide-react";

interface CnpjLookupInputProps {
  value: string;
  onChange: (cnpj: string) => void;
  onDataFound: (data: CnpjData) => void;
  label?: string;
  placeholder?: string;
}

export default function CnpjLookupInput({ value, onChange, onDataFound, label = "CPF/CNPJ", placeholder = "00.000.000/0000-00" }: CnpjLookupInputProps) {
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(false);

  const handleBuscar = async () => {
    const clean = value.replace(/\D/g, "");
    if (clean.length < 14) {
      toast.error("Digite um CNPJ completo (14 dígitos)");
      return;
    }
    setLoading(true);
    setFound(false);
    const data = await buscarCNPJ(clean);
    if (data) {
      onDataFound(data);
      setFound(true);
      toast.success(`Encontrado: ${data.razao_social || data.nome_fantasia}`);
    } else {
      toast.error("CNPJ não encontrado na Receita Federal");
    }
    setLoading(false);
  };

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setFound(false); }}
          placeholder={placeholder}
          className="font-mono"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBuscar(); } }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleBuscar}
          disabled={loading || value.replace(/\D/g, "").length < 11}
          title="Buscar na Receita Federal"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : found ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {found && (
        <Badge variant="secondary" className="mt-1 text-[10px] gap-1">
          <Building2 className="h-3 w-3" /> Dados preenchidos automaticamente via Receita Federal
        </Badge>
      )}
    </div>
  );
}

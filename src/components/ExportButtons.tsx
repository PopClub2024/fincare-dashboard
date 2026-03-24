import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";
import { toast } from "sonner";

interface ExportButtonsProps {
  data: Record<string, any>[];
  filename: string;
  titulo: string;
  colunas?: { header: string; dataKey: string }[];
  disabled?: boolean;
}

export default function ExportButtons({ data, filename, titulo, colunas, disabled }: ExportButtonsProps) {
  const handleExcel = () => {
    if (!data.length) { toast.error("Sem dados para exportar"); return; }
    exportToExcel(data, filename);
    toast.success(`Excel exportado: ${filename}.xlsx`);
  };

  const handlePDF = () => {
    if (!data.length) { toast.error("Sem dados para exportar"); return; }
    exportToPDF(data, filename, titulo, colunas);
    toast.success(`PDF exportado: ${filename}.pdf`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !data.length}>
          <Download className="h-4 w-4 mr-2" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePDF}>
          <FileText className="h-4 w-4 mr-2" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

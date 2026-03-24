import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Exporta dados para Excel (.xlsx)
 */
export function exportToExcel(
  data: Record<string, any>[],
  filename: string,
  sheetName = "Dados"
) {
  if (!data.length) return;
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buf], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

/**
 * Exporta dados para PDF com tabela formatada
 */
export function exportToPDF(
  data: Record<string, any>[],
  filename: string,
  titulo: string,
  colunas?: { header: string; dataKey: string }[]
) {
  if (!data.length) return;
  const doc = new jsPDF({ orientation: "landscape" });

  // Título
  doc.setFontSize(16);
  doc.text(titulo, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(128);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} — Medic Pop`, 14, 22);

  // Determinar colunas
  const cols = colunas || Object.keys(data[0]).map(k => ({ header: k, dataKey: k }));

  autoTable(doc, {
    startY: 28,
    head: [cols.map(c => c.header)],
    body: data.map(row => cols.map(c => {
      const val = row[c.dataKey];
      if (val === null || val === undefined) return "—";
      if (typeof val === "number") return val.toLocaleString("pt-BR");
      return String(val);
    })),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 64, 100], textColor: 255, fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}

/**
 * Componente helper: prepara dados de uma tabela para exportação
 * Recebe array de objetos e retorna dados limpos (sem objetos aninhados)
 */
export function flattenForExport(
  data: Record<string, any>[],
  fieldMap: Record<string, string | ((row: any) => any)>
): Record<string, any>[] {
  return data.map(row => {
    const flat: Record<string, any> = {};
    for (const [key, accessor] of Object.entries(fieldMap)) {
      if (typeof accessor === "function") {
        flat[key] = accessor(row);
      } else {
        flat[key] = accessor.includes(".")
          ? accessor.split(".").reduce((o: any, k) => o?.[k], row)
          : row[accessor];
      }
    }
    return flat;
  });
}

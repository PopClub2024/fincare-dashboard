import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ExportButtons from "@/components/ExportButtons";

interface Column {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: any) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: any) => void;
  exportFilename?: string;
  exportTitle?: string;
  rowKey?: string;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void };
}

export default function DataTable({
  columns, data, loading, emptyMessage = "Nenhum registro encontrado",
  onRowClick, exportFilename, exportTitle, rowKey = "id", pagination,
}: DataTableProps) {
  const pageData = pagination
    ? data.slice((pagination.page - 1) * pagination.pageSize, pagination.page * pagination.pageSize)
    : data;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div>
      <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid #E5E5E5" }}>
        <Table>
          <TableHeader>
            <TableRow style={{ background: "#F5F5F5" }}>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className="text-[13px] font-medium py-2.5 px-3"
                  style={{ color: "#666666", width: col.width, textAlign: col.align || "left" }}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12">
                  <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: "#1B5E7B" }} />
                </TableCell>
              </TableRow>
            ) : pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12 text-[13px]" style={{ color: "#666" }}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : pageData.map((row, idx) => (
              <TableRow
                key={row[rowKey] || idx}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${onRowClick ? "cursor-pointer hover:bg-blue-50/50" : ""}`}
                style={{
                  background: idx % 2 === 1 ? "#F5F5F5" : "white",
                  borderTop: "0.5px solid #E5E5E5",
                }}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className="py-2.5 px-3 text-[13px]"
                    style={{ color: "#2C3E50", textAlign: col.align || "left", fontVariantNumeric: "tabular-nums" }}
                  >
                    {col.render ? col.render(row) : row[col.key] ?? "—"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Paginação + Export */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {exportFilename && (
            <ExportButtons
              data={data.map(row => {
                const flat: Record<string, any> = {};
                columns.forEach(col => { flat[col.header] = col.render ? "—" : row[col.key]; });
                return flat;
              })}
              filename={exportFilename}
              titulo={exportTitle || exportFilename}
            />
          )}
        </div>
        {pagination && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs mr-2" style={{ color: "#666" }}>
              {((pagination.page - 1) * pagination.pageSize) + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.total)} de {pagination.total}
            </span>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => pagination.onPageChange(p)}
                className="h-7 w-7 rounded-full text-xs font-medium transition-colors"
                style={p === pagination.page ? { background: "#1B5E7B", color: "white" } : { color: "#666" }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

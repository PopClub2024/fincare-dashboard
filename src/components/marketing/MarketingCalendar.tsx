import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function MarketingCalendar() {
  const { clinicaId } = useAuth();

  const { data: postagens = [] } = useQuery({
    queryKey: ["mkt-postagens", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("calendario_postagens").select("*").eq("clinica_id", clinicaId).order("data_publicacao");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Rede</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {postagens.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Nenhuma postagem agendada</TableCell></TableRow>
            ) : postagens.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{format(new Date(p.data_publicacao), "dd/MM/yyyy")}</TableCell>
                <TableCell className="font-medium">{p.titulo}</TableCell>
                <TableCell><Badge variant="outline">{p.rede_social}</Badge></TableCell>
                <TableCell>{p.tipo}</TableCell>
                <TableCell><Badge variant={p.publicado ? "default" : "secondary"}>{p.publicado ? "Publicado" : "Agendado"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

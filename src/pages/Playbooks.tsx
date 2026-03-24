import { useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function Playbooks() {
  const { clinicaId } = useAuth();
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("todos");
  const [selected, setSelected] = useState<any>(null);

  const { data: playbooks = [] } = useQuery({
    queryKey: ["playbooks", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase.from("playbooks").select("*").eq("clinica_id", clinicaId).eq("ativo", true).order("area, titulo");
      return data || [];
    },
    enabled: !!clinicaId,
  });

  const areas = [...new Set(playbooks.map((p: any) => p.area))];
  const filtered = playbooks.filter((p: any) =>
    (areaFilter === "todos" || p.area === areaFilter) &&
    p.titulo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold">Playbooks (POP)</h1><p className="text-sm text-muted-foreground">Procedimentos operacionais padrão</p></div>
          <Button><Plus className="h-4 w-4 mr-2" /> Novo Playbook</Button>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todas áreas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas áreas</SelectItem>
              {areas.map((a: any) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <Card className="col-span-3"><CardContent className="p-8 text-center text-muted-foreground">Nenhum playbook encontrado</CardContent></Card>
          ) : filtered.map((p: any) => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(p)}>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> {p.titulo}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{p.area}</Badge>
                  {p.perfil && <Badge variant="secondary">{p.perfil}</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">v{p.versao}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {selected.titulo}
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Fechar</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <ReactMarkdown>{selected.conteudo}</ReactMarkdown>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

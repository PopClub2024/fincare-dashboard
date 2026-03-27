import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, MessageSquare, Phone, Mail, Users, Loader2 } from "lucide-react";

export default function WhatsAppContacts() {
  const { clinicaId } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["whatsapp-contacts", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("pacientes")
        .select("id, nome, telefone, email, convenio_id, created_at")
        .eq("clinica_id", clinicaId)
        .not("telefone", "is", null)
        .order("nome")
        .limit(500);
      return data || [];
    },
    enabled: !!clinicaId,
  });

  // Check which contacts have active conversations
  const { data: conversaPhones = [] } = useQuery({
    queryKey: ["whatsapp-conversa-phones", clinicaId],
    queryFn: async () => {
      if (!clinicaId) return [];
      const { data } = await supabase
        .from("whatsapp_conversas")
        .select("telefone")
        .eq("clinica_id", clinicaId) as any;
      return (data || []).map((c: any) => c.telefone);
    },
    enabled: !!clinicaId,
  });

  const filtered = contacts.filter((c: any) => {
    const term = searchTerm.toLowerCase();
    return (c.nome?.toLowerCase() || "").includes(term) || (c.telefone || "").includes(term) || (c.email?.toLowerCase() || "").includes(term);
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" /> {filtered.length} contatos
        </Badge>
      </div>

      <div className="rounded-lg border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">{searchTerm ? "Nenhum contato encontrado" : "Nenhum contato cadastrado"}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Canais</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((contact: any) => {
                const hasConversation = conversaPhones.includes(contact.telefone);
                return (
                  <TableRow key={contact.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {(contact.nome || "?").substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{contact.nome || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground">{contact.telefone}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={hasConversation ? "default" : "outline"} className="text-xs">
                        {hasConversation ? "Ativo" : contact.convenio_id ? "Convênio" : "Particular"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {contact.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> {contact.email}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" /> {contact.telefone}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MessageSquare className="h-3 w-3 mr-1" /> Chat
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

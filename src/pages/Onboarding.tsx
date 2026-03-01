import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export default function Onboarding() {
  const { user, hasClinica, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [nomeClinica, setNomeClinica] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (hasClinica) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeClinica.trim()) {
      toast.error("Nome da clínica é obrigatório");
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("onboard_clinica", {
      _nome_clinica: nomeClinica.trim(),
      _cnpj: cnpj.trim() || null,
      _nome_usuario: nomeUsuario.trim() || null,
      _email_usuario: user.email || null,
    });
    if (error) {
      toast.error("Erro ao criar clínica: " + error.message);
    } else {
      toast.success("Clínica criada com sucesso!");
      window.location.href = "/dashboard";
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-lg border-0 shadow-xl">
        <CardHeader className="items-center space-y-4 pb-2">
          <img src={logo} alt="Medic Pop" className="h-20 w-auto" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Bem-vindo!</h1>
            <p className="mt-1 text-sm text-muted-foreground">Configure sua clínica para começar</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nomeClinica">Nome da Clínica *</Label>
              <Input id="nomeClinica" value={nomeClinica} onChange={(e) => setNomeClinica(e.target.value)} placeholder="Ex: Medic Pop Clínica Médica" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nomeUsuario">Seu Nome</Label>
              <Input id="nomeUsuario" value={nomeUsuario} onChange={(e) => setNomeUsuario(e.target.value)} placeholder="Seu nome completo" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar Clínica e Começar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

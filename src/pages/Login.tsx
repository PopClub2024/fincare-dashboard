import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

export default function Login() {
  const { user, hasClinica } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  if (user && hasClinica) return <Navigate to="/dashboard" replace />;
  if (user && !hasClinica) return <Navigate to="/onboarding" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("E-mail de recuperação enviado!");
    setLoading(false);
    setResetMode(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="items-center space-y-4 pb-2">
          <img src={logo} alt="Medic Pop" className="h-20 w-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            {resetMode ? "Recuperar Senha" : "Entrar"}
          </h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={resetMode ? handleReset : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </div>
            {!resetMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : resetMode ? "Enviar link" : "Entrar"}
            </Button>
          </form>
          <div className="mt-4 flex flex-col items-center gap-2 text-sm">
            <button
              onClick={() => setResetMode(!resetMode)}
              className="text-primary hover:underline"
            >
              {resetMode ? "Voltar ao login" : "Esqueci minha senha"}
            </button>
            {!resetMode && (
              <span className="text-muted-foreground">
                Não tem conta?{" "}
                <Link to="/signup" className="text-primary hover:underline">
                  Criar conta
                </Link>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

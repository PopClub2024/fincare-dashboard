import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

const mockData = Array.from({ length: 30 }, (_, i) => ({
  dia: `${i + 1}`,
  entradas: 0,
  saidas: 0,
  saldo: 0,
}));

export default function TabCaixa() {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Fluxo de Caixa Diário</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dia" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(204, 67%, 32%)" fill="hsl(204, 67%, 32%)" fillOpacity={0.1} />
                <Area type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(358, 74%, 44%)" fill="hsl(358, 74%, 44%)" fillOpacity={0.1} />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(152, 60%, 40%)" fill="hsl(152, 60%, 40%)" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Total Entradas", value: "R$ 0,00", color: "text-secondary" },
          { label: "Total Saídas", value: "R$ 0,00", color: "text-primary" },
          { label: "Saldo do Período", value: "R$ 0,00", color: "text-foreground" },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className={`mt-1 text-2xl font-bold ${item.color}`}>{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

const agingData = [
  { faixa: "0-7d", valor: 0 },
  { faixa: "8-15d", valor: 0 },
  { faixa: "16-30d", valor: 0 },
  { faixa: "31-60d", valor: 0 },
  { faixa: "61-90d", valor: 0 },
  { faixa: "90+d", valor: 0 },
];

export default function TabCapitalGiro() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Contas a Receber (AR)", value: "R$ 0,00" },
          { label: "Contas a Pagar (AP)", value: "R$ 0,00" },
          { label: "NCG", value: "R$ 0,00" },
          { label: "Capital de Giro", value: "R$ 0,00" },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Aging de Recebíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="faixa" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="valor" name="Valor" fill="hsl(204, 67%, 32%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Endividamento Total</p>
            <p className="mt-1 text-2xl font-bold text-foreground">R$ 0,00</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Custo Médio da Dívida</p>
            <p className="mt-1 text-2xl font-bold text-foreground">0% a.a.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

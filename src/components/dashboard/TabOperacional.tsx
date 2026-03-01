import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LineChart, Line } from "recharts";

export default function TabOperacional() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "Folha / Receita", value: "0%" },
          { label: "Ticket Médio", value: "R$ 0,00" },
          { label: "Taxa de Falta", value: "0%" },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Receita por Médico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Sincronize com o Feegow para ver dados
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Receita por Sala</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Sincronize com o Feegow para ver dados
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Taxa de Ocupação</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dia" className="text-xs" />
                <YAxis className="text-xs" domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="ocupacao" name="Ocupação %" stroke="hsl(204, 67%, 32%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

export default function TabGrowth() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "CAC", value: "R$ 0,00", formula: "CAC = Gastos Marketing ÷ Novos Pacientes" },
          { label: "LTV", value: "R$ 0,00", formula: "LTV = Ticket Médio × Frequência × Tempo de Vida" },
          { label: "LTV / CAC", value: "0x", formula: "Indica retorno sobre investimento em aquisição" },
        ].map((item) => (
          <Card key={item.label} className="border-0 shadow-md">
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.formula}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Novos Pacientes por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="periodo" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="novos" name="Novos Pacientes" fill="hsl(204, 67%, 32%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Marketing por Canal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Cadastre gastos de marketing para ver dados
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

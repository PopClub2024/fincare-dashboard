import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip } from "recharts";

const mockData = [
  { mes: "Jan", rl: 0, csv: 0, cv: 0, cf: 0, ebitda: 0 },
  { mes: "Fev", rl: 0, csv: 0, cv: 0, cf: 0, ebitda: 0 },
  { mes: "Mar", rl: 0, csv: 0, cv: 0, cf: 0, ebitda: 0 },
];

export default function TabDRE() {
  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">DRE Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Bar dataKey="rl" name="Receita Líquida" fill="hsl(204, 67%, 32%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ebitda" name="EBITDA" fill="hsl(358, 74%, 44%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Demonstrativo Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {[
              { label: "Receita Bruta", value: "R$ 0,00", bold: true },
              { label: "(-) Descontos e Impostos", value: "R$ 0,00" },
              { label: "= Receita Líquida", value: "R$ 0,00", bold: true },
              { label: "(-) Custo dos Serviços", value: "R$ 0,00" },
              { label: "= Margem de Contribuição", value: "R$ 0,00", bold: true },
              { label: "(-) Custos Variáveis", value: "R$ 0,00" },
              { label: "(-) Custos Fixos", value: "R$ 0,00" },
              { label: "= EBITDA", value: "R$ 0,00", bold: true },
              { label: "(+) Depreciação/Amortização", value: "R$ 0,00" },
              { label: "= Resultado Operacional", value: "R$ 0,00", bold: true },
            ].map((row) => (
              <div key={row.label} className={`flex justify-between rounded px-3 py-2 ${row.bold ? "bg-accent font-semibold" : ""}`}>
                <span>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

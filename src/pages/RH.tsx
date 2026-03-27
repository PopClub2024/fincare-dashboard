import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Clock, Calendar, Building2, UserMinus, MessageSquare, FileText, CalendarClock } from "lucide-react";
import RHColaboradores from "@/components/rh/RHColaboradores";
import RHPonto from "@/components/rh/RHPonto";
import RHFerias from "@/components/rh/RHFerias";
import RHDepartamentos from "@/components/rh/RHDepartamentos";
import RHDesligamentos from "@/components/rh/RHDesligamentos";
import RHFeedbacks from "@/components/rh/RHFeedbacks";
import RHDocumentos from "@/components/rh/RHDocumentos";
import RHEscalas from "@/components/rh/RHEscalas";

export default function RH() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Recursos Humanos</h1>
          <p className="text-sm text-muted-foreground">Gestão completa de colaboradores, ponto, férias, departamentos e mais</p>
        </div>

        <Tabs defaultValue="colaboradores">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="colaboradores" className="gap-1"><Users className="h-3.5 w-3.5" /> Colaboradores</TabsTrigger>
            <TabsTrigger value="ponto" className="gap-1"><Clock className="h-3.5 w-3.5" /> Ponto</TabsTrigger>
            <TabsTrigger value="ferias" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Férias</TabsTrigger>
            <TabsTrigger value="departamentos" className="gap-1"><Building2 className="h-3.5 w-3.5" /> Departamentos</TabsTrigger>
            <TabsTrigger value="desligamentos" className="gap-1"><UserMinus className="h-3.5 w-3.5" /> Desligamentos</TabsTrigger>
            <TabsTrigger value="feedbacks" className="gap-1"><MessageSquare className="h-3.5 w-3.5" /> Feedbacks</TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1"><FileText className="h-3.5 w-3.5" /> Documentos</TabsTrigger>
            <TabsTrigger value="escalas" className="gap-1"><CalendarClock className="h-3.5 w-3.5" /> Escalas</TabsTrigger>
          </TabsList>

          <TabsContent value="colaboradores"><RHColaboradores /></TabsContent>
          <TabsContent value="ponto"><RHPonto /></TabsContent>
          <TabsContent value="ferias"><RHFerias /></TabsContent>
          <TabsContent value="departamentos"><RHDepartamentos /></TabsContent>
          <TabsContent value="desligamentos"><RHDesligamentos /></TabsContent>
          <TabsContent value="feedbacks"><RHFeedbacks /></TabsContent>
          <TabsContent value="documentos"><RHDocumentos /></TabsContent>
          <TabsContent value="escalas"><RHEscalas /></TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

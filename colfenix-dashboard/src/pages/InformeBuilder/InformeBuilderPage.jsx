import React, { useMemo } from "react";
import InformeBuilderTemplate from "../../components/plantillas/plantillaInforme";

const novedadFallback = {
  codigo_novedad: "NAS-SC-1262",
  cliente: "Flota La Macarena",
  conductor: "Fabian Leonardo Rueda Acosta",
  numero_interno: "7389",
  vehiculo: "TSW878",
};

export default function InformeBuilderPage({ data, onVolver, onGuardar }) {
  const novedad = useMemo(() => data ?? novedadFallback, [data]);

  return (
    <div className="page-shell">

      <InformeBuilderTemplate
        novedad={novedad}
        onVolver={onVolver}
        onGuardar={onGuardar}
      />
    </div>
  );
}

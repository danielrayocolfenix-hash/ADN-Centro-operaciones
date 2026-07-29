import React, { forwardRef, useMemo } from "react";
import { API_BASE } from "../../config/api";

// Contraparte de solo lectura de plantillaInforme.jsx: mismas clases CSS
// (informe-paper, informe-bloque-*, preview-mini-table...) para que la
// vista previa se vea igual al documento que el analista construyó, pero
// sin ningún control editable -- esto renderiza el informe ya guardado tal
// como viene del backend (GET /api/informes/:id/).

const mediaUrl = (path) => (path ? (path.startsWith("http") ? path : `${API_BASE}${path}`) : null);

const formatHora = (value) => (value ? value.slice(0, 8) : "—:—:—");

function RichText({ html, placeholder }) {
  const vacio = !html || !html.replace(/<[^>]*>/g, "").trim();
  if (vacio) {
    return placeholder ? <span className="informe-bloque-placeholder">{placeholder}</span> : null;
  }
  return <div className="informe-richtext" dangerouslySetInnerHTML={{ __html: html }} />;
}

function PreviewImage({ src, width = 100, align = "center", borderWidth = 0, borderColor = "#333333" }) {
  if (!src) return null;
  return (
    <div style={{ textAlign: align }}>
      <img
        src={src}
        alt=""
        className="informe-imagen-preview-full"
        style={{
          width: `${width}%`,
          display: "inline-block",
          border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : "none",
        }}
      />
    </div>
  );
}

function PreviewTable({ columnas, filas }) {
  if (!columnas || columnas.length === 0) return null;
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="preview-mini-table" style={{ width: "100%" }}>
        <thead>
          <tr>{columnas.map((c) => <th key={c.id}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {filas && filas.length > 0 ? (
            filas.map((row) => (
              <tr key={row.id}>
                {columnas.map((c) => <td key={c.id}>{row.cells?.[c.id] || "—"}</td>)}
              </tr>
            ))
          ) : (
            <tr><td colSpan={columnas.length} style={{ textAlign: "center", color: "#999" }}>Sin filas registradas</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PreviewHeader({ detalle }) {
  const novedad = detalle.novedad;
  const fecha = detalle.fecha_creacion ? new Date(detalle.fecha_creacion) : null;

  return (
    <>
      <table className="informe-header-table">
        <tbody>
          <tr>
            <td className="informe-header-logo-cell">
              <img src="/archivos/colfenix-logo.png" alt="Logo Colfenix" className="informe-logo-img" />
            </td>
            <td className="informe-header-central-cell">
              <div className="informe-empresa-nombre">COLFENIX GPS SAS</div>
              <div className="informe-empresa-nit">NIT.900.531.898-1</div>
              <div className="informe-tipo-titulo">{detalle.titulo || "—"}</div>
            </td>
            <td className="informe-header-meta-cell">
              <div className="informe-meta-codigo">{novedad?.codigo_novedad || detalle.codigo}</div>
              <div>{fecha ? fecha.toLocaleDateString("es-CO") : "—"}</div>
              <div>Hora: {fecha ? fecha.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
              <div className="informe-meta-version">{detalle.version}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="informe-bar-titulo">Datos del Cliente</div>
      <div className="informe-datos-box">
        <span><strong>Operador:</strong> {novedad?.conductor || "—"}</span>
        <span><strong>N° Interno:</strong> {novedad?.numero_interno || "—"}</span>
        <span><strong>Placa:</strong> {novedad?.vehiculo || "—"}</span>
      </div>

      <div className="informe-intro-box">
        Respetados Señores:
        <br />
        <br />
        Se presenta el siguiente informe/novedad para los fines determinados:
      </div>

      <div className="informe-bar-titulo informe-bar-novedad">NOVEDAD 1</div>
    </>
  );
}

function PreviewLogiox({ logiox }) {
  if (!logiox) return null;
  return (
    <div className="informe-bloque-preview">
      <div className="informe-bloque-titulo">Logiox</div>
      {logiox.modo === "imagen" ? (
        <PreviewImage src={mediaUrl(logiox.imagen)} />
      ) : (
        <PreviewTable columnas={logiox.tabla?.columnas} filas={logiox.tabla?.filas} />
      )}
    </div>
  );
}

function PreviewSolicitud({ detalle }) {
  return (
    <div className="informe-bloque-preview">
      <div className="informe-bloque-titulo">Solicitud</div>
      <div className="informe-bloque-box">
        <RichText html={detalle.solicitud} placeholder="Sin solicitud registrada" />
        {detalle.solicitud_imagenes?.length > 0 && (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {detalle.solicitud_imagenes.map((img) => (
              <PreviewImage key={img.id} src={mediaUrl(img.imagen)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewRecorrido({ detalle, esPositiva, segmentosRecorrido }) {
  const recorrido = detalle.recorrido;
  if (!recorrido?.imagen && !esPositiva) return null;

  return (
    <div className="informe-bloque-preview">
      <div className="informe-bloque-titulo">Recorrido</div>
      <PreviewImage src={mediaUrl(recorrido?.imagen)} />
      {esPositiva && (
        <div className="informe-bloque-box" style={{ marginTop: recorrido?.imagen ? 8 : 0 }}>
          <RichText html={recorrido?.texto_confirmacion} />
          <div style={{ marginTop: 10 }}>
            <RichText html={recorrido?.intro_texto} />
          </div>
          {segmentosRecorrido.length > 0 && (
            <div className="informe-bloque-texto" style={{ marginTop: 10 }}>
              {segmentosRecorrido.map((seg, index) => (
                <div key={seg.id} style={{ marginTop: 4 }}>
                  <strong>Parte {index + 1}:</strong> Entre los minutos <strong>{formatHora(seg.hora_inicio)}</strong> y{" "}
                  <strong>{formatHora(seg.hora_fin)}</strong>
                  {seg.observacion ? <> — {seg.observacion}</> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewEvidencia({ segmentosEvidencia }) {
  const soloUnEvento = segmentosEvidencia.length === 1;
  return (
    <div className="informe-bloque-preview">
      <div className="informe-bloque-titulo">Evidencia de cámaras</div>
      <div className="informe-bloque-box">
        {segmentosEvidencia.length === 0 && (
          <span className="informe-bloque-placeholder">Sin eventos registrados</span>
        )}
        {segmentosEvidencia.map((seg, index) => {
          const evento = seg.eventos[0];
          return (
            <div
              key={seg.id}
              style={{
                marginTop: index === 0 ? 0 : 14,
                paddingTop: index === 0 ? 0 : 14,
                borderTop: index === 0 ? "none" : "1px dashed #ddd",
              }}
            >
              <div className="informe-bloque-texto">
                <strong>{soloUnEvento ? "Novedad Puntual" : `Evento ${index + 1}`}:</strong> Entre el minuto{" "}
                <strong>{formatHora(seg.hora_inicio)}</strong> y el minuto <strong>{formatHora(seg.hora_fin)}</strong>
                {index === 0 && seg.observacion ? <> — {seg.observacion}</> : null}
              </div>
              {evento?.descripcion && (
                <div style={{ marginTop: 6 }}>
                  <RichText html={evento.descripcion} />
                </div>
              )}
              {evento?.evidencias?.map((ev) => (
                <div key={ev.id} style={{ marginTop: 6 }}>
                  <PreviewImage src={mediaUrl(ev.imagen)} />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviewMantenimientos({ detalle }) {
  const porTitulo = (titulo) => detalle.detalles?.find((d) => d.titulo === titulo);
  const inicial = porTitulo("Mantenimiento inicial");
  const final = porTitulo("Mantenimiento final");
  const diagnostico = porTitulo("Diagnóstico");
  const tabla = detalle.mantenimientos_tabla || {};

  return (
    <>
      <div className="informe-bloque-preview">
        <div className="informe-bloque-titulo">Mantenimiento inicial</div>
        <div className="informe-bloque-box">
          <RichText html={inicial?.observacion} placeholder="Sin información registrada" />
          {inicial?.imagen && <div style={{ marginTop: 8 }}><PreviewImage src={mediaUrl(inicial.imagen)} /></div>}
        </div>
      </div>

      <div className="informe-bloque-preview">
        <div className="informe-bloque-titulo">Mantenimiento final</div>
        <div className="informe-bloque-box">
          <RichText html={final?.observacion} placeholder="Sin información registrada" />
          {final?.imagen && <div style={{ marginTop: 8 }}><PreviewImage src={mediaUrl(final.imagen)} /></div>}
        </div>
      </div>

      <div className="informe-bloque-preview">
        <div className="informe-bloque-titulo">Mantenimientos anteriores</div>
        <PreviewTable columnas={tabla.columnas} filas={tabla.filas} />
        {detalle.mantenimientos_nota && (
          <div className="informe-bloque-texto" style={{ marginTop: 8 }}>NOTA: {detalle.mantenimientos_nota}</div>
        )}
      </div>

      <div className="informe-bloque-preview">
        <div className="informe-bloque-titulo">Diagnóstico</div>
        <div className="informe-bloque-box">
          <RichText html={diagnostico?.observacion} placeholder="Sin diagnóstico registrado" />
          {diagnostico?.imagen && <div style={{ marginTop: 8 }}><PreviewImage src={mediaUrl(diagnostico.imagen)} /></div>}
        </div>
      </div>
    </>
  );
}

function PreviewFooter({ anexos }) {
  return (
    <>
      <div className="informe-cierre-box">
        <div><strong><em>ANEXOS:</em></strong></div>
        <div style={{ marginTop: 4 }}>{anexos || "—"}</div>
      </div>
      <div className="informe-cierre-box">
        <p>Sírvase tomar este informe, en los términos y para los fines correspondientes.</p>
        <p style={{ marginTop: 8 }}>
          En apoyo del avance tecnológico para el control y seguimiento de vehículos, basado en las políticas de
          seguridad de los usuarios y control de procesos internos, a su vez <strong>COLFENIX GPS S.A.S.</strong> representa
          la administración y protección de datos de conformidad con lo previsto en la{" "}
          <strong>LEY 1581 DEL 17 DE OCTUBRE DE 2012</strong>, se presenta informe, aportando además a la{" "}
          <strong>RESPONSABILIDAD SOCIAL EMPRESARIAL</strong>, respetando la autonomía. Cabe decir además que{" "}
          <strong>COLFENIX GPS S.A.S.</strong> sus funcionarios/analistas no tienen injerencia en las decisiones.
        </p>
      </div>
      <div className="informe-firma">
        Atentamente,
        <br />
        <br />
        <strong>ANALISTA DE MEDIOS TECNOLÓGICOS – COLFENIX GPS S.A.S</strong>
      </div>
    </>
  );
}

const InformePreview = forwardRef(function InformePreview({ detalle }, ref) {
  const esPositiva = (detalle.resultado || "").toLowerCase() === "positiva";

  const segmentosRecorrido = useMemo(
    () => (detalle.segmentos || []).filter((s) => !s.eventos || s.eventos.length === 0),
    [detalle.segmentos],
  );
  const segmentosEvidencia = useMemo(
    () => (detalle.segmentos || []).filter((s) => s.eventos && s.eventos.length > 0),
    [detalle.segmentos],
  );

  return (
    <div ref={ref} className="informe-paper" style={{ maxHeight: "none", overflow: "visible" }}>
      <PreviewHeader detalle={detalle} />
      <PreviewLogiox logiox={detalle.logiox} />
      <PreviewSolicitud detalle={detalle} />
      <PreviewRecorrido detalle={detalle} esPositiva={esPositiva} segmentosRecorrido={segmentosRecorrido} />
      {esPositiva ? (
        <PreviewEvidencia segmentosEvidencia={segmentosEvidencia} />
      ) : (
        <PreviewMantenimientos detalle={detalle} />
      )}
      <PreviewFooter anexos={detalle.anexos} />
    </div>
  );
});

export default InformePreview;

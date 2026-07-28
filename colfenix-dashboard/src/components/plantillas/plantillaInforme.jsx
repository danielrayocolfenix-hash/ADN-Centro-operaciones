import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  Printer,
  AlertCircle,
  CheckCircle2,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Clock,
} from "lucide-react";
import { API_BASE } from "../../config/api";
import { getCsrfToken } from "../../utils/csrf";
import RichTextEditor from "./RichTextEditor";

const RESULTADOS = [
  { value: "positiva", label: "Positiva" },
  { value: "negativa", label: "Negativa" },
];

const nextId = () => `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DRAFT_KEY_PREFIX = "informe_draft_";

const readImageFile = (file, onLoad, onError) => {
  if (!file) return onError?.("No se proporcionó archivo");
  if (file.size && file.size > MAX_IMAGE_BYTES)
    return onError?.("El archivo supera el tamaño máximo recomendado (2 MB)");
  const reader = new FileReader();
  reader.onload = () => onLoad?.(reader.result);
  reader.onerror = () => onError?.("Error leyendo el archivo");
  reader.readAsDataURL(file);
};

// El HTML de un editor TipTap vacío no es "", es "<p></p>" — hay que quitar
// las etiquetas para saber si el analista realmente escribió algo.
const isRichTextEmpty = (html) => !html || !html.replace(/<[^>]*>/g, "").trim();

// El número de Anexos se sugiere solo: cada "Parte" que el usuario agrega en
// Recorrido (Parte 1, Parte 2...) es un clip de video distinto, así que en
// positiva el conteo es simplemente cuántas partes hay (en negativa parte de
// 0, no se confrontan segmentos). El analista puede corregirlo a mano si
// hace falta.
const contarClipsVideo = (resultado, recorridoSegmentos) => {
  if (resultado !== "positiva") return 0;
  return recorridoSegmentos.length;
};

// El singular/plural de "clip(s) de video(s)..." sigue siendo automático,
// calculado a partir de la cantidad (editada o no).
const construirSufijoAnexos = (cantidad) => {
  const plural = cantidad !== 1;
  return `clip${plural ? "s" : ""} de video${plural ? "s" : ""} con los registros de grabación.`;
};

// Las tablas (Logiox, Mantenimientos) tienen columnas de fecha/hora reales
// (no texto libre) — se infiere el tipo de input por el nombre de la columna
// para que "Fecha"/"FechaHora" usen un selector de fecha en vez de texto.
const inferCellInputType = (label = "") => {
  const norm = label.toLowerCase().replace(/\s+/g, "");
  if (norm.includes("fecha")) return "date";
  if (norm.includes("hora")) return "time";
  return "text";
};

// Vehículo/Placa ya están en la novedad — al agregar una fila se prellenan
// con esos valores (el analista los puede editar igual, es una celda normal).
const inferCellDefaultValue = (label = "", novedad) => {
  const norm = label.toLowerCase().replace(/\s+/g, "");
  if (norm.includes("vehiculo")) return novedad?.numero_interno || "";
  if (norm.includes("placa")) return novedad?.vehiculo || "";
  return "";
};

const pad2 = (v) => (v ? v.padStart(2, "0") : "00");
const parseHora = (value) => {
  const [h = "", m = "", s = ""] = (value || "").split(":");
  return { hh: h.slice(0, 2), mm: m.slice(0, 2), ss: s.slice(0, 2) };
};
const HOURS_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINSEC_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// Hora militar (24h) con segundos, ej. 13:20:59, en todos los campos de hora
// del constructor. El <input type="time"> nativo decide si muestra AM/PM
// según el idioma con el que está configurado el navegador (no según el
// atributo lang del elemento ni el de la página), así que no hay forma
// confiable de forzar 24h desde el código — por eso este campo es propio:
// se puede teclear, subir/bajar con flechas ↑/↓, o elegir desde el reloj
// (botón con ícono), y siempre se ve y se guarda en formato 24 horas.
function HoraInput({ value, onChange, style, bold }) {
  const [local, setLocal] = useState(() => parseHora(value));
  const [open, setOpen] = useState(false);
  const focusedRef = useRef(0);
  const hhRef = useRef(null);
  const mmRef = useRef(null);
  const ssRef = useRef(null);
  const wrapperRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (focusedRef.current > 0) return;
    setLocal(parseHora(value));
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open || !popoverRef.current) return;
    popoverRef.current.querySelectorAll(".paper-time-popover-active").forEach((el) => {
      el.scrollIntoView({ block: "center" });
    });
  }, [open]);

  const emit = (next) => {
    if (!next.hh && !next.mm && !next.ss) onChange("");
    else onChange(`${next.hh || "00"}:${next.mm || "00"}:${next.ss || "00"}`);
  };

  const setSegment = (key, val) => {
    const next = { ...local, [key]: val };
    setLocal(next);
    emit(next);
  };

  const handleFocus = () => {
    focusedRef.current += 1;
  };

  const handleBlur = () => {
    focusedRef.current = Math.max(0, focusedRef.current - 1);
    setTimeout(() => {
      if (focusedRef.current > 0) return;
      setLocal((prev) => {
        if (!prev.hh && !prev.mm && !prev.ss) return prev;
        const padded = { hh: pad2(prev.hh), mm: pad2(prev.mm), ss: pad2(prev.ss) };
        emit(padded);
        return padded;
      });
    }, 0);
  };

  const handleSegment = (key, max, nextRef) => (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
    let next = { ...local, [key]: digits };
    if (digits.length === 2) {
      next = { ...next, [key]: String(Math.min(parseInt(digits, 10), max)).padStart(2, "0") };
    }
    setLocal(next);
    emit(next);
    if (digits.length === 2 && nextRef?.current) {
      nextRef.current.focus();
      nextRef.current.select();
    }
  };

  const handleKeyDown = (key, max, prevRef) => (event) => {
    if (event.key === "Backspace" && !event.target.value && prevRef?.current) {
      prevRef.current.focus();
      prevRef.current.select();
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const current = parseInt(local[key] || "0", 10);
      const delta = event.key === "ArrowUp" ? 1 : -1;
      setSegment(key, String((current + delta + (max + 1)) % (max + 1)).padStart(2, "0"));
    }
  };

  const renderColumn = (key, options) => (
    <div className="paper-time-popover-col">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`paper-time-popover-btn${local[key] === opt ? " paper-time-popover-active" : ""}`}
          onClick={() => setSegment(key, opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );

  return (
    <span className="paper-time-input" style={{ fontWeight: bold ? 700 : 400, ...style }} ref={wrapperRef}>
      <input
        ref={hhRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="HH"
        className="paper-time-segment"
        value={local.hh}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleSegment("hh", 23, mmRef)}
        onKeyDown={handleKeyDown("hh", 23, null)}
      />
      <span className="paper-time-colon">:</span>
      <input
        ref={mmRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="MM"
        className="paper-time-segment"
        value={local.mm}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleSegment("mm", 59, ssRef)}
        onKeyDown={handleKeyDown("mm", 59, hhRef)}
      />
      <span className="paper-time-colon">:</span>
      <input
        ref={ssRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="SS"
        className="paper-time-segment"
        value={local.ss}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleSegment("ss", 59, null)}
        onKeyDown={handleKeyDown("ss", 59, mmRef)}
      />
      <button
        type="button"
        className="paper-time-clock-btn"
        title="Elegir hora"
        onClick={() => setOpen((o) => !o)}
      >
        <Clock size={13} />
      </button>
      {open && (
        <div className="paper-time-popover" ref={popoverRef}>
          {renderColumn("hh", HOURS_OPTIONS)}
          {renderColumn("mm", MINSEC_OPTIONS)}
          {renderColumn("ss", MINSEC_OPTIONS)}
        </div>
      )}
    </span>
  );
}

function TableButton({ onClick, title, icon, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#ccc] text-[#888] transition hover:border-[#999] hover:text-[#c00] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
    </button>
  );
}

// Único componente de tabla editable, ya con look de "papel" (bordes claros)
// porque su único destino ahora es vivir dentro del documento imprimible.
const EditableTable = React.memo(function EditableTable({ columns, rows, onColumnsChange, onRowsChange, novedad }) {
  const addColumn = useCallback(() => {
    onColumnsChange([...columns, { id: nextId(), label: "Nueva columna" }]);
  }, [columns, onColumnsChange]);

  const removeColumn = useCallback(
    (colId) => {
      if (!window.confirm("¿Quitar columna y eliminar sus celdas de las filas?")) return;
      onColumnsChange(columns.filter((column) => column.id !== colId));
      onRowsChange(
        rows.map((row) => {
          const { [colId]: removed, ...remaining } = row.cells;
          return { ...row, cells: remaining };
        }),
      );
    },
    [columns, rows, onColumnsChange, onRowsChange],
  );

  const renameColumn = useCallback(
    (colId, label) => onColumnsChange(columns.map((column) => (column.id === colId ? { ...column, label } : column))),
    [columns, onColumnsChange],
  );

  const addRow = useCallback(() => {
    const cells = {};
    columns.forEach((column) => {
      cells[column.id] = inferCellDefaultValue(column.label, novedad);
    });
    onRowsChange([...rows, { id: nextId(), cells }]);
  }, [columns, rows, onRowsChange, novedad]);

  const removeRow = useCallback(
    (rowId) => {
      if (!window.confirm("¿Quitar fila?")) return;
      onRowsChange(rows.filter((row) => row.id !== rowId));
    },
    [rows, onRowsChange],
  );

  const updateCell = useCallback(
    (rowId, colId, value) => {
      onRowsChange(
        rows.map((row) => (row.id !== rowId ? row : { ...row, cells: { ...row.cells, [colId]: value } })),
      );
    },
    [rows, onRowsChange],
  );

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table className="preview-mini-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id}>
                  <div className="flex items-center gap-1">
                    <input
                      className="w-full min-w-[70px] border-none bg-transparent text-[11px] font-bold text-[#333] outline-none"
                      value={column.label}
                      onChange={(event) => renameColumn(column.id, event.target.value)}
                    />
                    <button type="button" onClick={() => removeColumn(column.id)} className="text-[#999] hover:text-[#c00]">
                      <X size={12} />
                    </button>
                  </div>
                </th>
              ))}
              <th style={{ width: 34 }} className="paper-table-action-cell">
                <button
                  type="button"
                  onClick={addColumn}
                  className="flex h-6 w-6 items-center justify-center rounded border border-dashed border-[#bbb] text-[#888] hover:border-[#888]"
                  title="Añadir columna"
                >
                  <Plus size={12} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.id}>
                    {inferCellInputType(column.label) === "time" ? (
                      <HoraInput
                        value={row.cells[column.id] ?? ""}
                        onChange={(v) => updateCell(row.id, column.id, v)}
                      />
                    ) : (
                      <input
                        type={inferCellInputType(column.label)}
                        className="w-full min-w-[80px] border-none bg-transparent text-[11px] text-[#333] outline-none"
                        value={row.cells[column.id] ?? ""}
                        onChange={(event) => updateCell(row.id, column.id, event.target.value)}
                      />
                    )}
                  </td>
                ))}
                <td style={{ textAlign: "center" }} className="paper-table-action-cell">
                  <button type="button" onClick={() => removeRow(row.id)} className="text-[#999] hover:text-[#c00]">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1 rounded border border-dashed border-[#bbb] px-2 py-1 text-[11px] text-[#888] hover:border-[#888]"
      >
        <Plus size={12} /> Agregar fila
      </button>
    </div>
  );
});

// Acepta tanto el objeto nuevo {src, width, align, borderWidth, borderColor}
// como un string plano (data URL) de borradores guardados antes de este ajuste.
const normalizeImage = (value) =>
  !value
    ? null
    : typeof value === "string"
    ? { src: value, width: 100, align: "center", borderWidth: 0, borderColor: "#333333" }
    : value;

function ImagePreview({ img }) {
  return (
    <div style={{ textAlign: img.align }}>
      <img
        src={img.src}
        alt=""
        className="informe-imagen-preview-full"
        style={{
          width: `${img.width}%`,
          display: "inline-block",
          border: img.borderWidth > 0 ? `${img.borderWidth}px solid ${img.borderColor}` : "none",
        }}
      />
    </div>
  );
}

// Controles de la imagen: tamaño, alineación y borde (ancho + color) — todo
// editable directo sobre el papel, junto a la X para quitarla.
function ImageControls({ img, onUpdate, onRemove }) {
  return (
    <div className="paper-image-toolbar">
      <label className="paper-image-toolbar-item" title="Tamaño">
        <input type="range" min="20" max="100" value={img.width} onChange={(event) => onUpdate({ width: Number(event.target.value) })} />
        <span>{img.width}%</span>
      </label>
      <span className="paper-image-toolbar-align">
        <button type="button" onClick={() => onUpdate({ align: "left" })} className={img.align === "left" ? "active" : ""} title="Alinear a la izquierda">
          <AlignLeft size={12} />
        </button>
        <button type="button" onClick={() => onUpdate({ align: "center" })} className={img.align === "center" ? "active" : ""} title="Centrar">
          <AlignCenter size={12} />
        </button>
        <button type="button" onClick={() => onUpdate({ align: "right" })} className={img.align === "right" ? "active" : ""} title="Alinear a la derecha">
          <AlignRight size={12} />
        </button>
      </span>
      <label className="paper-image-toolbar-item" title="Ancho del borde">
        Borde
        <input
          type="number"
          min="0"
          max="12"
          value={img.borderWidth}
          onChange={(event) => onUpdate({ borderWidth: Number(event.target.value) })}
          style={{ width: 34 }}
        />
        px
      </label>
      <input
        type="color"
        value={img.borderColor}
        onChange={(event) => onUpdate({ borderColor: event.target.value })}
        title="Color del borde"
        className="paper-image-toolbar-color"
      />
      <button type="button" onClick={onRemove} title="Quitar imagen" className="paper-image-toolbar-remove">
        <X size={13} />
      </button>
    </div>
  );
}

const DEFAULT_ESTILO_CAJA = { borderWidth: 1, borderColor: "#333333" };

// Caja de contenido con borde configurable (ancho + color), igual que las
// imágenes: el analista decide a qué bloques del documento darles borde y
// de qué color, en vez de que todos lleven el mismo borde fijo.
function BloqueBox({ id, estilos, onEstilosChange, style, children }) {
  const estilo = (estilos && estilos[id]) || DEFAULT_ESTILO_CAJA;
  const updateEstilo = (patch) => onEstilosChange({ ...estilos, [id]: { ...estilo, ...patch } });

  return (
    <div style={style}>
      <div
        className="informe-bloque-box"
        style={{ border: estilo.borderWidth > 0 ? `${estilo.borderWidth}px solid ${estilo.borderColor}` : "none" }}
      >
        {children}
      </div>
      <div className="paper-box-toolbar">
        <label className="paper-box-toolbar-item" title="Ancho del borde">
          Borde
          <input
            type="number"
            min="0"
            max="8"
            value={estilo.borderWidth}
            onChange={(event) => updateEstilo({ borderWidth: Number(event.target.value) })}
            style={{ width: 32 }}
          />
          px
        </label>
        <input
          type="color"
          value={estilo.borderColor}
          onChange={(event) => updateEstilo({ borderColor: event.target.value })}
          title="Color del borde"
          className="paper-box-toolbar-color"
        />
      </div>
    </div>
  );
}

// Cargador de imagen "de papel": muestra la imagen con controles de tamaño/
// alineación/borde, o el botón de carga si todavía no hay ninguna.
function ImageField({ value, onChange, label = "Agregar imagen" }) {
  const [error, setError] = useState(null);
  const img = normalizeImage(value);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      readImageFile(
        file,
        (result) => {
          setError(null);
          onChange({ src: result, width: 100, align: "center", borderWidth: 0, borderColor: "#333333" });
        },
        setError,
      );
    },
    [onChange],
  );

  return (
    <div>
      {img ? (
        <>
          <ImagePreview img={img} />
          <ImageControls img={img} onUpdate={(patch) => onChange({ ...img, ...patch })} onRemove={() => onChange(null)} />
        </>
      ) : (
        <label className="paper-upload-label inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-[#bbb] px-3 py-2 text-xs text-[#888] transition hover:border-[#888]">
          <ImageIcon size={13} /> {label}
          <input type="file" accept="image/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
        </label>
      )}
      {error && <div className="mt-1 text-xs text-danger">{error}</div>}
    </div>
  );
}

// Variante de ImageField que acepta varias imágenes (ej. Solicitud puede
// traer más de una captura de correo), cada una con sus propios controles.
function MultiImageField({ images, onChange, label = "Adjuntar imagen" }) {
  const [error, setError] = useState(null);

  const addImage = useCallback(
    (file) => {
      if (!file) return;
      readImageFile(
        file,
        (result) => {
          setError(null);
          onChange([...images, { id: nextId(), src: result, width: 100, align: "center", borderWidth: 0, borderColor: "#333333" }]);
        },
        setError,
      );
    },
    [images, onChange],
  );

  const updateImage = (id, patch) => onChange(images.map((img) => (img.id === id ? { ...img, ...patch } : img)));
  const removeImage = (id) => onChange(images.filter((img) => img.id !== id));

  return (
    <div>
      {images.length > 0 && (
        <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
          {images.map((img) => (
            <div key={img.id}>
              <ImagePreview img={normalizeImage(img)} />
              <ImageControls
                img={normalizeImage(img)}
                onUpdate={(patch) => updateImage(img.id, patch)}
                onRemove={() => removeImage(img.id)}
              />
            </div>
          ))}
        </div>
      )}
      <label className="paper-upload-label inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-[#bbb] px-3 py-2 text-xs text-[#888] transition hover:border-[#888]">
        <ImageIcon size={13} /> {label}
        <input type="file" accept="image/*" className="hidden" onChange={(event) => addImage(event.target.files?.[0])} />
      </label>
      {error && <div className="mt-1 text-xs text-danger">{error}</div>}
    </div>
  );
}

const columnasLogioxDefault = [
  "FechaHora",
  "Placa",
  "Vehiculo",
  "Descripcion",
  "Viajo",
  "Oferta",
  "Conductor",
].map((label) => ({ id: nextId(), label }));

const columnasMantenimientosDefault = [
  "Fecha",
  "Vehiculo",
  "Placa",
  "Marca",
  "Categoria",
  "Tipo",
  "Motivo",
  "Diagnostico",
  "Accion",
  "Resultado",
].map((label) => ({ id: nextId(), label }));

// Texto fijo e importante del informe: siempre va, editable/con negrita si
// hace falta, pero no depende de ningún dato de la novedad para aparecer.
const TEXTO_CONFIRMACION_RECORRIDO =
  "Al confrontar el recorrido con la plataforma y verificando los registros de grabación contenidos dentro del disco duro se encuentra lo siguiente:";

const estadoInicialCompartido = () => ({
  logioxModo: "tabla",
  logioxColumnas: columnasLogioxDefault,
  logioxFilas: [],
  logioxImagen: null,
  solicitudTexto: "",
  solicitudImagenes: [],
  recorridoTextoConfirmacion: TEXTO_CONFIRMACION_RECORRIDO,
  recorridoIntroTexto: "",
  recorridoSegmentos: [],
  recorridoMapaImagen: null,
  estilosCajas: {},
});

const estadoInicialPositiva = () => ({
  eventosCamara: [{ id: nextId(), horaInicio: "", horaFin: "", descripcion: "", imagen: null }],
  notaEvidencia: "",
  estilosCajas: {},
});

const estadoInicialNegativa = () => ({
  mantenimientoInicialTexto: "",
  mantenimientoInicialImagen: null,
  mantenimientoFinalTexto: "",
  mantenimientoFinalImagen: null,
  mantenimientosColumnas: columnasMantenimientosDefault,
  mantenimientosFilas: [],
  notaMantenimientos: "",
  diagnosticoTexto: "",
  diagnosticoImagen: null,
  estilosCajas: {},
});

// ============ Bloques del documento (cada uno se edita directo ahí mismo) ============

function PaperHeader({ novedad, tituloInforme, onTituloChange, fecha, onFechaChange, hora, onHoraChange, version, onVersionChange }) {
  const codigo = novedad?.codigo_novedad || "NAS-XXXX";
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
              <input
                className="paper-inline-input informe-tipo-titulo"
                style={{ width: "100%", textAlign: "center" }}
                value={tituloInforme}
                onChange={(event) => onTituloChange(event.target.value)}
                aria-label="Título del encabezado"
              />
            </td>
            <td className="informe-header-meta-cell">
              <div className="informe-meta-codigo">{codigo}</div>
              <input
                type="date"
                className="paper-inline-input"
                style={{ width: "100%", textAlign: "center" }}
                value={fecha}
                onChange={(event) => onFechaChange(event.target.value)}
                aria-label="Fecha del informe"
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                Hora:
                <HoraInput value={hora} onChange={onHoraChange} />
              </div>
              <input
                className="paper-inline-input informe-meta-version"
                style={{ width: "100%", textAlign: "center" }}
                value={version}
                onChange={(event) => onVersionChange(event.target.value)}
                aria-label="Versión del informe"
              />
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

function PaperLogiox({ compartido, onChange, novedad }) {
  const upd = useCallback((field, value) => onChange({ ...compartido, [field]: value }), [compartido, onChange]);
  const modo = compartido.logioxModo || "tabla";

  return (
    <div className="informe-bloque-preview">
      <div className="informe-bloque-titulo" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Logiox</span>
        <span style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => upd("logioxModo", "tabla")}
            className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              modo === "tabla" ? "border-[#333] bg-[#333] text-white" : "border-[#ccc] text-[#888] hover:border-[#999]"
            }`}
          >
            Tabla
          </button>
          <button
            type="button"
            onClick={() => upd("logioxModo", "imagen")}
            className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              modo === "imagen" ? "border-[#333] bg-[#333] text-white" : "border-[#ccc] text-[#888] hover:border-[#999]"
            }`}
          >
            Imagen
          </button>
        </span>
      </div>
      {modo === "tabla" ? (
        <EditableTable
          columns={compartido.logioxColumnas}
          rows={compartido.logioxFilas}
          onColumnsChange={(value) => upd("logioxColumnas", value)}
          onRowsChange={(value) => upd("logioxFilas", value)}
          novedad={novedad}
        />
      ) : (
        <ImageField value={compartido.logioxImagen} onChange={(value) => upd("logioxImagen", value)} label="Cargar captura de Logiox" />
      )}
    </div>
  );
}

function PaperSolicitud({ compartido, onChange }) {
  const upd = useCallback((field, value) => onChange({ ...compartido, [field]: value }), [compartido, onChange]);
  return (
    <div className="informe-bloque-preview">
      <div className="informe-bloque-titulo">Solicitud</div>
      <BloqueBox id="solicitud" estilos={compartido.estilosCajas} onEstilosChange={(value) => upd("estilosCajas", value)}>
        <RichTextEditor
          value={compartido.solicitudTexto}
          onChange={(html) => upd("solicitudTexto", html)}
          placeholder="Pega o escribe el correo/petición del cliente..."
        />
        <div style={{ marginTop: 10 }}>
          <MultiImageField
            images={compartido.solicitudImagenes}
            onChange={(value) => upd("solicitudImagenes", value)}
            label="Adjuntar captura del correo"
          />
        </div>
      </BloqueBox>
    </div>
  );
}

function PaperRecorrido({ compartido, onChange, novedad, resultado }) {
  const upd = useCallback((field, value) => onChange({ ...compartido, [field]: value }), [compartido, onChange]);

  const addSegmento = () =>
    upd("recorridoSegmentos", [
      ...compartido.recorridoSegmentos,
      { id: nextId(), horaInicio: "", horaFin: "", etiqueta: "", horaNegrita: false },
    ]);
  const removeSegmento = (id) => upd("recorridoSegmentos", compartido.recorridoSegmentos.filter((s) => s.id !== id));
  const updateSegmento = (id, field, value) =>
    upd("recorridoSegmentos", compartido.recorridoSegmentos.map((s) => (s.id === id ? { ...s, [field]: value } : s)));

  // El párrafo "Se adjunta los segmentos..." se autocompleta una sola vez con
  // los datos que ya están en la novedad (vehículo, placa, fecha de la
  // novedad), con esos tres datos en negrita. Después queda libre para que
  // el analista lo edite/formatee sin que se le sobrescriba lo que escriba.
  // El texto "Al confrontar el recorrido..." es aparte: siempre está fijo
  // desde el estado inicial, no depende de datos de la novedad.
  useEffect(() => {
    if (resultado !== "positiva") return;
    if (!isRichTextEmpty(compartido.recorridoIntroTexto)) return;
    if (!novedad?.fecha_novedad) return;
    const html = `Se adjunta los segmentos de los registros de grabación del vehículo <strong>${novedad?.numero_interno || "—"}</strong>– Placa <strong>${novedad?.vehiculo || "—"}</strong>, del día <strong>${novedad.fecha_novedad}</strong>`;
    upd("recorridoIntroTexto", html);
  }, [resultado, novedad?.fecha_novedad, novedad?.numero_interno, novedad?.vehiculo]);

  return (
    <div className="informe-bloque-preview">
      <div className="informe-bloque-titulo">Recorrido</div>

      <ImageField value={compartido.recorridoMapaImagen} onChange={(value) => upd("recorridoMapaImagen", value)} label="Agregar mapa de recorrido" />

      {resultado === "positiva" && (
        <BloqueBox
          id="recorridoIntro"
          estilos={compartido.estilosCajas}
          onEstilosChange={(value) => upd("estilosCajas", value)}
          style={{ marginTop: 8 }}
        >
          <RichTextEditor
            value={compartido.recorridoTextoConfirmacion}
            onChange={(html) => upd("recorridoTextoConfirmacion", html)}
            placeholder="Al confrontar el recorrido con la plataforma..."
          />
          <div style={{ marginTop: 10 }}>
            <RichTextEditor
              value={compartido.recorridoIntroTexto}
              onChange={(html) => upd("recorridoIntroTexto", html)}
              placeholder="Ej: Se adjunta los segmentos de los registros de grabación..."
            />
          </div>

          {compartido.recorridoSegmentos.length > 0 && (
            <div className="informe-bloque-texto" style={{ marginTop: 10 }}>
              {compartido.recorridoSegmentos.map((segmento, index) => (
                <div key={segmento.id} style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  <strong>Parte {index + 1}:</strong> Entre los minutos
                  <HoraInput value={segmento.horaInicio} onChange={(v) => updateSegmento(segmento.id, "horaInicio", v)} bold={segmento.horaNegrita} />
                  y
                  <HoraInput value={segmento.horaFin} onChange={(v) => updateSegmento(segmento.id, "horaFin", v)} bold={segmento.horaNegrita} />
                  <button
                    type="button"
                    onClick={() => updateSegmento(segmento.id, "horaNegrita", !segmento.horaNegrita)}
                    title="Negrita en la hora"
                    className={`flex h-6 w-6 items-center justify-center rounded border text-[11px] font-bold ${
                      segmento.horaNegrita ? "border-[#333] bg-[#333] text-white" : "border-[#ccc] text-[#888] hover:border-[#999]"
                    }`}
                  >
                    B
                  </button>
                  <input
                    className="paper-inline-input"
                    placeholder="Ej: Novedad Puntual"
                    style={{ width: 140 }}
                    value={segmento.etiqueta}
                    onChange={(e) => updateSegmento(segmento.id, "etiqueta", e.target.value)}
                  />
                  <TableButton onClick={() => removeSegmento(segmento.id)} title="Quitar parte" icon={<X size={12} />} />
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addSegmento}
            className="mt-3 inline-flex items-center gap-1 rounded border border-dashed border-[#bbb] px-2 py-1 text-[11px] text-[#888] hover:border-[#888]"
          >
            <Plus size={12} /> Agregar otra parte
          </button>
        </BloqueBox>
      )}
    </div>
  );
}

function PaperEvidencia({ data, onChange }) {
  const upd = useCallback((field, value) => onChange({ ...data, [field]: value }), [data, onChange]);
  const addEvento = () => upd("eventosCamara", [...data.eventosCamara, { id: nextId(), horaInicio: "", horaFin: "", descripcion: "", imagen: null }]);
  const removeEvento = (id) => upd("eventosCamara", data.eventosCamara.filter((event) => event.id !== id));
  const updateEvento = (id, field, value) =>
    upd("eventosCamara", data.eventosCamara.map((event) => (event.id === id ? { ...event, [field]: value } : event)));

  const [notaAbierta, setNotaAbierta] = useState(Boolean(data.notaEvidencia));
  const soloUnEvento = data.eventosCamara.length === 1;

  return (
    <div className="informe-bloque-preview">
      <div className="informe-bloque-titulo">Evidencia de cámaras</div>
      <BloqueBox id="evidencia" estilos={data.estilosCajas} onEstilosChange={(value) => upd("estilosCajas", value)}>
        {notaAbierta ? (
          <div className="informe-bloque-texto" style={{ marginBottom: 10 }}>
            Nota:{" "}
            <input
              className="paper-inline-input"
              style={{ width: 320 }}
              placeholder="Ej: la cámara del pasillo 1 presentaba intermitencia"
              value={data.notaEvidencia}
              onChange={(event) => upd("notaEvidencia", event.target.value)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNotaAbierta(true)}
            className="mb-3 inline-flex items-center gap-1 text-[11px] text-[#999] hover:text-[#555]"
          >
            <Plus size={11} /> Agregar nota (opcional)
          </button>
        )}
        {data.eventosCamara.map((event, index) => (
          <div key={event.id} style={{ marginTop: index === 0 ? 0 : 14, paddingTop: index === 0 ? 0 : 14, borderTop: index === 0 ? "none" : "1px dashed #ddd" }}>
            <div className="informe-bloque-texto" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <strong>{soloUnEvento ? "Novedad Puntual" : `Evento ${index + 1}`}:</strong> Entre el minuto
              <HoraInput value={event.horaInicio} onChange={(v) => updateEvento(event.id, "horaInicio", v)} />
              y el minuto
              <HoraInput value={event.horaFin} onChange={(v) => updateEvento(event.id, "horaFin", v)} />
              <span style={{ marginLeft: "auto" }}>
                <TableButton onClick={() => removeEvento(event.id)} title="Eliminar evento" icon={<Trash2 size={12} />} />
              </span>
            </div>
            <div style={{ marginTop: 6 }}>
              <RichTextEditor value={event.descripcion} onChange={(html) => updateEvento(event.id, "descripcion", html)} placeholder="Describe lo observado en el video..." />
            </div>
            <div style={{ marginTop: 6 }}>
              <ImageField value={event.imagen} onChange={(value) => updateEvento(event.id, "imagen", value)} label="Cargar imagen del evento" />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addEvento}
          className="mt-4 inline-flex items-center gap-1 rounded border border-dashed border-[#bbb] px-2 py-1 text-[11px] text-[#888] hover:border-[#888]"
        >
          <Plus size={12} /> Añadir evento
        </button>
      </BloqueBox>
    </div>
  );
}

function PaperMantenimientos({ data, onChange, novedad }) {
  const upd = useCallback((field, value) => onChange({ ...data, [field]: value }), [data, onChange]);

  return (
    <>
      <div className="informe-bloque-preview">
        <div className="informe-bloque-titulo">Mantenimiento inicial</div>
        <BloqueBox id="mantenimientoInicial" estilos={data.estilosCajas} onEstilosChange={(value) => upd("estilosCajas", value)}>
          <RichTextEditor
            value={data.mantenimientoInicialTexto}
            onChange={(html) => upd("mantenimientoInicialTexto", html)}
            placeholder="Estado del vehículo al momento de presentarse a mantenimiento..."
          />
          <div style={{ marginTop: 8 }}>
            <ImageField value={data.mantenimientoInicialImagen} onChange={(value) => upd("mantenimientoInicialImagen", value)} />
          </div>
        </BloqueBox>
      </div>

      <div className="informe-bloque-preview">
        <div className="informe-bloque-titulo">Mantenimiento final</div>
        <BloqueBox id="mantenimientoFinal" estilos={data.estilosCajas} onEstilosChange={(value) => upd("estilosCajas", value)}>
          <RichTextEditor
            value={data.mantenimientoFinalTexto}
            onChange={(html) => upd("mantenimientoFinalTexto", html)}
            placeholder="Diagnóstico y corrección aplicada..."
          />
          <div style={{ marginTop: 8 }}>
            <ImageField value={data.mantenimientoFinalImagen} onChange={(value) => upd("mantenimientoFinalImagen", value)} />
          </div>
        </BloqueBox>
      </div>

      <div className="informe-bloque-preview">
        <div className="informe-bloque-titulo">Mantenimientos anteriores</div>
        <EditableTable
          columns={data.mantenimientosColumnas}
          rows={data.mantenimientosFilas}
          onColumnsChange={(value) => upd("mantenimientosColumnas", value)}
          onRowsChange={(value) => upd("mantenimientosFilas", value)}
          novedad={novedad}
        />
        <div className="informe-bloque-texto" style={{ marginTop: 8 }}>
          NOTA:{" "}
          <input
            className="paper-inline-input"
            style={{ width: 340 }}
            placeholder="Ej: en enero no se presentó a mantenimiento"
            value={data.notaMantenimientos}
            onChange={(event) => upd("notaMantenimientos", event.target.value)}
          />
        </div>
      </div>

      <div className="informe-bloque-preview">
        <div className="informe-bloque-titulo">Diagnóstico</div>
        <BloqueBox id="diagnostico" estilos={data.estilosCajas} onEstilosChange={(value) => upd("estilosCajas", value)}>
          <RichTextEditor
            value={data.diagnosticoTexto}
            onChange={(html) => upd("diagnosticoTexto", html)}
            placeholder="Resultado técnico de la revisión del disco/DVR..."
          />
          <div style={{ marginTop: 8 }}>
            <ImageField value={data.diagnosticoImagen} onChange={(value) => upd("diagnosticoImagen", value)} />
          </div>
        </BloqueBox>
      </div>
    </>
  );
}

function PaperFooter({ anexosCantidad, onAnexosCantidadChange, anexosSufijo }) {
  return (
    <>
      <div className="informe-cierre-box">
        <div>
          <strong><em>ANEXOS:</em></strong>
        </div>
        <div style={{ marginTop: 4 }}>
          <input
            type="text"
            inputMode="numeric"
            className="paper-inline-input"
            style={{ width: 28, textAlign: "center" }}
            value={String(anexosCantidad).padStart(2, "0")}
            onChange={(event) => {
              const soloDigitos = event.target.value.replace(/\D/g, "");
              onAnexosCantidadChange(soloDigitos ? Math.min(99, parseInt(soloDigitos, 10)) : 0);
            }}
            aria-label="Cantidad de clips de video"
          />{" "}
          {anexosSufijo}
        </div>
      </div>
      <div className="informe-cierre-box">
        <p>Sírvase tomar este informe, en los términos y para los fines correspondientes.</p>
        <p style={{ marginTop: 8 }}>
          En apoyo del avance tecnológico para el control y seguimiento de vehículos, basado en las políticas de seguridad de los usuarios y control de procesos internos, a su vez <strong>COLFENIX GPS S.A.S.</strong> representa la administración y protección de datos de conformidad con lo previsto en la <strong>LEY 1581 DEL 17 DE OCTUBRE DE 2012</strong>, se presenta informe, aportando además a la <strong>RESPONSABILIDAD SOCIAL EMPRESARIAL</strong>, respetando la autonomía. Cabe decir además que <strong>COLFENIX GPS S.A.S.</strong> sus funcionarios/analistas no tienen injerencia en las decisiones.
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

export default function InformeBuilderPage({ novedad, onVolver, onGuardar }) {
  const [resultado, setResultado] = useState("positiva");
  const [tituloInforme, setTituloInforme] = useState("INFORME NOVEDAD – GERENCIA JURIDICA");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState(new Date().toTimeString().slice(0, 5));
  const [version, setVersion] = useState("Versión 5 de 2025");
  const [anexosCantidadManual, setAnexosCantidadManual] = useState(null);
  const [compartido, setCompartido] = useState(estadoInicialCompartido());
  const [dataPositiva, setDataPositiva] = useState(estadoInicialPositiva());
  const [dataNegativa, setDataNegativa] = useState(estadoInicialNegativa());
  const [errores, setErrores] = useState({});
  const [draftStatus, setDraftStatus] = useState(null);
  const [draftDisponible, setDraftDisponible] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardarError, setGuardarError] = useState(null);

  const currentData = useMemo(() => (resultado === "positiva" ? dataPositiva : dataNegativa), [resultado, dataNegativa, dataPositiva]);
  const anexosCantidadAuto = useMemo(
    () => contarClipsVideo(resultado, compartido.recorridoSegmentos),
    [resultado, compartido.recorridoSegmentos],
  );
  const anexosCantidad = anexosCantidadManual ?? anexosCantidadAuto;
  const anexosSufijo = construirSufijoAnexos(anexosCantidad);
  const anexosTexto = `${String(anexosCantidad).padStart(2, "0")} ${anexosSufijo}`;
  const draftKey = `${DRAFT_KEY_PREFIX}${novedad?.codigo_novedad || "nuevo"}`;

  useEffect(() => {
    try {
      if (localStorage.getItem(draftKey)) setDraftDisponible(true);
    } catch {
      /* ignore */
    }
  }, [draftKey]);

  const restaurarBorrador = useCallback(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      setResultado(draft.resultado ?? "positiva");
      setTituloInforme(draft.tituloInforme ?? tituloInforme);
      setFecha(draft.fecha ?? fecha);
      setHora(draft.hora ?? hora);
      setVersion(draft.version ?? version);
      if (draft.compartido) setCompartido(draft.compartido);
      if (draft.dataPositiva) setDataPositiva(draft.dataPositiva);
      if (draft.dataNegativa) setDataNegativa(draft.dataNegativa);
    } catch {
      /* ignore */
    }
    setDraftDisponible(false);
  }, [draftKey, fecha, hora, version, tituloInforme]);

  const descartarBorrador = useCallback(() => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setDraftDisponible(false);
  }, [draftKey]);

  const autosaveTimer = useRef(null);
  useEffect(() => {
    if (draftDisponible) return;
    setDraftStatus("saving");
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            resultado,
            tituloInforme,
            fecha,
            hora,
            version,
            compartido,
            dataPositiva,
            dataNegativa,
          }),
        );
        setDraftStatus("saved");
      } catch {
        setDraftStatus(null);
      }
    }, 900);
    return () => clearTimeout(autosaveTimer.current);
  }, [draftDisponible, compartido, dataNegativa, dataPositiva, draftKey, fecha, hora, resultado, tituloInforme, version]);

  const validar = useCallback(() => {
    const errors = {};
    if (!fecha) errors.fecha = true;
    if (!hora) errors.hora = true;

    if (resultado === "positiva") {
      const emptyBody = dataPositiva.eventosCamara.every((event) => isRichTextEmpty(event.descripcion) && !event.imagen);
      if (emptyBody) errors.cuerpoPositiva = true;
    } else {
      if (isRichTextEmpty(dataNegativa.diagnosticoTexto) && dataNegativa.mantenimientosFilas.length === 0) {
        errors.cuerpoNegativa = true;
      }
    }

    setErrores(errors);
    return Object.keys(errors).length === 0;
  }, [dataNegativa, dataPositiva, fecha, hora, resultado]);

  const handleGuardar = useCallback(async () => {
    if (!validar()) return;
    if (!novedad?.id) {
      setGuardarError("Esta novedad no tiene un id real — no se puede guardar el informe.");
      return;
    }

    const payload = {
      resultado,
      titulo_informe: tituloInforme,
      fecha,
      hora,
      version,
      compartido,
      cuerpo: currentData,
      anexos: anexosTexto,
    };

    setGuardando(true);
    setGuardarError(null);
    try {
      const res = await fetch(`${API_BASE}/api/novedades/${novedad.id}/generar-informe/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCsrfToken() },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const resultadoGuardado = await res.json();
      if (!resultadoGuardado.success) {
        throw new Error(resultadoGuardado.mensaje || "No se pudo guardar el informe.");
      }
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      if (onGuardar) onGuardar(resultadoGuardado.informe);
    } catch (err) {
      setGuardarError(err.message || "No se pudo guardar el informe.");
    } finally {
      setGuardando(false);
    }
  }, [anexosTexto, compartido, currentData, draftKey, fecha, hora, novedad, onGuardar, resultado, tituloInforme, version, validar]);

  const limpiarTodo = () => {
    if (!window.confirm("¿Limpiar todo el contenido del informe?")) return;
    setCompartido(estadoInicialCompartido());
    setDataPositiva(estadoInicialPositiva());
    setDataNegativa(estadoInicialNegativa());
    setErrores({});
  };

  return (
    <div className="space-y-6 text-ink">
      <header className="rounded-3xl border border-line bg-card p-6 shadow-xl shadow-card sm:flex sm:items-end sm:justify-between sm:gap-6">
        <div className="space-y-3">
          <button onClick={onVolver} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft transition hover:text-ink">
            <ArrowLeft size={18} /> Volver
          </button>
          <div className="space-y-1">
            <p className="text-sm uppercase tracking-[0.24em] text-accent">Constructor principal</p>
            <h1 className="text-3xl font-semibold text-ink">Generador de informes</h1>
            <p className="max-w-2xl text-sm text-ink-faint">Escribe directo sobre el documento — selecciona cualquier texto para darle formato.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-3xl border border-line bg-input p-1">
            {RESULTADOS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setResultado(option.value)}
                className={`rounded-3xl px-4 py-2 text-xs font-semibold transition ${
                  resultado === option.value
                    ? option.value === "positiva"
                      ? "bg-success-soft text-success"
                      : "bg-danger-soft text-danger"
                    : "text-ink-faint hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {draftStatus && !draftDisponible && (
            <span className="inline-flex items-center gap-2 rounded-full bg-hover px-4 py-2 text-sm text-ink ring-1 ring-line">
              {draftStatus === "saving" ? "Guardando borrador…" : <><CheckCircle2 size={14} /> Borrador guardado</>}
            </span>
          )}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-3xl border border-line bg-input px-4 py-3 text-sm font-semibold text-ink transition hover:border-accent hover:bg-hover"
          >
            <Printer size={16} /> Imprimir
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="inline-flex items-center gap-2 rounded-3xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} /> {guardando ? "Guardando…" : "Guardar informe"}
          </button>
        </div>
      </header>

      {guardarError && (
        <div className="rounded-3xl border border-line bg-danger-soft p-4 text-sm text-danger shadow-lg shadow-card">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle size={18} /> {guardarError}</div>
        </div>
      )}

      {draftDisponible && (
        <div className="rounded-3xl border border-line bg-warn-soft p-4 text-sm text-warn shadow-lg shadow-card sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-2 font-medium"><AlertCircle size={18} /> Se detectó un borrador guardado para este informe.</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={restaurarBorrador} className="rounded-3xl bg-warn px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">Restaurar</button>
            <button onClick={descartarBorrador} className="rounded-3xl border border-warn bg-transparent px-4 py-2 text-sm font-semibold text-warn transition hover:bg-warn-soft">Descartar</button>
          </div>
        </div>
      )}

      {Object.keys(errores).length > 0 && (
        <div className="rounded-3xl border border-line bg-danger-soft p-4 text-sm text-danger shadow-lg shadow-card">
          <div className="flex items-center gap-2 font-semibold"><AlertCircle size={18} /> Faltan campos por completar antes de guardar.</div>
        </div>
      )}

      <div className="informe-preview informe-paper" style={{ maxWidth: 820, margin: "0 auto", maxHeight: "none", overflow: "visible" }}>
        <PaperHeader
          novedad={novedad}
          tituloInforme={tituloInforme}
          onTituloChange={setTituloInforme}
          fecha={fecha}
          onFechaChange={setFecha}
          hora={hora}
          onHoraChange={setHora}
          version={version}
          onVersionChange={setVersion}
        />
        <PaperLogiox compartido={compartido} onChange={setCompartido} novedad={novedad} />
        <PaperSolicitud compartido={compartido} onChange={setCompartido} />
        <PaperRecorrido compartido={compartido} onChange={setCompartido} novedad={novedad} resultado={resultado} />
        {resultado === "positiva" ? (
          <PaperEvidencia data={dataPositiva} onChange={setDataPositiva} />
        ) : (
          <PaperMantenimientos data={dataNegativa} onChange={setDataNegativa} novedad={novedad} />
        )}
        <PaperFooter anexosCantidad={anexosCantidad} onAnexosCantidadChange={setAnexosCantidadManual} anexosSufijo={anexosSufijo} />
      </div>

      <div className="flex justify-center">
        <button type="button" onClick={limpiarTodo} className="text-xs text-ink-faint underline decoration-dotted hover:text-ink">
          Limpiar todo el informe
        </button>
      </div>
    </div>
  );
}

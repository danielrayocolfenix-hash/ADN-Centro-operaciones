import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../../config/api";

export default function DynamicForm({ endpoint, initialData, onSubmit, onCancel, hideActions = false }) {
  const [schema, setSchema] = useState(null);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Opciones de selects cargadas desde su propio "endpoint", indexadas por nombre de campo
  const [opcionesSelect, setOpcionesSelect] = useState({});
  // Selects agrupados (ej. Tipo Informe agrupado por Categoría): guarda la
  // respuesta cruda [{id, nombre, tipos:[{id,nombre}]}] tal como la devuelve
  // el endpoint, sin aplanar — se renderiza como <optgroup>.
  const [gruposSelect, setGruposSelect] = useState({});
  const [cargandoOpciones, setCargandoOpciones] = useState({});

  // Estado del autocompletado tipo "lookup" (ej. placa)
  const [sugerencias, setSugerencias] = useState([]);
  const [campoLookupActivo, setCampoLookupActivo] = useState(null);
  const [buscandoLookup, setBuscandoLookup] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRefs = useRef({});

  useEffect(() => {
    cargarFormulario();
  }, [endpoint]);

  // Cierra el dropdown de sugerencias al hacer click afuera del campo activo
  useEffect(() => {
    function handleClickFuera(e) {
      if (!campoLookupActivo) return;
      const wrapper = wrapperRefs.current[campoLookupActivo];
      if (wrapper && !wrapper.contains(e.target)) {
        setCampoLookupActivo(null);
        setSugerencias([]);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, [campoLookupActivo]);

  async function cargarFormulario() {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`${API_BASE}${endpoint}`);
      if (!response.ok) throw new Error(`Error ${response.status} al cargar formulario`);
      const data = await response.json();
      
      setSchema(data);

      // Valores iniciales: usa initialData si existe (modo edición),
      // si no, usa el default del schema o vacío según el tipo de campo.
      const valoresIniciales = {};
      data.campos.forEach((campo) => {
        if (initialData) {
          if (campo.tipo === "select" || campo.tipo === "select-agrupado") {
              const idField = `${campo.nombre}_id`;
              if (initialData[idField] !== undefined) {
                  valoresIniciales[campo.nombre] = initialData[idField];
              } else if (initialData[campo.nombre] !== undefined) {
                  valoresIniciales[campo.nombre] = initialData[campo.nombre];
              }
          } else if (initialData[campo.nombre] !== undefined) {
              valoresIniciales[campo.nombre] = initialData[campo.nombre];
          } else if (campo.default !== undefined) {
              valoresIniciales[campo.nombre] = campo.default;
          } else {
              valoresIniciales[campo.nombre] =
                  campo.tipo === "checkbox" ? false : "";
          }
      }
          });
      setFormData(valoresIniciales);

      cargarOpcionesSelects(data.campos);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }
  // Normaliza la respuesta de un endpoint de opciones sin importar si viene
  // como {value, label} (ej. /api/rutas/) o {id, nombre} (ej. /api/areas/, /api/tipo-informes/).
  function normalizarOpciones(data) {
    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      value: Number(item.value ?? item.id),
      label:
        item.label ??
        item.nombre ??
        item.nombre_grupo ??
        String(item.value ?? item.id),
    }));
  }

  // Carga, en paralelo, las opciones de cada select que declare "endpoint" en el schema.
  function cargarOpcionesSelects(campos) {
    const camposConEndpoint = campos.filter(
      (c) => (c.tipo === "select" || c.tipo === "select-agrupado") && c.endpoint
    );

    camposConEndpoint.forEach((campo) => {
      setCargandoOpciones((prev) => ({ ...prev, [campo.nombre]: true }));

      fetch(`${API_BASE}${campo.endpoint}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Error ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (campo.tipo === "select-agrupado") {
            setGruposSelect((prev) => ({ ...prev, [campo.nombre]: Array.isArray(data) ? data : [] }));
          } else {
            setOpcionesSelect((prev) => ({ ...prev, [campo.nombre]: normalizarOpciones(data) }));
          }
        })
        .catch((err) => {
          console.error(`Error cargando opciones de "${campo.nombre}":`, err);
          if (campo.tipo === "select-agrupado") {
            setGruposSelect((prev) => ({ ...prev, [campo.nombre]: [] }));
          } else {
            setOpcionesSelect((prev) => ({ ...prev, [campo.nombre]: [] }));
          }
        })
        .finally(() => {
          setCargandoOpciones((prev) => ({ ...prev, [campo.nombre]: false }));
        });
    });
  }

  function handleChange(nombre, valor) {
    setFormData((prev) => ({ ...prev, [nombre]: valor }));
    if (errors[nombre]) {
      setErrors((prev) => ({ ...prev, [nombre]: null }));
    }
  }

  // ── Autocompletado tipo "lookup" (placa) ───────────────────
  function handleChangeLookup(campo, valor) {
    handleChange(campo.nombre, valor);
    setCampoLookupActivo(campo.nombre);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const texto = valor.trim();
    if (texto.length < 2) {
      setSugerencias([]);
      return;
    }

    debounceRef.current = setTimeout(() => buscarLookup(campo, texto), 300);
  }

  async function buscarLookup(campo, texto) {
    setBuscandoLookup(true);
    try {
      const response = await fetch(
        `${API_BASE}${campo.endpoint}?q=${encodeURIComponent(texto)}`
      );
      if (!response.ok) throw new Error("Error en búsqueda");
      const data = await response.json();
      setSugerencias(data);
    } catch {
      setSugerencias([]);
    } finally {
      setBuscandoLookup(false);
    }
  }

  // Al elegir una sugerencia, copia cada key del item recibido hacia el campo
  // del formulario con el mismo "nombre" (ej. item.numero_interno -> formData.numero_interno).
  function seleccionarSugerencia(item) {
    setFormData((prev) => {
      const actualizado = { ...prev };
      schema.campos.forEach((campo) => {
        if (item[campo.nombre] !== undefined) {
          actualizado[campo.nombre] = item[campo.nombre];
        }
      });
      return actualizado;
    });
    setSugerencias([]);
    setCampoLookupActivo(null);
  }

  function validar() {
    const nuevosErrores = {};
    schema.campos.forEach((campo) => {
      const valor = formData[campo.nombre];
      if (campo.requerido && (valor === "" || valor === null || valor === undefined)) {
        nuevosErrores[campo.nombre] = "Este campo es obligatorio";
      }
      if (campo.tipo === "number" && valor !== "" && isNaN(Number(valor))) {
        nuevosErrores[campo.nombre] = "Debe ser un número válido";
      }
    });
    setErrors(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validar()) return;
    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      console.error("Error al guardar:", err);
      alert("No se pudo guardar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }


  function renderCampo(campo) {
    const valor = formData[campo.nombre] ?? "";
    const soloLectura = !!campo.readonly;

    switch (campo.tipo) {
      case "lookup":
        return (
          <div
            className="autocomplete-wrapper"
            ref={(el) => (wrapperRefs.current[campo.nombre] = el)}
          >
            <input
              type="text"
              className="form-input"
              autoComplete="off"
              value={valor}
              readOnly={soloLectura}
              onChange={(e) => handleChangeLookup(campo, e.target.value)}
              onFocus={() => {
                setCampoLookupActivo(campo.nombre);
              }}
              placeholder={`Escribe ${campo.label.toLowerCase()}...`}
            />
            {campoLookupActivo === campo.nombre && buscandoLookup && (
              <span className="autocomplete-loading">Buscando...</span>
            )}

            {campoLookupActivo === campo.nombre && !buscandoLookup && sugerencias.length > 0 && (
              <div className="autocomplete-dropdown">
                {sugerencias.map((item) => (
                  <div
                    key={item.id}
                    className="autocomplete-item"
                    onClick={() => seleccionarSugerencia(item)}
                  >
                    <span className="autocomplete-placa">{item.label ?? item.placa}</span>
                    <span className="autocomplete-detalle">
                      {item.numero_interno} · {item.cliente}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {campoLookupActivo === campo.nombre &&
              !buscandoLookup &&
              sugerencias.length === 0 &&
              (formData[campo.nombre] || "").trim().length >= 2 && (
                <div className="autocomplete-dropdown">
                  <div className="autocomplete-vacio">Sin coincidencias</div>
                </div>
              )}
          </div>
        );

      case "select": {
        const opciones = campo.endpoint
          ? opcionesSelect[campo.nombre] || []
          : campo.opciones || [];
        const cargando = cargandoOpciones[campo.nombre];

        return (
          <select
            className="form-select"
            value={valor != null ? String(valor) : ""}
            disabled={soloLectura || cargando}
            onChange={(e) =>
              handleChange(
                  campo.nombre,
                  e.target.value === "" ? "" : Number(e.target.value)
              )
          }
          >
            <option value="">{cargando ? "Cargando..." : "Seleccione..."}</option>
            {opciones.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        );
      }

      case "select-agrupado": {
        const grupos = gruposSelect[campo.nombre] || [];
        const cargando = cargandoOpciones[campo.nombre];

        return (
          <select
            className="form-select"
            value={valor != null ? String(valor) : ""}
            disabled={soloLectura || cargando}
            onChange={(e) =>
              handleChange(
                  campo.nombre,
                  e.target.value === "" ? "" : Number(e.target.value)
              )
          }
          >
            <option value="">{cargando ? "Cargando..." : "Seleccione..."}</option>
            {grupos.map((grupo) => (
              <optgroup key={grupo.id} label={grupo.nombre}>
                {grupo.tipos.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        );
      }

      case "checkbox":
        return (
          <input
            type="checkbox"
            className="form-checkbox"
            checked={!!valor}
            disabled={soloLectura}
            onChange={(e) => handleChange(campo.nombre, e.target.checked)}
          />
        );

      case "textarea":
        return (
          <textarea
            className="form-textarea"
            rows={campo.filas || 4}
            value={valor}
            readOnly={soloLectura}
            onChange={(e) => handleChange(campo.nombre, e.target.value)}
          />
        );

      case "number":
        return (
          <input
            type="number"
            className="form-input"
            value={valor}
            min={campo.min}
            max={campo.max}
            readOnly={soloLectura}
            onChange={(e) => handleChange(campo.nombre, e.target.value)}
          />
        );

      case "date":
      case "datetime-local":
        return (
          <input
            type={campo.tipo}
            className="form-input"
            value={valor}
            readOnly={soloLectura}
            onChange={(e) => handleChange(campo.nombre, e.target.value)}
          />
        );

      default:
        return (
          <input
            type="text"
            className="form-input"
            value={valor}
            readOnly={soloLectura}
            onChange={(e) => handleChange(campo.nombre, e.target.value)}
          />
        );
    }
  }

  if (loading) {
    return <p className="text-muted" style={{ fontSize: 13 }}>Cargando formulario...</p>;
  }

  if (loadError) {
    return (
      <div>
        <p className="text-danger" style={{ fontSize: 13, marginBottom: 12 }}>
          No se pudo cargar el formulario: {loadError}
        </p>
        <button type="button" className="btn btn-secondary" onClick={cargarFormulario}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <form id="dynamic-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        {schema.campos
          .filter((campo) => campo.tipo !== "hidden")
          .map((campo) => {
                  const esCheckbox = campo.tipo === "checkbox";
                  const esAnchoCompleto = campo.tipo === "textarea" || campo.colspan === 2;
                  const soloLectura = !!campo.readonly;

          return (
            <div
              key={campo.nombre}
              className={`form-group${soloLectura ? " form-group-autollenado" : ""}`}
              style={esAnchoCompleto ? { gridColumn: "1 / -1" } : undefined}
            >
              {esCheckbox ? (
                <label
                  className="form-label"
                  style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 0, cursor: soloLectura ? "default" : "pointer" }}
                >
                  {renderCampo(campo)}
                  <span style={{ textTransform: "none", fontWeight: 500 }}>
                    {campo.label}
                    {campo.requerido && <span className="req"> *</span>}
                  </span>
                </label>
              ) : (
                <>
                  <label className="form-label">
                    {campo.label}
                    {campo.requerido && <span className="req"> *</span>}
                    {soloLectura && (
                      <span className="autocomplete-tag" title="Se completa automáticamente, no editable">
                        auto
                      </span>
                    )}
                  </label>
                  {renderCampo(campo)}
                </>
              )}

              {errors[campo.nombre] && (
                <span className="text-danger" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
                  {errors[campo.nombre]}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!hideActions && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
              Cancelar
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}
    </form>
  );
}
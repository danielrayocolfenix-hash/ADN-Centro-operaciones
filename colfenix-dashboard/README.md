# COLFENIX GPS — Dashboard de Monitoreo Operativo

## 🚍 ¿Qué es esto?

Dashboard completo para el Centro de Monitoreo de COLFENIX GPS. Gestiona todo el ciclo operativo del transporte intermunicipal: clientes, novedades e informes legales.

---

## ✨ Módulos incluidos

### 1. Dashboard principal
- KPIs en tiempo real: vehículos activos, alertas críticas, novedades del día, informes pendientes
- Gráfica de novedades por día (semana actual)
- Distribución de novedades por tipo (dona)
- Tabla de novedades recientes
- Estado visual de la flota

### 2. Monitoreo en vivo
- Tarjetas de vehículos con actualización de velocidad cada 3 seg
- Indicadores de estado: En ruta / Detenido / Sin señal
- Velocímetro visual por unidad
- Panel de detalle al seleccionar un vehículo
- Botón para registrar novedad directamente desde la unidad

### 3. Gestión de clientes
- CRUD completo de clientes
- **Generador automático de código abreviado** (6 letras desde la razón social)
- Vista previa del código antes de guardar
- Filtros por estado y búsqueda
- Modal de detalle con toda la información

### 4. Registro de novedades
- Formulario dinámico: al seleccionar cliente, filtra sus vehículos
- Campos: tipo, prioridad, estado, descripción, heridos, daños materiales
- Filtros por estado y prioridad
- Acceso directo a generar informe legal desde la novedad
- Enlace al informe generado

### 5. Informes legales
- Generador de informe a partir de la novedad
- Preview de informe en formato documento oficial (logo, secciones, firmas)
- Botón de impresión / PDF
- Flujo automático: novedad → informe en un clic

---

## 🚀 Instalación y ejecución

### Requisitos
- Node.js 16+
- npm 8+

### Pasos

```bash
# 1. Entrar al directorio
cd colfenix-dashboard

# 2. Instalar dependencias
npm install

# 3. Iniciar en modo desarrollo
npm start
```

La aplicación abrirá en `http://localhost:3000`

---

## 📁 Estructura del proyecto

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx      # Navegación lateral
│   │   └── Topbar.jsx       # Barra superior
│   └── ui/
│       └── Toast.jsx        # Notificaciones
├── data/
│   └── mockData.js          # Datos de prueba
├── pages/
│   ├── DashboardPage.jsx    # Vista principal con KPIs
│   ├── MonitoreoPage.jsx    # Monitoreo en vivo
│   ├── ClientesPage.jsx     # Gestión de clientes
│   ├── NovedadesPage.jsx    # Registro de novedades
│   └── InformesPage.jsx     # Informes legales
├── utils/
│   └── helpers.js           # Funciones utilitarias
├── App.jsx                  # Raíz de la app con navegación
├── index.css                # Estilos globales (tema oscuro)
└── index.js                 # Punto de entrada
```

---

## 🔌 Integración con backend (próximos pasos)

El archivo `src/data/mockData.js` centraliza todos los datos de prueba.
Para conectar con un backend real, reemplaza las importaciones de `mockData.js`
por llamadas a tu API REST o integración con Google Sheets.

Ejemplo de reemplazo:
```js
// Antes (mock)
import { clientes } from "../data/mockData";

// Después (API)
const [clientes, setClientes] = useState([]);
useEffect(() => {
  fetch("/api/clientes").then(r => r.json()).then(setClientes);
}, []);
```

---

## 🎨 Tecnologías

- **React 18** — UI
- **Recharts** — Gráficas
- **Lucide React** — Iconografía
- **CSS Variables** — Sistema de diseño (tema oscuro GPS)
- **Google Fonts** — Inter + JetBrains Mono

---

*Desarrollado para COLFENIX GPS · Centro de Monitoreo Transporte Intermunicipal*

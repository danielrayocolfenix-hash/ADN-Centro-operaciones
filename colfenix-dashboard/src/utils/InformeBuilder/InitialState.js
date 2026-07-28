export const estadoInicialPositivo = () => {
    return {
        // Propiedades del estado inicial positivo
    };
};

export const estadoInicialNegativo = () => {
    return {
        // Propiedades del estado inicial negativo
    };
}

export const columnasLogioxDefault = () => {
    return [
        { id: "id", label: "ID", type: "number" },
        { id: "nombre", label: "Nombre", type: "string" },
        { id: "fecha", label: "Fecha", type: "date" },
    ]
}

export const ColumnasTrasabilidadDefault = () => {
    return [
        { id: "id", label: "ID", type: "number" },
        { id: "usuario", label: "Usuario", type: "string" },
        { id: "accion", label: "Acción", type: "string" },
    ]
}    
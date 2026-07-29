// `user.permisos` ya viene resuelto desde el backend (ver
// apps.configuracion.permisos.claves_de en Django): el catálogo completo de
// claves si el usuario es is_staff, o su set explícito si no. Acá no hace
// falta repetir esa lógica de "is_staff implica todo" — solo se pregunta
// si la clave está en la lista.
export function tienePermiso(user, clave) {
  return !!user?.permisos?.includes(clave);
}

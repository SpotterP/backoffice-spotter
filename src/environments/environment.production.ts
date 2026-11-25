// Valor de relleno: permite compilar en configuracion produccion sin inyectar nada
// (ng build local y el job verify de CI). La imagen de produccion reescribe este
// archivo con --build-arg API_URL antes de compilar; ver Dockerfile.
export const environment = {
  apiUrl: 'http://localhost:1337',
};

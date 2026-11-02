/**
 * Configuración del registro (pino). El sitio no recoge datos personales: el registro de peticiones guarda
 * solo método y dirección. Nunca la IP, el puerto, el user-agent ni las cabeceras del visitante.
 * Los errores del servidor se siguen registrando completos.
 */
export const loggerConfig = {
  serializers: {
    req: (req: { method?: string; url?: string }) => ({ method: req.method, url: req.url }),
  },
};

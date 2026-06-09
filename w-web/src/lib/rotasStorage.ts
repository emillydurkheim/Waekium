import type { Rota } from "@/types/rota";

export function buildMapsUrl(rota: Rota) {
  if (rota.mapsUrl) return rota.mapsUrl;

  const origem = encodeURIComponent(rota.origem);
  const destino = encodeURIComponent(rota.destino);

  return `https://www.google.com/maps/dir/${origem}/${destino}`;
}
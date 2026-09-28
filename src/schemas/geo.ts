import { z } from 'zod';

/** Query de `GET /api/public/geo/reverse`. */
export const geoReverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export type GeoReverseInput = z.infer<typeof geoReverseSchema>;

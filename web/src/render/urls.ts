/** Dirección pública de una imagen subida. La usan el servidor y el cliente por igual. */
export const uploadUrl = (imageId: string): string => `/uploads/${imageId}.webp`;

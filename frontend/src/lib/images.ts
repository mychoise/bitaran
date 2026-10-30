// Prepares a picked image for upload: checks the type and shrinks it in the browser so uploads
// stay small on slow mobile data (and, in the demo, fit in the browser's storage).

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class ImageProblem extends Error {}

/** Returns a PNG no larger than `maxPx` on its longest side. */
export async function prepareImage(file: File, maxPx = 512): Promise<Blob> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) throw new ImageProblem("Choose a PNG, JPEG or WebP image.");
  if (file.size > MAX_IMAGE_BYTES) throw new ImageProblem("Choose an image under 5 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageProblem("This image could not be read. Try another file.");
  }
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new ImageProblem("This image could not be read. Try another file.");
  return blob;
}

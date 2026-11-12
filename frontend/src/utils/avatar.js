// Resize large photos in the browser so the backend only receives small profile images.
const VALID_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 400 * 1024;

export async function prepareAvatar(file) {
  if (!file || !VALID_TYPES.has(file.type)) throw new Error('Choose a JPG, PNG or WebP photo.');
  if (file.size > MAX_FILE_BYTES) throw new Error('Choose a photo smaller than 8 MB.');

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('This photo cannot be opened.'));
      element.src = url;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error('This photo is empty.');
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Photo processing is not supported by this browser.');
    ctx.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2,
      side, side, 0, 0, 384, 384);
    const data = canvas.toDataURL('image/jpeg', 0.82);
    if (Math.ceil((data.length - data.indexOf(',') - 1) * 3 / 4) > MAX_UPLOAD_BYTES) {
      throw new Error('This photo is too large after resizing. Try another image.');
    }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

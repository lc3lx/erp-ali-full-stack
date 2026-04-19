const MAX_IMAGE_DATA_URL_LENGTH = 850_000;

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("تعذر قراءة ملف الصورة."));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذر معالجة الصورة."));
    img.src = src;
  });
}

export async function optimizeImageFile(file) {
  const rawDataUrl = await readFileAsDataUrl(file);
  if (!rawDataUrl.startsWith("data:image/")) {
    throw new Error("يرجى اختيار ملف صورة صالح.");
  }
  const img = await loadImage(rawDataUrl);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر تجهيز الصورة.");

  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.9;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > MAX_IMAGE_DATA_URL_LENGTH && quality > 0.45) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }

  if (out.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("الصورة كبيرة جداً. اختر صورة أصغر.");
  }
  return out;
}

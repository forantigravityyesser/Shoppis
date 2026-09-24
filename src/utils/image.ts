/**
 * Порт utils/imageOptimizer из старого проекта.
 * Сжимает картинку через canvas (WebP) перед загрузкой в наш Storage.
 * В БД base64 НЕ пишем — возвращаем File для uploadFile().
 */
export async function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.8,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);

    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          const newFileName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
          resolve(new File([blob], newFileName, { type: 'image/webp', lastModified: Date.now() }));
        },
        'image/webp',
        quality,
      );
    };
    img.onerror = (err) => reject(err);

    reader.readAsDataURL(file);
  });
}

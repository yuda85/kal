// The owner's photo for the check-in lives only on this device (never in Firestore or the public repo).
const KEY = 'kal.checkinPhoto';

export function loadPhoto(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function savePhoto(dataUrl: string): boolean {
  try {
    localStorage.setItem(KEY, dataUrl);
    return true;
  } catch {
    return false;
  }
}

/** A phone photo is several MB; a JPEG at most `maxSide` px fits easily in local storage. */
export async function shrinkPhoto(file: Blob, maxSide = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

import mammoth from 'mammoth';
// @ts-ignore - Direct import for Vercel
import pdf from 'pdf-parse/lib/pdf-parse.js';

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  contentType?: string | null,
) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const normalizedType = contentType?.toLowerCase() ?? '';

  if (extension === 'pdf' || normalizedType.includes('pdf')) {
    const parsed = await pdf(buffer);
    return normalizeExtractedText(parsed.text ?? '');
  }

  if (
    extension === 'docx' ||
    normalizedType.includes('wordprocessingml') ||
    normalizedType.includes('msword')
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return normalizeExtractedText(parsed.value ?? '');
  }

  throw new Error('Formato no soportado para digitalización. Usa PDF o DOCX.');
}

import mammoth from 'mammoth';
// @ts-ignore - Direct import for Vercel
import pdf from 'pdf-parse/lib/pdf-parse.js';

const DEFAULT_PDF_MAX_PAGES = 24;

function resolvePdfMaxPages() {
  const configured = Number(process.env.WRITING_PDF_MAX_PAGES ?? DEFAULT_PDF_MAX_PAGES);
  if (!Number.isFinite(configured)) {
    return DEFAULT_PDF_MAX_PAGES;
  }
  return Math.max(4, Math.min(80, Math.trunc(configured)));
}

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
    const parsed = await pdf(buffer, { max: resolvePdfMaxPages() });
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

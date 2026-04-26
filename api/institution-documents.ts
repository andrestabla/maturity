import { getIntegrationConfig } from '../lib/admin-center.js';
import { errorResponse, jsonResponse } from '../lib/http.js';
import { getSessionUser } from '../lib/session.js';
import { canManageCourses } from '../lib/permissions.js';
import { getR2Object, deleteR2Object } from '../lib/r2.js';
import {
  getInstitutionDocuments,
  addInstitutionDocument,
  deleteInstitutionDocument,
  countInstitutionDocuments,
} from '../lib/store.js';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import pdf from 'pdf-parse/lib/pdf-parse.js';

export const config = {
  runtime: 'nodejs',
};

async function extractText(buffer: Buffer, contentType: string, name: string): Promise<string> {
  try {
    if (contentType.includes('pdf') || name.endsWith('.pdf')) {
      return (await pdf(buffer)).text;
    }
    if (contentType.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) {
      return (await mammoth.extractRawText({ buffer })).value;
    }
    if (contentType.includes('excel') || contentType.includes('spreadsheet') || name.endsWith('.xls') || name.endsWith('.xlsx')) {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      return XLSX.utils.sheet_to_txt(wb.Sheets[wb.SheetNames[0]]);
    }
    return buffer.toString('utf-8');
  } catch {
    return '';
  }
}

export default async function handler(request: Request | any, response?: any) {
  const isNodeRes = response && typeof response.write === 'function';
  const fail = (status: number, msg: string) =>
    isNodeRes ? response.status(status).json({ error: msg }) : errorResponse(status, msg);

  const user = await getSessionUser(request);
  if (!user) return fail(401, 'Authentication required');
  if (!canManageCourses(user.role)) return fail(403, 'Permisos insuficientes.');

  const url = new URL(
    request.url ?? '',
    `http://${request.headers?.host ?? 'localhost'}`,
  );
  const institutionId = url.searchParams.get('institutionId');
  const docId = url.searchParams.get('id');

  // ── GET: list documents ──────────────────────────────────────────────────
  if (request.method === 'GET') {
    if (!institutionId) return fail(400, 'institutionId is required');
    const documents = await getInstitutionDocuments(institutionId);
    if (isNodeRes) return response.status(200).json({ documents });
    return jsonResponse({ documents });
  }

  // ── POST: register a doc (r2Key already uploaded) + extract text ─────────
  if (request.method === 'POST') {
    if (!institutionId) return fail(400, 'institutionId is required');

    const count = await countInstitutionDocuments(institutionId);
    if (count >= 5) return fail(400, 'Máximo 5 documentos por institución.');

    let body: { r2Key?: string; name?: string; contentType?: string } = {};
    if (typeof request.json === 'function') {
      try { body = await request.json(); } catch (e) {}
    } else if (request.body) {
      body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    }

    if (!body.r2Key || !body.name) return fail(400, 'r2Key and name are required');

    const r2Config = await getIntegrationConfig('cloudflare-r2');
    const r2Resp = await getR2Object(body.r2Key, r2Config);
    let extractedText = '';
    if (r2Resp.ok) {
      const buf = Buffer.from(await r2Resp.arrayBuffer());
      extractedText = (await extractText(buf, body.contentType ?? '', body.name)).slice(0, 50000);
    }

    const doc = await addInstitutionDocument(institutionId, {
      r2Key: body.r2Key,
      name: body.name,
      contentType: body.contentType ?? 'application/octet-stream',
      extractedText: extractedText || undefined,
    });

    if (isNodeRes) return response.status(201).json({ document: doc });
    return jsonResponse({ document: doc }, { status: 201 });
  }

  // ── DELETE: remove document ──────────────────────────────────────────────
  if (request.method === 'DELETE') {
    if (!docId) return fail(400, 'id is required');
    const deleted = await deleteInstitutionDocument(docId);
    if (deleted) {
      const r2Config = await getIntegrationConfig('cloudflare-r2');
      await deleteR2Object(deleted.r2Key, r2Config).catch(() => {});
    }
    if (isNodeRes) return response.status(200).json({ ok: true });
    return jsonResponse({ ok: true });
  }

  return fail(405, 'Method not allowed');
}

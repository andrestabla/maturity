import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { getSql } from '../../lib/db.js';

export const config = { runtime: 'nodejs' };

/**
 * GET /api/library/metrics
 * Returns reutilization metrics for library assets:
 *   - Per-asset link count (how many courses reference each asset)
 *   - Top reused assets
 *   - Provider distribution
 *   - Recent activity
 *
 * Query params:
 *   ?scope=global        — all assets (Admin/Coordinator only)
 *   ?scope=course&slug=X — assets linked to a specific course
 *   ?top=10              — number of top-reused assets to return
 */
export default async function handler(request: Request) {
  const user = await getSessionUser(request);
  if (!user) return errorResponse(401, 'No autorizado');

  if (request.method !== 'GET') return errorResponse(405, 'Método no permitido');

  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') || 'global';
  const slug = url.searchParams.get('slug') || '';
  const topN = Math.min(parseInt(url.searchParams.get('top') || '10', 10), 50);

  const sql = getSql();

  try {
    // 1. Top reused assets (across all courses)
    const topReused = await sql`
      SELECT
        a.id,
        a.title,
        a.provider,
        a.group_name as "group",
        a.resource_type as "resourceType",
        a.canonical_url as "canonicalUrl",
        a.open_access as "openAccess",
        a.citation_count as "citationCount",
        COUNT(cl.id)::int as "linkCount",
        COUNT(DISTINCT cl.course_slug)::int as "courseCount",
        MAX(cl.added_at) as "lastLinkedAt"
      FROM maturity_library_assets a
      INNER JOIN maturity_library_course_links cl ON cl.asset_id = a.id
      ${scope === 'course' && slug
        ? sql`WHERE cl.course_slug = ${slug}`
        : sql``}
      GROUP BY a.id
      ORDER BY "linkCount" DESC
      LIMIT ${topN}
    `;

    // 2. Provider distribution
    const providerDist = await sql`
      SELECT
        a.provider,
        COUNT(DISTINCT a.id)::int as "assetCount",
        COUNT(cl.id)::int as "linkCount"
      FROM maturity_library_assets a
      LEFT JOIN maturity_library_course_links cl ON cl.asset_id = a.id
      GROUP BY a.provider
      ORDER BY "linkCount" DESC
    `;

    // 3. Group distribution
    const groupDist = await sql`
      SELECT
        a.group_name as "group",
        COUNT(DISTINCT a.id)::int as "assetCount",
        COUNT(cl.id)::int as "linkCount"
      FROM maturity_library_assets a
      LEFT JOIN maturity_library_course_links cl ON cl.asset_id = a.id
      GROUP BY a.group_name
      ORDER BY "linkCount" DESC
    `;

    // 4. Recent activity (last 20 links)
    const recentLinks = await sql`
      SELECT
        cl.id,
        cl.course_slug as "courseSlug",
        cl.target_unit as "targetUnit",
        cl.added_at as "addedAt",
        a.title as "assetTitle",
        a.provider,
        a.resource_type as "resourceType"
      FROM maturity_library_course_links cl
      INNER JOIN maturity_library_assets a ON a.id = cl.asset_id
      ORDER BY cl.added_at DESC
      LIMIT 20
    `;

    // 5. Summary stats
    const [stats] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM maturity_library_assets) as "totalAssets",
        (SELECT COUNT(*)::int FROM maturity_library_course_links) as "totalLinks",
        (SELECT COUNT(DISTINCT course_slug)::int FROM maturity_library_course_links) as "coursesWithLinks",
        (SELECT COUNT(DISTINCT asset_id)::int FROM maturity_library_course_links) as "linkedAssets"
    `;

    return jsonResponse({
      ok: true,
      scope,
      stats,
      topReused,
      providerDistribution: providerDist,
      groupDistribution: groupDist,
      recentActivity: recentLinks,
    });
  } catch (err) {
    console.error('[LibraryMetrics] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error al obtener métricas');
  }
}

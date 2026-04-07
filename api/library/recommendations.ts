import { errorResponse, jsonResponse } from '../../lib/http.js';
import { getSessionUser } from '../../lib/session.js';
import { getSql } from '../../lib/db.js';

export const config = { runtime: 'edge' };

/**
 * GET /api/library/recommendations?courseSlug=X
 * Returns AI-based resource suggestions for a given course:
 *   1. Finds the course's modules/units and learning objectives
 *   2. Checks which assets are already linked
 *   3. Searches the existing library_assets pool for unlinked matches
 *   4. Scores by relevance (keyword overlap + provider diversity + recency)
 *
 * If OPENAI_API_KEY is set, uses GPT to rank and justify recommendations.
 * Otherwise falls back to keyword-based heuristic matching.
 */
export default async function handler(request: Request) {
  try {
  const user = await getSessionUser(request);
  if (!user) return errorResponse(401, 'No autorizado');

  if (request.method !== 'GET') return errorResponse(405, 'Método no permitido');

  const url = new URL(request.url);
  const courseSlug = url.searchParams.get('courseSlug');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '12', 10), 30);

  if (!courseSlug) {
    return errorResponse(400, 'Se requiere courseSlug');
  }

  const sql = getSql();

  try {
    // 1. Get course info and its modules
    const [course] = await sql`
      SELECT id, slug, title, description
      FROM maturity_courses
      WHERE slug = ${courseSlug}
      LIMIT 1
    `;

    if (!course) {
      return errorResponse(404, 'Curso no encontrado');
    }

    // 2. Get modules/units for keyword extraction
    const modules = await sql`
      SELECT id, title, description, stage
      FROM maturity_course_modules
      WHERE course_id = ${course.id}
      ORDER BY sort_order
    `;

    // 3. Already-linked assets excluded via SQL subquery in step 5

    // 4. Build keyword set from course + modules
    const keywords = extractKeywords([
      course.title,
      course.description || '',
      ...modules.map((m: any) =>
        `${m.title} ${m.description || ''}`
      ),
    ].join(' '));

    // 5. Search existing assets pool for unlinked matches
    //    Using a text search approach against title + abstract + tags
    const candidateAssets = await sql`
      SELECT
        id, title, authors, provider, group_name as "group",
        resource_type as "resourceType", canonical_url as "canonicalUrl",
        abstract, tags, open_access as "openAccess",
        citation_count as "citationCount", published_at as "publishedAt",
        preview_kind as "previewKind", thumbnail_url as "thumbnailUrl",
        embed_url as "embedUrl", language, doi
      FROM maturity_library_assets
      WHERE id NOT IN (
        SELECT asset_id FROM maturity_library_course_links WHERE course_slug = ${courseSlug}
      )
      ORDER BY citation_count DESC, updated_at DESC
      LIMIT 200
    `;

    // 6. Score and rank candidates by keyword relevance
    const scored: any[] = candidateAssets
      .map((asset: any) => {
        const assetText = [
          asset.title as string,
          (asset.abstract as string) || '',
          ...(Array.isArray(asset.tags) ? asset.tags : []),
        ].join(' ').toLowerCase();

        let score = 0;
        const matchedKeywords: string[] = [];

        for (const kw of keywords) {
          if (assetText.includes(kw)) {
            score += 1;
            matchedKeywords.push(kw);
          }
        }

        // Bonus for high citation count
        const citations = (asset.citationCount as number) || 0;
        if (citations > 100) score += 2;
        else if (citations > 10) score += 1;

        // Bonus for open access
        if (asset.openAccess) score += 0.5;

        // Bonus for recency
        const year = parseInt(((asset.publishedAt as string) || '').slice(0, 4), 10);
        if (year && year >= new Date().getFullYear() - 2) score += 1;

        return {
          ...asset,
          relevanceScore: score,
          matchedKeywords,
        };
      })
      .filter((a: any) => a.relevanceScore > 0)
      .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    // 7. Try AI enhancement if OPENAI_API_KEY is available
    let aiEnhanced = false;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && scored.length > 0) {
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            max_tokens: 1500,
            messages: [
              {
                role: 'system',
                content: 'You are an academic library assistant. Given a course description and a list of candidate resources, provide a brief justification (1 sentence) for why each resource is relevant to the course. Respond as a JSON array of objects with {id, justification} fields. Only include resources that are truly relevant.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  course: { title: course.title, description: course.description, modules: modules.map((m: any) => m.title) },
                  candidates: scored.slice(0, 15).map((a: any) => ({
                    id: a.id,
                    title: a.title,
                    abstract: (a.abstract || '').slice(0, 200),
                  })),
                }),
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json() as {
            choices: Array<{ message: { content: string } }>;
          };
          const content = aiData.choices?.[0]?.message?.content || '';
          try {
            const justifications = JSON.parse(content) as Array<{ id: string; justification: string }>;
            for (const j of justifications) {
              const match = scored.find((a: any) => a.id === j.id);
              if (match) {
                (match as Record<string, unknown>).aiJustification = j.justification;
              }
            }
            aiEnhanced = true;
          } catch {
            // AI returned invalid JSON, continue without justifications
          }
        }
      } catch {
        // OpenAI call failed, continue with keyword-based results
      }
    }

    return jsonResponse({
      ok: true,
      courseSlug,
      courseTitle: course.title,
      recommendations: scored,
      totalCandidates: candidateAssets.length,
      aiEnhanced,
      keywords: keywords.slice(0, 20),
    });
  } catch (err) {
    console.error('[LibraryRecommendations] Error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error al generar recomendaciones');
  }
  } catch (err) {
    console.error('[LibraryRecommendations] Unhandled error:', err);
    return errorResponse(500, err instanceof Error ? err.message : 'Error interno');
  }
}

/**
 * Extract meaningful keywords from text (Spanish + English academic terms)
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'de', 'del', 'en', 'un', 'una', 'y', 'o', 'que',
    'es', 'por', 'con', 'para', 'al', 'se', 'su', 'no', 'a', 'the', 'of', 'and',
    'in', 'to', 'for', 'is', 'on', 'with', 'this', 'that', 'are', 'an', 'be',
    'as', 'at', 'by', 'from', 'or', 'was', 'but', 'not', 'have', 'has', 'had',
    'will', 'can', 'do', 'does', 'did', 'been', 'being', 'its', 'más', 'como',
    'entre', 'sobre', 'sin', 'hacia', 'desde', 'cada', 'todo', 'todos', 'hasta',
  ]);

  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^a-záéíóúñü\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w))
  )];
}

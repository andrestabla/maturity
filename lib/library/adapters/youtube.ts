import type { LibrarySearchResult } from '../../../src/types.js';

/**
 * YouTube Data API Adapter
 */
export async function searchYouTube(query: string, apiKey: string): Promise<LibrarySearchResult[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q: query,
    maxResults: '25',
    key: apiKey,
  });

  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`YouTube API Error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json() as any;
  
  return (data.items || []).map((item: any): LibrarySearchResult => ({
    id: `yt-${item.id.videoId}`,
    canonicalKey: `youtube:${item.id.videoId}`,
    provider: 'youtube',
    providerRecordId: item.id.videoId,
    providers: ['youtube'],
    group: 'YouTube',
    title: item.snippet.title,
    authors: [item.snippet.channelTitle],
    publishedAt: item.snippet.publishedAt,
    abstract: item.snippet.description,
    descriptionHtml: '',
    canonicalUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    resourceType: 'Video',
    language: 'es',
    openAccess: true,
    citationCount: 0,
    thumbnailUrl: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
    embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
    visibility: 'Publico',
    previewKind: 'video',
    tags: [],
    metadata: {
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      liveBroadcastContent: item.snippet.liveBroadcastContent,
    },
    score: 1.0,
    sourceKinds: ['YouTube'],
    cached: false,
  }));
}

import librarySearchHandler from './library-search.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  return librarySearchHandler(request);
}

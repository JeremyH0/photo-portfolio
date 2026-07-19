import { createClient } from '@sanity/client';

const projectId = import.meta.env.SANITY_PROJECT_ID;
const dataset = import.meta.env.SANITY_DATASET ?? 'production';

if (!projectId) {
  throw new Error('SANITY_PROJECT_ID is missing — set it in .env (see .env.example)');
}

// Build-time only client (static output): CDN reads, no token needed.
export const sanity = createClient({
  projectId,
  dataset,
  apiVersion: '2026-07-01',
  useCdn: true,
});

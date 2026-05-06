// Future PocketBase persistence
// Connect to VITE_POCKETBASE_URL for production data storage.
// Collections: gms_rooms, gms_scripts, gms_script_versions, gms_hint_ladders,
//              gms_pronunciation_terms, gms_acknowledgements, gms_exports

import PocketBase from 'pocketbase';

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL ?? 'http://localhost:8090');

export default pb;

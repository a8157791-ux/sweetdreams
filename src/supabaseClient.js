import { createClient } from '@supabase/supabase-js';

// PROJECT.md에 있는 공개 키 (publishable key — 클라이언트에 노출돼도 안전한 키)
const SUPABASE_URL = 'https://febdxwxykxqvesbdevtg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xDQko-_qYz_R9T3VvD3Ahg_XNobQGzH';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

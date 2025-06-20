//GitHub/LeadTalksv1/whatsapp-core/supabase.js

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log(
  "[DEBUG] SUPABASE KEY em uso começa com:",
  SUPABASE_KEY.slice(0, 20)
);

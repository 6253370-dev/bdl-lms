// Resolves an employee_id to its email so the client can sign in.
// Public endpoint; only returns email (not sensitive given internal corporate use).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { employee_id } = await req.json();
    if (!employee_id) throw new Error("employee_id required");
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await admin
      .from("profiles").select("email").eq("employee_id", String(employee_id)).maybeSingle();
    if (error) throw error;
    if (!data) return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    return new Response(JSON.stringify({ email: data.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

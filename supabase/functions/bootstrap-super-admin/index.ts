// One-time bootstrap: creates the first super admin if none exists.
// Public endpoint, safe because it refuses to run if any super_admin already exists.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { employee_id, password, full_name, email, phone } = await req.json();
    if (!employee_id || !password || !full_name || !email) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Refuse if any super_admin already exists
    const { count, error: countErr } = await admin
      .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "super_admin");
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) {
      return new Response(JSON.stringify({ error: "Super admin already exists" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user (email confirmed)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, employee_id },
    });
    if (createErr) throw createErr;
    const userId = created.user!.id;

    const { error: profErr } = await admin.from("profiles").insert({
      id: userId, employee_id, full_name, email, phone: phone ?? null,
    });
    if (profErr) throw profErr;

    const { error: roleErr } = await admin.from("user_roles").insert({
      user_id: userId, role: "super_admin",
    });
    if (roleErr) throw roleErr;

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

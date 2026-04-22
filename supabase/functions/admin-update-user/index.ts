// Update user (roles, phone, password). Requires admin or super_admin.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: callerRoles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = callerRoles?.some((r) => ["admin", "super_admin"].includes(r.role));
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const { user_id, phone, password, roles, full_name } = await req.json();
    if (!user_id) throw new Error("user_id required");

    if (password) {
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;
    }
    const profileUpdates: Record<string, unknown> = {};
    if (phone !== undefined) profileUpdates.phone = phone;
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await admin.from("profiles").update(profileUpdates).eq("id", user_id);
      if (error) throw error;
    }
    if (Array.isArray(roles)) {
      await admin.from("user_roles").delete().eq("user_id", user_id);
      if (roles.length > 0) {
        const rows = roles.map((r: string) => ({ user_id, role: r }));
        const { error } = await admin.from("user_roles").insert(rows);
        if (error) throw error;
      }
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

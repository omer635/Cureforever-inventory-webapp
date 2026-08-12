import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { vendorId, password } = await req.json();

    if (!vendorId || !password || String(password).trim().length < 6) {
      return NextResponse.json({ error: "vendorId and a password of at least 6 characters are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: "Server not configured for password updates" }, { status: 500 });
    }

    // Only an already-authenticated admin may reset another account's password.
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sbCaller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: callerData, error: callerErr } = await sbCaller.auth.getUser(token);
    if (callerErr || !callerData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: callerVendor } = await sbCaller
      .from("vendors")
      .select("is_admin")
      .eq("user_id", callerData.user.id)
      .maybeSingle();
    if (!callerVendor?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const sbAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: vendor, error: vendorErr } = await sbAdmin
      .from("vendors")
      .select("user_id")
      .eq("id", vendorId)
      .single();
    if (vendorErr || !vendor?.user_id) {
      return NextResponse.json({ error: "This vendor has no linked login to reset" }, { status: 400 });
    }

    const { error: updateErr } = await sbAdmin.auth.admin.updateUserById(vendor.user_id, {
      password: String(password).trim(),
    });
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, address, phone, is_admin } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and Email are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json({ error: "Server not configured for account creation" }, { status: 500 });
    }

    // Only an already-authenticated admin may provision a new vendor login — this endpoint
    // can create accounts with is_admin=true, so it must never be reachable anonymously.
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

    let userId: string | null = null;
    if (password && String(password).trim().length >= 6) {
      const { data: userData, error: userError } = await sbAdmin.auth.admin.createUser({
        email: String(email).trim(),
        password: String(password).trim(),
        email_confirm: true,
        user_metadata: { name, is_admin: !!is_admin },
      });
      if (!userError && userData?.user) {
        userId = userData.user.id;
      } else if (userError) {
        return NextResponse.json({ error: userError.message }, { status: 500 });
      }
    }

    const payload = {
      user_id: userId,
      name: String(name).trim(),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : null,
      address: address ? String(address).trim() : null,
      state: address ? String(address).trim() : "HQ Location",
      is_admin: !!is_admin,
    };

    const { data: vendorData, error: vendorError } = await sbAdmin
      .from("vendors")
      .insert(payload)
      .select()
      .single();

    if (vendorError) {
      return NextResponse.json({ error: vendorError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, vendor: vendorData });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

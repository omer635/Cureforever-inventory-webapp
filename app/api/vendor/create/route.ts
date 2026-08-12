import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, address, phone, is_admin } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and Email are required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uchozkkzgqeismqvamye.supabase.co";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

    const sbAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let userId: string | null = null;

    if (password && String(password).trim().length >= 6) {
      // 1. Create Supabase Auth User
      const { data: userData, error: userError } = await sbAdmin.auth.admin.createUser({
        email: String(email).trim(),
        password: String(password).trim(),
        email_confirm: true,
        user_metadata: { name, is_admin: !!is_admin },
      });

      if (!userError && userData?.user) {
        userId = userData.user.id;
      } else {
        // Fallback: Try client signup if admin.createUser is restricted
        const sbAnon = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: signUpData } = await sbAnon.auth.signUp({
          email: String(email).trim(),
          password: String(password).trim(),
        });
        if (signUpData?.user) {
          userId = signUpData.user.id;
        }
      }
    }

    // 2. Insert vendor row into vendors table
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

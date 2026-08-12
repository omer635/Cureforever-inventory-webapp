import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const cleanEmail = String(email).trim();
    const cleanPassword = String(password).trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uchozkkzgqeismqvamye.supabase.co";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;

    const sbClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    // 1. Try standard sign in
    const { data: signData, error: signError } = await sbClient.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (!signError && signData.session) {
      return NextResponse.json({ session: signData.session });
    }

    // 2. Handle "Email not confirmed" or unconfirmed users
    if (signError && signError.message.toLowerCase().includes("email not confirmed")) {
      const sbAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      // Find user by email
      const { data: usersData } = await sbAdmin.auth.admin.listUsers();
      const targetUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail.toLowerCase()
      );

      if (targetUser) {
        // Auto-confirm user email and set password
        await sbAdmin.auth.admin.updateUserById(targetUser.id, {
          email_confirm: true,
          password: cleanPassword,
        });

        // Link user_id in vendors table
        await sbAdmin
          .from("vendors")
          .update({ user_id: targetUser.id })
          .ilike("email", cleanEmail);

        // Retry sign in
        const { data: retryData, error: retryErr } = await sbClient.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (!retryErr && retryData.session) {
          return NextResponse.json({ session: retryData.session });
        }
      }
    }

    return NextResponse.json({ error: signError?.message || "Invalid credentials" }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

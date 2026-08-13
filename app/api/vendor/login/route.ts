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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const sbClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { data: signData, error: signError } = await sbClient.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (!signError && signData.session) {
      return NextResponse.json({ session: signData.session });
    }

    // Only fall back to an admin-assisted retry when the account's email just isn't
    // confirmed yet — never on a wrong-password error, and never touch the account's
    // password here. A login endpoint must not be able to reset credentials for an
    // account it hasn't verified the caller actually owns.
    const isUnconfirmed = !!signError?.message?.toLowerCase().includes("email not confirmed");
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (isUnconfirmed && serviceRoleKey) {
      const sbAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
      });

      const { data: usersData } = await sbAdmin.auth.admin.listUsers();
      const targetUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail.toLowerCase()
      );

      if (targetUser) {
        await sbAdmin.auth.admin.updateUserById(targetUser.id, { email_confirm: true });

        await sbAdmin
          .from("vendors")
          .update({ user_id: targetUser.id })
          .ilike("email", cleanEmail)
          .is("user_id", null);

        const { data: retryData, error: retryErr } = await sbClient.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (!retryErr && retryData.session) {
          return NextResponse.json({ session: retryData.session });
        }
      }
    }

    if (isUnconfirmed && !serviceRoleKey) {
      return NextResponse.json(
        { error: "Email not confirmed. Please turn off 'Confirm email' in Supabase Dashboard (Auth -> Providers -> Email)." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: signError?.message || "Invalid credentials" }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

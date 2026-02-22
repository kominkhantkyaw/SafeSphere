// Supabase Edge Function: send confirmation email with 6-digit code (Resend)
// Deploy: supabase functions deploy send-confirmation-email
// Set secret: supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
// Resend: https://resend.com (free tier: 100 emails/day, use onboarding@resend.dev as sender)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
    email?: string;
    code?: string;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const apiKey = Deno.env.get('RESEND_API_KEY');
        if (!apiKey) {
            console.error('RESEND_API_KEY is not set');
            return new Response(
                JSON.stringify({ success: false, message: 'Email service not configured.' }),
                { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const body = (await req.json().catch(() => ({}))) as Body;
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        const code = typeof body.code === 'string' ? body.code.trim() : '';

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(
                JSON.stringify({ success: false, message: 'Valid email is required.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        if (!code || code.length !== 6) {
            return new Response(
                JSON.stringify({ success: false, message: 'Valid 6-digit code is required.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'SafeSphere <onboarding@resend.dev>',
                to: [email],
                subject: 'Your SafeSphere confirmation code',
                html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1e40af;">SafeSphere</h2>
  <p>Use this code to activate your account:</p>
  <p style="font-size: 28px; font-weight: bold; letter-spacing: 0.2em; color: #1e40af;">${code}</p>
  <p style="color: #6b7280; font-size: 14px;">This code expires in 24 hours. If you did not request an account, you can ignore this email.</p>
  <p style="color: #6b7280; font-size: 14px;">— SafeSphere</p>
</body>
</html>`,
            }),
        });

        const data = await res.json().catch(() => ({})) as { id?: string; message?: string };

        if (!res.ok) {
            console.error('Resend error:', res.status, data);
            return new Response(
                JSON.stringify({ success: false, message: data?.message || 'Failed to send email.' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, id: data?.id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (e) {
        console.error('send-confirmation-email error:', e);
        return new Response(
            JSON.stringify({ success: false, message: 'Server error.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

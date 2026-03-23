// Supabase Edge Function: send confirmation SMS with 6-digit code (Twilio)
// Deploy: supabase functions deploy send-confirmation-sms
// Set secrets:
//   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxx
//   supabase secrets set TWILIO_AUTH_TOKEN=xxxxxxxxxx
//   supabase secrets set TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
// Twilio: https://www.twilio.com (free trial gives you a phone number + credits)

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body {
    phone?: string;
    code?: string;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

        if (!accountSid || !authToken || !fromNumber) {
            console.error('Twilio credentials not configured');
            return new Response(
                JSON.stringify({
                    success: false,
                    message:
                        'SMS service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.',
                }),
                { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const body = (await req.json().catch(() => ({}))) as Body;
        const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
        const code = typeof body.code === 'string' ? body.code.trim() : '';

        if (!phone || phone.length < 8) {
            return new Response(
                JSON.stringify({ success: false, message: 'Valid phone number is required.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        if (!code || code.length !== 6) {
            return new Response(
                JSON.stringify({ success: false, message: 'Valid 6-digit code is required.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Send SMS via Twilio REST API
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const credentials = btoa(`${accountSid}:${authToken}`);

        const smsBody = new URLSearchParams({
            To: phone,
            From: fromNumber,
            Body: `Your SafeSphere confirmation code is: ${code}. This code expires in 24 hours.`,
        });

        const res = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: smsBody.toString(),
        });

        const data = (await res.json().catch(() => ({}))) as {
            sid?: string;
            message?: string;
            status?: string;
            error_message?: string;
        };

        if (!res.ok) {
            console.error('Twilio error:', res.status, data);
            return new Response(
                JSON.stringify({
                    success: false,
                    message: data?.error_message || data?.message || 'Failed to send SMS.',
                }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, sid: data?.sid }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (e) {
        console.error('send-confirmation-sms error:', e);
        return new Response(
            JSON.stringify({ success: false, message: 'Server error.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});

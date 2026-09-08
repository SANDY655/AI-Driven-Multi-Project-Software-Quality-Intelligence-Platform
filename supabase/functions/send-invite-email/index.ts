// In modern Deno/Supabase Edge Functions, we use Deno.serve directly

// Type definitions to fix 'Cannot find name Deno' in non-Deno IDEs
declare const Deno: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => void;
    env: {
        get: (key: string) => string | undefined;
    };
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: { method: string; json: () => any }) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        if (!RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY is not set in Edge Function secrets')
        }

        // Correctly parse the JSON body
        let reqBody;
        try {
            reqBody = await req.json()
        } catch (e) {
            throw new Error('Valid JSON body must be provided')
        }

        const { email, projectName, role, inviterName } = reqBody;

        if (!email || !projectName) {
            throw new Error('Missing required parameters: email or projectName')
        }

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: 'Project Team <onboarding@resend.dev>', // Update this to your verified domain when moving to production
                to: [email],
                subject: `You have been invited to join ${projectName}`,
                html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited!</h2>
            <p>Hello,</p>
            <p>You have been invited by <strong>${inviterName || 'a team member'}</strong> to join the project <strong>${projectName}</strong> as a <strong>${role || 'member'}</strong>.</p>
            <p>Please log in to the application to access your new project.</p>
            <br/>
            <p>Best regards,<br/>The Quality Intelligence Platform Team</p>
          </div>
        `,
            }),
        })

        const data = await res.json()

        if (!res.ok) {
            throw new Error(data.message || 'Failed to send email via Resend')
        }

        return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error: any) {
        console.error('Email sending error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})

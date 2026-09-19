import 'server-only';

type Message = {
  to: string;
  subject: string;
  text: string;
  /** Optional; console/Resend both accept text-only mail fine. */
  html?: string;
};

type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Never throws — callers decide what a failed send means (registration
 * still succeeds either way; a login/reset request should say "try again").
 * Provider is picked at call time, not at import time, so tests and the
 * create-admin script don't need a live provider configured.
 */
export async function sendEmail(message: Message): Promise<SendResult> {
  const provider = process.env.EMAIL_PROVIDER || 'console';
  try {
    switch (provider) {
      case 'console':
        return sendViaConsole(message);
      case 'resend':
        return await sendViaResend(message);
      default:
        return { ok: false, error: `Unknown EMAIL_PROVIDER "${provider}".` };
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[email] send failed:', error);
    return { ok: false, error };
  }
}

function sendViaConsole(message: Message): SendResult {
  console.log(
    `\n[email] --- to: ${message.to} --- subject: ${message.subject} ---\n${message.text}\n[email] ---\n`,
  );
  return { ok: true };
}

async function sendViaResend(message: Message): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not set.' };
  if (!from) return { ok: false, error: 'EMAIL_FROM is not set.' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, error: `Resend responded ${res.status}: ${body.slice(0, 300)}` };
  }
  return { ok: true };
}

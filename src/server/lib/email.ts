import { google } from 'googleapis';
import { format } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { env } from '@/env';

function getGmailService() {
	const auth = new google.auth.JWT({
		email: env.GOOGLE_CLIENT_EMAIL,
		key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
		scopes: ['https://www.googleapis.com/auth/gmail.send'],
		subject: env.GOOGLE_IMPERSONATE_USER,
	});

	return google.gmail({ version: 'v1', auth });
}

async function sendEmail(opts: { to: string; subject: string; html: string }) {
	const gmail = getGmailService();

	const message = [
		`From: ${env.GOOGLE_IMPERSONATE_USER}`,
		`To: ${opts.to}`,
		`Subject: ${opts.subject}`,
		'MIME-Version: 1.0',
		'Content-Type: text/html; charset="UTF-8"',
		'',
		opts.html,
	].join('\r\n');

	const raw = Buffer.from(message)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

	console.log('wysyla sie', env.GOOGLE_IMPERSONATE_USER);

	await gmail.users.messages.send({
		userId: env.GOOGLE_IMPERSONATE_USER,
		requestBody: { raw },
	});
}

export async function sendInvitationEmail(to: string, token: string) {
	const registerUrl = `${env.NEXT_PUBLIC_APP_URL}/register?token=${token}`;

	await sendEmail({
		to,
		subject: "You're invited to Oligamy Cal",
		html: `
			<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
				<h2>You've been invited!</h2>
				<p>You've been invited to join <strong>Oligamy Cal</strong> — the team meeting scheduler.</p>
				<p>Click the button below to create your account:</p>
				<a href="${registerUrl}" style="display: inline-block; padding: 12px 24px; background-color: #18181b; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
					Create Account
				</a>
				<p style="margin-top: 24px; color: #71717a; font-size: 14px;">
					Or copy this link: <br/>${registerUrl}
				</p>
				<p style="color: #71717a; font-size: 13px;">This invitation expires in 7 days.</p>
			</div>
		`,
	});
}

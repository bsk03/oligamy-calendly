import nodemailer from "nodemailer";
import { env } from "@/env";

const transporter = nodemailer.createTransport({
	host: env.SMTP_HOST,
	port: env.SMTP_PORT,
	secure: env.SMTP_PORT === 465,
	auth: {
		user: env.SMTP_USER,
		pass: env.SMTP_PASS,
	},
});

export async function sendInvitationEmail(to: string, token: string) {
	const registerUrl = `${env.NEXT_PUBLIC_APP_URL}/register?token=${token}`;

	await transporter.sendMail({
		from: env.EMAIL_FROM,
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

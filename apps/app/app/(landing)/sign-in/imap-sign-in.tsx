"use client";

import { signIn } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useId, useState } from "react";
import { toast } from "sonner";

export function ImapSignIn() {
	const emailId = useId();
	const passwordId = useId();
	const [pending, setPending] = useState(false);

	function fail(message?: string) {
		setPending(false);
		toast.error(message ?? "Could not reach the sign-in service.");
	}

	async function submit(form: FormData) {
		setPending(true);

		const { error } = await signIn.imap({
			email: String(form.get("email") ?? "").trim(),
			password: String(form.get("password") ?? ""),
		});

		if (error) {
			fail(error.message);
			return;
		}

		window.location.assign("/");
	}

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				submit(new FormData(event.currentTarget)).catch(() => fail());
			}}
			className="flex flex-col gap-6"
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={emailId}>Email</FieldLabel>
					<Input
						id={emailId}
						name="email"
						type="email"
						placeholder="you@company.com"
						autoComplete="username"
						autoCapitalize="off"
						autoCorrect="off"
						spellCheck={false}
						disabled={pending}
						required
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor={passwordId}>Mailbox password</FieldLabel>
					<Input
						id={passwordId}
						name="password"
						type="password"
						autoComplete="current-password"
						disabled={pending}
						required
					/>
					<FieldDescription>
						Checked against your mail server, then stored encrypted. Signing in
						connects this mailbox to the CRM.
					</FieldDescription>
				</Field>
			</FieldGroup>

			<Button type="submit" disabled={pending}>
				{pending ? <Spinner data-icon="inline-start" /> : null}
				Sign in with your mailbox
			</Button>
		</form>
	);
}

"use client";

import { signOut } from "@crm/auth/client";
import { useMountEffect } from "@crm/ui/hooks/use-mount-effect";
import { useState } from "react";

type Outcome = "leaving" | "left" | "kept";

const COPY = {
	leaving: "Saindo do CRM…",
	left: "Você saiu do CRM.",
	kept: "Esta página só funciona dentro do Portal.",
} as const satisfies Record<Outcome, string>;

export function PortalSignOut() {
	const [outcome, setOutcome] = useState<Outcome>("leaving");

	useMountEffect(() => {
		if (window.self === window.top) {
			setOutcome("kept");
			return;
		}

		signOut()
			.then(() => setOutcome("left"))
			.catch(() => setOutcome("left"));
	});

	return (
		<main className="flex min-h-svh items-center justify-center p-6">
			<p role="status" className="text-muted-foreground text-sm">
				{COPY[outcome]}
			</p>
		</main>
	);
}

"use client";

import { signOut } from "@crm/auth/client";
import { toast } from "sonner";

export async function signOutAndRedirect() {
	const { error } = await signOut();

	if (error) {
		toast.error(error.message ?? "Não foi possível sair.");
		return;
	}

	window.location.assign("/sign-in");
}

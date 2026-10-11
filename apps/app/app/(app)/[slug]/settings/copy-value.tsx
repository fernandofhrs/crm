"use client";

import Copy from "@carbon/icons-react/es/Copy";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { toast } from "sonner";

export function CopyValue({ value, label }: { value: string; label: string }) {
	const unavailable = () =>
		toast.error(
			`Não foi possível copiar: ${label}. Selecione o texto e copie.`,
		);

	return (
		<Button
			variant="ghost"
			size="icon"
			type="button"
			onClick={() => {
				const clipboard = navigator.clipboard;

				if (!clipboard) {
					unavailable();
					return;
				}

				clipboard
					.writeText(value)
					.then(() => toast.success(`Copiado: ${label}.`))
					.catch(unavailable);
			}}
		>
			<Icon icon={Copy} />
			<span className="sr-only">Copiar {label}</span>
		</Button>
	);
}

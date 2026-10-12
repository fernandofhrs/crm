import Image from "next/image";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
	return (
		<main className="auth-backdrop min-h-svh text-foreground">
			<div className="mx-auto grid min-h-svh w-full max-w-[1240px] px-6 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-14">
				<section className="flex flex-col justify-center gap-7 pt-12 pb-2 lg:py-16 lg:pr-12">
					<Image
						src="/moulin-logo.png"
						alt="Moulin"
						width={147}
						height={46}
						className="h-[46px] w-auto self-start"
						priority
					/>
					<div className="hidden flex-col gap-6 lg:flex">
						<p className="flex items-center gap-2.5 font-bold text-[11.5px] text-primary uppercase tracking-[0.16em]">
							<span
								aria-hidden="true"
								className="h-0.5 w-[22px] rounded-full bg-primary"
							/>
							CRM comercial
						</p>
						<h1 className="max-w-[13ch] text-balance font-bold text-5xl/[1.05] tracking-tight xl:text-6xl/[1.05]">
							Todos os clientes em um só{" "}
							<span className="text-primary">lugar</span>.
						</h1>
						<p className="max-w-[46ch] text-[15px]/relaxed text-muted-foreground">
							Empresas, contatos, propostas e a jornada de cada pedido, com o
							histórico do Portal do Vendedor e os e-mails do time.
						</p>
					</div>
				</section>

				<section className="flex items-start justify-center pt-4 pb-12 lg:items-center lg:py-16 lg:pl-10">
					<div className="flex w-full max-w-[420px] flex-col gap-7 rounded-3xl border bg-card p-7 shadow-lg sm:p-9">
						{children}
					</div>
				</section>
			</div>
		</main>
	);
}

export function AuthHeading({
	title,
	description,
}: {
	title: string;
	description: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5 text-left">
			<h2 className="text-balance font-bold text-2xl/8 tracking-tight">
				{title}
			</h2>
			<p className="text-pretty text-muted-foreground text-sm/5">
				{description}
			</p>
		</div>
	);
}

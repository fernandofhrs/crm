import type { Metadata } from "next";
import { Suspense } from "react";
import { AsanaConnection } from "../asana-connection";
import { ConnectionPage, ConnectionPageLoading } from "../connection-page";

export const metadata: Metadata = { title: "Asana" };

export default function AsanaConnectionPage(props: {
	params: Promise<{ slug: string }>;
}) {
	return (
		<Suspense fallback={<ConnectionPageLoading />}>
			<AsanaConnectionPageContent {...props} />
		</Suspense>
	);
}

async function AsanaConnectionPageContent({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	return (
		<ConnectionPage>
			<AsanaConnection slug={slug} />
		</ConnectionPage>
	);
}

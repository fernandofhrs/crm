import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectionPage, ConnectionPageLoading } from "../connection-page";
import { ImapConnection } from "../imap-connection";

export const metadata: Metadata = { title: "Email by IMAP" };

export default function ImapConnectionPage(props: {
	params: Promise<{ slug: string }>;
}) {
	return (
		<Suspense fallback={<ConnectionPageLoading />}>
			<ImapConnectionPageContent {...props} />
		</Suspense>
	);
}

async function ImapConnectionPageContent({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	return (
		<ConnectionPage>
			<ImapConnection slug={slug} />
		</ConnectionPage>
	);
}

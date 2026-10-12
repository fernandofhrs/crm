import type { Metadata } from "next";
import { PortalSignOut } from "./portal-sign-out";

export const metadata: Metadata = {
	title: "Saindo",
};

export default function PortalSignOutPage() {
	return <PortalSignOut />;
}

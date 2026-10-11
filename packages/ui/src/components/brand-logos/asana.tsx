import type * as React from "react";

const AsanaLogo = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
		{...props}
	>
		<circle cx="12" cy="6.6" r="4.8" fill="#F06A6A" />
		<circle cx="5.3" cy="17.2" r="4.8" fill="#F06A6A" />
		<circle cx="18.7" cy="17.2" r="4.8" fill="#F06A6A" />
	</svg>
);

export default AsanaLogo;

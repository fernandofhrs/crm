import type * as React from "react";

const Logo = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={512}
		height={512}
		viewBox="0 0 512 512"
		fill="none"
		aria-label="Moulin"
		{...props}
	>
		<path
			d="M256 256V48l152 152zM256 256h208L312 408zM256 256v208L104 312zM256 256H48l152-152z"
			fill="currentColor"
		/>
	</svg>
);
export default Logo;

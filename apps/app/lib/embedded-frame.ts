export const EMBEDDED_FRAME = {
	scriptId: "embedded-frame",
	attribute: "embedded",
	script:
		'if(window.self!==window.top){document.documentElement.dataset.embedded="true"}',
} as const;

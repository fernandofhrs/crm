export type BuilderCommandType = "CHAT" | "CREATE_AGENT";

const CREATE_AGENT =
	/^\/(?:create(?:\s+agent|-agent)|criar(?:\s+agente|-agente))(?:\s|$)/i;

type IntentGrammar = {
	request: RegExp;
	nonRequest: RegExp;
	question: RegExp;
	requestCue: RegExp;
};

const ENGLISH_INTENT: IntentGrammar = {
	request:
		/\b(?:create|build|draft|make|configure|set\s+up)(?:\s+me)?\s+(?:(?:and\s+save)\s+)?(?:(?:a|an|the|this)\s+)?(?:new\s+)?agent\b/i,
	nonRequest:
		/\b(?:(?:do\s+not|don't|dont|never)\b[^.!?]*|how\s+(?:(?:do|can|could|would|should)\s+(?:i|we)|to))\s*$/i,
	question:
		/^(?:how|why|when|where|what|does|do|did|is|are|will|would|can|could|should)\b/i,
	requestCue:
		/\b(?:please|plz|(?:can|could|would|will)\s+you|i\s+(?:need|want)\b|we\s+need\b|let'?s)\b/i,
};

const PORTUGUESE_INTENT: IntentGrammar = {
	request:
		/(?<![\p{L}\p{N}_])(?:(?:cri(?:e|a|ar|em)|mont(?:e|a|ar|em)|constru(?:a|ir|am)|configur(?:e|a|ar|em))(?:\s+(?:me|(?:pra|para)\s+mim))?\s+(?:e\s+salv(?:e|a|ar|em)\s+)?(?:(?:um|o|esse|este|outro)\s+)?(?:novo\s+)?|fa(?:[çc]a|z|zer|[çc]am)(?:\s+(?:me|(?:pra|para)\s+mim))?\s+(?:um|outro)\s+(?:novo\s+)?|(?:quer(?:o|ia|emos)|precis(?:o|amos)\s+de)\s+(?:um|outro)\s+(?:novo\s+)?)agente(?![\p{L}\p{N}_])/iu,
	nonRequest:
		/(?<![\p{L}\p{N}_])(?:(?:n[ãa]o|nunca|jamais)(?![\p{L}\p{N}_])[^.!?]*|como(?![\p{L}\p{N}_])[^.!?,]*)$/iu,
	question:
		/^(?:como|por\s*qu[eê]|quando|onde|o\s+que|qual|quais|quem|posso|podemos|consigo|conseguimos|d[aá]\s+pa?ra|[eé]\s+poss[ií]vel|ser[aá]|tem\s+como|existe)(?![\p{L}\p{N}_])/iu,
	requestCue:
		/(?<![\p{L}\p{N}_])(?:por\s+favor|pfv|voc[eê]\s+(?:pode|poderia|consegue)|quer(?:o|ia|emos)|precis(?:o|amos)|vamos|bora)(?![\p{L}\p{N}_])/iu,
};

const INTENT_GRAMMARS = [ENGLISH_INTENT, PORTUGUESE_INTENT] as const;

function matchIntent(
	grammar: IntentGrammar,
	message: string,
): RegExpExecArray | null {
	const match = grammar.request.exec(message);
	if (!match) return null;

	const prefix = message.slice(0, match.index);
	if (grammar.nonRequest.test(prefix)) return null;
	if (
		message.trimEnd().endsWith("?") &&
		grammar.question.test(message.trimStart()) &&
		!grammar.requestCue.test(prefix)
	) {
		return null;
	}

	return match;
}

function matchCreateAgentRequest(message: string): RegExpExecArray | null {
	let earliest: RegExpExecArray | null = null;

	for (const grammar of INTENT_GRAMMARS) {
		const match = matchIntent(grammar, message);
		if (match && (!earliest || match.index < earliest.index)) {
			earliest = match;
		}
	}

	return earliest;
}

export function builderCommandType(message: string): BuilderCommandType {
	const trimmed = message.trimStart();
	return CREATE_AGENT.test(trimmed) || matchCreateAgentRequest(trimmed)
		? "CREATE_AGENT"
		: "CHAT";
}

export function consumeBuilderCommand(
	message: string,
): { commandType: BuilderCommandType; body: string } | null {
	const trimmed = message.trimStart();
	const match = CREATE_AGENT.exec(trimmed);
	if (!match) return null;

	return {
		commandType: "CREATE_AGENT",
		body: trimmed.slice(match[0].length).trimStart(),
	};
}

export function consumeBuilderIntent(message: string): {
	commandType: "CREATE_AGENT";
	body: string;
	invocation: string;
} | null {
	const trimmed = message.trimStart();
	const match = matchCreateAgentRequest(trimmed);
	if (!match) return null;

	return {
		commandType: "CREATE_AGENT",
		body: trimmed.slice(match.index + match[0].length).replace(/^[\s,:-]+/, ""),
		invocation: match[0].trim(),
	};
}

export function hasCreateAgentCommand(
	submissions: ReadonlyArray<{ commandType: BuilderCommandType }>,
): boolean {
	return submissions.some(
		(submission) => submission.commandType === "CREATE_AGENT",
	);
}

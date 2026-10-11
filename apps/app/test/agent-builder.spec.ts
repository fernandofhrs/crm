import { describe, expect, it } from "bun:test";
import {
	builderCommandType,
	consumeBuilderCommand,
	consumeBuilderIntent,
	hasCreateAgentCommand,
} from "../lib/agent-builder";

describe("agent builder commands", () => {
	it("enters agent creation for slash commands and direct build requests", () => {
		expect(builderCommandType("/Create agent Flag stalled deals")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("  /create agent summarize renewals")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("Tell me about this customer")).toBe("CHAT");
		expect(builderCommandType("/Create agentic workflows")).toBe("CHAT");
		expect(builderCommandType("/create-agent Flag stalled deals")).toBe(
			"CREATE_AGENT",
		);
		expect(
			builderCommandType('Create an agent named "Stalled Deal Brief".'),
		).toBe("CREATE_AGENT");
		expect(builderCommandType("Build and save a new agent for renewals")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("Build me an agent for stalled deals")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("Build the agent I described above")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("Please set up an agent for overdue deals")).toBe(
			"CREATE_AGENT",
		);
		expect(
			builderCommandType("I want you to create an agent for renewals"),
		).toBe("CREATE_AGENT");
		expect(builderCommandType("hey fucker plz create an agent to")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("How do I create an agent?")).toBe("CHAT");
		expect(builderCommandType("Tell me how to create an agent")).toBe("CHAT");
		expect(builderCommandType("I do not want you to create an agent")).toBe(
			"CHAT",
		);
		expect(builderCommandType("Tell me about our agent workflows")).toBe(
			"CHAT",
		);
		expect(consumeBuilderCommand("/Create agent Flag stalled deals")).toEqual({
			commandType: "CREATE_AGENT",
			body: "Flag stalled deals",
		});
		expect(
			consumeBuilderIntent("Build an agent that flags stalled deals"),
		).toEqual({
			commandType: "CREATE_AGENT",
			body: "that flags stalled deals",
			invocation: "Build an agent",
		});
		expect(consumeBuilderIntent("hey fucker plz create an agent to")).toEqual({
			commandType: "CREATE_AGENT",
			body: "to",
			invocation: "create an agent",
		});
		expect(
			consumeBuilderIntent("Tell me about our agent workflows"),
		).toBeNull();
	});

	it("enters agent creation for the same commands and requests in Portuguese", () => {
		expect(builderCommandType("/criar agente Avisar negócios parados")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("  /Criar agente resumir renovações")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("/criar-agente Avisar negócios parados")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("/criar agentes em lote")).toBe("CHAT");
		expect(
			builderCommandType('Crie um agente chamado "Negócios parados".'),
		).toBe("CREATE_AGENT");
		expect(builderCommandType("criar um agente para renovações")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("Monte um agente para negócios parados")).toBe(
			"CREATE_AGENT",
		);
		expect(
			builderCommandType("Monte e salve um novo agente para renovações"),
		).toBe("CREATE_AGENT");
		expect(builderCommandType("Monte o agente que descrevi acima")).toBe(
			"CREATE_AGENT",
		);
		expect(
			builderCommandType("Quero um agente que avise quando um negócio parar"),
		).toBe("CREATE_AGENT");
		expect(builderCommandType("Faça um agente para tarefas atrasadas")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("FAÇA UM AGENTE PARA TAREFAS ATRASADAS")).toBe(
			"CREATE_AGENT",
		);
		expect(builderCommandType("cria um agente pra mim")).toBe("CREATE_AGENT");
		expect(
			builderCommandType("Quero que você crie um agente para renovações"),
		).toBe("CREATE_AGENT");
		expect(
			builderCommandType("Você pode criar um agente para renovações?"),
		).toBe("CREATE_AGENT");
		expect(
			builderCommandType("Será que você pode criar um agente para mim?"),
		).toBe("CREATE_AGENT");
		expect(builderCommandType("Como eu faço para criar um agente?")).toBe(
			"CHAT",
		);
		expect(builderCommandType("Me explique como criar um agente")).toBe("CHAT");
		expect(builderCommandType("Posso criar um agente?")).toBe("CHAT");
		expect(builderCommandType("Não quero que você crie um agente")).toBe(
			"CHAT",
		);
		expect(builderCommandType("Não quero um agente agora")).toBe("CHAT");
		expect(builderCommandType("Fale sobre os nossos agentes")).toBe("CHAT");
		expect(builderCommandType("Vamos recriar um agente antigo")).toBe("CHAT");
		expect(
			consumeBuilderCommand("/criar agente Avisar negócios parados"),
		).toEqual({
			commandType: "CREATE_AGENT",
			body: "Avisar negócios parados",
		});
		expect(
			consumeBuilderIntent("Quero um agente que avise negócios parados"),
		).toEqual({
			commandType: "CREATE_AGENT",
			body: "que avise negócios parados",
			invocation: "Quero um agente",
		});
		expect(
			consumeBuilderIntent("Por favor, faça um agente: avisar renovações"),
		).toEqual({
			commandType: "CREATE_AGENT",
			body: "avisar renovações",
			invocation: "faça um agente",
		});
		expect(consumeBuilderIntent("Fale sobre os nossos agentes")).toBeNull();
	});

	it("shows creation surfaces only after a creation command", () => {
		expect(hasCreateAgentCommand([{ commandType: "CHAT" }])).toBe(false);
		expect(
			hasCreateAgentCommand([
				{ commandType: "CHAT" },
				{ commandType: "CREATE_AGENT" },
			]),
		).toBe(true);
	});
});

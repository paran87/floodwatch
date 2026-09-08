export type AiMessage = { role: "system" | "user"; content: string };

export type AiClient = {
  completeJson: (messages: AiMessage[]) => Promise<unknown>;
};

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

export function createAiClient(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
}): AiClient | null {
  if (!options.apiKey) return null;

  return {
    async completeJson(messages) {
      const response = await fetch(`${options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages,
        }),
      });
      const payload = (await response.json()) as ChatResponse;
      if (!response.ok) {
        throw new Error(payload.error?.message || "AI request failed.");
      }
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI returned an empty response.");
      return JSON.parse(content);
    },
  };
}

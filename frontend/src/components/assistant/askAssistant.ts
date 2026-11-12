/** Open the assistant chat and ask a question (the chat widget listens for this event). */
export const askAssistant = (question: string) => window.dispatchEvent(new CustomEvent('assistant-ask', { detail: question }));

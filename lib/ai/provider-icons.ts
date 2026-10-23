import {
  ChatGptIcon,
  ClaudeIcon,
  ComputerIcon,
  GoogleGeminiIcon,
  ServerStack01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { ProviderId } from "./catalog";

export const providerIcons: Record<ProviderId, IconSvgElement> = {
  openai: ChatGptIcon,
  anthropic: ClaudeIcon,
  google: GoogleGeminiIcon,
  ollama: ComputerIcon,
  lmstudio: ServerStack01Icon,
};

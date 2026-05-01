import { generateText, streamText, type StreamTextResult, type ToolSet } from 'ai'
import { getZhipuProvider } from './provider'

export interface AgentOptions {
  system: string
  model?: string
}

export interface Agent {
  generate(prompt: string): Promise<string>
  stream(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<StreamTextResult<ToolSet, unknown>>
}

export function createAgent(options: AgentOptions): Agent {
  const modelId = options.model ?? 'glm-4-flash'

  return {
    async generate(prompt: string): Promise<string> {
      const provider = await getZhipuProvider()
      const { text } = await generateText({
        model: provider(modelId),
        system: options.system,
        prompt,
      })
      return text
    },

    async stream(
      messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    ) {
      const provider = await getZhipuProvider()
      return streamText({
        model: provider(modelId),
        system: options.system,
        messages,
      })
    },
  }
}

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { getMastra } from '@/workflows/brainstorm'

// ── Schemas ──────────────────────────────────────────────────────

const extractRequirementsInputSchema = z.object({
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    }),
  ),
})

const extractedEpicSchema = z.object({
  title: z.string().describe('Epic 的标题'),
  description: z.string().describe('Epic 的简要描述'),
  features: z.array(
    z.object({
      title: z.string().describe('Feature 的标题'),
      description: z.string().describe('Feature 的简要描述'),
      userStories: z.array(
        z.object({
          title: z.string().describe('User Story 的标题'),
          description: z.string().describe('User Story 的详细描述'),
          acceptanceCriteria: z
            .array(z.string())
            .describe('验收标准列表'),
        }),
      ),
    }),
  ),
})

const extractRequirementsOutputSchema = z.object({
  epics: z.array(extractedEpicSchema),
})

// ── Tool ─────────────────────────────────────────────────────────

export const extractRequirementsTool = createTool({
  id: 'extract-requirements',
  description:
    '从对话历史中提取结构化需求，分解为 Epic → Feature → User Story 层级',
  inputSchema: extractRequirementsInputSchema,
  outputSchema: extractRequirementsOutputSchema,
  execute: async (inputData: any) => {
    const m = getMastra()
    const agent = m.getAgent('facilitator')
    const { conversationHistory } = inputData

    const conversationText = conversationHistory
      .map((m: any) => `[${m.role}]: ${m.content}`)
      .join('\n')

    const response = await agent.generate(
      `请分析以下对话记录，提取其中涉及的所有需求，并按照 Epic → Feature → User Story 的层级结构进行整理。

要求：
1. 每个需求必须来自对话中明确提到的内容
2. 不要臆造对话中没有提到的需求
3. User Story 需要包含验收标准
4. 以 JSON 格式返回，结构为：
{
  "epics": [
    {
      "title": "...",
      "description": "...",
      "features": [
        {
          "title": "...",
          "description": "...",
          "userStories": [
            {
              "title": "...",
              "description": "...",
              "acceptanceCriteria": ["..."]
            }
          ]
        }
      ]
    }
  ]
}

如果对话中没有足够的信息来提取任何需求，返回 { "epics": [] }。

对话记录：
${conversationText}`,
    )

    const text =
      typeof response === 'string'
        ? response
        : (response.text ?? '{"epics": []}')

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { epics: [] }
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      return { epics: parsed.epics ?? [] }
    } catch {
      return { epics: [] }
    }
  },
})

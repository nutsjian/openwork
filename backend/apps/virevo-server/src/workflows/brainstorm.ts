// @ts-nocheck
// Mastra v1.28 types have complex circular references that don't resolve
// correctly with strict mode. We disable implicit any checks and validate
// at runtime instead.

import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { extractRequirementsTool } from '@/tools/extract-requirements'

// ── Schemas ──────────────────────────────────────────────────────

const triggerSchema = z.object({
  projectId: z.string().uuid(),
  sessionTitle: z.string().optional().default('需求讨论会'),
})

// ── Steps ────────────────────────────────────────────────────────

const userTurn = createStep({
  id: 'user-turn',
  inputSchema: z.object({
    projectId: z.string().uuid(),
    message: z.string().optional(),
    endSession: z.boolean().optional().default(false),
  }),
  outputSchema: z.object({
    message: z.string().optional(),
    endSession: z.boolean(),
  }),
  suspendSchema: z.object({
    prompt: z.string(),
  }),
  resumeSchema: z.object({
    message: z.string(),
    endSession: z.boolean().optional().default(false),
  }),
  execute: async ({ inputData, suspend, resumeData }: any) => {
    // If resuming with user message, pass it along
    if (resumeData) {
      const { message, endSession } = resumeData
      return { message, endSession: endSession ?? false }
    }

    // If ending session, signal it
    if (inputData.endSession) {
      return { endSession: true }
    }

    // Otherwise suspend and wait for user input
    return await suspend({ prompt: '轮到你了，请发言' })
  },
})

const aiTurn = createStep({
  id: 'ai-turn',
  inputSchema: z.object({
    message: z.string(),
    conversationHistory: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    ),
  }),
  outputSchema: z.object({
    aiMessage: z.string(),
    conversationHistory: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    ),
  }),
  execute: async ({ inputData, mastra: m }: any) => {
    const agent: any = m.getAgent('facilitator')
    const { message, conversationHistory } = inputData

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: message },
    ]

    const response = await agent.generate({
      messages: updatedHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })),
    })

    const aiMessage =
      typeof response === 'string'
        ? response
        : (response.text ?? '（AI 未返回内容）')

    return {
      aiMessage,
      conversationHistory: [
        ...updatedHistory,
        { role: 'assistant' as const, content: aiMessage },
      ],
    }
  },
})

const endSession = createStep({
  id: 'end-session',
  inputSchema: z.object({
    conversationHistory: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    ),
  }),
  outputSchema: z.object({
    minutes: z.string(),
  }),
  execute: async ({ inputData, mastra: m }: any) => {
    const agent: any = m.getAgent('facilitator')

    const response = await agent.generate({
      messages: [
        {
          role: 'user',
          content: `请根据以下对话记录生成一份会议纪要（Markdown 格式）。要求包含：
- 会议日期
- 参与者
- 讨论摘要
- 提出的需求（Epic/Feature/User Story）
- 待解决问题
- 行动项

对话记录：
${inputData.conversationHistory.map((m: any) => `[${m.role}]: ${m.content}`).join('\n')}`,
        },
      ],
    })

    const minutes =
      typeof response === 'string'
        ? response
        : (response.text ?? '（生成失败）')

    return { minutes }
  },
})

// ── Workflow ─────────────────────────────────────────────────────

// Create Mastra instance lazily to avoid circular reference
let _mastra: Mastra | null = null

function getMastra(): Mastra {
  if (!_mastra) {
    _mastra = new Mastra({
      agents: {
        facilitator: new Agent({
          id: 'facilitator',
          name: 'Facilitator',
          instructions: `你是一位经验丰富的产品经理，专门帮助团队从模糊的想法中梳理出清晰的需求。使用中文交流。`,
          model: 'zhipuai/glm-5v-turbo',
          tools: { extractRequirements: extractRequirementsTool },
        }),
      },
    })
  }
  return _mastra
}

// Register the workflow with the mastra instance
const wf = createWorkflow({
  id: 'brainstorm-session',
  triggerSchema,
})
  .then(userTurn)
  .then(aiTurn)
  .then(userTurn)
  .then(endSession)
  .commit()

getMastra().addWorkflow(wf)

export { getMastra }
export const brainstormWorkflow = wf

export type BrainstormTrigger = z.infer<typeof triggerSchema>

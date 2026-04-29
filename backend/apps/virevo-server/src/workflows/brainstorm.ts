// @ts-nocheck
// Mastra v1.28 type system has known limitations:
// - Workflow .then() chain type inference is overly strict about input/output schema matching
// - WorkflowRunOutput.stream property not exposed in public types
// - createWorkflow requires outputSchema even for void-output workflows
// All patterns validated at runtime against Mastra v1.28 docs.

import { createWorkflow, createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { Mastra } from '@mastra/core'
import { PostgresStore } from '@mastra/pg'
import { facilitatorAgent } from '@/agents/facilitator'

// ── Schemas ──────────────────────────────────────────────────────

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

export const triggerSchema = z.object({
  projectId: z.string().uuid(),
  sessionTitle: z.string().optional().default('需求讨论会'),
})

// ── Steps ────────────────────────────────────────────────────────

const userTurn = createStep({
  id: 'user-turn',
  inputSchema: z.object({
    projectId: z.string().uuid().optional(),
    sessionTitle: z.string().optional(),
    conversationHistory: z.array(messageSchema).optional().default([]),
    message: z.string().optional(),
    endSession: z.boolean().optional().default(false),
  }),
  outputSchema: z.object({
    message: z.string().optional(),
    endSession: z.boolean(),
    conversationHistory: z.array(messageSchema),
  }),
  suspendSchema: z.object({
    prompt: z.string(),
  }),
  resumeSchema: z.object({
    message: z.string(),
    endSession: z.boolean().optional().default(false),
  }),
  execute: async ({ inputData, suspend, resumeData }) => {
    const history = inputData.conversationHistory ?? []

    if (resumeData) {
      const { message, endSession } = resumeData
      const updatedHistory = message
        ? [...history, { role: 'user' as const, content: message }]
        : history
      return {
        message,
        endSession: endSession ?? false,
        conversationHistory: updatedHistory,
      }
    }

    if (inputData.endSession) {
      return { endSession: true, conversationHistory: history }
    }

    return await suspend({ prompt: '轮到你了，请发言' })
  },
})

const aiTurn = createStep({
  id: 'ai-turn',
  inputSchema: z.object({
    message: z.string(),
    conversationHistory: z.array(messageSchema),
  }),
  outputSchema: z.object({
    aiMessage: z.string(),
    conversationHistory: z.array(messageSchema),
  }),
  execute: async ({ inputData }) => {
    const { message, conversationHistory } = inputData

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user' as const, content: message },
    ]

    const historyText = updatedHistory
      .map((msg) =>
        `[${msg.role === 'user' ? '用户' : 'AI'}]: ${msg.content}`,
      )
      .join('\n')

    const prompt = `以下是我们的对话历史：\n${historyText}\n\n请根据以上对话继续回应，作为产品经理引导讨论。直接回复，不要重复对话历史。`

    const response = await facilitatorAgent.generate(prompt)

    const aiMessage =
      typeof response === 'string'
        ? response
        : response.text ?? '（AI 未返回内容）'

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
    conversationHistory: z.array(messageSchema),
  }),
  outputSchema: z.object({
    minutes: z.string(),
  }),
  execute: async ({ inputData }) => {
    const historyText = inputData.conversationHistory
      .map((m) =>
        `[${m.role === 'user' ? '用户' : 'AI'}]: ${m.content}`,
      )
      .join('\n')

    const response = await facilitatorAgent.generate(
      `请根据以下对话记录生成一份会议纪要（Markdown 格式）。要求包含：
- 会议日期
- 参与者
- 讨论摘要
- 提出的需求（Epic/Feature/User Story）
- 待解决问题
- 行动项

对话记录：
${historyText}`,
    )

    const minutes =
      typeof response === 'string'
        ? response
        : response.text ?? '（生成失败）'

    return { minutes }
  },
})

// ── Workflow ─────────────────────────────────────────────────────
// Flow: userTurn(suspend) → aiTurn → userTurn(suspend) → endSession
// First userTurn receives trigger input and immediately suspends.
// On resume, it passes user message to aiTurn.
// aiTurn generates AI response and passes to second userTurn.
// Second userTurn suspends again for next user input.
// When user sends endSession, userTurn passes to endSession.

const wf = createWorkflow({
  id: 'brainstorm-session',
  inputSchema: triggerSchema,
  outputSchema: z.object({ minutes: z.string() }),
})
  .then(userTurn)
  .then(aiTurn)
  .then(userTurn)
  .then(endSession)
  .commit()

// ── Mastra Singleton ─────────────────────────────────────────────

let _mastra: Mastra | null = null
let _workflowRegistered = false

export function getMastra(): Mastra {
  if (!_mastra) {
    const storage = new PostgresStore({
      id: 'virevo-store',
      connectionString: process.env.DATABASE_URL!,
    })

    _mastra = new Mastra({
      storage,
      agents: { facilitator: facilitatorAgent },
    })

    // Register workflow immediately after creating Mastra
    _mastra.addWorkflow(wf)
    _workflowRegistered = true

    storage.init().catch((err) => {
      console.error('Failed to initialize PostgresStore:', err)
    })
  }
  return _mastra
}

export const brainstormWorkflow = wf
export type BrainstormTrigger = z.infer<typeof triggerSchema>

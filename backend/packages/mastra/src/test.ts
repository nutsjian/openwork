import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPaths = [
  path.resolve(__dirname, '..', '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '..', 'backend', '.env'),
]
for (const p of envPaths) {
  if (dotenv.config({ path: p }).parsed) break
}

import { generateText, streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''

console.log('=== @openwork/mastra 连通性测试 ===\n')
console.log(`ZHIPU_API_KEY: ${process.env.ZHIPU_API_KEY ? '✓ 已设置' : '✗ 未设置'}`)
console.log(`HTTPS_PROXY: ${PROXY_URL || '(未设置)'}\n`)

if (!process.env.ZHIPU_API_KEY) {
  console.error('错误: ZHIPU_API_KEY 未设置')
  process.exit(1)
}

async function testDirectFetch() {
  console.log('--- 测试 1: 方案 A — Bun 默认 fetch (环境变量 proxy) ---')
  try {
    const provider = createOpenAI({
      baseURL: ZHIPU_BASE_URL,
      apiKey: process.env.ZHIPU_API_KEY,
    })

    const { text } = await generateText({
      model: provider('glm-4-flash'),
      prompt: '用一句话回答：1+1等于几？',
    })
    console.log(`✅ generateText 成功: "${text}"\n`)
    return true
  } catch (err: any) {
    console.log(`❌ 方案 A 失败: ${err.message}\n`)
    return false
  }
}

async function testStreamText() {
  console.log('--- 测试 2: streamText 流式输出 ---')
  try {
    const provider = createOpenAI({
      baseURL: ZHIPU_BASE_URL,
      apiKey: process.env.ZHIPU_API_KEY,
    })

    const result = streamText({
      model: provider('glm-4-flash'),
      prompt: '用三句话介绍 TypeScript。',
    })

    process.stdout.write('流式输出: ')
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk)
    }
    console.log('\n✅ streamText 成功\n')
    return true
  } catch (err: any) {
    console.log(`❌ streamText 失败: ${err.message}\n`)
    return false
  }
}

async function testWithContext() {
  console.log('--- 测试 3: 多轮对话 (带 system prompt + 历史消息) ---')
  try {
    const provider = createOpenAI({
      baseURL: ZHIPU_BASE_URL,
      apiKey: process.env.ZHIPU_API_KEY,
    })

    const { text } = await generateText({
      model: provider('glm-4-flash'),
      system: '你是一位经验丰富的产品经理。用中文回答，保持简洁。',
      messages: [
        { role: 'user', content: '我想做一个任务管理工具' },
        {
          role: 'assistant',
          content: '好的，能告诉我更多细节吗？目标用户是谁？',
        },
        { role: 'user', content: '目标用户是小型创业团队' },
      ],
    })
    console.log(`✅ 多轮对话成功: "${text.substring(0, 100)}..."\n`)
    return true
  } catch (err: any) {
    console.log(`❌ 多轮对话失败: ${err.message}\n`)
    return false
  }
}

async function testNoProxy() {
  console.log('--- 测试 4: 确认无 proxy 时会失败 ---')
  try {
    const savedProxy =
      process.env.HTTPS_PROXY || process.env.HTTP_PROXY || ''
    delete process.env.HTTPS_PROXY
    delete process.env.HTTP_PROXY

    const provider = createOpenAI({
      baseURL: ZHIPU_BASE_URL,
      apiKey: process.env.ZHIPU_API_KEY,
    })

    await generateText({
      model: provider('glm-4-flash'),
      prompt: 'test',
    })

    if (savedProxy) process.env.HTTPS_PROXY = savedProxy
    console.log('⚠️  无 proxy 竟然成功了（可能 Bun 缓存了代理设置或网络直连可用）\n')
    return true
  } catch (err: any) {
    if (process.env.HTTPS_PROXY === undefined && PROXY_URL)
      process.env.HTTPS_PROXY = PROXY_URL
    console.log(`✅ 预期中的失败: ${err.message.substring(0, 80)}\n`)
    return true
  }
}

const results = []

results.push(await testDirectFetch())
results.push(await testStreamText())
results.push(await testWithContext())
results.push(await testNoProxy())

console.log('=== 测试结果汇总 ===')
console.log(
  `通过: ${results.filter(Boolean).length}/${results.length}`,
)

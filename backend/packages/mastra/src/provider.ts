import { createOpenAI } from '@ai-sdk/openai'

const ZHIPU_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

let _proxyFetch: typeof globalThis.fetch | null | undefined

async function loadProxyFetch(): Promise<typeof globalThis.fetch | undefined> {
  if (_proxyFetch !== undefined) return _proxyFetch ?? undefined

  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (!proxyUrl) {
    _proxyFetch = null
    return undefined
  }

  try {
    const undici = await import('undici')
    const dispatcher = new undici.ProxyAgent(proxyUrl)
    _proxyFetch = ((url: any, init: any) =>
      undici.fetch(url, { ...init, dispatcher })) as typeof globalThis.fetch
    return _proxyFetch
  } catch {
    console.warn('[mastra] undici not available, proxy may not work under Node.js')
    _proxyFetch = null
    return undefined
  }
}

let _providerPromise: ReturnType<typeof createOpenAI> | undefined
let _providerReady = false

export async function getZhipuProvider() {
  if (_providerReady && _providerPromise) return _providerPromise

  const proxyFetch = await loadProxyFetch()
  _providerPromise = createOpenAI({
    baseURL: ZHIPU_BASE_URL,
    apiKey: process.env.ZHIPU_API_KEY,
    ...(proxyFetch ? { fetch: proxyFetch } : {}),
  })
  _providerReady = true
  return _providerPromise
}

export function createZhipuProvider() {
  return createOpenAI({
    baseURL: ZHIPU_BASE_URL,
    apiKey: process.env.ZHIPU_API_KEY,
  })
}

import { describe, it, expect, vi } from 'vitest'
import { ChatsResource } from '../../src/resources/chats.js'
import type { HttpClient } from '../../src/http.js'

function mockHttp(overrides: Partial<HttpClient> = {}): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as HttpClient
}

const sampleChat = {
  id: 'chat-1',
  friendId: 'friend-1',
  status: 'open' as const,
  operatorId: null,
  lastMessageAt: '2026-03-21T00:00:00Z',
  createdAt: '2026-03-21T00:00:00Z',
}

describe('ChatsResource', () => {
  it('list() with no params calls GET /api/chats', async () => {
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: [sampleChat] }) })
    const resource = new ChatsResource(http)
    const result = await resource.list()
    expect(http.get).toHaveBeenCalledWith('/api/chats')
    expect(result).toEqual([sampleChat])
  })

  it('list() with status param appends query string', async () => {
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: [] }) })
    const resource = new ChatsResource(http)
    await resource.list({ status: 'open' })
    const calledPath = (http.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledPath).toContain('status=open')
  })

  it('list() uses defaultAccountId when no accountId in params', async () => {
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: [] }) })
    const resource = new ChatsResource(http, 'acc-default')
    await resource.list()
    const calledPath = (http.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledPath).toContain('lineAccountId=acc-default')
  })

  it('list() prefers params.accountId over defaultAccountId', async () => {
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: [] }) })
    const resource = new ChatsResource(http, 'acc-default')
    await resource.list({ accountId: 'acc-override' })
    const calledPath = (http.get as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(calledPath).toContain('lineAccountId=acc-override')
    expect(calledPath).not.toContain('acc-default')
  })

  it('get() calls GET /api/chats/:id', async () => {
    const chatWithMessages = { ...sampleChat, messages: [] }
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: chatWithMessages }) })
    const resource = new ChatsResource(http)
    const result = await resource.get('chat-1')
    expect(http.get).toHaveBeenCalledWith('/api/chats/chat-1')
    expect(result).toEqual(chatWithMessages)
  })

  it('send() calls POST /api/chats/:id/send with text type by default', async () => {
    const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: { sent: true, messageId: 'msg-1' } }) })
    const resource = new ChatsResource(http)
    const result = await resource.send('chat-1', 'Hello')
    expect(http.post).toHaveBeenCalledWith('/api/chats/chat-1/send', { content: 'Hello', messageType: 'text' })
    expect(result).toEqual({ messageId: 'msg-1' })
  })

  it('send() passes explicit messageType', async () => {
    const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: { sent: true, messageId: 'msg-2' } }) })
    const resource = new ChatsResource(http)
    await resource.send('chat-1', '<flex>', 'flex')
    expect(http.post).toHaveBeenCalledWith('/api/chats/chat-1/send', { content: '<flex>', messageType: 'flex' })
  })
})

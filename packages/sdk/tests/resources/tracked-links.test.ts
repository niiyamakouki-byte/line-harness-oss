import { describe, it, expect, vi } from 'vitest'
import { TrackedLinksResource } from '../../src/resources/tracked-links.js'
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

const sampleLink = {
  id: 'tl-1',
  name: 'Spring Campaign',
  originalUrl: 'https://example.com/spring',
  shortCode: 'spring2026',
  clickCount: 0,
  createdAt: '2026-03-21T00:00:00Z',
  updatedAt: '2026-03-21T00:00:00Z',
}

describe('TrackedLinksResource', () => {
  it('list() calls GET /api/tracked-links', async () => {
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: [sampleLink] }) })
    const resource = new TrackedLinksResource(http)
    const result = await resource.list()
    expect(http.get).toHaveBeenCalledWith('/api/tracked-links')
    expect(result).toEqual([sampleLink])
  })

  it('create() calls POST /api/tracked-links with input', async () => {
    const input = { name: 'Spring Campaign', originalUrl: 'https://example.com/spring' }
    const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: sampleLink }) })
    const resource = new TrackedLinksResource(http)
    const result = await resource.create(input)
    expect(http.post).toHaveBeenCalledWith('/api/tracked-links', input)
    expect(result).toEqual(sampleLink)
  })

  it('get() calls GET /api/tracked-links/:id', async () => {
    const linkWithClicks = { ...sampleLink, clicks: [] }
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: linkWithClicks }) })
    const resource = new TrackedLinksResource(http)
    const result = await resource.get('tl-1')
    expect(http.get).toHaveBeenCalledWith('/api/tracked-links/tl-1')
    expect(result).toEqual(linkWithClicks)
  })

  it('delete() calls DELETE /api/tracked-links/:id', async () => {
    const http = mockHttp({ delete: vi.fn().mockResolvedValue({ success: true, data: null }) })
    const resource = new TrackedLinksResource(http)
    await resource.delete('tl-1')
    expect(http.delete).toHaveBeenCalledWith('/api/tracked-links/tl-1')
  })
})

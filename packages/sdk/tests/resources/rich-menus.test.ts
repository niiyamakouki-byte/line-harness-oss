import { describe, it, expect, vi } from 'vitest'
import { RichMenusResource } from '../../src/resources/rich-menus.js'
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

const sampleMenu = {
  id: 'rm-1',
  richMenuId: 'richmenu-abc123',
  name: 'Main Menu',
  isDefault: false,
  chatBarText: 'Menu',
  selected: false,
  areas: [],
  createdAt: '2026-03-21T00:00:00Z',
}

describe('RichMenusResource', () => {
  it('list() calls GET /api/rich-menus and returns data', async () => {
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: [sampleMenu] }) })
    const resource = new RichMenusResource(http)
    const result = await resource.list()
    expect(http.get).toHaveBeenCalledWith('/api/rich-menus')
    expect(result).toEqual([sampleMenu])
  })

  it('create() calls POST /api/rich-menus with input', async () => {
    const input = { name: 'Main Menu', chatBarText: 'Menu', selected: false, areas: [] }
    const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: { richMenuId: 'richmenu-abc123' } }) })
    const resource = new RichMenusResource(http)
    const result = await resource.create(input)
    expect(http.post).toHaveBeenCalledWith('/api/rich-menus', input)
    expect(result).toEqual({ richMenuId: 'richmenu-abc123' })
  })

  it('delete() calls DELETE /api/rich-menus/:id with URL encoding', async () => {
    const http = mockHttp({ delete: vi.fn().mockResolvedValue({ success: true, data: null }) })
    const resource = new RichMenusResource(http)
    await resource.delete('richmenu-abc 123')
    expect(http.delete).toHaveBeenCalledWith('/api/rich-menus/richmenu-abc%20123')
  })

  it('setDefault() calls POST /api/rich-menus/:id/default with URL encoding', async () => {
    const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: null }) })
    const resource = new RichMenusResource(http)
    await resource.setDefault('richmenu-abc123')
    expect(http.post).toHaveBeenCalledWith('/api/rich-menus/richmenu-abc123/default')
  })
})

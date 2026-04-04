import { describe, it, expect, vi } from 'vitest'
import { FormsResource } from '../../src/resources/forms.js'
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

const sampleForm = {
  id: 'form-1',
  name: 'Contact Form',
  description: null,
  fields: [],
  isActive: true,
  createdAt: '2026-03-21T00:00:00Z',
  updatedAt: '2026-03-21T00:00:00Z',
}

describe('FormsResource', () => {
  it('list() calls GET /api/forms', async () => {
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: [sampleForm] }) })
    const resource = new FormsResource(http)
    const result = await resource.list()
    expect(http.get).toHaveBeenCalledWith('/api/forms')
    expect(result).toEqual([sampleForm])
  })

  it('get() calls GET /api/forms/:id', async () => {
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: sampleForm }) })
    const resource = new FormsResource(http)
    const result = await resource.get('form-1')
    expect(http.get).toHaveBeenCalledWith('/api/forms/form-1')
    expect(result).toEqual(sampleForm)
  })

  it('create() calls POST /api/forms with input', async () => {
    const input = { name: 'Contact Form', fields: [] }
    const http = mockHttp({ post: vi.fn().mockResolvedValue({ success: true, data: sampleForm }) })
    const resource = new FormsResource(http)
    const result = await resource.create(input)
    expect(http.post).toHaveBeenCalledWith('/api/forms', input)
    expect(result).toEqual(sampleForm)
  })

  it('update() calls PUT /api/forms/:id with input', async () => {
    const input = { name: 'Updated Form' }
    const updated = { ...sampleForm, name: 'Updated Form' }
    const http = mockHttp({ put: vi.fn().mockResolvedValue({ success: true, data: updated }) })
    const resource = new FormsResource(http)
    const result = await resource.update('form-1', input)
    expect(http.put).toHaveBeenCalledWith('/api/forms/form-1', input)
    expect(result).toEqual(updated)
  })

  it('delete() calls DELETE /api/forms/:id', async () => {
    const http = mockHttp({ delete: vi.fn().mockResolvedValue({ success: true, data: null }) })
    const resource = new FormsResource(http)
    await resource.delete('form-1')
    expect(http.delete).toHaveBeenCalledWith('/api/forms/form-1')
  })

  it('getSubmissions() calls GET /api/forms/:id/submissions', async () => {
    const submissions = [{ id: 'sub-1', formId: 'form-1', data: {}, createdAt: '2026-03-21T00:00:00Z' }]
    const http = mockHttp({ get: vi.fn().mockResolvedValue({ success: true, data: submissions }) })
    const resource = new FormsResource(http)
    const result = await resource.getSubmissions('form-1')
    expect(http.get).toHaveBeenCalledWith('/api/forms/form-1/submissions')
    expect(result).toEqual(submissions)
  })
})

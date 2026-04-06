import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/contexts/account-context', () => ({
  useAccount: () => ({
    accounts: [],
    selectedAccountId: 'account-1',
    selectedAccount: {
      id: 'account-1',
      name: 'Test Account',
      displayName: 'Test Account',
      channelId: 'channel-1',
      isActive: true,
    },
    setSelectedAccountId: () => undefined,
    refreshAccounts: async () => undefined,
    loading: false,
  }),
}))

vi.mock('@/components/app-shell', () => ({
  default: ({ children }: any) => <div data-testid="app-shell">{children}</div>,
}))

vi.mock('@/lib/api', () => ({
  api: {
    automations: {
      list: vi.fn(async () => ({ success: true, data: [] })),
      create: vi.fn(async () => ({ success: true, data: {} })),
      update: vi.fn(async () => ({ success: true, data: {} })),
      delete: vi.fn(async () => ({ success: true, data: {} })),
    },
    tags: {
      list: vi.fn(async () => ({ success: true, data: [] })),
    },
    friends: {
      list: vi.fn(async () => ({
        success: true,
        data: { items: [], total: 0, hasNextPage: false },
      })),
      count: vi.fn(async () => ({ success: true, data: { count: 0 } })),
      addTag: vi.fn(async () => ({ success: true, data: {} })),
      removeTag: vi.fn(async () => ({ success: true, data: {} })),
    },
    scenarios: { list: vi.fn(async () => ({ success: true, data: [] })) },
    broadcasts: { list: vi.fn(async () => ({ success: true, data: [] })) },
    templates: { list: vi.fn(async () => ({ success: true, data: [] })) },
    scoring: { rules: vi.fn(async () => ({ success: true, data: [] })) },
  },
}))

describe('admin UI smoke tests', () => {
  it('renders the dashboard page shell', async () => {
    const { default: DashboardPage } = await import('@/app/page')
    const html = renderToStaticMarkup(<DashboardPage />)

    expect(html).toContain('ダッシュボード')
    expect(html).toContain('Test Account の管理画面')
    expect(html).toContain('クイックアクション')
    expect(html).toContain('LINE で体験する')
  })

  it('renders the root layout wrapper', async () => {
    const { default: RootLayout } = await import('@/app/layout')
    const html = renderToStaticMarkup(
      <RootLayout>
        <div>Smoke Test Child</div>
      </RootLayout>
    )

    expect(html).toContain('lang="ja"')
    expect(html).toContain('data-testid="app-shell"')
    expect(html).toContain('Smoke Test Child')
  })

  it('renders the automations page shell', async () => {
    const { default: AutomationsPage } = await import('@/app/automations/page')
    const html = renderToStaticMarkup(<AutomationsPage />)

    expect(html).toContain('オートメーション')
    expect(html).toContain('新規ルール')
  })

  it('renders the friends page shell', async () => {
    const { default: FriendsPage } = await import('@/app/friends/page')
    const html = renderToStaticMarkup(<FriendsPage />)

    expect(html).toContain('友だち管理')
    expect(html).toContain('タグで絞り込み')
  })
})

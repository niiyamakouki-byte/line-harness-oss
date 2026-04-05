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
})

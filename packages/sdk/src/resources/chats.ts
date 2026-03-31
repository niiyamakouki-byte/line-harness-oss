import type { HttpClient } from '../http.js'
import type { ApiResponse, Chat, ChatWithMessages, ChatListParams, MessageType } from '../types.js'

export class ChatsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly defaultAccountId?: string,
  ) {}

  async list(params?: ChatListParams): Promise<Chat[]> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.operatorId) query.set('operatorId', params.operatorId)
    const accountId = params?.accountId ?? this.defaultAccountId
    if (accountId) query.set('lineAccountId', accountId)
    const qs = query.toString()
    const path = qs ? `/api/chats?${qs}` : '/api/chats'
    const res = await this.http.get<ApiResponse<Chat[]>>(path)
    return res.data
  }

  async get(id: string): Promise<ChatWithMessages> {
    const res = await this.http.get<ApiResponse<ChatWithMessages>>(`/api/chats/${id}`)
    return res.data
  }

  async send(chatId: string, content: string, messageType: MessageType = 'text'): Promise<{ messageId: string }> {
    const res = await this.http.post<ApiResponse<{ sent: boolean; messageId: string }>>(`/api/chats/${chatId}/send`, {
      content,
      messageType,
    })
    return { messageId: res.data.messageId }
  }
}

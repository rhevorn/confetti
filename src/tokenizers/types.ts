export type TokenKind =
  'whitespace' | 'text' | 'string' | 'escaped' | 'comment' | 'symbol'

export interface Token {
  kind: TokenKind
  value: string
}

export interface TokenizerOptions {
  symbols?: readonly string[]
  comments?: readonly string[]
  commentRequiresBoundary?: boolean
}

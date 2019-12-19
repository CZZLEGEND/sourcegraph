import * as Monaco from 'monaco-editor'
import { Sequence } from './parser'

export function getMonacoTokens({ members }: Pick<Sequence, 'members'>): Monaco.languages.IToken[] {
    const tokens: Monaco.languages.IToken[] = []
    for (const { token, range } of members) {
        if (token.type === 'whitespace') {
            tokens.push({
                startIndex: range.start,
                scopes: 'whitespace',
            })
        } else if (token.type === 'quoted' || token.type === 'word') {
            tokens.push({
                startIndex: range.start,
                scopes: 'identifier'
            })
        } else if (token.type === 'filter') {
            tokens.push({
                startIndex: token.filterType.range.start,
                scopes: 'keyword',
            })
            tokens.push({
                startIndex: token.filterValue.range.start,
                scopes: 'identifier'
            })
        }
    }
    return tokens
}

import * as Monaco from 'monaco-editor'
import { Sequence } from './parser'
import { FILTERS } from './filters'

export const getHoverResult = (
    { members }: Pick<Sequence, 'members'>,
    { column }: Pick<Monaco.Position, 'column'>
): Monaco.languages.Hover | null => {
    const tokenAtColumn = members.find(({ range }) => range.start + 1 <= column && range.end + 1 >= column)
    if (!tokenAtColumn || tokenAtColumn.token.type !== 'filter') {
        return null
    }
    const { filterType } = tokenAtColumn.token
    const matchedFilterDefinition = FILTERS.find(({ aliases }) => aliases.includes(filterType.token.value))
    if (!matchedFilterDefinition) {
        return null
    }
    return {
        contents: [{ value: matchedFilterDefinition.description }],
        range: {
            startLineNumber: 0,
            endLineNumber: 0,
            startColumn: tokenAtColumn.range.start + 1,
            endColumn: tokenAtColumn.range.end + 1,
        },
    }
}

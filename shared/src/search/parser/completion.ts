import * as Monaco from 'monaco-editor'
import { FILTERS } from './filters'
import { Omit } from 'utility-types'

const FILTER_TYPE_COMPLETIONS: Omit<Monaco.languages.CompletionItem, 'range' | 'insertText'>[] = FILTERS.flatMap(
    ({ aliases, description }) =>
        aliases.map(
            (label: string): Omit<Monaco.languages.CompletionItem, 'range' | 'insertText'> => ({
                label,
                kind: Monaco.languages.CompletionItemKind.Keyword,
                detail: description,
                // insertText: label,
            })
        )
)

export const getCompletionItems = (...args: any[]): Monaco.languages.CompletionList => {
    console.log('Returning completion items')
    return {
        suggestions: FILTER_TYPE_COMPLETIONS as Monaco.languages.CompletionItem[], // `as` statement because range is not actually necessary for these static suggestions.
    }
}

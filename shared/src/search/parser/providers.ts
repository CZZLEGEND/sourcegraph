import * as Monaco from 'monaco-editor'
import { Observable, fromEventPattern } from 'rxjs'
import { parseSearchQuery } from './parser'
import { map, first, takeUntil, publishReplay, refCount } from 'rxjs/operators'
import { getMonacoTokens } from './tokens'
import { getDiagnostics } from './diagnostics'
import { getCompletionItems } from './completion'
import { SearchSuggestion } from '../../graphql/schema'
import { getHoverResult } from './hover'

interface SearchFieldProviders {
    tokens: Monaco.languages.TokensProvider
    hover: Monaco.languages.HoverProvider
    completion: Monaco.languages.CompletionItemProvider
    diagnostics: Observable<Monaco.editor.IMarkerData[]>
}

/**
 * A dummy parsing state, required for the token provider.
 */
const PARSER_STATE: Monaco.languages.IState = {
    clone: () => ({ ...PARSER_STATE }),
    equals: () => false,
}

export function getProviders(
    searchQueries: Observable<string>,
    fetchSuggestions: (input: string) => Observable<SearchSuggestion>
): SearchFieldProviders {
    const parsedQueries = searchQueries.pipe(map(parseSearchQuery), publishReplay(1), refCount())
    return {
        tokens: {
            getInitialState: () => PARSER_STATE,
            tokenize: line => {
                const result = parseSearchQuery(line)
                if (result.type === 'success') {
                    return {
                        tokens: getMonacoTokens(result.token),
                        endState: PARSER_STATE,
                    }
                }
                return { endState: PARSER_STATE, tokens: [] }
            },
        },
        hover: {
            provideHover: (_, position, token) =>
                parsedQueries
                    .pipe(
                        first(),
                        map(parsed => (parsed.type === 'error' ? null : getHoverResult(parsed.token, position))),
                        takeUntil(fromEventPattern(handler => token.onCancellationRequested(handler)))
                    )
                    .toPromise(),
        },
        completion: {
            provideCompletionItems: (_, position, context, token) => {
                console.log('GIVE ME COMPLETIONS')
                return null
                // return parsedQueries
                //     .pipe(
                //         first(),
                //         map(parsed => {
                //             console.log('sup', { parsed })
                //             return parsed.type === 'error'
                //                 ? null
                //                 : getCompletionItems(parsed.token, position, context, fetchSuggestions)
                //         }),
                //         takeUntil(fromEventPattern(handler => token.onCancellationRequested(handler)))
                //     )
                //     .toPromise()
            },
        },
        diagnostics: parsedQueries.pipe(map(parsed => (parsed.type === 'success' ? getDiagnostics(parsed.token) : []))),
    }
}

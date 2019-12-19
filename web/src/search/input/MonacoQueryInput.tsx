import React, { useEffect, useMemo } from 'react'
import * as Monaco from 'monaco-editor'
import { MonacoEditor } from '../../components/MonacoEditor'
import { QueryState } from '../helpers'
import { getProviders } from '../../../../shared/src/search/parser/providers'
import { ReplaySubject, Subscription, Observable } from 'rxjs'
import { fetchSuggestions } from '../backend'

export interface MonacoQueryInputProps {
    queryState: QueryState
    onChange: (newState: QueryState) => void
    onSubmit: () => void
}

const SOURCEGRAPH_SEARCH: 'sourcegraphSearch' = 'sourcegraphSearch'

function addSouregraphSearchCodeIntelligence(monaco: typeof Monaco, searchQueries: Observable<string>, changeQuery: (query: string) => void): Subscription {
    const subscriptions = new Subscription()

    const disposables: Monaco.IDisposable[] = []

    subscriptions.add(() => {
        for (const disposable of disposables) {
            disposable.dispose()
        }
    })

    monaco.languages.register({ id: SOURCEGRAPH_SEARCH })

    monaco.editor.defineTheme('sourcegraph-dark', {
        base: 'vs-dark',
        inherit: true,
        colors: {
            'editor.background': '#0E121B',
            'editor.foreground': '#F2F4F8',
            'editorCursor.foreground': '#A2B0CD',
            'editor.selectionBackground': '#1C7CD650',
            'editor.selectionHighlightBackground': '#1C7CD625',
            'editor.inactiveSelectionBackground': '#1C7CD625',
        },
        rules: [],
    })

    monaco.editor.setTheme('sourcegraph-dark')

    const providers = getProviders(searchQueries, fetchSuggestions)

    disposables.push(
        monaco.languages.setTokensProvider(SOURCEGRAPH_SEARCH, providers.tokens)
    )

    disposables.push(
        monaco.languages.registerHoverProvider(SOURCEGRAPH_SEARCH, providers.hover)
    )

    disposables.push(
        monaco.languages.registerCompletionItemProvider(SOURCEGRAPH_SEARCH, providers.completion)
    )

    let diagnosticsSubscription = new Subscription()
    disposables.push(
        monaco.editor.onDidCreateModel(model => {
            disposables.push(
                model.onDidChangeContent(e => {
                    changeQuery(model.getValue().replace(/[\n\r↵]/g, ''))
                })
            )
            diagnosticsSubscription.unsubscribe()
            diagnosticsSubscription = providers.diagnostics.subscribe(markers => {
                monaco.editor.setModelMarkers(model, 'diagnostics', markers)
            })
        })
    )

    subscriptions.add(() => diagnosticsSubscription.unsubscribe())

    return subscriptions
}

export const MonacoQueryInput: React.FunctionComponent<MonacoQueryInputProps> = ({
    queryState,
    onChange,
    onSubmit,
}) => {
    const queryUpdates = useMemo(() => new ReplaySubject<string>(1), [])
    useEffect(() => queryUpdates.next(queryState.query), [queryState.query, queryUpdates])
    const editorWillMount = React.useCallback((monaco: typeof Monaco) => {
        addSouregraphSearchCodeIntelligence(monaco, queryUpdates, query => onChange({ query, cursorPosition: 0}))
    }, [ queryUpdates, onChange])
    const options: Monaco.editor.IEditorOptions = {
        readOnly: false,
        lineNumbers: 'off',
        fontFamily: 'SFMono-Regular, Consolas, Menlo, DejaVu Sans Mono, monospace',
        lineHeight: 35,
        minimap: {
            enabled: false,
        },
        scrollbar: {
            vertical: 'hidden',
            horizontal: 'hidden',
        },
        // glyphMargin: false,
        // lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        // folding: false,
        rulers: [],
        overviewRulerLanes: 0,
        wordBasedSuggestions: false,
        quickSuggestions: false,
    }
    return (
        <MonacoEditor
            id='monaco-search-field'
            language={SOURCEGRAPH_SEARCH}
            value={queryState.query}
            height={35}
            theme='sourcegraph-dark'
            editorWillMount={editorWillMount}
            options={options}
            className="flex-grow-1"
        ></MonacoEditor>
    )
}

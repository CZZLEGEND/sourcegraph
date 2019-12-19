import { once } from 'lodash'
import React, { useEffect, useCallback, useRef, useState } from 'react'
import * as Monaco from 'monaco-editor'
import { MonacoEditor } from '../../components/MonacoEditor'
import { QueryState } from '../helpers'
import { parseSearchQuery } from '../../../../shared/src/search/parser/parser'
import { getDiagnostics } from '../../../../shared/src/search/parser/diagnostics'
import { getMonacoTokens } from '../../../../shared/src/search/parser/tokens'

export interface MonacoQueryInputProps {
    queryState: QueryState
    onChange: (newState: QueryState) => void
    onSubmit: () => void
}

const SOURCEGRAPH_SEARCH: 'sourcegraphSearch' = 'sourcegraphSearch'

const STATE: Monaco.languages.IState = {
    clone: () => ({ ...STATE }),
    equals: () => false,
}

const makeEditorHype = once((monaco: typeof Monaco) => {
    monaco.languages.register({ id: SOURCEGRAPH_SEARCH })
    // Register a tokens provider for the language

    monaco.languages.setTokensProvider(SOURCEGRAPH_SEARCH, {
        getInitialState: () => STATE,
        tokenize: line => {
            const result = parseSearchQuery(line)
            if (result.type === 'error') {
                return { tokens: [], endState: STATE }
            }
            return {
                tokens: getMonacoTokens(result.token),
                endState: STATE,
            }
        },
    })
})

export const MonacoQueryInput: React.FunctionComponent<MonacoQueryInputProps> = ({
    queryState,
    onChange,
    onSubmit,
}) => {
    let monaco: typeof Monaco | null = null
    let editor: Monaco.editor.ICodeEditor | null = null
    const stripNewlines = (q: string): string => q.replace(/[\n\r]+/g, '')
    const editorWillMount = React.useCallback((e: typeof Monaco): void => {
        monaco = e
        makeEditorHype(monaco)
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

        // Only listen to 1 event each to avoid receiving events from other Monaco editors on the
        // same page (if there are multiple).
        const editorDisposable = monaco.editor.onDidCreateEditor(e => {
            editor = editor
            editorDisposable.dispose()
        })
        const modelDisposable = monaco.editor.onDidCreateModel(m => {
            m.onDidChangeContent(() => {
                const query = stripNewlines(m.getValue())
                const parsed = parseSearchQuery(m.getValue())
                if (parsed.type === 'success') {
                    monaco?.editor.setModelMarkers(m, 'sourcegraph', getDiagnostics(parsed.token))
                }
                onChange({ query, cursorPosition: query.length })
            })
            modelDisposable.dispose()
        })
    }, [])
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
        // lineNumbersMinChars: 0,
        // folding: false,
        rulers: [],
        overviewRulerLanes: 0,
        wordBasedSuggestions: false,
        quickSuggestions: false,
    }
    const actions: Monaco.editor.IActionDescriptor[] = [
        // {
        //     id: 'submitSearch',
        //     label: 'Submit Sourcegraph search',
        //     keybindings: [Monaco.KeyCode.Enter],
        //     run: () => {},
        // },
    ]
    return (
        <MonacoEditor
            id='monaco-search-field'
            language={SOURCEGRAPH_SEARCH}
            value={queryState.query}
            height={35}
            theme='sourcegraph-dark'
            editorWillMount={editorWillMount}
            options={options}
            actions={actions}
            className="flex-grow-1"
        ></MonacoEditor>
    )
}

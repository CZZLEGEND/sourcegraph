import { once } from 'lodash'
import React, { useEffect, useCallback, useRef, useState } from 'react'
import * as Monaco from 'monaco-editor'
import { MonacoEditor } from '../../components/MonacoEditor'
import { QueryState } from '../helpers'
import { parseSearchQuery } from '../../../../shared/src/search/parser/parser'

export interface MonacoQueryInputProps {
    queryState: QueryState
    onChange: (newState: QueryState) => void
    onSubmit: () => void
}

const SOURCEGRAPH_SEARCH: 'sourcegraphSearch' = 'sourcegraphSearch'

const STATE: Monaco.languages.IState = {
    clone: () => ({ ...STATE }),
    equals: () => true,
}

const makeEditorHype = once((monaco: typeof Monaco) => {
    monaco.languages.register({ id: SOURCEGRAPH_SEARCH })
    // Register a tokens provider for the language

    monaco.languages.setTokensProvider(SOURCEGRAPH_SEARCH, {
        getInitialState: () => STATE,
        tokenize: (line, state) => {
            const result = parseSearchQuery(line, 0)
            if (result.type === 'error') {
                return { tokens: [], endState: STATE }
            }
            return {
                tokens: result.token.members.map(({ token, range }): Monaco.languages.IToken => ({})),
                endState: STATE,
            }
        },
    })

    monaco.languages.setMonarchTokensProvider(SOURCEGRAPH_SEARCH, {
        keywords: [
            'repo',
            'r',
            '-repo',
            '-r',
            'lang',
            'language',
            'file',
            'f',
            '-file',
            '-f',
            'case',
            'repohasfile',
            'repohascommitafter',
        ].map(s => `${s}:`),
        tokenizer: {
            root: [
                [
                    /[^\s:]+:?/,
                    {
                        cases: {
                            '@keywords': 'keyword',
                            '@default': 'identifier',
                        },
                    },
                ],
                { include: '@whitespace' },
            ],
            whitespace: [[/\s+/, 'white']],
        },
    } as any)
    monaco.languages.registerCompletionItemProvider(SOURCEGRAPH_SEARCH, {
        provideCompletionItems: (model, position, context, token) => {
            return {
                suggestions: [
                    { label: 'repo:', detail: 'Limit results to repositories matching this pattern.' },
                    { label: '-repo:', detail: 'Exclude repositories matching this pattern.' },
                    { label: 'repogroup:', detail: 'Include results from the named group.' },
                    { label: 'repohascommitafter:', detail: 'Filter out stale repositories without recent commits.' },
                    { label: 'lang:', detail: 'Include only results from the given language.' },
                    { label: 'file:', detail: 'Include only results from files matching this pattern.' },
                    { label: '-file:', detail: 'Exclude files matching this pattern from results.' },
                    { label: 'case:', detail: 'Whether the search pattern is case-sensitive.' },
                    { label: 'repohasfile:', detail: 'Include only repositories including a given file.' },
                ].map(
                    ({ label, detail }): Monaco.languages.CompletionItem =>
                        ({
                            label,
                            detail,
                            kind: Monaco.languages.CompletionItemKind.Keyword,
                            insertText: label,
                        } as any)
                ),
            }
        },
    })

    monaco.languages.registerHoverProvider(SOURCEGRAPH_SEARCH, {
        provideHover: (model, position, token): Monaco.languages.Hover | null => {
            if (model.getWordAtPosition(position)?.word === 'lang') {
                return {
                    contents: [
                        {
                            value: `**\`lang:\` filter**\n\nInclude only results matching a language.
                        `,
                        },
                    ],
                }
            } else if (model.getWordAtPosition(position)?.word === 'file') {
                return {
                    contents: [
                        {
                            value: `**\`file:\` filter**\n\nInclude only results from files matching this pattern.
                        `,
                        },
                    ],
                }
            }
            return null
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
    const stripNewlines = (q: string) => q.replace(/[\n\r]+/g, '')
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
            id={'monaco-search-field'}
            language={SOURCEGRAPH_SEARCH}
            value={queryState.query}
            height={35}
            theme={'sourcegraph-dark'}
            editorWillMount={editorWillMount}
            options={options}
            actions={actions}
            className="flex-grow-1"
        ></MonacoEditor>
    )
}

import classNames from 'classnames';
import * as DraftJs from 'draft-js';
import { find } from 'lodash';
import { debounce, bind } from 'lodash-decorators';
import React from 'react';
import { connect } from 'react-redux';

import CodeMirror from 'lib/codemirror';
import { ICodeAnalysis, getSelectedQuery } from 'lib/sql-helper/sql-lexer';
import { renderTemplatedQuery } from 'lib/templated-query';
import { sleep, getCodeEditorTheme } from 'lib/utils';
import { sendNotification } from 'lib/dataHubUI';
import { formatError } from 'lib/utils/error';

import { IDataQueryCellMeta } from 'const/datadoc';

import * as dataSourcesActions from 'redux/dataSources/action';
import { createQueryExecution } from 'redux/queryExecutions/action';
import { setSidebarTableId } from 'redux/dataHubUI/action';
import {
    queryEngineSelector,
    queryEngineByIdEnvSelector,
} from 'redux/queryEngine/selector';
import { IStoreState, Dispatch } from 'redux/store/types';

import { DataDocQueryExecutions } from 'components/DataDocQueryExecutions/DataDocQueryExecutions';
import { QueryEditor } from 'components/QueryEditor/QueryEditor';
import { QuerySnippetInsertionModal } from 'components/QuerySnippetInsertionModal/QuerySnippetInsertionModal';
import { QueryRunButton } from 'components/QueryRunButton/QueryRunButton';

import { DebouncedInput } from 'ui/DebouncedInput/DebouncedInput';
import { DropdownMenu, IMenuItem } from 'ui/DropdownMenu/DropdownMenu';
import { Title } from 'ui/Title/Title';
import { Modal } from 'ui/Modal/Modal';

import './DataDocQueryCell.scss';
import { Message } from 'ui/Message/Message';
import { Button } from 'ui/Button/Button';
import { Icon } from 'ui/Icon/Icon';

const ON_CHANGE_DEBOUNCE_MS = 250;

type StateProps = ReturnType<typeof mapStateToProps>;
type DispatchProps = ReturnType<typeof mapDispatchToProps>;
interface IOwnProps {
    query: string;
    meta: IDataQueryCellMeta;
    isEditable: boolean;

    docId: number;
    cellId: number;

    queryIndexInDoc: number;
    templatedVariables: Record<string, string>;

    shouldFocus: boolean;
    isFullScreen?: boolean;

    showCollapsed: boolean;

    onChange: (fields: {
        context?: string | DraftJs.ContentState;
        meta?: {};
    }) => any;
    onFocus?: () => any;
    onBlur?: () => any;
    onUpKeyPressed?: () => any;
    onDownKeyPressed?: () => any;
    onDeleteKeyPressed?: () => any;
}
type IProps = IOwnProps & StateProps & DispatchProps;

interface IState {
    query: string;
    meta: IDataQueryCellMeta;

    focused: boolean;
    selectedRange: {
        from: {
            line: number;
            ch: number;
        };
        to: {
            line: number;
            ch: number;
        };
    };
    isQueryCollapsedViewOverride: boolean;
    showQuerySnippetModal: boolean;
}

class DataDocQueryCellComponent extends React.Component<IProps, IState> {
    private queryEditorRef = React.createRef<QueryEditor>();
    private runButtonRef = React.createRef<QueryRunButton>();
    private selfRef = React.createRef<HTMLDivElement>();
    private keyMap = {
        'Shift-Enter': this.clickOnRunButton,
    };

    constructor(props) {
        super(props);

        this.state = {
            query: props.query,
            meta: props.meta,
            focused: false,
            selectedRange: null,
            isQueryCollapsedViewOverride: null,
            showQuerySnippetModal: false,
        };
    }

    public get engineId() {
        return this.state.meta.engine;
    }

    public componentDidMount() {
        const { queryEngineById } = this.props;

        this.updateFocus();

        if (this.engineId in queryEngineById) {
            this.props.loadFunctionDocumentationByLanguage(
                queryEngineById[this.engineId].language
            );
        }
    }

    public componentDidUpdate(prevProps, prevState) {
        this.updateFocus();

        if (
            prevProps.query !== this.props.query ||
            prevProps.meta !== this.props.meta
        ) {
            this.setState({
                ...(prevProps.query !== this.props.query && {
                    query: this.props.query,
                }),
                ...(prevProps.meta !== this.props.meta && {
                    meta: this.props.meta,
                }),
            });

            if (
                prevProps.meta !== this.props.meta &&
                this.props.meta.engine in this.props.queryEngineById
            ) {
                this.props.loadFunctionDocumentationByLanguage(
                    this.props.queryEngineById[this.props.meta.engine].language
                );
            }
        }
    }

    @bind
    @debounce(ON_CHANGE_DEBOUNCE_MS)
    public onChangeDebounced(...args) {
        this.props.onChange.apply(null, args);
    }

    @bind
    public updateFocus() {
        if (this.props.shouldFocus !== this.state.focused) {
            if (!this.state.focused) {
                this.focus();
            }

            this.setState({
                focused: this.props.shouldFocus,
            });
        }
    }

    @bind
    public onSelection(query, selectedRange) {
        this.setState({
            selectedRange,
        });

        if (selectedRange) {
            const codeAnalysis: ICodeAnalysis = this.queryEditorRef.current.getCodeAnalysis();

            if (
                codeAnalysis &&
                codeAnalysis.lineage &&
                codeAnalysis.lineage.references &&
                selectedRange.from.line === selectedRange.to.line
            ) {
                const selectionLine = selectedRange.from.line;
                const selectionPos = {
                    from: selectedRange.from.ch,
                    to: selectedRange.to.ch,
                };

                const tableReferences = Array.prototype.concat.apply(
                    [],
                    Object.values(codeAnalysis.lineage.references)
                );
                const table = find(tableReferences, (tb) => {
                    if (tb.line === selectionLine) {
                        const isSchemaExplicit =
                            tb.end - tb.start > tb.name.length;
                        const tablePos = {
                            from:
                                tb.start +
                                (isSchemaExplicit ? tb.schema.length + 1 : 0),
                            to: tb.end,
                        };

                        return (
                            tablePos.from === selectionPos.from &&
                            tablePos.to === selectionPos.to
                        );
                    }
                });
                if (table) {
                    (async () => {
                        const tableInfo = await this.fetchDataTableByNameIfNeeded(
                            table.schema,
                            table.name
                        );

                        if (tableInfo) {
                            this.props.setTableSidebarId(tableInfo.id);
                            // TODO: do we keep this logic?
                            // this.props.showTableInInspector(tableInfo.id);
                        } else {
                            this.props.setTableSidebarId(null);
                            // this.props.showTableInInspector(null);
                        }
                    })();
                }
            }
        }
    }

    @bind
    public onBlur() {
        if (this.state.focused) {
            if (this.props.onBlur) {
                this.props.onBlur();
            }
        }
    }

    @bind
    public onFocus() {
        if (!this.state.focused) {
            if (this.props.onFocus) {
                this.props.onFocus();
            }
        }
    }

    public focus() {
        if (
            !(
                this.queryEditorRef.current &&
                this.queryEditorRef.current.getEditor
            )
        ) {
            return;
        }

        const editor = this.queryEditorRef.current.getEditor();
        editor.focus();
    }

    @bind
    public onKeyDown(editor: CodeMirror.Editor, event) {
        const keyUpCode = 38;
        const keyDownCode = 40;
        const keyDeleteCode = 8;

        const doc = editor.getDoc();

        const cursor = doc.getCursor();
        const autocompleteWidgetOpen =
            editor.state.completionActive &&
            editor.state.completionActive.widget;

        let stopEvent = true;
        if (
            this.props.onUpKeyPressed &&
            event.keyCode === keyUpCode &&
            !autocompleteWidgetOpen &&
            cursor.line === 0 &&
            cursor.ch === 0
        ) {
            this.props.onUpKeyPressed();
        } else if (
            this.props.onDownKeyPressed &&
            event.keyCode === keyDownCode &&
            !autocompleteWidgetOpen &&
            cursor.line === doc.lineCount() - 1 &&
            cursor.ch === doc.getLine(doc.lineCount() - 1).length
        ) {
            this.props.onDownKeyPressed();
        } else if (
            event.keyCode === keyDeleteCode &&
            this.state.query.length === 0
        ) {
            this.props.onDeleteKeyPressed();
        } else {
            stopEvent = false;
        }

        if (stopEvent) {
            event.stopPropagation();
            event.preventDefault();
        }
    }

    @bind
    public clickOnRunButton() {
        if (this.runButtonRef.current) {
            // emulate a click
            this.runButtonRef.current.clickRunButton();
        }
    }

    @bind
    public handleChange(query) {
        this.setState(
            {
                query,
            },
            () => this.onChangeDebounced({ context: query })
        );
    }

    @bind
    public handleMetaChange(field, value) {
        const { meta } = this.state;
        const newMeta = {
            ...meta,
            [field]: value,
        };
        this.setState(
            {
                meta: newMeta,
            },
            () => this.onChangeDebounced({ meta: newMeta })
        );
    }
    public handleMetaTitleChange = (value) =>
        this.handleMetaChange('title', value);

    @bind
    public async onRunButtonClick() {
        const { cellId, templatedVariables = {} } = this.props;
        const { query } = this.state;

        await sleep(ON_CHANGE_DEBOUNCE_MS);
        const selectedRange =
            this.queryEditorRef.current &&
            this.queryEditorRef.current.getEditorSelection();

        let renderedQuery: string;
        try {
            const rawQuery = getSelectedQuery(query, selectedRange);
            renderedQuery = await renderTemplatedQuery(
                rawQuery,
                templatedVariables
            );
        } catch (e) {
            sendNotification(
                'Failed to render query. Check for template syntax errors.'
            );
        }

        if (renderedQuery != null) {
            return this.props.createQueryExecution(
                renderedQuery,
                this.engineId,
                cellId
            );
        }
    }

    @bind
    public formatQuery(options = {}) {
        if (this.queryEditorRef.current) {
            this.queryEditorRef.current.formatQuery(options);
        }
    }

    public additionalDropDownButtonFormatter() {
        return (
            <Icon
                className="additional-dropdown-button flex-center"
                name="more-vertical"
            />
        );
    }

    @bind
    public toggleQueryCollapsing(forceCollapse) {
        const { isEditable } = this.props;
        if (isEditable) {
            this.handleMetaChange('is_query_collapsed', !!forceCollapse);
        } else {
            this.setState({ isQueryCollapsedViewOverride: !!forceCollapse });
        }
    }

    @bind
    public getIsQueryCollapsed() {
        const { meta } = this.props;
        const { isQueryCollapsedViewOverride } = this.state;

        const isQueryCollapsedSavedValue = !!(meta || ({} as any))
            .is_query_collapsed;
        return isQueryCollapsedViewOverride != null
            ? isQueryCollapsedViewOverride
            : isQueryCollapsedSavedValue;
    }

    public getAdditionalDropDownButtonDOM() {
        const { isEditable } = this.props;

        const isQueryCollapsed = this.getIsQueryCollapsed();

        const additionalButtons: IMenuItem[] = [];
        if (isEditable) {
            additionalButtons.push({
                name: 'Format Query (⇧⎇F)',
                onClick: this.formatQuery.bind(this, { case: 'upper' }),
                icon: 'fas fa-file-code',
                items: [
                    {
                        name: 'Format(Uppercase)',
                        onClick: this.formatQuery.bind(this, { case: 'upper' }),
                    },
                    {
                        name: 'Format(Lowercase)',
                        onClick: this.formatQuery.bind(this, { case: 'lower' }),
                    },
                ],
            });
        }

        additionalButtons.push({
            name: isQueryCollapsed ? 'Show Query' : 'Hide Query',
            onClick: this.toggleQueryCollapsing.bind(this, !isQueryCollapsed),
            icon: isQueryCollapsed ? 'far fa-eye' : 'far fa-eye-slash',
        });

        return additionalButtons.length > 0 ? (
            <DropdownMenu
                customButtonRenderer={this.additionalDropDownButtonFormatter}
                items={additionalButtons}
                className="is-right"
            />
        ) : null;
    }

    @bind
    public getTitle() {
        const { meta } = this.props;
        return (meta || ({} as any)).title;
    }

    @bind
    public handleInsertSnippet(query: string) {
        this.handleChange(query);
    }

    @bind
    public toggleInsertQuerySnippetModal() {
        this.setState(({ showQuerySnippetModal }) => ({
            showQuerySnippetModal: !showQuerySnippetModal,
        }));
    }

    @bind
    public fetchDataTableByNameIfNeeded(schema: string, table: string) {
        return this.props.fetchDataTableByNameIfNeeded(
            schema,
            table,
            this.props.queryEngineById[this.engineId].metastore_id
        );
    }

    public renderErrorCell(errorMessage: React.ReactChild) {
        return (
            <div className={'DataDocQueryCell'} ref={this.selfRef}>
                <div className="data-doc-query-cell-inner">
                    <Message
                        title={'Invalid Query Cell - Please remove'}
                        message={errorMessage}
                        type="error"
                    />
                </div>
            </div>
        );
    }

    public render() {
        const {
            queryEngines,
            queryEngineById,

            cellId,
            docId,

            isEditable,

            functionDocumentationByNameByLanguage,
            codeEditorTheme,

            queryIndexInDoc,
            showCollapsed,
        } = this.props;
        const {
            query,
            meta,
            selectedRange,
            showQuerySnippetModal,
        } = this.state;

        if (!queryEngines.length) {
            return this.renderErrorCell(
                'QueryCell will not work unless there is at least 1 query engine.' +
                    ' Please contact admin.'
            );
        } else if (!(this.engineId in queryEngineById)) {
            return this.renderErrorCell(
                <>
                    <p>
                        Please remove this cell since it uses an invalid engine.
                        Query text:
                    </p>
                    <p>{query}</p>
                </>
            );
        }
        const queryEngine = queryEngineById[this.engineId];
        const isQueryCollapsed = this.getIsQueryCollapsed();

        const classes = classNames({
            DataDocQueryCell: true,
        });

        const defaultQueryTitle =
            queryIndexInDoc == null
                ? 'Untitled'
                : `Query #${queryIndexInDoc + 1}`;
        const dataCellTitle = meta.title || defaultQueryTitle;
        const queryTitleDOM = isEditable ? (
            <DebouncedInput
                value={meta.title}
                onChange={this.handleMetaTitleChange}
                inputProps={{
                    placeholder: defaultQueryTitle,
                    className: 'Title',
                }}
                transparent
                flex
            />
        ) : (
            <Title size={4}>{dataCellTitle}</Title>
        );

        const editorLanguage = queryEngine.language;
        const editorDOM = !isQueryCollapsed && (
            <div className="editor">
                <QueryEditor
                    value={query}
                    lineWrapping={true}
                    language={editorLanguage}
                    onKeyDown={this.onKeyDown}
                    onChange={this.handleChange}
                    onFocus={this.onFocus}
                    onBlur={this.onBlur}
                    onSelection={this.onSelection}
                    readOnly={!isEditable}
                    keyMap={this.keyMap}
                    ref={this.queryEditorRef}
                    functionDocumentationByNameByLanguage={
                        functionDocumentationByNameByLanguage
                    }
                    theme={codeEditorTheme}
                    getTableByName={this.fetchDataTableByNameIfNeeded}
                    metastoreId={queryEngine.metastore_id}
                    showFullScreenButton
                />
            </div>
        );

        const openSnippetDOM =
            query.trim().length === 0 ? (
                <div className="add-snippet-wrapper flex-center">
                    <Button
                        title="Add Template"
                        onClick={this.toggleInsertQuerySnippetModal}
                        borderless
                        type="inlineText"
                    />
                </div>
            ) : null;

        const insertQuerySnippetModalDOM = showQuerySnippetModal ? (
            <Modal
                onHide={this.toggleInsertQuerySnippetModal}
                className="wide"
                title="Insert Query Snippet"
            >
                <QuerySnippetInsertionModal
                    onInsert={this.handleInsertSnippet}
                />
            </Modal>
        ) : null;

        return showCollapsed ? (
            <div className={classes} ref={this.selfRef}>
                <div className="query-title flex-row">
                    <span>{meta.title || defaultQueryTitle}</span>
                    <span>{'{...}'}</span>
                </div>
            </div>
        ) : (
            <>
                <div className={classes} ref={this.selfRef}>
                    <div className="data-doc-query-cell-inner">
                        <div className="query-metadata">
                            <div className="query-title">{queryTitleDOM}</div>
                            <QueryRunButton
                                ref={this.runButtonRef}
                                queryEngineById={queryEngineById}
                                queryEngines={queryEngines}
                                disabled={!isEditable}
                                hasSelection={selectedRange != null}
                                engineId={this.engineId}
                                onRunClick={this.onRunButtonClick}
                                onEngineIdSelect={this.handleMetaChange.bind(
                                    this,
                                    'engine'
                                )}
                            />
                            {this.getAdditionalDropDownButtonDOM()}
                        </div>
                        <div className="query-content">
                            {editorDOM}
                            {openSnippetDOM}
                            <DataDocQueryExecutions
                                docId={docId}
                                cellId={cellId}
                                isQueryCollapsed={isQueryCollapsed}
                                changeCellContext={this.handleChange}
                            />
                        </div>
                    </div>
                </div>
                {insertQuerySnippetModalDOM}
            </>
        );
    }
}

function mapStateToProps(state: IStoreState, ownProps: IOwnProps) {
    const queryEngines = queryEngineSelector(state);

    return {
        codeEditorTheme: getCodeEditorTheme(state.user.computedSettings.theme),
        functionDocumentationByNameByLanguage:
            state.dataSources.functionDocumentationByNameByLanguage,
        queryEngines,
        queryEngineById: queryEngineByIdEnvSelector(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch, ownProps: IOwnProps) {
    return {
        loadFunctionDocumentationByLanguage: (language) => {
            return dispatch(
                dataSourcesActions.fetchFunctionDocumentationIfNeeded(language)
            );
        },
        fetchDataTableByNameIfNeeded: (schemaName, tableName, metastoreId) =>
            dispatch(
                dataSourcesActions.fetchDataTableByNameIfNeeded(
                    schemaName,
                    tableName,
                    metastoreId
                )
            ),
        createQueryExecution: (
            query: string,
            engineId: number,
            cellId: number
        ) => dispatch(createQueryExecution(query, engineId, cellId)),

        setTableSidebarId: (id: number) => dispatch(setSidebarTableId(id)),
    };
}

export const DataDocQueryCell = connect(
    mapStateToProps,
    mapDispatchToProps
)(DataDocQueryCellComponent);
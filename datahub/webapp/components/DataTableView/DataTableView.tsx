import { bind } from 'lodash-decorators';
import { snakeCase } from 'lodash';
import { decorate } from 'core-decorators';
import memoizeOne from 'memoize-one';
import React from 'react';
import { connect } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';

import { sanitizeUrlTitle } from 'lib/utils';
import history from 'lib/router-history';
import { formatError } from 'lib/utils/error';
import { getQueryString, replaceQueryString } from 'lib/utils/query-string';

import { fullTableSelector } from 'redux/dataSources/selector';
import { IStoreState, Dispatch } from 'redux/store/types';
import * as dataSourcesActions from 'redux/dataSources/action';

import { DataTableViewColumn } from 'components/DataTableViewColumn/DataTableViewColumn';
import { DataTableViewSamples } from 'components/DataTableViewSamples/DataTableViewSamples';
import { DataTableViewOverview } from 'components/DataTableViewOverview/DataTableViewOverview';
import { DataTableViewLineage } from 'components/DataTableViewLineage/DataTableViewLineage';
import { DataTableViewSourceQuery } from 'components/DataTableViewSourceQuery/DataTableViewSourceQuery';
import { DataTableViewQueryExamples } from 'components/DataTableViewQueryExample/DataTableViewQueryExamples';

import { Loader } from 'ui/Loader/Loader';
import { Tabs } from 'ui/Tabs/Tabs';

import { DataTableHeader } from './DataTableHeader';
import { FourOhFour } from 'ui/ErrorPage/FourOhFour';
import { ErrorPage } from 'ui/ErrorPage/ErrorPage';
import { Container } from 'ui/Container/Container';
import './DataTableView.scss';

const tabDefinitions = [
    {
        name: 'Overview',
        key: 'overview',
    },
    {
        name: 'Columns',
        key: 'columns',
    },
    {
        name: 'Row Samples',
        key: 'row_samples',
    },
    {
        name: 'Lineage',
        key: 'lineage',
    },
    {
        name: 'Source Query',
        key: 'source_query',
    },
    {
        name: 'Query Examples',
        key: 'query_examples',
    },
];

interface IOwnProps extends RouteComponentProps {
    tableId: number;
}

type DataTableViewStateProps = ReturnType<typeof mapStateToProps>;
type DataTableViewDispatchProps = ReturnType<typeof mapDispatchToProps>;

export type IDataTableViewProps = IOwnProps &
    DataTableViewStateProps &
    DataTableViewDispatchProps;

export interface IDataTableViewState {
    selectedTabKey: string;
}

class DataTableViewComponent extends React.PureComponent<
    IDataTableViewProps,
    IDataTableViewState
> {
    public readonly state = {
        selectedTabKey: this.getInitialTabKey(),
    };

    public componentDidMount() {
        this.props.getTable(this.props.tableId);
        this.publishDataTableTitle(this.props.tableName);
    }

    public componentDidUpdate(prevProps) {
        if (
            this.props.tableName &&
            prevProps.tableName !== this.props.tableName
        ) {
            this.publishDataTableTitle(this.props.tableName);
        }
    }

    @decorate(memoizeOne)
    public publishDataTableTitle(title: string) {
        if (title) {
            document.title = title;
            history.replace(
                location.pathname.split('/').slice(0, 4).join('/') +
                    `/${sanitizeUrlTitle(title)}/` +
                    location.search +
                    location.hash,
                this.props.location.state
            );
        }
    }

    public getInitialTabKey() {
        const queryParam = getQueryString();
        return queryParam['tab'] || snakeCase(tabDefinitions[0].key);
    }

    public getInitialTabs() {
        const tabs = tabDefinitions;
        return tabs.map((tab) => {
            return {
                name: tab.name,
                key: tab.key,
                onClick: this.onTabSelected.bind(this, tab.key),
            };
        });
    }

    @bind
    public onTabSelected(key) {
        // Temporal
        replaceQueryString({ tab: key });
        this.setState({ selectedTabKey: key });
    }

    @bind
    public makeOverviewDOM() {
        const { table, tableName, tableColumns } = this.props;

        return (
            <DataTableViewOverview
                table={table}
                tableName={tableName}
                tableColumns={tableColumns}
                onTabSelected={this.onTabSelected}
                updateDataTableDescription={this.updateDataTableDescription}
            />
        );
    }

    @bind
    public makeColumnsDOM(numberOfRows = null) {
        const { table, tableColumns, updateDataColumnDescription } = this.props;

        return (
            <DataTableViewColumn
                table={table}
                tableColumns={tableColumns}
                numberOfRows={numberOfRows}
                updateDataColumnDescription={updateDataColumnDescription}
            />
        );
    }

    @bind
    public makeSamplesDOM(numberOfRows: number) {
        const { table, schema } = this.props;

        return (
            <Loader
                item={table}
                itemLoader={() => {
                    /* */
                }}
            >
                <DataTableViewSamples table={table} schema={schema} />
            </Loader>
        );
    }

    @bind
    public makeLineageDOM() {
        const { table, dataLineages, loadDataLineages } = this.props;

        return (
            <Loader
                item={dataLineages}
                itemLoader={loadDataLineages.bind(null, table.id)}
            >
                <DataTableViewLineage
                    dataLineageLoader={loadDataLineages}
                    table={table}
                    dataLineages={dataLineages}
                />
            </Loader>
        );
    }

    @bind
    public updateDataTableDescription(tableId: number, description) {
        this.props.updateDataTable(tableId, { description });
    }

    @bind
    public updateDataTableGolden(golden: boolean) {
        this.props.updateDataTable(this.props.tableId, { golden });
    }

    @bind
    public makeQueryDOM() {
        const {
            table,
            dataJobMetadataById,
            dataLineages,
            loadDataJobMetadata,
            loadDataLineages,
        } = this.props;

        return (
            <Loader
                item={dataLineages.parentLineage[table.id]}
                itemLoader={loadDataLineages.bind(null, table.id)}
                itemKey={table.id}
            >
                <DataTableViewSourceQuery
                    table={table}
                    dataJobMetadataById={dataJobMetadataById}
                    dataLineages={dataLineages}
                    loadDataJobMetadata={loadDataJobMetadata}
                />
            </Loader>
        );
    }

    @bind
    public makeExampleDOM() {
        const { tableId } = this.props;

        return <DataTableViewQueryExamples tableId={tableId} />;
    }

    public render() {
        const { table, tableId, getTable } = this.props;

        return (
            <Loader
                item={table}
                itemKey={tableId}
                itemLoader={getTable.bind(null, tableId)}
                errorRenderer={(error) => (
                    <ErrorPage>{formatError(error)}</ErrorPage>
                )}
            >
                {this.renderTableView()}
            </Loader>
        );
    }

    public renderTableView() {
        const { selectedTabKey } = this.state;
        const { tableName, table, userInfo } = this.props;

        if (!table) {
            return;
        }

        const rendererByTab = {
            overview: this.makeOverviewDOM,
            columns: this.makeColumnsDOM,
            row_samples: this.makeSamplesDOM,
            lineage: this.makeLineageDOM,
            source_query: this.makeQueryDOM,
            query_examples: this.makeExampleDOM,
        };

        const contentDOM =
            selectedTabKey in rendererByTab ? (
                rendererByTab[selectedTabKey]()
            ) : (
                <FourOhFour />
            );

        return (
            <div className={'DataTableView with-background '}>
                <DataTableHeader
                    table={table}
                    tableName={tableName}
                    userInfo={userInfo}
                    updateDataTableGolden={this.updateDataTableGolden}
                />
                <Tabs
                    items={tabDefinitions}
                    selectedTabKey={selectedTabKey}
                    onSelect={this.onTabSelected}
                    className="DataTableView-tabs"
                />
                <div className="DataTableView-content">
                    <Container>{contentDOM}</Container>
                </div>
            </div>
        );
    }
}

function mapStateToProps(state: IStoreState, ownProps) {
    const {
        dataJobMetadataById,
        dataTablesById,
        dataLineages,
        dataSchemasById,
    } = state.dataSources;

    const { tableId } = ownProps;

    const { table, schema, tableName, tableColumns } = fullTableSelector(
        state,
        tableId
    );

    return {
        table,
        schema,
        tableName,
        tableColumns,

        dataLineages,
        dataTablesById,
        dataJobMetadataById,
        dataSchemasById,

        userInfo: state.user.myUserInfo,
    };
}

function mapDispatchToProps(dispatch: Dispatch, ownProps) {
    return {
        getTable: (tableId) => {
            return dispatch(dataSourcesActions.fetchDataTableIfNeeded(tableId));
        },

        loadDataJobMetadata: (dataJobMetadataId) => {
            dispatch(
                dataSourcesActions.fetchDataJobMetadataIfNeeded(
                    dataJobMetadataId
                )
            );
        },

        updateDataTable: (tableId, params) => {
            return dispatch(
                dataSourcesActions.updateDataTable(tableId, params)
            );
        },

        updateDataColumnDescription: (columnId, description) => {
            return dispatch(
                dataSourcesActions.updateDataColumnDescription(
                    columnId,
                    description
                )
            );
        },
        loadDataLineages: (tableId) =>
            dispatch(dataSourcesActions.fetchDataLineage(tableId)),
    };
}

export const DataTableView = withRouter(
    connect(mapStateToProps, mapDispatchToProps)(DataTableViewComponent)
);
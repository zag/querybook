import React from 'react';
import * as DraftJs from 'draft-js';

import ds from 'lib/datasource';
import { transformData } from 'lib/chart/chart-data-transformation';
import { getDataTransformationOptions } from 'lib/chart/chart-meta-processing';
import { useChartSource } from 'hooks/chart/useChartSource';

import { IDataChartCellMeta } from 'const/datadoc';

import { StatementExecutionPicker } from 'components/ExecutionPicker/StatementExecutionPicker';
import { StatementResultTable } from 'components/DataDocStatementExecution/StatementResultTable';
import { QueryExecutionPicker } from 'components/ExecutionPicker/QueryExecutionPicker';

import { Button } from 'ui/Button/Button';
import { ErrorBoundary } from 'ui/ErrorBoundary/ErrorBoundary';
import { DataDocChart } from './DataDocChart';
import { DataDocChartComposer } from './DataDocChartComposer';
import { InfoButton } from 'ui/Button/InfoButton';
import { Modal } from 'ui/Modal/Modal';
import { Title } from 'ui/Title/Title';

interface IProps {
    context: string;
    meta: IDataChartCellMeta;
    isEditable: boolean;
    shouldFocus: boolean;
    previousQueryCellId: number;
    dataDocId?: number;

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
interface IState {
    queryExecutionId?: number;
    statementExecutionId?: number;
    showChartComposer: boolean;
}

export const DataDocChartCell: React.FunctionComponent<IProps> = ({
    context,
    meta,
    previousQueryCellId,
    dataDocId,

    onChange,
    isEditable,
}) => {
    const [cellId, setCellId] = React.useState(
        meta.data.source_type === 'cell_above'
            ? previousQueryCellId
            : meta.data.source_type === 'cell'
            ? meta.data.source_ids[0]
            : null
    );
    const [queryExecutionId, setQueryExecutionId] = React.useState(
        meta.data.source_type === 'execution'
            ? meta.data.source_ids[0]
            : undefined
    );
    const [statementExecutionId, setStatementExecutionId] = React.useState(
        null
    );
    const [showChartComposer, setShowChartComposer] = React.useState(false);

    const {
        statementResultData,
        queryExecutions,
        statementExecutions,
    } = useChartSource(
        cellId,
        queryExecutionId,
        statementExecutionId,
        setCellId,
        setQueryExecutionId,
        setStatementExecutionId
    );

    React.useEffect(() => {
        const sourceType = meta.data.source_type;
        if (
            sourceType === 'cell_above' &&
            previousQueryCellId != null &&
            cellId !== previousQueryCellId
        ) {
            setCellId(previousQueryCellId);
        } else if (sourceType === 'cell' && meta.data.source_ids[0] != null) {
            setCellId(meta.data.source_ids[0]);
        } else if (
            sourceType === 'execution' &&
            meta.data.source_ids[0] != null
        ) {
            ds.fetch(
                `/query_execution/${meta.data.source_ids[0]}/datadoc_cell_info/`
            ).then((resp) => {
                setCellId(resp.data.cell_id);
                setQueryExecutionId(meta.data.source_ids[0]);
            });
        }
    }, [meta.data, previousQueryCellId, queryExecutions]);

    React.useEffect(() => {
        const sourceType = meta.data.source_type;
        if (sourceType === 'cell_above' || sourceType === 'cell') {
            if (queryExecutionId !== queryExecutions[0]?.id) {
                setQueryExecutionId(queryExecutions[0]?.id);
            }
        }
    }, [queryExecutions]);

    const transformedChartData = React.useMemo(() => {
        const sourceType = meta.data.source_type;

        if (sourceType === 'custom') {
            return JSON.parse(context);
        } else {
            if (statementResultData != null) {
                const {
                    aggregate,
                    switch: isSwitch,
                    formatAggCol,
                    formatSeriesCol,
                    formatValueCols,
                    aggSeries,
                } = getDataTransformationOptions(meta);

                return transformData(
                    statementResultData,
                    aggregate,
                    isSwitch,
                    formatAggCol,
                    formatSeriesCol,
                    formatValueCols,
                    aggSeries
                );
            }
        }

        return null;
    }, [meta.data, statementResultData, previousQueryCellId]);

    const renderPickerDOM = () => {
        const sourceType = meta.data.source_type;

        if (sourceType === 'custom') {
            return null; // Custom data is sourced from internal context
        }

        const queryExecutionPicker = queryExecutions.length ? (
            <QueryExecutionPicker
                queryExecutionId={queryExecutionId}
                onSelection={setQueryExecutionId}
                queryExecutions={queryExecutions}
                autoSelect
            />
        ) : null;

        const statementExecutionPicker =
            queryExecutionId != null && statementExecutions.length ? (
                <StatementExecutionPicker
                    statementExecutionId={statementExecutionId}
                    onSelection={setStatementExecutionId}
                    statementExecutions={statementExecutions}
                    total={statementExecutions.length}
                    autoSelect
                />
            ) : null;

        return (
            <div className="ChartCell-picker">
                <div>{queryExecutionPicker}</div>
                <div>{statementExecutionPicker}</div>
            </div>
        );
    };

    const renderChartDOM = () => {
        if (transformedChartData == null || transformedChartData.length === 0) {
            return (
                <div>
                    <Title subtitle size={1}>
                        No Data
                    </Title>
                </div>
            );
        }

        let visualizationDOM: React.ReactChild;
        if (meta.chart.type === 'table') {
            visualizationDOM = (
                <StatementResultTable
                    data={transformedChartData}
                    paginate={true}
                    maxNumberOfRowsToShow={20}
                />
            );
        } else {
            visualizationDOM = (
                <DataDocChart data={transformedChartData} meta={meta} />
            );
        }

        return <ErrorBoundary>{visualizationDOM}</ErrorBoundary>;
    };

    const chartComposerDOM = showChartComposer ? (
        <Modal
            onHide={() => setShowChartComposer(false)}
            title="Chart Configuration"
            type="fullscreen"
        >
            <DataDocChartComposer
                meta={meta}
                onUpdateChartConfig={(chartCellMeta: IDataChartCellMeta) => {
                    onChange({ meta: chartCellMeta });
                    setShowChartComposer(false);
                }}
                dataDocId={dataDocId}
                cellAboveId={previousQueryCellId}
                isEditable={isEditable}
            />
        </Modal>
    ) : null;

    return (
        <div className={'DataDocChartCell'}>
            <div className="horizontal-space-between">
                <div>{renderPickerDOM()}</div>
                <div className="flex-row">
                    <Button
                        title="Config Chart"
                        onClick={() => setShowChartComposer(true)}
                        borderless
                        small
                        type="inlineText"
                    />
                    <InfoButton>
                        Chart data comes from the last query cell above.
                        Configure chart to select desired format.
                    </InfoButton>
                </div>
            </div>
            <div>{renderChartDOM()}</div>
            {chartComposerDOM}
        </div>
    );
};
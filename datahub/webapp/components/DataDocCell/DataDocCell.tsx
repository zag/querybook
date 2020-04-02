import React, { useEffect } from 'react';

import { useSelector, useDispatch } from 'react-redux';
import { IStoreState, Dispatch } from 'redux/store/types';
import { IDataCell, IDataDoc } from 'const/datadoc';

import * as dataDocSelectors from 'redux/dataDoc/selector';
import * as dataDocActions from 'redux/dataDoc/action';

import { DataDocCellWrapper } from 'components/DataDocCellWrapper/DataDocCellWrapper';
import { DataDocCellControl } from 'components/DataDoc/DataDocCellControl';
import { DataDocQueryCell } from 'components/DataDocQueryCell/DataDocQueryCell';
import { DataDocChartCell } from 'components/DataDocChartCell/DataDocChartCell';
import { DataDocTextCell } from 'components/DataDocTextCell/DataDocTextCell';
import { UserAvatar } from 'components/UserBadge/UserAvatar';
import { sendNotification, sendConfirm } from 'lib/dataHubUI';
import { ContentState } from 'draft-js';

import './DataDocCell.scss';

interface IDataDocCellProps {
    dataDoc: IDataDoc;

    cell: IDataCell;
    index: number;
    lastQueryCellId: number;
    queryIndexInDoc: number;
    isEditable: boolean;
    focusedCellIndex: number;
    insertCellAt: (
        index: number,
        cellKey: string,
        context: string,
        meta: {}
    ) => any;
    cellFocusProps: {
        onUpKeyPressed: () => any;
        onDownKeyPressed: () => any;
        onFocus: () => any;
        onBlur: () => any;
    };
    defaultCollapse: boolean;
}

function getEstimatedCellHeight(cell: IDataCell) {
    if (Boolean(cell.meta['collapsed'])) {
        return 40;
    }

    // chart or query
    if (cell.cell_type !== 'text') {
        return 240;
    }
    return 80;
}

// renders cell
export const DataDocCell: React.FunctionComponent<IDataDocCellProps> = ({
    dataDoc,
    cell,
    index,
    lastQueryCellId,
    queryIndexInDoc,
    isEditable,
    focusedCellIndex,
    insertCellAt,
    cellFocusProps,
    defaultCollapse,
}) => {
    const { cellIdtoUid, arrowKeysEnabled } = useSelector(
        (state: IStoreState) => {
            return {
                cellIdtoUid: dataDocSelectors.dataDocCursorByCellIdSelector(
                    state,
                    {
                        docId: dataDoc.id,
                    }
                ),
                arrowKeysEnabled:
                    state.user.computedSettings.datadoc_arrow_key === 'enabled',
            };
        }
    );

    const dispatch: Dispatch = useDispatch();
    const [showCollapsed, setShowCollapsed] = React.useState(undefined);

    useEffect(() => {
        if (defaultCollapse != null) {
            setShowCollapsed(defaultCollapse);
        } else {
            setShowCollapsed(
                cell.cell_type === 'query'
                    ? Boolean(cell.meta.collapsed)
                    : undefined
            );
        }
    }, [defaultCollapse]);

    const uncollapseCell = () => setShowCollapsed(false);

    const updateCellAt = React.useCallback(
        async (fields: { context?: string | ContentState; meta?: {} }) => {
            try {
                await dispatch(
                    dataDocActions.updateDataDocCell(
                        dataDoc.id,
                        cell.id,
                        fields.context,
                        fields.meta
                    )
                );
            } catch (e) {
                sendNotification(`Cannot update cell, reason: ${e}`);
            }
        },
        [cell.id, dataDoc.id]
    );

    const handleDefaultCollapseChange = React.useCallback(
        () =>
            updateCellAt({
                meta: { ...cell.meta, collapsed: !cell.meta.collapsed },
            }),
        [cell]
    );

    const deleteCellAt = React.useCallback(() => {
        return new Promise((resolve) => {
            const dataDocCells = dataDoc.dataDocCells;
            const numberOfCells = (dataDocCells || []).length;
            const { context } = dataDocCells[index];

            if (numberOfCells > 0) {
                const deleteCell = async () => {
                    try {
                        await dataDocActions.deleteDataDocCell(
                            dataDoc.id,
                            index
                        );
                    } catch (e) {
                        sendNotification(`Delete cell failed, reason: ${e}`);
                    } finally {
                        resolve();
                    }
                };

                const plaintext =
                    typeof context === 'string'
                        ? context
                        : (context as ContentState).getPlainText();
                if (plaintext.length === 0) {
                    deleteCell();
                } else {
                    sendConfirm({
                        header: 'Are you sure?',
                        message: 'This cell will be removed.',
                        onConfirm: deleteCell,
                        onHide: resolve,
                    });
                }
            } else {
                resolve();
            }
        });
    }, [dataDoc]);

    const renderCell = () => {
        const onCellFocusOrBlur = {
            onFocus: cellFocusProps.onFocus,
            onBlur: cellFocusProps.onBlur,
        };
        const onCellKeyArrowKeyPressed = arrowKeysEnabled
            ? {
                  onUpKeyPressed: cellFocusProps.onUpKeyPressed,
                  onDownKeyPressed: cellFocusProps.onDownKeyPressed,
              }
            : {};

        // If we are printing, then print readonly cells
        const cellProps = {
            meta: cell.meta,
            isEditable,

            shouldFocus: focusedCellIndex === index,
            showCollapsed,

            onChange: updateCellAt,
            onDeleteKeyPressed: deleteCellAt,

            ...onCellFocusOrBlur,
            ...onCellKeyArrowKeyPressed,
        };

        let cellDOM = null;
        if (cell.cell_type === 'query') {
            const allProps = {
                ...cellProps,
                query: cell.context,
                docId: dataDoc.id,
                cellId: cell.id,
                queryIndexInDoc,
                templatedVariables: dataDoc.meta,
            };
            cellDOM = <DataDocQueryCell {...allProps} />;
        } else if (cell.cell_type === 'chart') {
            cellDOM = (
                <DataDocChartCell
                    {...cellProps}
                    previousQueryCellId={lastQueryCellId}
                    context={cell.context}
                    meta={cell.meta}
                    dataDocId={dataDoc.id}
                />
            );
        } else if (cell.cell_type === 'text') {
            // default text
            cellDOM = <DataDocTextCell {...cellProps} context={cell.context} />;
        }

        return cellDOM;
    };

    const renderCellControlDOM = (idx: number, isHeaderParam: boolean) => {
        return (
            <div className={'data-doc-cell-divider-container'}>
                <DataDocCellControl
                    index={idx}
                    numberOfCells={dataDoc.dataDocCells.length}
                    moveCellAt={dataDocActions.moveDataDocCell.bind(
                        null,
                        dataDoc.id
                    )}
                    insertCellAt={insertCellAt}
                    deleteCellAt={deleteCellAt}
                    isHeader={isHeaderParam}
                    isEditable={isEditable}
                    showCollapsed={showCollapsed}
                    setShowCollapsed={setShowCollapsed}
                    isCollapsedDefault={
                        Boolean(cell.meta.collapsed) === showCollapsed
                    }
                    toggleDefaultCollapsed={handleDefaultCollapseChange}
                />
            </div>
        );
    };

    const uids = cellIdtoUid[cell.id] || [];
    const uidDOM = uids.map((uid) => <UserAvatar key={uid} uid={uid} tiny />);
    const dataDocCellClassName = showCollapsed
        ? 'DataDocCell collapsed'
        : 'DataDocCell';

    const innerCellContentDOM = (
        <div className="data-doc-cell-container-pair">
            <div className="data-doc-cell-users flex-column">{uidDOM}</div>
            {renderCellControlDOM(index, true)}
            <div
                className={dataDocCellClassName}
                onClick={showCollapsed ? uncollapseCell : null}
            >
                {renderCell()}
            </div>
            {renderCellControlDOM(index + 1, false)}
        </div>
    );

    return (
        <DataDocCellWrapper
            cellKey={String(cell.id)}
            placeholderHeight={getEstimatedCellHeight(cell)}
            key={cell.id}
        >
            {innerCellContentDOM}
        </DataDocCellWrapper>
    );
};
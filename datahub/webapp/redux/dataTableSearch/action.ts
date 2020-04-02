import { getQueryString, replaceQueryString } from 'lib/utils/query-string';
import ds from 'lib/datasource';
import {
    ThunkResult,
    IDataTableSearchResultResetAction,
    IDataTableSearchResultClearAction,
    ITableSearchResult,
    IDataTableSearchState,
} from './types';

const BATCH_LOAD_SIZE = 100;

export function mapQueryParamToState(): ThunkResult<void> {
    return (dispatch) => {
        dispatch(resetSearchResult());
        const queryParam = getQueryString();
        dispatch({
            type: '@@dataTableSearch/DATA_TABLE_SEARCH_RECEIVE_QUERY_PARAM',
            payload: {
                queryParam,
            },
        });
        dispatch(searchDataTable());
    };
}

function mapStateToQueryParam(state) {
    const { searchFilters, searchString } = state;
    replaceQueryString({
        searchFilters,
        searchString,
    });
}

function mapStateToSearch(state: IDataTableSearchState) {
    const searchString = state.searchString;

    const filters = Object.entries(state.searchFilters).filter(
        ([filterKey, filterValue]) => filterValue != null
    );

    const matchSchemaName = searchString.match(/(\w+)\.\w*/);
    if (matchSchemaName) {
        filters.push(['schema', matchSchemaName[1]]);
    }

    const searchParam = {
        metastore_id: state.metastoreId,
        keywords: searchString,
        filters,
        limit: BATCH_LOAD_SIZE,
        concise: true,
    };
    return searchParam;
}

function resetSearchResult(): IDataTableSearchResultResetAction {
    return {
        type: '@@dataTableSearch/DATA_TABLE_SEARCH_RESULT_RESET',
    };
}

export function resetSearch(): IDataTableSearchResultClearAction {
    return {
        type: '@@dataTableSearch/DATA_TABLE_SEARCH_RESET',
    };
}

function searchDataTable(): ThunkResult<Promise<ITableSearchResult[]>> {
    return async (dispatch, getState) => {
        try {
            const state = getState().dataTableSearch;
            if (state.searchRequest) {
                state.searchRequest.cancel();
            }
            const searchRequest = ds.fetch(
                '/search/tables/',
                mapStateToSearch(state)
            );
            dispatch(resetSearchResult());
            dispatch({
                type: '@@dataTableSearch/DATA_TABLE_SEARCH_STARTED',
                payload: {
                    searchRequest,
                },
            });

            const { data: tables, count } = await searchRequest;

            dispatch({
                type: '@@dataTableSearch/DATA_TABLE_SEARCH_DONE',
                payload: {
                    results: tables,
                    count,
                },
            });

            return tables;
        } catch (error) {
            if (error instanceof Object && error.name === 'AbortError') {
                // guess it got canceled
            } else {
                dispatch({
                    type: '@@dataTableSearch/DATA_TABLE_SEARCH_FAILED',
                    payload: {
                        error,
                    },
                });
            }
        }

        return [];
    };
}

export function getMoreDataTable(): ThunkResult<Promise<ITableSearchResult[]>> {
    return async (dispatch, getState) => {
        const state = getState().dataTableSearch;
        const count = state.count;
        const resultsCount = state.results.length;
        if (resultsCount >= count) {
            return;
        }

        try {
            if (state.searchRequest) {
                state.searchRequest.cancel();
            }
            const searchParams = {
                ...mapStateToSearch(state),
                offset: resultsCount,
            };

            const searchRequest = ds.fetch('/search/tables/', searchParams);

            dispatch({
                type: '@@dataTableSearch/DATA_TABLE_SEARCH_STARTED',
                payload: {
                    searchRequest,
                },
            });

            const { data: tables } = await searchRequest;

            dispatch({
                type: '@@dataTableSearch/DATA_TABLE_SEARCH_MORE',
                payload: {
                    results: tables,
                },
            });

            return tables;
        } catch (error) {
            if (error instanceof Object && error.name === 'AbortError') {
                // guess it got canceled
            } else {
                dispatch({
                    type: '@@dataTableSearch/DATA_TABLE_SEARCH_FAILED',
                    payload: {
                        error,
                    },
                });
            }
        }

        return [];
    };
}

export function updateSearchString(searchString): ThunkResult<void> {
    return (dispatch, getState) => {
        dispatch({
            type: '@@dataTableSearch/DATA_TABLE_SEARCH_STRING_UPDATE',
            payload: {
                searchString,
            },
        });
        mapStateToQueryParam(getState().dataTableSearch);
        dispatch(searchDataTable());
    };
}

export function updateSearchFilter(filterKey, filterValue): ThunkResult<void> {
    return (dispatch, getState) => {
        dispatch({
            type: '@@dataTableSearch/DATA_TABLE_SEARCH_FILTER_UPDATE',
            payload: {
                filterKey,
                filterValue,
            },
        });
        mapStateToQueryParam(getState().dataTableSearch);
        dispatch(searchDataTable());
    };
}

export function selectMetastore(
    metastoreId: number
): ThunkResult<Promise<any>> {
    return (dispatch, getState) => {
        dispatch({
            type: '@@dataTableSearch/DATA_TABLE_SEARCH_SELECT_METASTORE',
            payload: {
                metastoreId,
            },
        });
        mapStateToQueryParam(getState().dataTableSearch);
        return dispatch(searchDataTable());
    };
}
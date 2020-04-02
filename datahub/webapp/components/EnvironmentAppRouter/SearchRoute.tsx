import React from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import { mapQueryParamToState as mapQueryParamToStateAction } from 'redux/search/action';
import history from 'lib/router-history';
import { useModalRoute } from 'hooks/useModalRoute';
import { SearchOverview } from 'components/Search/SearchOverview';
import { Modal } from 'ui/Modal/Modal';

export const SearchRoute: React.FunctionComponent<RouteComponentProps> = ({
    location,
}) => {
    const dispatch = useDispatch();
    const mapQueryParamToState = React.useCallback(
        () => dispatch(mapQueryParamToStateAction()),
        []
    );

    const isModal = useModalRoute(location);
    React.useLayoutEffect(() => {
        if (!isModal) {
            mapQueryParamToState();
        }
    }, []);

    const contentDOM = <SearchOverview />;

    return isModal ? (
        <Modal
            type="standard"
            onHide={history.goBack}
            className="SearchModal no-scroll"
            title={null}
        >
            {contentDOM}
        </Modal>
    ) : (
        contentDOM
    );
};
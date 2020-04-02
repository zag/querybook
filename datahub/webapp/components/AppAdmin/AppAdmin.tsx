import React from 'react';
import { useSelector } from 'react-redux';
import { Route, Switch, useParams } from 'react-router-dom';

import history from 'lib/router-history';
import { IStoreState } from 'redux/store/types';
import { AdminEntity, IAdminEntity } from './types';
import { IAdminEnvironment } from 'components/AppAdmin/AdminEnvironment';

import { AdminAnnouncement } from './AdminAnnouncement';
import { AdminQueryEngine, IAdminQueryEngine } from './AdminQueryEngine';
import { AdminMetastore, IAdminMetastore } from './AdminMetastore';
import { AdminUserRole } from './AdminUserRole';
import { AdminEnvironment } from './AdminEnvironment';
import { AdminApiAccessToken } from './AdminApiAccessToken';

import { AdminAppEntitySidebar } from 'components/AdminAppSidebar/AdminAppEntitySidebar';
import { AdminAppNavigator } from 'components/AdminAppSidebar/AdminAppNavigator';
import { JobStatus } from 'components/JobStatus/JobStatus';

import { FourOhThree } from 'ui/ErrorPage/FourOhThree';
import { Sidebar } from 'ui/Sidebar/Sidebar';

import './AppAdmin.scss';
import { Card } from 'ui/Card/Card';
import { Icon } from 'ui/Icon/Icon';
import { useDataFetch } from 'hooks/useDataFetch';

const ENTITY_SIDEBAR_WIDTH = 200;
const NAV_SIDEBAR_WIDTH = 200;

export const AppAdmin: React.FunctionComponent = () => {
    const { entity: selectedEntity }: { entity: AdminEntity } = useParams();

    const { data: environments, forceFetch: loadEnvironments } = useDataFetch<
        IAdminEnvironment[]
    >({
        url: '/admin/environment/',
    });
    const { data: metastores, forceFetch: loadMetastores } = useDataFetch<
        IAdminMetastore[]
    >({
        url: '/admin/query_metastore/',
    });
    const { data: queryEngines, forceFetch: loadQueryEngines } = useDataFetch<
        IAdminQueryEngine[]
    >({
        url: '/admin/query_engine/',
    });

    const isAdmin = useSelector(
        (state: IStoreState) => state.user.myUserInfo.isAdmin
    );

    const entityList = React.useMemo(() => {
        const entityData =
            selectedEntity === 'environment'
                ? (environments || []).map((env) => ({
                      id: env.id,
                      name: env.name,
                      deleted: env.deleted_at !== null,
                  }))
                : selectedEntity === 'metastore'
                ? (metastores || []).map((metastore) => ({
                      id: metastore.id,
                      name: metastore.name,
                      deleted: metastore.deleted_at !== null,
                      searchField: metastore.loader,
                  }))
                : selectedEntity === 'query_engine'
                ? (queryEngines || []).map((engine) => ({
                      id: engine.id,
                      name: engine.name,
                      deleted: engine.deleted_at !== null,
                      searchField: engine.language,
                  }))
                : null;
        return entityData;
    }, [selectedEntity, environments, metastores, queryEngines]);

    React.useEffect(() => {
        loadSelectedEntity();
    }, [selectedEntity]);

    const loadSelectedEntity = React.useCallback(
        async (entity = selectedEntity) => {
            switch (entity) {
                case 'environment': {
                    loadEnvironments();
                    break;
                }
                case 'metastore': {
                    loadMetastores();
                    break;
                }
                case 'query_engine': {
                    loadQueryEngines();
                    break;
                }
                default: {
                    return;
                }
            }
        },
        [selectedEntity]
    );

    const handleEntitySelect = React.useCallback((key: AdminEntity) => {
        history.push(`/admin/${key}/`);
    }, []);

    const hasNavigator = React.useMemo(
        () =>
            ['environment', 'metastore', 'query_engine'].includes(
                selectedEntity
            ),
        [selectedEntity]
    );

    const makeLandingPageDOM = () => {
        return (
            <div className="AdminLanding">
                <div className="AdminLanding-top">
                    <div className="AdminLanding-title">
                        Welcome to the DataHub Admin App
                    </div>
                    <div className="AdminLanding-desc">
                        All your settings are here.
                    </div>
                </div>
                <div className="AdminLanding-content">
                    <div className="AdminLanding-cards flex-row">
                        <Card
                            title={<Icon name="box" />}
                            children="create a new environment"
                            onClick={() =>
                                history.push('/admin/environment/new/')
                            }
                            height="160px"
                            width="240px"
                        />
                        <Card
                            title={<Icon name="database" />}
                            children="create a new metastore"
                            onClick={() =>
                                history.push('/admin/metastore/new/')
                            }
                            height="160px"
                            width="240px"
                        />
                        <Card
                            title={<Icon name="server" />}
                            children="create a new query engine"
                            onClick={() =>
                                history.push('/admin/query_engine/new/')
                            }
                            height="160px"
                            width="240px"
                        />
                        <Card
                            title={<Icon name="users" />}
                            children="create a new user role"
                            onClick={() =>
                                history.push('/admin/user_role/?new=true/')
                            }
                            height="160px"
                            width="240px"
                        />
                        <Card
                            title={<Icon name="clipboard" />}
                            children="create a new announcement"
                            onClick={() =>
                                history.push('/admin/announcement/?new=true/')
                            }
                            height="160px"
                            width="240px"
                        />
                    </div>
                </div>
            </div>
        );
    };

    return isAdmin ? (
        <div className="AppAdmin">
            <Sidebar
                className="AdminAppSidebar"
                initialWidth={ENTITY_SIDEBAR_WIDTH}
                minWidth={ENTITY_SIDEBAR_WIDTH}
            >
                <AdminAppEntitySidebar
                    selectedEntity={selectedEntity}
                    onSelectEntity={handleEntitySelect}
                />
            </Sidebar>
            {hasNavigator ? (
                <Sidebar
                    className="AdminAppSidebar"
                    initialWidth={NAV_SIDEBAR_WIDTH}
                    minWidth={NAV_SIDEBAR_WIDTH}
                >
                    <AdminAppNavigator
                        selectedEntity={selectedEntity}
                        entityList={entityList}
                        placeholder={
                            selectedEntity === 'metastore'
                                ? 'Filter by name and loader'
                                : selectedEntity === 'query_engine'
                                ? 'Filter by name and language'
                                : 'Filter by name'
                        }
                    />
                </Sidebar>
            ) : null}
            <div className="AppAdmin-content">
                <Switch>
                    <Route exact path="/admin/" render={makeLandingPageDOM} />
                    <Route
                        path="/admin/environment/:id?"
                        render={() => (
                            <AdminEnvironment
                                environments={environments}
                                queryEngines={queryEngines}
                                loadEnvironments={loadEnvironments}
                                loadQueryEngines={loadQueryEngines}
                            />
                        )}
                    />
                    <Route
                        path="/admin/metastore/:id?"
                        render={() => (
                            <AdminMetastore
                                metastores={metastores}
                                loadMetastores={loadMetastores}
                            />
                        )}
                    />
                    <Route
                        path="/admin/query_engine/:id?"
                        render={() => (
                            <AdminQueryEngine
                                queryEngines={queryEngines}
                                environments={environments}
                                metastores={metastores}
                                loadQueryEngines={loadQueryEngines}
                                loadEnvironments={loadEnvironments}
                                loadMetastores={loadMetastores}
                            />
                        )}
                    />
                    <Route
                        path="/admin/job_status/"
                        render={() => (
                            <div className="AdminJobStatus">
                                <div className="AdminLanding-top">
                                    <div className="AdminLanding-title">
                                        Job Status
                                    </div>
                                    <div className="AdminLanding-desc">
                                        Update job schedule at a metastore
                                        setting or in a data doc.
                                    </div>
                                </div>
                                <JobStatus />
                            </div>
                        )}
                    />
                    <Route path="/admin/user_role/" component={AdminUserRole} />
                    <Route
                        path="/admin/api_access_token/"
                        component={AdminApiAccessToken}
                    />
                    <Route
                        path="/admin/announcement/"
                        component={AdminAnnouncement}
                    />
                    <Route component={FourOhThree} />
                </Switch>
            </div>
        </div>
    ) : (
        <FourOhThree />
    );
};
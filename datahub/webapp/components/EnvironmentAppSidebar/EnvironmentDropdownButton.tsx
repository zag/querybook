import React from 'react';
import classNames from 'classnames';
import { useSelector } from 'react-redux';

import { TooltipDirection } from 'const/tooltip';
import history from 'lib/router-history';
import {
    environmentsSelector,
    currentEnvironmentSelector,
    userEnvironmentNamesSelector,
} from 'redux/environment/selector';
import { DropdownMenu } from 'ui/DropdownMenu/DropdownMenu';

import './EnvironmentDropdownButton.scss';

export const EnvironmentDropdownButton: React.FunctionComponent<{
    skip?: number;
}> = ({ skip = 0 }) => {
    const environments = useSelector(environmentsSelector);
    const currentEnvironment = useSelector(currentEnvironmentSelector);
    const userEnvironmentNames = useSelector(userEnvironmentNamesSelector);

    const environmentsToShow = environments.slice(skip);
    if (!environmentsToShow.length) {
        return null;
    }

    const environmentItems = environmentsToShow.map((environment) => {
        const accessible = userEnvironmentNames.has(environment.name);

        return {
            name: (
                <span
                    className={classNames({
                        'environment-name': true,
                        'environment-disabled': !accessible,
                    })}
                >
                    {environment.name}
                </span>
            ),
            onClick: accessible
                ? () => history.push(`/${environment.name}/`)
                : null,
            checked: environment === currentEnvironment,
            tooltip: environment.description,
            tooltipPos: 'right' as TooltipDirection,
        };
    });

    return (
        <DropdownMenu
            className="EnvironmentDropdownButton"
            items={environmentItems}
            type="select"
        />
    );
};
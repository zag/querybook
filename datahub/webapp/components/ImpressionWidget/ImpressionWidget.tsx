import React, { useState, useRef, useCallback } from 'react';
import { ImpressionType } from 'const/impression';
import { useDataFetch } from 'hooks/useDataFetch';
import { Icon } from 'ui/Icon/Icon';

import './ImpressionWidget.scss';
import { Popover, PopoverLayout } from 'ui/Popover/Popover';
import { ImpressionWidgetMenu } from './ImpressionWidgetMenu';

interface IProps {
    type: ImpressionType;
    itemId: number;
    popoverLayout?: PopoverLayout;
}

export const ImpressionWidget: React.FunctionComponent<IProps> = ({
    type,
    itemId,
    popoverLayout = ['left', 'top'],
}) => {
    const selfRef = useRef<HTMLSpanElement>(null);
    const [showMenu, setShowMenu] = useState(false);

    const { data: totalViews, isLoading } = useDataFetch({
        url: `/impression/${type}/${itemId}/count/`,
    });

    const onHidePopover = useCallback(() => setShowMenu(false), []);
    const widgetMenu = showMenu && (
        <Popover
            onHide={onHidePopover}
            anchor={selfRef.current}
            layout={popoverLayout}
        >
            <ImpressionWidgetMenu type={type} itemId={itemId} />
        </Popover>
    );

    const icon = <Icon name={isLoading ? 'loader' : 'eye'} size={14} />;
    return (
        <>
            <span
                className="ImpressionWidget"
                onClick={() => setShowMenu(true)}
                ref={selfRef}
            >
                {icon} &nbsp;
                {isLoading ? ' ' : totalViews}
            </span>
            {widgetMenu}
        </>
    );
};
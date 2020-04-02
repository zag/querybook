import React from 'react';
import * as ReactDOM from 'react-dom';
import { useSpring, animated } from 'react-spring';

import './Popover.scss';

const popoverRoot = document.getElementById('popover-root');

export type PopoverDirection = 'left' | 'right' | 'top' | 'bottom';
export type PopoverLayout =
    | [PopoverDirection, PopoverDirection]
    | [PopoverDirection];

export interface IPopoverProps {
    // View
    anchor?: HTMLElement; // If anchor is supplied, anchorBox will be auto calculated
    anchorBox?: ClientRect; // If anchorBox is supplied, we will ignore anchor

    layout?: PopoverLayout;
    // Controller
    onHide: () => any;

    hideArrow?: boolean;
    resizeOnChange?: boolean;
}

interface IPopoverContainerProps extends IPopoverProps {
    container: HTMLDivElement;
}

function middle(position: number, length: number) {
    return position + length / 2;
}

const ARROW_SIZE = 10;

export const Popover: React.FunctionComponent<IPopoverProps> = (props) => {
    const [el] = React.useState(document.createElement('div'));

    React.useEffect(() => {
        popoverRoot.appendChild(el);
        return () => popoverRoot.removeChild(el);
    }, []);

    const dom = <PopoverContainer {...props} container={el} />;
    return ReactDOM.createPortal(dom, el);
};

const initialArrowStyle: React.CSSProperties = {
    top: 0,
    left: 0,
};
const initialWrapperStyle: React.CSSProperties = {
    top: 0,
    left: 0,
};

export const PopoverContainer: React.FunctionComponent<IPopoverContainerProps> = ({
    layout = ['right', 'right'],
    resizeOnChange,
    onHide,
    container,
    anchorBox,
    anchor,
    hideArrow,

    children,
}) => {
    const [mainLayout, subLayout] = layout;
    const wrapperElement = React.useRef<HTMLDivElement>(null);

    // Behavior related to clicking outside
    const onDocumentClick = React.useCallback(
        (event) => {
            if (!event.composedPath().includes(container)) {
                // Here we pass the event so the parent can manage focus.
                // We only dismiss the last child
                if (container === popoverRoot.lastElementChild) {
                    onHide();
                }
            }
        },
        [onHide, container, wrapperElement.current]
    );
    React.useEffect(() => {
        document.addEventListener('mousedown', onDocumentClick);
        return () => document.removeEventListener('mousedown', onDocumentClick);
    }, [onDocumentClick]);

    // Behaivor related to resizing event
    const [resizeVersion, setVersion] = React.useState(0);
    React.useEffect(() => {
        let mutationObserver: MutationObserver;
        let innerVersion = resizeVersion;
        if (resizeOnChange) {
            mutationObserver = new MutationObserver(() =>
                setVersion(innerVersion++)
            );
            mutationObserver.observe(wrapperElement.current, {
                attributes: true,
                childList: true,
                subtree: true,
            });
        }
        return () => {
            if (mutationObserver) {
                mutationObserver.disconnect();
            }
        };
    }, [wrapperElement.current]);

    // Popover position calculation code
    const [wrapperStyle, setWrapperStyle] = React.useState(initialWrapperStyle);
    const [arrowStyle, setArrowStyle] = React.useState(initialArrowStyle);
    React.useEffect(() => {
        const newArrowStyle = { ...initialArrowStyle };
        const newWrapperStyle = { ...initialWrapperStyle };

        const box = anchorBox
            ? anchorBox
            : anchor
            ? anchor.getBoundingClientRect()
            : null;
        if (!box) {
            return;
        }

        const contentBox = wrapperElement.current.getBoundingClientRect();

        let arrowRotation = 0;
        const arrowSize = hideArrow ? 0 : ARROW_SIZE;

        if (mainLayout === 'top') {
            newWrapperStyle.top = box.top - contentBox.height - arrowSize;

            arrowRotation = 180;
            newArrowStyle.top = contentBox.height;

            if (subLayout === 'left') {
                newWrapperStyle.left = box.left;
                newArrowStyle.left = middle(0, box.width) - ARROW_SIZE;
            } else if (subLayout === 'right') {
                newWrapperStyle.left = box.left + box.width - contentBox.width;
                newArrowStyle.left = contentBox.width - 3 * ARROW_SIZE;
            } else {
                newWrapperStyle.left =
                    middle(box.left, box.width) - middle(0, contentBox.width);
                newArrowStyle.left = middle(0, contentBox.width) - ARROW_SIZE;
            }
        } else if (mainLayout === 'bottom') {
            newWrapperStyle.top = box.bottom + arrowSize;
            newWrapperStyle.left =
                middle(box.left, box.width) - middle(0, contentBox.width);

            newArrowStyle.top = -(2 * ARROW_SIZE);

            if (subLayout === 'left') {
                newWrapperStyle.left = box.left;
                newArrowStyle.left = ARROW_SIZE;
            } else if (subLayout === 'right') {
                newWrapperStyle.left = box.left + box.width - contentBox.width;
                newArrowStyle.left = contentBox.width - 3 * ARROW_SIZE;
            } else {
                newWrapperStyle.left =
                    middle(box.left, box.width) - middle(0, contentBox.width);
                newArrowStyle.left = middle(0, contentBox.width) - ARROW_SIZE;
            }
        } else if (mainLayout === 'left') {
            newWrapperStyle.left = box.left - contentBox.width - arrowSize;
            newArrowStyle.left = contentBox.width - 4;
            arrowRotation = 90;

            if (subLayout === 'top') {
                newWrapperStyle.top = box.top;
                newArrowStyle.top = middle(0, box.height) - ARROW_SIZE;
            } else if (subLayout === 'bottom') {
                newWrapperStyle.top = box.top + box.height - contentBox.height;
                newArrowStyle.top =
                    contentBox.height - middle(0, box.height) - ARROW_SIZE;
            } else {
                newWrapperStyle.top =
                    middle(box.top, box.height) - middle(0, contentBox.height);
                newArrowStyle.top = middle(0, contentBox.height) - ARROW_SIZE;
            }
        } else if (mainLayout === 'right') {
            newWrapperStyle.left = box.left + box.width + arrowSize;
            newArrowStyle.left = -25;
            arrowRotation = 270;

            if (subLayout === 'top') {
                newWrapperStyle.top = box.top;
                newArrowStyle.top = middle(0, box.height) - ARROW_SIZE;
            } else if (subLayout === 'bottom') {
                newWrapperStyle.top = box.top + box.height - contentBox.height;
                newArrowStyle.top =
                    contentBox.height - middle(0, box.height) - ARROW_SIZE;
            } else {
                newWrapperStyle.top =
                    middle(box.top, box.height) - middle(0, contentBox.height);
                newArrowStyle.top = middle(0, contentBox.height) - ARROW_SIZE;
            }
        }

        newArrowStyle.transform = `rotate(${arrowRotation}deg)`;

        setArrowStyle(newArrowStyle);
        setWrapperStyle(newWrapperStyle);
    }, [
        layout,
        anchorBox,
        anchor,
        hideArrow,
        wrapperElement.current,
        resizeVersion,
    ]);

    // Animation Spring
    const wrapperAnimationProps = useSpring({
        from: {
            opacity: 0.75,
            transform: `translate(${
                mainLayout === 'left'
                    ? '-10px'
                    : mainLayout === 'right'
                    ? '10px'
                    : '0'
            },${
                mainLayout === 'top'
                    ? '-10px'
                    : mainLayout === 'bottom'
                    ? '10px'
                    : '0'
            })`,
        },
        to: { opacity: 1, transform: `translate(0,0)` },
    });

    const arrowDOM = hideArrow ? null : (
        <div className="arrow" style={arrowStyle} />
    );

    return (
        <div className={'Popover '}>
            <animated.div
                className={'popover-wrapper'}
                style={{ ...wrapperStyle, ...wrapperAnimationProps }}
                ref={wrapperElement}
            >
                {arrowDOM}
                <div className={'popover-content'}>{children}</div>
            </animated.div>
        </div>
    );
};
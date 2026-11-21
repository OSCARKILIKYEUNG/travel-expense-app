/**
 * Placement for the Ledger expense action menu.
 *
 * The menu is `position: fixed` and portaled to `document.body`. Trigger
 * rectangles and the returned coordinates are layout-viewport pixels. The
 * visible window is `visualViewport` width and height, offset from the layout
 * origin by `offsetLeft` and `offsetTop` (MDN's fixed-position example applies
 * those offsets from that origin:
 * https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport ).
 * Pass the raw trigger rectangle through unchanged.
 */

export const EXPENSE_MENU_GAP = 4;
export const EXPENSE_MENU_MARGIN = 8;
/** Tailwind `w-32` at the default 16px root. Used when the menu is not laid out yet. */
export const EXPENSE_MENU_FALLBACK_WIDTH = 128;
/** Two `min-h-11` rows (44px each). */
export const EXPENSE_MENU_FALLBACK_HEIGHT = 88;

function roundPx(value) {
  return Math.round(value);
}

/**
 * @param {object} input
 * @param {{top:number,right:number,bottom:number,left:number,width:number,height:number}} input.trigger
 * @param {{width:number,height:number}} input.menu Natural menu size, before max-height.
 * @param {{width:number,height:number,offsetLeft?:number,offsetTop?:number}} input.viewport
 *        Visible window in layout-viewport space. `offsetLeft` / `offsetTop`
 *        are the visual viewport's distance from the layout origin. Do not
 *        pre-shift `trigger` by those offsets.
 * @param {number} [input.gap]
 * @param {number} [input.margin]
 * @returns {{
 *   top: number,
 *   left: number,
 *   width: number,
 *   maxHeight: number,
 *   placement: 'above' | 'below',
 *   triggerVisible: boolean,
 *   measurable: boolean,
 * }}
 */
export function placeExpenseActionMenu({
  trigger,
  menu,
  viewport,
  gap = EXPENSE_MENU_GAP,
  margin = EXPENSE_MENU_MARGIN,
}) {
  const menuWidth = Math.max(0, menu.width);
  const menuHeight = Math.max(0, menu.height);
  const measurable = trigger.width > 0 && trigger.height > 0;
  if (!measurable) {
    return {
      top: 0,
      left: 0,
      width: roundPx(menuWidth),
      maxHeight: roundPx(menuHeight),
      placement: 'below',
      triggerVisible: true,
      measurable: false,
    };
  }

  const viewLeft = viewport.offsetLeft || 0;
  const viewTop = viewport.offsetTop || 0;
  const viewRight = viewLeft + viewport.width;
  const viewBottom = viewTop + viewport.height;
  const triggerVisible = trigger.left < viewRight
    && trigger.right > viewLeft
    && trigger.top < viewBottom
    && trigger.bottom > viewTop;

  const spaceBelow = viewBottom - margin - trigger.bottom - gap;
  const spaceAbove = trigger.top - gap - (viewTop + margin);
  const placement = spaceBelow >= menuHeight || spaceBelow >= spaceAbove ? 'below' : 'above';
  const available = Math.max(0, placement === 'below' ? spaceBelow : spaceAbove);
  const usedHeight = Math.min(menuHeight, available);
  const width = Math.min(menuWidth, Math.max(0, viewport.width - margin * 2));

  let left = trigger.right - width;
  const minLeft = viewLeft + margin;
  const maxLeft = Math.max(minLeft, viewRight - margin - width);
  left = Math.min(Math.max(left, minLeft), maxLeft);

  let top = placement === 'below' ? trigger.bottom + gap : trigger.top - gap - usedHeight;
  const minTop = viewTop + margin;
  const maxTop = Math.max(minTop, viewBottom - margin - usedHeight);
  top = Math.min(Math.max(top, minTop), maxTop);

  return {
    top: roundPx(top),
    left: roundPx(left),
    width: roundPx(width),
    maxHeight: roundPx(available),
    placement,
    triggerVisible,
    measurable: true,
  };
}

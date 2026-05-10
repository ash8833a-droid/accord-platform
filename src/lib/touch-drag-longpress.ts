/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Long-press-to-drag polyfill for HTML5 drag events on touch devices.
 *
 * Adapted from `drag-drop-touch` (MIT, B. Lauret) but rewritten so that:
 *   • Touch scrolling is NEVER blocked at touchstart — native vertical scroll
 *     keeps working as expected.
 *   • Drag is only initiated after a sustained long-press (≥ HOLD_MS) on a
 *     [draggable] element. If the finger moves more than HOLD_MARGIN_PX
 *     before the timer fires, the gesture is treated as a scroll and drag
 *     is cancelled.
 *   • Once drag is engaged, native scrolling is suppressed until touchend.
 *
 * Result: members can scroll the task lists freely; tasks only reorder when
 * the user explicitly long-presses a card and then drags it.
 */

const HOLD_MS = 450;
const HOLD_MARGIN_PX = 10; // finger jitter tolerance during the hold
const DRAG_OPACITY = 0.6;
const RMV_ATTS = ["id", "class", "style", "draggable"];
const KBD_PROPS = ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const;
const PT_PROPS = [
  "pageX", "pageY", "clientX", "clientY", "screenX", "screenY",
] as const;

type Pt = { x: number; y: number };

class LongPressDrag {
  private _dragSource: HTMLElement | null = null;
  private _holdTimer: ReturnType<typeof setTimeout> | null = null;
  private _isDragEnabled = false;
  private _ptDown: Pt | null = null;
  private _lastTouch: TouchEvent | null = null;
  private _img: HTMLElement | null = null;
  private _imgOffset: Pt = { x: 0, y: 0 };
  private _lastTarget: Element | null = null;
  private _isDropZone = false;
  private _dataTransfer: DataTransfer = new DataTransfer();

  constructor() {
    if (typeof document === "undefined" || !("ontouchstart" in document)) return;
    const opts: AddEventListenerOptions = { passive: false, capture: false };
    // touchstart must NOT be passive so we can preventDefault later (after long-press)
    document.addEventListener("touchstart", this._onTouchStart, opts);
    document.addEventListener("touchmove", this._onTouchMove, opts);
    document.addEventListener("touchend", this._onTouchEnd);
    document.addEventListener("touchcancel", this._onTouchEnd);
  }

  // -------- handlers --------
  private _onTouchStart = (e: TouchEvent) => {
    if (!this._shouldHandle(e)) return;
    this._reset();
    const src = this._closestDraggable(e.target as Element | null);
    if (!src) return;
    this._dragSource = src;
    this._ptDown = this._getPoint(e);
    this._lastTouch = e;
    // CRITICAL: do NOT preventDefault here — let the browser scroll natively.
    // Drag is only armed after the long-press timer fires.
    this._holdTimer = setTimeout(() => {
      if (this._dragSource !== src) return;
      this._isDragEnabled = true;
      // Haptic hint when supported
      try { (navigator as any).vibrate?.(15); } catch { /* ignore */ }
    }, HOLD_MS);
  };

  private _onTouchMove = (e: TouchEvent) => {
    if (!this._dragSource || !this._ptDown) return;

    // Long-press not yet triggered → if finger moved past margin, treat as scroll.
    if (!this._isDragEnabled) {
      if (this._delta(e) > HOLD_MARGIN_PX) this._reset();
      return; // never preventDefault here; browser keeps scrolling
    }

    // Drag armed — block native scroll and synthesize HTML5 drag events
    if (e.cancelable) e.preventDefault();
    const target = this._getTarget(e);
    if (!this._img) {
      this._dispatch(e, "dragstart", this._dragSource);
      this._createImage(e);
      this._dispatch(e, "dragenter", target);
    }
    this._lastTouch = e;
    if (target !== this._lastTarget) {
      this._dispatch(this._lastTouch, "dragleave", this._lastTarget);
      this._dispatch(e, "dragenter", target);
      this._lastTarget = target;
    }
    this._moveImage(e);
    this._isDropZone = this._dispatch(e, "dragover", target);
  };

  private _onTouchEnd = (e: TouchEvent) => {
    // If the user just tapped (no drag image), let the click pass through naturally.
    if (!this._img) { this._reset(); return; }
    this._destroyImage();
    if (this._dragSource) {
      if (e.type.indexOf("cancel") < 0 && this._isDropZone) {
        this._dispatch(this._lastTouch, "drop", this._lastTarget);
      }
      this._dispatch(this._lastTouch, "dragend", this._dragSource);
    }
    this._reset();
  };

  // -------- utils --------
  private _shouldHandle(e: TouchEvent) {
    return e && !e.defaultPrevented && e.touches && e.touches.length < 2;
  }

  private _reset() {
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._holdTimer = null;
    this._destroyImage();
    this._dragSource = null;
    this._lastTouch = null;
    this._lastTarget = null;
    this._ptDown = null;
    this._isDragEnabled = false;
    this._isDropZone = false;
    this._dataTransfer = new DataTransfer();
  }

  private _getPoint(e: TouchEvent | MouseEvent | Touch, page = false): Pt {
    const t: any = (e as TouchEvent).touches?.[0] ?? e;
    return { x: page ? t.pageX : t.clientX, y: page ? t.pageY : t.clientY };
  }

  private _delta(e: TouchEvent) {
    if (!this._ptDown) return 0;
    const p = this._getPoint(e);
    return Math.abs(p.x - this._ptDown.x) + Math.abs(p.y - this._ptDown.y);
  }

  private _getTarget(e: TouchEvent): Element | null {
    const pt = this._getPoint(e);
    let el = document.elementFromPoint(pt.x, pt.y);
    while (el && getComputedStyle(el).pointerEvents === "none") {
      el = el.parentElement;
    }
    return el;
  }

  private _closestDraggable(el: Element | null): HTMLElement | null {
    let cur: Element | null = el;
    while (cur) {
      if (cur instanceof HTMLElement && cur.hasAttribute("draggable") && cur.draggable) {
        return cur;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  private _createImage(e: TouchEvent) {
    if (this._img) this._destroyImage();
    const src = this._dragSource!;
    const clone = src.cloneNode(true) as HTMLElement;
    this._copyStyle(src, clone);
    clone.style.top = clone.style.left = "-9999px";
    const rc = src.getBoundingClientRect();
    const pt = this._getPoint(e);
    this._imgOffset = { x: pt.x - rc.left, y: pt.y - rc.top };
    clone.style.opacity = String(DRAG_OPACITY);
    this._img = clone;
    this._moveImage(e);
    document.body.appendChild(clone);
  }

  private _destroyImage() {
    if (this._img?.parentElement) this._img.parentElement.removeChild(this._img);
    this._img = null;
  }

  private _moveImage(e: TouchEvent) {
    requestAnimationFrame(() => {
      if (!this._img) return;
      const pt = this._getPoint(e, true);
      const s = this._img.style;
      s.position = "absolute";
      s.pointerEvents = "none";
      s.zIndex = "999999";
      s.left = Math.round(pt.x - this._imgOffset.x) + "px";
      s.top = Math.round(pt.y - this._imgOffset.y) + "px";
    });
  }

  private _copyStyle(src: HTMLElement, dst: HTMLElement) {
    RMV_ATTS.forEach((a) => dst.removeAttribute(a));
    if (src instanceof HTMLCanvasElement && dst instanceof HTMLCanvasElement) {
      dst.width = src.width;
      dst.height = src.height;
      dst.getContext("2d")?.drawImage(src, 0, 0);
    }
    const cs = getComputedStyle(src);
    for (let i = 0; i < cs.length; i++) {
      const key = cs[i];
      if (key.indexOf("transition") < 0) {
        (dst.style as any)[key] = (cs as any)[key];
      }
    }
    dst.style.pointerEvents = "none";
    for (let i = 0; i < src.children.length; i++) {
      this._copyStyle(src.children[i] as HTMLElement, dst.children[i] as HTMLElement);
    }
  }

  private _dispatch(e: TouchEvent | null, type: string, target: Element | null): boolean {
    if (!e || !target) return false;
    const evt: any = document.createEvent("Event");
    const t: any = e.touches?.[0] ?? e;
    evt.initEvent(type, true, true);
    evt.button = 0;
    evt.which = evt.buttons = 1;
    KBD_PROPS.forEach((p) => { evt[p] = (e as any)[p]; });
    PT_PROPS.forEach((p) => { evt[p] = t[p]; });
    evt.dataTransfer = this._dataTransfer;
    target.dispatchEvent(evt);
    return evt.defaultPrevented;
  }
}

let installed = false;
export function installLongPressDrag() {
  if (installed) return;
  installed = true;
  // eslint-disable-next-line no-new
  new LongPressDrag();
}
import { splitText, __spreadProps, __spreadValues } from './chunk-OI2DURYO.js';
import { forwardRef, useRef, useCallback, useState, useLayoutEffect, useEffect, isValidElement, cloneElement } from 'react';
import { jsx } from 'react/jsx-runtime';

function normalizeToPromise(result) {
  if (!result) return null;
  if (Array.isArray(result)) {
    const promises = result.map(
      (r) => "finished" in r ? r.finished : Promise.resolve(r)
    );
    return Promise.all(promises);
  }
  if (typeof result === "object" && "finished" in result) {
    return result.finished;
  }
  if (result instanceof Promise) {
    return result;
  }
  return null;
}
var SplitText = forwardRef(
  function SplitText2({
    children,
    onSplit,
    onResize,
    options,
    autoSplit = false,
    revertOnComplete = false,
    inView,
    onInView,
    onLeaveView
  }, forwardedRef) {
    const containerRef = useRef(null);
    const mergedRef = useCallback(
      (node) => {
        containerRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );
    const [childElement, setChildElement] = useState(null);
    const [isInView, setIsInView] = useState(false);
    const onSplitRef = useRef(onSplit);
    const onResizeRef = useRef(onResize);
    const optionsRef = useRef(options);
    const revertOnCompleteRef = useRef(revertOnComplete);
    const inViewRef = useRef(inView);
    const onInViewRef = useRef(onInView);
    const onLeaveViewRef = useRef(onLeaveView);
    useLayoutEffect(() => {
      onSplitRef.current = onSplit;
      onResizeRef.current = onResize;
      optionsRef.current = options;
      revertOnCompleteRef.current = revertOnComplete;
      inViewRef.current = inView;
      onInViewRef.current = onInView;
      onLeaveViewRef.current = onLeaveView;
    });
    const hasSplitRef = useRef(false);
    const hasRevertedRef = useRef(false);
    const revertFnRef = useRef(null);
    const splitResultRef = useRef(null);
    const observerRef = useRef(null);
    const hasTriggeredOnceRef = useRef(false);
    const childRefCallback = useCallback((node) => {
      setChildElement(node);
    }, []);
    useEffect(() => {
      if (!childElement) return;
      if (hasSplitRef.current) return;
      let isMounted = true;
      document.fonts.ready.then(() => {
        var _a, _b;
        if (!isMounted || hasSplitRef.current) return;
        if (!containerRef.current) return;
        const result = splitText(childElement, __spreadProps(__spreadValues({}, optionsRef.current), {
          autoSplit,
          onResize: (resizeResult) => {
            var _a2;
            const newSplitElements = {
              chars: resizeResult.chars,
              words: resizeResult.words,
              lines: resizeResult.lines,
              revert: result.revert
            };
            splitResultRef.current = newSplitElements;
            (_a2 = onResizeRef.current) == null ? void 0 : _a2.call(onResizeRef, newSplitElements);
          }
        }));
        revertFnRef.current = result.dispose;
        hasSplitRef.current = true;
        const splitElements = {
          chars: result.chars,
          words: result.words,
          lines: result.lines,
          revert: result.revert
        };
        splitResultRef.current = splitElements;
        containerRef.current.style.visibility = "visible";
        if (onSplitRef.current) {
          const callbackResult = onSplitRef.current(splitElements);
          if (!inViewRef.current && revertOnCompleteRef.current) {
            const promise = normalizeToPromise(callbackResult);
            if (promise) {
              promise.then(() => {
                if (!isMounted || hasRevertedRef.current) return;
                result.revert();
                hasRevertedRef.current = true;
              });
            } else if (callbackResult === void 0) ; else {
              console.warn(
                "SplitText: revertOnComplete is enabled but onSplit did not return an animation or promise."
              );
            }
          }
        }
        if (inViewRef.current && containerRef.current) {
          const inViewOptions = typeof inViewRef.current === "object" ? inViewRef.current : {};
          const threshold = (_a = inViewOptions.amount) != null ? _a : 0;
          const rootMargin = (_b = inViewOptions.margin) != null ? _b : "0px";
          observerRef.current = new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              if (!entry) return;
              const isOnce = typeof inViewRef.current === "object" && inViewRef.current.once;
              if (entry.isIntersecting) {
                if (isOnce && hasTriggeredOnceRef.current) return;
                hasTriggeredOnceRef.current = true;
                setIsInView(true);
              } else {
                if (!isOnce) {
                  setIsInView(false);
                }
              }
            },
            { threshold, rootMargin }
          );
          observerRef.current.observe(containerRef.current);
        }
      });
      return () => {
        isMounted = false;
        if (observerRef.current) {
          observerRef.current.disconnect();
          observerRef.current = null;
        }
        if (revertFnRef.current) {
          revertFnRef.current();
        }
      };
    }, [childElement, autoSplit]);
    useEffect(() => {
      if (!splitResultRef.current) return;
      if (hasRevertedRef.current) return;
      if (isInView && onInViewRef.current) {
        const callbackResult = onInViewRef.current(splitResultRef.current);
        const promise = normalizeToPromise(callbackResult);
        if (revertOnCompleteRef.current && promise) {
          promise.then(() => {
            var _a;
            if (hasRevertedRef.current) return;
            (_a = splitResultRef.current) == null ? void 0 : _a.revert();
            hasRevertedRef.current = true;
          });
        }
      } else if (!isInView && onLeaveViewRef.current && splitResultRef.current) {
        onLeaveViewRef.current(splitResultRef.current);
      }
    }, [isInView]);
    if (!isValidElement(children)) {
      console.error("SplitText: children must be a single valid React element");
      return null;
    }
    const clonedChild = cloneElement(children, {
      ref: childRefCallback
    });
    return /* @__PURE__ */ jsx(
      "div",
      {
        ref: mergedRef,
        style: { visibility: "hidden", position: "relative" },
        children: clonedChild
      }
    );
  }
);

export { SplitText };

import type { ComponentProps } from "react";
import type { SplitTextOptions as CoreSplitTextOptions } from "../../core/splitText";
import type { SplitText as ReactSplitText } from "../../react/SplitText";
import type { SplitText as MotionSplitText } from "../../motion/SplitText";

const motionLikeAnimation = {
  finished: Promise.resolve("done"),
};

const gsapLikeTween = {
  then: (
    onFulfilled?: ((result: { kill: () => void }) => unknown) | undefined
  ) => Promise.resolve(onFulfilled?.({ kill: () => {} })),
};

type CoreOnSplit = NonNullable<CoreSplitTextOptions["onSplit"]>;
type ReactProps = ComponentProps<typeof ReactSplitText>;
type MotionProps = ComponentProps<typeof MotionSplitText>;
type ReactOnSplit = NonNullable<ReactProps["onSplit"]>;
type ReactOnViewportEnter = NonNullable<ReactProps["onViewportEnter"]>;
type MotionOnSplit = NonNullable<MotionProps["onSplit"]>;
type MotionOnViewportEnter = NonNullable<MotionProps["onViewportEnter"]>;

const coreAcceptsThenable: CoreOnSplit = () => gsapLikeTween;
const coreAcceptsFinished: CoreOnSplit = () => motionLikeAnimation;
// @ts-expect-error Plain objects without then/finished are not valid animation results.
const coreRejectsPlainObject: CoreOnSplit = () => ({ foo: "bar" });

const reactAcceptsThenableOnSplit: ReactOnSplit = () => gsapLikeTween;
const reactAcceptsFinishedOnSplit: ReactOnSplit = () => motionLikeAnimation;
const reactAcceptsThenableViewport: ReactOnViewportEnter = () => gsapLikeTween;
// @ts-expect-error Plain objects without then/finished are not valid animation results.
const reactRejectsPlainObjectOnSplit: ReactOnSplit = () => ({ foo: "bar" });

const motionAcceptsThenableOnSplit: MotionOnSplit = () => gsapLikeTween;
const motionAcceptsFinishedOnSplit: MotionOnSplit = () => motionLikeAnimation;
const motionAcceptsThenableViewport: MotionOnViewportEnter = () => gsapLikeTween;
// @ts-expect-error Plain objects without then/finished are not valid animation results.
const motionRejectsPlainObjectOnSplit: MotionOnSplit = () => ({ foo: "bar" });

void coreAcceptsThenable;
void coreAcceptsFinished;
void coreRejectsPlainObject;
void reactAcceptsThenableOnSplit;
void reactAcceptsFinishedOnSplit;
void reactAcceptsThenableViewport;
void reactRejectsPlainObjectOnSplit;
void motionAcceptsThenableOnSplit;
void motionAcceptsFinishedOnSplit;
void motionAcceptsThenableViewport;
void motionRejectsPlainObjectOnSplit;

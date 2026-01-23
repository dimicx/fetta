"use client";

import { useEffect, useRef } from "react";
import { ItalianFlag } from "./icons/italian-flag";
import { motion, stagger, useAnimate } from "motion/react";
import { Volume } from "./icons/volume";

export function FettaDefinition() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [scope, animate] = useAnimate();

  // Preload audio on mount
  useEffect(() => {
    const audio = new Audio("/pronunciation_it_fetta.mp3");
    audio.preload = "auto";
    audioRef.current = audio;
  }, []);

  const playPronunciation = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();

    if (scope.current) {
      animate(
        ".vol-line",
        {
          scale: [1, 1.2, 1],
          x: ["0px", "1px", "0px"],
        },
        {
          times: [0, 0.35, 1],
          duration: 0.75,
          ease: [0.25, 0.46, 0.45, 0.94],
          delay: stagger(0.075),
        },
      );
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3">
        <span className="font-serif text-4xl italic">fetta</span>
        <div className="text-sm flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="h-4">
              <ItalianFlag />
            </span>
            <span>Noun · /&apos;fetːa/</span>
            <motion.button
              onClick={playPronunciation}
              className="size-6 flex items-center justify-center cursor-pointer group text-fd-muted-foreground hover:text-fd-foreground active:scale-95 transition-all duration-150 ease-out focus-visible:outline-none will-change-transform focus-visible:ring-2 focus-visible:ring-fd-ring bg-fd-secondary hover:bg-fd-accent active:bg-fd-accent rounded-md"
              whileTap="tap"
              ref={scope}
            >
              <span className="sr-only">Listen to the pronunciation</span>
              <span className="inline-block size-4">
                <Volume />
              </span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="my-5 border-t border-b border-fd-border py-4">
        <ol className="font-serif text-lg [&>li]:m-0 my-0! pl-4 marker:text-fd-foreground/60">
          <li>
            <div className="font-sans uppercase text-sm">(di cibo)</div>
            <div className="italic">slice , wedge , piece</div>
            <div className="text-fd-foreground/60">
              una <span className="text-fd-foreground">fetta</span> di salame (a
              slice of salami)
            </div>
          </li>
          <li className="pt-1">
            <div className="font-sans uppercase text-sm">(di territorio)</div>
            <div className="italic">piece , strip</div>
            <div className="text-fd-foreground/60">
              una <span className="text-fd-foreground">fetta</span> di terra (a
              strip of land)
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}

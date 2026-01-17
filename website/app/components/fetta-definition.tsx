"use client";

import { useRef } from "react";
import { ItalianFlag } from "./icons/italian-flag";
import { VolumeUp } from "./icons/volume-up";
import { motion, useAnimate } from "motion/react";

export function FettaDefinition() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [scope, animate] = useAnimate();

  const playPronunciation = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/pronunciation_it_fetta.mp3");
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play();

    if (scope.current) {
      const volume = scope.current.querySelector(".vol-line");
      if (volume) {
        animate(
          volume,
          {
            scale: [1, 1.25, 1],
            x: ["0px", "1.3px", "0px"],
          },
          {
            times: [0, 0.35, 1],
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94],
          },
        );
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3">
        <span className="font-serif font-medium text-4xl italic">fetta</span>
        <div className="text-sm font-medium flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="h-4">
              <ItalianFlag />
            </span>
            <span>
              <em>Noun</em> · <span>/&apos;fetːa/</span>
            </span>
            <motion.button
              onClick={playPronunciation}
              className="size-6 flex items-center justify-center cursor-pointer group -ml-1"
              whileTap="tap"
              ref={scope}
            >
              <span className="sr-only">Listen to the pronunciation</span>
              <span className="inline-block size-4 group-active:scale-95 transition-transform duration-150 ease-out">
                <VolumeUp />
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

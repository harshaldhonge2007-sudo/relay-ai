import { VIDEO_URL } from "../../constants";

/**
 * Optional demo video slot.
 * Hidden by default; rendered only when VIDEO_URL constant is defined.
 * Strict accessibility rules:
 * - No autoplay
 * - Captions track required
 * - Focus ring and keyboard operable
 */
export default function DemoVideo() {
  if (!VIDEO_URL) {
    return null;
  }

  return (
    <section
      id="demo-video"
      className="bg-surface-base py-16 border-t border-edge-default"
      aria-labelledby="video-heading"
    >
      <div className="max-w-5xl mx-auto px-4 lg:px-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-secondary mb-2">
          Walkthrough
        </p>
        <h2
          id="video-heading"
          className="font-display font-semibold text-ink-primary tracking-tight leading-[0.95] mb-6 text-2xl sm:text-3xl"
        >
          Product walkthrough
        </h2>
        <div className="rounded-card overflow-hidden border border-edge-strong bg-ink-primary shadow-float aspect-video flex items-center justify-center relative z-10">
          <video
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
            aria-label="RELAY autonomous offboarding walkthrough video"
          >
            <source src={VIDEO_URL} type="video/mp4" />
            <track
              kind="captions"
              src="/tour/captions.vtt"
              srcLang="en"
              label="English captions"
              default
            />
            Your browser does not support HTML5 video.
          </video>
        </div>
      </div>
    </section>
  );
}


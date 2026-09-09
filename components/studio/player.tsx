'use client';

import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { useRef, useState } from 'react';

export default function Player({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const format = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0')}`;

  return (
    <div className="audio-player">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onTimeUpdate={() => setTime(audio.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audio.current?.duration || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() =>
          setError('The song could not be played. Please reopen this creation.')
        }
      >
        <track
          kind="captions"
          src="data:text/vtt,WEBVTT%0A"
          srcLang="en"
          label="Lyrics are shown below the player"
        />
      </audio>
      <div className="player-controls">
        <button
          className="button secondary"
          aria-label="Back ten seconds"
          onClick={() => {
            if (audio.current) {
              audio.current.currentTime = Math.max(0, audio.current.currentTime - 10);
            }
          }}
        >
          <RotateCcw size={24} />
          <span>10s</span>
        </button>
        <button
          className="button play-button"
          onClick={() => {
            if (playing) audio.current?.pause();
            else
              audio.current
                ?.play()
                .catch(() => setError('Tap Play again to listen.'));
          }}
        >
          {playing ? <Pause /> : <Play />}
          {playing ? 'Pause' : 'Play song'}
        </button>
        <button
          className="button secondary"
          aria-label="Forward ten seconds"
          onClick={() => {
            if (audio.current && Number.isFinite(duration)) {
              audio.current.currentTime = Math.min(
                duration,
                audio.current.currentTime + 10,
              );
            }
          }}
        >
          <span>10s</span>
          <RotateCw size={24} />
        </button>
      </div>
      <div className="audio-timeline">
        <span>{format(time)}</span>
        <progress aria-label="Song progress" max={duration || 1} value={time} />
        <span>{format(duration)}</span>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

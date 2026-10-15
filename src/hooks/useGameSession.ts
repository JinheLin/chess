import { useEffect, useState } from 'react';
import { loadSession, saveSession } from '../storage/session';
import { MoveSound, moveSound } from '../audio/MoveSound';
export function useGameSession() {
  const [initial] = useState(() => loadSession());
  const [preferences, setPreferences] = useState(initial.preferences);
  const [notice, setNotice] = useState(initial.notice);
  const [saveFailed, setSaveFailed] = useState(false);
  const [audio] = useState(() => new MoveSound());
  const controller = initial.controller;
  useEffect(() => {
    let previous = controller.getSnapshot();
    const update = () => {
      setSaveFailed(!saveSession(controller, preferences));
      const current = controller.getSnapshot();
      const kind = moveSound(previous, current);
      if (preferences.sound && kind) audio.play(kind);
      previous = current;
    };
    update();
    const unsubscribe = controller.subscribe(update);
    return unsubscribe;
  }, [controller, preferences, audio]);
  useEffect(() => () => audio.dispose(), [audio]);
  return {controller, preferences, setPreferences, notice, dismissNotice: () => setNotice(''), saveFailed, unlockSound: () => { if (preferences.sound) audio.unlock(); }};
}

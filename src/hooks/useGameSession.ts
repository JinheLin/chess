import { useEffect, useState } from 'react';
import { loadSession, saveSession } from '../storage/session';
import { MoveSound, moveSound } from '../audio/MoveSound';
import { PLAY_USAGE_KEY } from '../storage/playUsage';
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
  useEffect(() => {
    const onStorage = (event: StorageEvent) => { if (event.key === PLAY_USAGE_KEY) controller.refreshPlayLimit(); };
    const refresh = () => controller.refreshPlayLimit();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [controller]);
  return {controller, preferences, setPreferences, notice, dismissNotice: () => setNotice(''), saveFailed, unlockSound: () => { if (preferences.sound) audio.unlock(); }};
}

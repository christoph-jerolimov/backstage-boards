import { useEffect, useMemo, useRef, useState } from 'react';
import { storageApiRef, useApi } from '@backstage/frontend-plugin-api';

const BUCKET = 'boards-item-drafts';

/** Keystrokes are collapsed before hitting the storage backend. */
const WRITE_DELAY_MS = 300;

/**
 * A text draft persisted per user through the storage (user settings)
 * API, so in-progress input survives closing the drawer and reloading
 * the browser. Writes are debounced; `clear` removes the stored draft
 * immediately (use it once the text was actually submitted).
 */
export function useDraft(
  key: string,
): [string, (value: string) => void, () => void] {
  const storageApi = useApi(storageApiRef);
  const bucket = useMemo(() => storageApi.forBucket(BUCKET), [storageApi]);
  const [value, setValue] = useState<string>(
    () => bucket.snapshot<string>(key).value ?? '',
  );
  const touched = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // an async storage backend (the user-settings service) delivers the
  // stored draft after mount; adopt it only while nothing was typed yet
  useEffect(() => {
    const subscription = bucket.observe$<string>(key).subscribe(snapshot => {
      if (!touched.current && snapshot.presence === 'present') {
        setValue(snapshot.value ?? '');
      }
    });
    return () => subscription.unsubscribe();
  }, [bucket, key]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (next: string) => {
    touched.current = true;
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next) {
        bucket.set(key, next);
      } else {
        bucket.remove(key);
      }
    }, WRITE_DELAY_MS);
  };

  const clear = () => {
    touched.current = true;
    clearTimeout(timer.current);
    setValue('');
    bucket.remove(key);
  };

  return [value, update, clear];
}

import { useEffect, useRef, useState } from "react";

// Local editable copy of server content; reloads only overwrite it when there are no unsaved edits.
export function useDraft(content, select = (c) => c) {
  const sel = useRef(select);
  const [draft, setDraft] = useState(() => select(content));
  const prev = useRef(JSON.stringify(select(content)));
  useEffect(() => {
    const next = sel.current(content);
    const before = prev.current;
    setDraft((cur) => (JSON.stringify(cur) === before ? next : cur));
    prev.current = JSON.stringify(next);
  }, [content]);
  return [draft, setDraft];
}

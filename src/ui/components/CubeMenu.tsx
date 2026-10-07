import { useEffect, useRef, useState } from "react";
import { getScrambleType, SCRAMBLE_GROUPS, SCRAMBLE_TYPES } from "../../core/events";
import { closeModal, selectProfileSummaries, switchProfile, useStore } from "../../state/store";

// compact dropdown under the cube name, one tab per group
export function CubeMenu() {
  const current = useStore((s) => s.profile);
  const summaries = useStore(selectProfileSummaries);
  const [group, setGroup] = useState(getScrambleType(current).group);
  const items = SCRAMBLE_TYPES.filter((t) => t.group === group);
  const [cursor, setCursor] = useState(() => Math.max(0, items.findIndex((t) => t.id === current)));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => panelRef.current?.focus(), []);
  useEffect(() => {
    panelRef.current?.querySelector(".is-cursor")?.scrollIntoView({ block: "nearest" });
  }, [cursor, group]);

  const choose = (id: string) => {
    switchProfile(id);
    closeModal();
  };

  const switchGroup = (g: string) => {
    setGroup(g);
    const list = SCRAMBLE_TYPES.filter((t) => t.group === g);
    setCursor(Math.max(0, list.findIndex((t) => t.id === current)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    const gi = SCRAMBLE_GROUPS.indexOf(group);
    if (e.key === "ArrowDown") setCursor((c) => Math.min(items.length - 1, c + 1));
    else if (e.key === "ArrowUp") setCursor((c) => Math.max(0, c - 1));
    else if (e.key === "ArrowRight") switchGroup(SCRAMBLE_GROUPS[(gi + 1) % SCRAMBLE_GROUPS.length]!);
    else if (e.key === "ArrowLeft") switchGroup(SCRAMBLE_GROUPS[(gi + SCRAMBLE_GROUPS.length - 1) % SCRAMBLE_GROUPS.length]!);
    else if (e.key === "Enter" && items[cursor]) choose(items[cursor]!.id);
    else if (e.key === "Escape") closeModal();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="menu-layer" onMouseDown={(e) => e.target === e.currentTarget && closeModal()}>
      <div className="menu" role="dialog" aria-label="Choose a cube" ref={panelRef} tabIndex={-1} onKeyDown={onKey}>
        <div className="menu__tabs" role="tablist">
          {SCRAMBLE_GROUPS.map((g) => (
            <button key={g} role="tab" aria-selected={g === group} className={g === group ? "is-on" : ""} onClick={() => switchGroup(g)}>
              {g}
            </button>
          ))}
        </div>
        <div className="menu__list" role="listbox">
          {items.map((t, i) => {
            const count = summaries.get(t.id)?.count;
            return (
              <button
                key={t.id}
                role="option"
                aria-selected={t.id === current}
                className={`menu__item ${t.id === current ? "is-current" : ""} ${i === cursor ? "is-cursor" : ""}`}
                onClick={() => choose(t.id)}
                onMouseMove={() => i !== cursor && setCursor(i)}
              >
                <span>{t.name}</span>
                {count ? <span className="menu__count">{count.toLocaleString()}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

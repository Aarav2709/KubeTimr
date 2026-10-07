import { dismissToast, useStore } from "../../state/store";
import { Icon, Modal } from "./Modal";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          <Icon name={t.tone === "warning" ? "warn" : "tick"} size={17} />
          <span>{t.message}</span>
          {t.action && (
            <button
              className="toast__action"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Space", "Hold, then release to start"],
  ["Any key", "Stop, or split with phases on"],
  ["Esc", "Cancel inspection, close, back to timer"],
  ["Alt 1 2 3", "Last solve OK, +2, DNF"],
  ["Alt Z", "Delete last solve"],
  ["R", "Next scramble"],
  ["Shift R", "Previous scramble"],
  ["G", "Scramble and solve guide"],
  ["E", "Switch cube"],
  ["Alt ↑ ↓", "Previous or next cube you use"],
  ["S", "Timer or stats"],
  ["I", "Inspection on or off"],
  ["F", "Fullscreen"],
  ["↑ ↓ Enter", "Browse solves on the stats page"],
  ["P N Del", "Selected solve +2, DNF, delete"],
];

export function ShortcutsHelp() {
  return (
    <Modal title="Shortcuts" size="sm">
      <dl className="shortcuts">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k}>
            <dt>
              {k.split(" ").map((part) => (
                <kbd key={part}>{part}</kbd>
              ))}
            </dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Command, Search } from 'lucide-react';

export interface Action {
  label: string;
  shortcut?: string;
  run: () => void;
}

/** Native disclosure-based command picker. Focused buttons provide keyboard selection. */
export function Commands({ actions }: { actions: Action[] }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const textField = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState('');
  const [expanded, setExpanded] = useState(false);
  const words = term.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visibleActions = actions.filter(action => words.every(word => action.label.toLocaleLowerCase().includes(word)));

  function dismiss(restoreFocus = true) {
    if (!disclosure.current) return;
    disclosure.current.open = false;
    if (restoreFocus) disclosure.current.querySelector('summary')?.focus();
  }

  useEffect(() => {
    const keyboardShortcut = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.code !== 'KeyK' || event.altKey) return;
      event.preventDefault();
      const element = disclosure.current;
      if (element) element.open = !element.open;
    };
    const outsideClick = (event: MouseEvent) => {
      const element = disclosure.current;
      if (element?.open && !event.composedPath().includes(element)) dismiss(false);
    };
    window.addEventListener('keydown', keyboardShortcut);
    window.addEventListener('click', outsideClick);
    return () => {
      window.removeEventListener('keydown', keyboardShortcut);
      window.removeEventListener('click', outsideClick);
    };
  }, []);

  function navigate(event: KeyboardEvent<HTMLDetailsElement>) {
    if (!disclosure.current?.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
      return;
    }
    const buttons = Array.from(results.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    if (event.key === 'Enter' && event.target === textField.current) {
      event.preventDefault();
      buttons[0]?.click();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    if (['Home', 'End'].includes(event.key) && event.target === textField.current) return;
    event.preventDefault();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let destination: HTMLButtonElement | undefined;
    if (event.key === 'Home') destination = buttons[0];
    else if (event.key === 'End') destination = buttons.at(-1);
    else if (event.key === 'ArrowDown') destination = buttons[index + 1] ?? buttons[0];
    else destination = buttons[index - 1] ?? buttons.at(-1);
    destination?.focus();
  }

  return (
    <details
      className="commands"
      ref={disclosure}
      onKeyDown={navigate}
      onToggle={event => {
        const isOpen = event.currentTarget.open;
        setExpanded(isOpen);
        if (isOpen) {
          setTerm('');
          textField.current?.focus();
        }
      }}
    >
      <summary className="command-trigger" role="button" aria-expanded={expanded} aria-haspopup="dialog">
        <Search size={14} /><span>Find a command</span><kbd>⌘ K</kbd>
      </summary>
      <div className="command-panel" role="dialog" aria-label="Editor commands">
        <label className="searchbox">
          <Command size={16} />
          <input ref={textField} value={term} onChange={event => setTerm(event.target.value)} placeholder="What would you like to do?" aria-label="Search commands" autoComplete="off" />
        </label>
        <div className="command-results" ref={results}>
          {visibleActions.map(action => (
            <button key={action.label} onClick={() => { dismiss(); action.run(); }}>
              <span>{action.label}</span>{action.shortcut && <kbd>{action.shortcut}</kbd>}
            </button>
          ))}
          {visibleActions.length === 0 && <p>No matching commands.</p>}
        </div>
      </div>
    </details>
  );
}

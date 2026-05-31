interface SceneActionButtonProps {
  id: string;
  label: string;
  hotkey: string;
  onClick: () => void;
}

export function SceneActionButton({ id, label, hotkey, onClick }: SceneActionButtonProps) {
  return (
    <button className="action-button" id={id} onClick={onClick}>
      {label} <kbd className="key-badge">{hotkey}</kbd>
    </button>
  );
}

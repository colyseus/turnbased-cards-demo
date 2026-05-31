import React from 'react';

interface TableCustomizerProps {
  feltTheme: string;
  onSelectTheme: (theme: string) => void;
}

export const TableCustomizer = React.memo(function TableCustomizer({
  feltTheme,
  onSelectTheme,
}: TableCustomizerProps) {
  return (
    <div className="customizer-hud">
      <div className="customizer-header">
        <span>Table Customizer</span>
      </div>
      <div className="customizer-section">
        <label>Felt Theme</label>
        <div className="customizer-options">
          <button className={`opt-btn felt-opt ${feltTheme === 'theme-emerald' ? 'active' : ''}`} style={{ background: 'hsl(158, 60%, 14%)', borderColor: feltTheme === 'theme-emerald' ? 'var(--gold, #f0c66f)' : '' }} onClick={() => onSelectTheme('theme-emerald')} />
          <button className={`opt-btn felt-opt ${feltTheme === 'theme-sapphire' ? 'active' : ''}`} style={{ background: 'hsl(215, 55%, 16%)', borderColor: feltTheme === 'theme-sapphire' ? 'var(--gold, #f0c66f)' : '' }} onClick={() => onSelectTheme('theme-sapphire')} />
          <button className={`opt-btn felt-opt ${feltTheme === 'theme-ruby' ? 'active' : ''}`} style={{ background: 'hsl(355, 45%, 15%)', borderColor: feltTheme === 'theme-ruby' ? 'var(--gold, #f0c66f)' : '' }} onClick={() => onSelectTheme('theme-ruby')} />
          <button className={`opt-btn felt-opt ${feltTheme === 'theme-obsidian' ? 'active' : ''}`} style={{ background: 'hsl(220, 8%, 18%)', borderColor: feltTheme === 'theme-obsidian' ? 'var(--gold, #f0c66f)' : '' }} onClick={() => onSelectTheme('theme-obsidian')} />
        </div>
      </div>
    </div>
  );
});

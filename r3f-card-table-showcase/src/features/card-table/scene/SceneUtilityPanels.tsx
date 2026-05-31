import { CardMintingLab, TableCustomizer, ToastContainer } from '../controls';
import type { CardTableController } from '../useCardTableController';

interface SceneUtilityPanelsProps {
  controller: CardTableController;
}

export function SceneUtilityPanels({ controller }: SceneUtilityPanelsProps) {
  const {
    feltTheme,
    handleMint,
    setFeltTheme,
    toastRef,
  } = controller;

  return (
    <>
      <TableCustomizer feltTheme={feltTheme} onSelectTheme={setFeltTheme} />
      <CardMintingLab onMint={handleMint} />
      <ToastContainer ref={toastRef} />
    </>
  );
}

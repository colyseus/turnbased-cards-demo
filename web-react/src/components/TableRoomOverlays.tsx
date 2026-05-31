import type { RefObject } from "react";
import type { CardSchema, UnoColor } from "../gameTypes";
import { TableCardAlert } from "./TableCardAlert";
import { TableReverseSweep } from "./TableReverseSweep";
import { TableRulesDrawer } from "./TableRulesDrawer";
import { TableTurnBanner, type TurnBanner } from "./TableTurnBanner";
import { TableTutorialGuide, type TutorialCard } from "./TableTutorialGuide";
import { TableWildColorModal } from "./TableWildColorModal";

interface TableRoomOverlaysProps {
  colorblindMode: boolean;
  cardAlert: string | null;
  showRules: boolean;
  onCloseRules: () => void;
  onReplayGuide: () => void;
  rulesDialogRef: RefObject<HTMLDivElement | null>;
  tutorial: TutorialCard | null;
  tutorialStep: number;
  tutorialCount: number;
  onCloseTutorial: () => void;
  onAdvanceTutorial: () => void;
  turnBanner: TurnBanner | null;
  showReverseSweep: boolean;
  direction: number | undefined;
  wildFor: CardSchema | null;
  onCloseWild: () => void;
  onSelectWildColor: (color: UnoColor) => void;
  wildDialogRef: RefObject<HTMLDivElement | null>;
}

export function TableRoomOverlays({
  colorblindMode,
  cardAlert,
  showRules,
  onCloseRules,
  onReplayGuide,
  rulesDialogRef,
  tutorial,
  tutorialStep,
  tutorialCount,
  onCloseTutorial,
  onAdvanceTutorial,
  turnBanner,
  showReverseSweep,
  direction,
  wildFor,
  onCloseWild,
  onSelectWildColor,
  wildDialogRef,
}: TableRoomOverlaysProps) {
  return (
    <>
      {turnBanner && <TableTurnBanner turnBanner={turnBanner} />}
      <TableReverseSweep showReverseSweep={showReverseSweep} direction={direction} />
      {cardAlert && <TableCardAlert cardAlert={cardAlert} />}
      {showRules && (
        <TableRulesDrawer
          colorblindMode={colorblindMode}
          rulesDialogRef={rulesDialogRef}
          onReplayGuide={onReplayGuide}
          onCloseRules={onCloseRules}
        />
      )}
      {tutorial && (
        <TableTutorialGuide
          tutorial={tutorial}
          tutorialStep={tutorialStep}
          tutorialCount={tutorialCount}
          onCloseTutorial={onCloseTutorial}
          onAdvanceTutorial={onAdvanceTutorial}
        />
      )}
      {wildFor && (
        <TableWildColorModal
          wildDialogRef={wildDialogRef}
          onCloseWild={onCloseWild}
          onSelectWildColor={onSelectWildColor}
        />
      )}
    </>
  );
}

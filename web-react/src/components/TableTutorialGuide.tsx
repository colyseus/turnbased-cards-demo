export interface TutorialCard {
  eyebrow: string;
  title: string;
  text: string;
  target: string;
}

interface TableTutorialGuideProps {
  tutorial: TutorialCard;
  tutorialStep: number;
  tutorialCount: number;
  onCloseTutorial: () => void;
  onAdvanceTutorial: () => void;
}

export function TableTutorialGuide({
  tutorial,
  tutorialStep,
  tutorialCount,
  onCloseTutorial,
  onAdvanceTutorial,
}: TableTutorialGuideProps) {
  return (
    <section
      className={`first-game-guide guide-step-${tutorialStep + 1}`}
      role="dialog"
      aria-labelledby="first-game-guide-title"
      aria-describedby="first-game-guide-copy"
    >
      <div className="first-game-guide-marker" aria-hidden="true">
        <span>{tutorialStep + 1}</span>
      </div>
      <div className="first-game-guide-copy">
        <span>{tutorial.eyebrow}</span>
        <h2 id="first-game-guide-title">{tutorial.title}</h2>
        <p id="first-game-guide-copy">{tutorial.text}</p>
        <small>{tutorial.target}</small>
      </div>
      <div className="first-game-guide-actions">
        <button className="ghost-btn" data-testid="tutorial-skip" onClick={onCloseTutorial} type="button">
          Skip guide
        </button>
        <button className="guide-next-btn" data-testid="tutorial-next" onClick={onAdvanceTutorial} type="button">
          {tutorialStep === tutorialCount - 1 ? "Start playing" : "Next"}
        </button>
      </div>
    </section>
  );
}

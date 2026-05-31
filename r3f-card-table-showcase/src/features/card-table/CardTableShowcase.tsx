import { CardTableScene } from './CardTableScene';
import { useCardTableController } from './useCardTableController';

export default function CardTableShowcase() {
  const controller = useCardTableController();
  return <CardTableScene controller={controller} />;
}

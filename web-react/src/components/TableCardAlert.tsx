function ChampionshipCrest({
  kind,
  icon,
  title,
  subtitle,
}: {
  kind: "success" | "warning";
  icon: string;
  title: string;
  subtitle: string;
}) {
  const gradientId = kind === "success" ? "crestGoldGrad" : "crestRedGrad";
  const gradientStops =
    kind === "success"
      ? [
          { offset: "0%", stopColor: "hsl(42, 95%, 65%)" },
          { offset: "50%", stopColor: "hsl(35, 90%, 45%)" },
          { offset: "100%", stopColor: "hsl(42, 95%, 25%)" },
        ]
      : [
          { offset: "0%", stopColor: "hsl(358, 85%, 60%)" },
          { offset: "100%", stopColor: "hsl(358, 80%, 25%)" },
        ];
  return (
    <div className={`championship-crest-shield ${kind}`}>
      <div className="shield-glow-aura" />
      <div className="crest-svg-container">
        <svg viewBox="0 0 100 120" className="shield-svg">
          <path
            d="M 50,5 L 90,20 L 90,65 C 90,95 50,115 50,115 C 50,115 10,95 10,65 L 10,20 Z"
            fill={`url(#${gradientId})`}
            stroke={kind === "success" ? "var(--gold)" : "var(--card-red)"}
            strokeWidth="3"
          />
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              {gradientStops.map((stop) => (
                <stop key={`${gradientId}-${stop.offset}`} offset={stop.offset} stopColor={stop.stopColor} />
              ))}
            </linearGradient>
          </defs>
        </svg>
        <div className="crest-symbol">{icon}</div>
      </div>
      <h2>{title}</h2>
      <p className="crest-subtitle">{subtitle}</p>
    </div>
  );
}

interface TableCardAlertProps {
  cardAlert: string;
}

export function TableCardAlert({ cardAlert }: TableCardAlertProps) {
  return (
    <div className="card-alert-overlay">
      {cardAlert.includes("CALLED UNO!") ? (
        <ChampionshipCrest
          kind="success"
          icon="🏆"
          title={cardAlert.replace("🎉 ", "")}
          subtitle="Uno Championship Honor"
        />
      ) : cardAlert.includes("HAS 1 CARD!") ? (
        <ChampionshipCrest
          kind="warning"
          icon="⚠️"
          title={cardAlert.replace("⚠️ ", "")}
          subtitle="Single Card Alert"
        />
      ) : (
        <div
          className={`card-alert-banner ${
            cardAlert.includes("⚠️") || cardAlert.includes("🔥")
              ? "warning"
              : cardAlert.includes("🎉")
                ? "success"
                : ""
          }`}
        >
          <h2>{cardAlert}</h2>
        </div>
      )}
    </div>
  );
}

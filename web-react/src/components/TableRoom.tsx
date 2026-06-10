import type { CSSProperties } from "react";
import { AmbientStardust } from "./AmbientStardust";
import { CardAtlasView } from "./CardAtlasView";
import { PlayDirectionRing } from "./PlayDirectionRing";
import { PlayerStrip } from "./PlayerStrip";
import { WinnerPodium } from "./WinnerPodium";
import { TableHandDock } from "./TableHandDock";
import { TableRoomOverlays } from "./TableRoomOverlays";
import { TableBoardStage } from "./TableBoardStage";
import { TableSidePanel } from "./TableSidePanel";
import { TableTopbar } from "./TableTopbar";
import { TableShell } from "./TableShell";
import { removeStorage, writeStorage } from "../storage";
import {
  cardLabel,
  getDeterministicOffsetX,
  getDeterministicOffsetY,
  getDeterministicRotation,
  parsePlayerName,
} from "../gameHelpers";
import {
  useTableRoomController,
  type TableRoomControllerProps,
} from "./useTableRoomController";
import { getReplayGuideSnapshot } from "./tableRoomOverlayFlow";

type TableRoomProps = TableRoomControllerProps;

export function TableRoom(props: TableRoomProps) {
  const { room, state, onLeave, colorblindMode, onToggleColorblind, showToast, disconnected } = props;
  const {
    me,
    players,
    discardPile,
    topCard,
    sortBy,
    setSortBy,
    wildFor,
    setWildFor,
    chatText,
    setChatText,
    currentPlayerLabel,
    activePlayerThemeColor,
    meSummary,
    rosterEntries,
    isMyTurn,
    spotlightPos,
    hasOneCardWarning,
    roomCode,
    tableReady,
    ping,
    showRules,
    setShowRules,
    tutorialStep,
    setTutorialStep,
    cardAlert,
    particles,
    selectedCardIdx,
    setSelectedCardIdx,
    flights,
    actionBubbles,
    turnBanner,
    skippedSeatIndex,
    showReverseSweep,
    botEmotions,
    shockwaves,
    cardBackTheme,
    setCardBackTheme,
    handScrollRef,
    chatLogRef,
    rulesDialogRef,
    wildDialogRef,
    hand,
    handCount,
    handMid,
    dynamicFanAngle,
    dynamicFanOffset,
    dynamicMarginValue,
    shouldDrawHint,
    guidanceText,
    guidanceStatus,
    actionCallout,
    tutorial,
    tutorialCards,
    closeTutorial,
    playCard,
    handleUnplayableTap,
    scrollHand,
  } = useTableRoomController({
    room,
    state,
    onLeave,
    colorblindMode,
    onToggleColorblind,
    showToast,
    disconnected,
  });

  return (
    <TableShell>
      {hasOneCardWarning && <div className="uno-hazard-siren" />}
      {disconnected && (
        <div className="disconnection-banner" role="alert" aria-live="assertive">
          <span>Connection lost — reconnecting...</span>
        </div>
      )}
      <TableTopbar
        roomCode={roomCode}
        isMyTurn={isMyTurn}
        currentPlayerLabel={currentPlayerLabel}
        direction={state?.direction}
        ping={ping}
        colorblindMode={colorblindMode}
        onToggleColorblind={onToggleColorblind}
        onShowRules={() => setShowRules(true)}
        onLeave={onLeave}
      />

      <TableBoardStage
        activeColor={state?.activeColor || "red"}
        spotlightPos={spotlightPos}
        activePlayerThemeColor={activePlayerThemeColor}
      >
        <div className="table-felt-wave-overlay" />
        <AmbientStardust />
        <div className="player-band">
          <PlayerStrip
            players={players.filter((player) => player.sessionId !== me?.sessionId)}
            activeSeat={state?.currentPlayer ?? -1}
            turnDeadline={state?.turnDeadline}
            skippedSeatIndex={skippedSeatIndex}
            actionBubbles={actionBubbles}
            botEmotions={botEmotions}
          />
        </div>

        <div className="center-table">
          <PlayDirectionRing direction={state?.direction ?? 1} />

          {tableReady && (
            <div className={`active-color-badge color-${state?.activeColor || "red"}`}>
              <div className="prism-shimmer" />
              <span className={`color-dot color-${state?.activeColor || "red"}`} />
              <span>
                {state?.activeColor}
                {colorblindMode && (
                  <span style={{ marginLeft: "6px", opacity: 0.85, fontWeight: "bold" }}>
                    {state?.activeColor === "red" && " ▲"}
                    {state?.activeColor === "blue" && " ■"}
                    {state?.activeColor === "green" && " ●"}
                    {state?.activeColor === "yellow" && " ★"}
                  </span>
                )}
              </span>
            </div>
          )}

          <button
            id="draw-pile-anchor"
            className={`draw-pile ${shouldDrawHint ? "guidance-pulse" : ""}`}
            disabled={!isMyTurn || !tableReady}
            onClick={() => room?.send("draw_card")}
            type="button"
            aria-label="Draw card deck"
          >
            {(() => {
              const deckCount = state?.drawPileCount ?? state?.deckCount ?? 0;
              const layerCount = Math.min(7, Math.ceil(deckCount / 15));
              return Array.from({ length: layerCount }).map((_, i) => (
                <div key={i} className={`deck-card-layer layer-${layerCount - i}`} />
              ));
            })()}
            <div className="deck-top-card">
              <CardAtlasView card={null} isBack skin={cardBackTheme} />
            </div>
            <div className="deck-count-overlay">
              <span>{state?.drawPileCount ?? state?.deckCount ?? 0}</span>
            </div>
            {shouldDrawHint && (
              <div className="draw-guidance-tooltip" role="tooltip">
                <span>Draw a card!</span>
              </div>
            )}
          </button>

          {tableReady ? (
            <div className="pile-container" id="discard-pile-anchor">
              {shockwaves.map((sw) => (
                <div key={sw.id} className={`discard-shockwave color-${sw.color}`} />
              ))}
              {discardPile.slice(-4, -1).map((histCard, hIdx) => {
                const globalIdx = discardPile.length - 4 + hIdx;
                const rot = getDeterministicRotation(globalIdx);
                const ox = getDeterministicOffsetX(globalIdx);
                const oy = getDeterministicOffsetY(globalIdx);
                return (
                  <div
                    key={histCard.id}
                    className="discard-card"
                    style={
                      {
                        transform: `rotate(${rot}deg) translate(${ox}px, ${oy}px)`,
                        opacity: 0.5 + hIdx * 0.15,
                      } as CSSProperties
                    }
                  >
                    <CardAtlasView card={histCard} colorblind={colorblindMode} />
                  </div>
                );
              })}
              <div
                className="discard-card"
                style={
                  {
                    transform: `rotate(${getDeterministicRotation(discardPile.length - 1)}deg) translate(${getDeterministicOffsetX(discardPile.length - 1)}px, ${getDeterministicOffsetY(discardPile.length - 1)}px)`,
                  } as CSSProperties
                }
              >
                <CardAtlasView card={topCard} colorblind={colorblindMode} />
              </div>
            </div>
          ) : (
            <div className="table-empty-state">
              <span>Syncing Table</span>
              <strong>Dealing Cards...</strong>
              <small>Awaiting server synchronization deal.</small>
            </div>
          )}

          {Boolean(state?.pendingDraw) && (
            <div className="pending-draw-badge">+{state?.pendingDraw} Draw Penalty Active</div>
          )}
        </div>
      </TableBoardStage>

      <TableRoomOverlays
        colorblindMode={colorblindMode}
        cardAlert={cardAlert}
        showRules={showRules}
        onCloseRules={() => setShowRules(false)}
        onReplayGuide={() => {
          removeStorage("uno_tutorial_complete");
          const next = getReplayGuideSnapshot({
            showRules: true,
            tutorialStep,
            wildFor,
            cardAlert,
            turnBanner,
            showReverseSweep,
          });
          setShowRules(next.showRules);
          setTutorialStep(next.tutorialStep);
        }}
        rulesDialogRef={rulesDialogRef}
        tutorial={tutorial}
        tutorialStep={tutorialStep}
        tutorialCount={tutorialCards.length}
        onCloseTutorial={closeTutorial}
        onAdvanceTutorial={() => {
          if (tutorialStep === tutorialCards.length - 1) {
            closeTutorial();
          } else {
            setTutorialStep((step) => step + 1);
          }
        }}
        turnBanner={turnBanner}
        showReverseSweep={showReverseSweep}
        direction={state?.direction}
        wildFor={wildFor}
        onCloseWild={() => setWildFor(null)}
        onSelectWildColor={(color) => {
          if (wildFor) playCard(wildFor, color);
        }}
        wildDialogRef={wildDialogRef}
      />

      {state?.winner !== undefined && state.winner !== -1 && (
        <WinnerPodium
          room={room}
          state={state}
          players={players}
          winnerSeat={state.winner}
          meSeatIndex={me?.seatIndex}
        />
      )}

      <TableSidePanel
        me={meSummary}
        topCardLabel={cardLabel(topCard)}
        phase={state?.phase}
        roster={rosterEntries}
        cardBackTheme={cardBackTheme}
        onSetCardBackTheme={(theme) => {
          setCardBackTheme(theme);
          writeStorage("uno_card_back_skin", theme);
        }}
        showToast={showToast}
      />

      <TableHandDock
        room={room}
        state={state}
        meSeatIndex={me?.seatIndex}
        isMyTurn={isMyTurn}
        actionCallout={actionCallout}
        guidanceText={guidanceText}
        guidanceStatus={guidanceStatus}
        sortBy={sortBy}
        setSortBy={setSortBy}
        actionBubbleLocal={actionBubbles.find((b) => b.seatIndex === me?.seatIndex)}
        hand={hand}
        handCount={handCount}
        handMid={handMid}
        dynamicFanAngle={dynamicFanAngle}
        dynamicFanOffset={dynamicFanOffset}
        dynamicMarginValue={dynamicMarginValue}
        selectedCardIdx={selectedCardIdx}
        setSelectedCardIdx={setSelectedCardIdx}
        playCard={playCard}
        onUnplayableTap={handleUnplayableTap}
        scrollHand={scrollHand}
        handScrollRef={handScrollRef}
        colorblindMode={colorblindMode}
      />

      <aside className="chat-panel">
        <div className="chat-log" ref={chatLogRef}>
          {(state?.chatMessages ?? []).length === 0 ? (
            <div className="chat-empty-state">
              <span>Table chat</span>
              <strong>No messages yet</strong>
            </div>
          ) : (
            (state?.chatMessages ?? []).slice(-10).map((message) => {
              const senderAv = parsePlayerName(message.sender);
              return (
                <p key={`${message.timestamp}-${message.sender}`}>
                  <strong>{senderAv.name}</strong>
                  {message.text}
                </p>
              );
            })
          )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!chatText.trim()) return;
            room?.send("chat", { text: chatText.trim() });
            setChatText("");
          }}
        >
          <input
            value={chatText}
            onChange={(event) => setChatText(event.target.value)}
            placeholder="Type a chat message..."
            aria-label="Chat input"
          />
          <button type="submit">Send</button>
        </form>
      </aside>

      <div className="particle-canvas">
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={
              {
                left: `${p.x}px`,
                top: `${p.y}px`,
                "--tx": p.tx,
                "--ty": p.ty,
                "--tr": p.tr,
              } as CSSProperties
            }
          >
            {p.emoji}
          </div>
        ))}
      </div>

      <div
        className="flights-overlay"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 9999,
        }}
      >
        {flights.map((f) => {
          return (
            <div
              key={f.id}
              className={`flying-card-wrapper ${f.animating ? "animating" : ""}`}
              style={
                {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "72px",
                  height: "108px",
                  "--start-x": `${f.startX}px`,
                  "--start-y": `${f.startY}px`,
                  "--end-x": `${f.endX}px`,
                  "--end-y": `${f.endY}px`,
                  "--end-rot": `${f.rotation}deg`,
                } as CSSProperties
              }
            >
              <CardAtlasView card={f.card} isBack={f.isBack} colorblind={colorblindMode} skin={cardBackTheme} />
            </div>
          );
        })}
      </div>
    </TableShell>
  );
}

import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { setupContextMenu } from "./contextMenu";
import { setupPassMode } from "./passMode";

const ID = "com.bluelock.ball";

const VISIBLE_HISTORY = 8;

const app =
  document.querySelector<HTMLDivElement>("#app")!;

const shotUiStyle = document.createElement("style");
shotUiStyle.textContent = `
  .shot-settings { position: relative; display: inline-flex; align-items: center; margin-left: 6px; }
  .shot-settings-toggle { width: 30px; height: 30px; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: rgba(20,25,35,.92); color: #fff; cursor: pointer; font-size: 16px; display: grid; place-items: center; transition: .15s ease; }
  .shot-settings-toggle:hover { transform: translateY(-1px); filter: brightness(1.15); }
  .shot-settings-menu { position: absolute; right: 0; bottom: 36px; z-index: 20; display: flex; gap: 6px; padding: 7px; border-radius: 10px; background: rgba(18,22,30,.98); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 8px 24px rgba(0,0,0,.35); white-space: nowrap; }
  .shot-settings-menu[hidden] { display: none; }
  .shot-result { border: 0; border-radius: 7px; padding: 7px 10px; color: #fff; font-weight: 700; cursor: pointer; font-size: 11px; transition: .15s ease; }
  .shot-result:hover { transform: translateY(-1px); filter: brightness(1.12); }
  .shot-result-shot { background: #3b82f6; }
  .shot-result-goal { background: #16a34a; }
  .assist-settings { position: relative; display: inline-flex; align-items: center; margin-left: 6px; }
  .assist-settings-toggle { width: 30px; height: 30px; border: 1px solid rgba(255,255,255,.16); border-radius: 8px; background: rgba(20,25,35,.92); color: #fff; cursor: pointer; font-size: 16px; display: grid; place-items: center; transition: .15s ease; }
  .assist-settings-toggle:hover { transform: translateY(-1px); filter: brightness(1.15); }
  .assist-settings-menu { position: absolute; right: 0; bottom: 36px; z-index: 20; display: flex; gap: 6px; padding: 7px; border-radius: 10px; background: rgba(18,22,30,.98); border: 1px solid rgba(255,255,255,.14); box-shadow: 0 8px 24px rgba(0,0,0,.35); white-space: nowrap; }
  .assist-settings-menu[hidden] { display: none; }
  .assist-result { border: 0; border-radius: 7px; padding: 7px 10px; color: #fff; font-weight: 700; cursor: pointer; font-size: 11px; transition: .15s ease; }
  .assist-result:hover { transform: translateY(-1px); filter: brightness(1.12); }
  .assist-result-on { background: #f59e0b; }
  .assist-result-off { background: #475569; }
  .assist-badge { display: inline-block; margin-left: 5px; padding: 2px 6px; border-radius: 6px; background: rgba(245,158,11,.18); color: #fbbf24; font-size: 10px; font-weight: 800; }
`;
document.head.appendChild(shotUiStyle);

// =========================================
// TIPOS
// =========================================

type HistoryEvent = {
  type: "pass" | "interception" | "steal" | "shot";
  result?: "pending" | "shot" | "goal";
  assist?: boolean;
  from: string;
  to: string;
  fromName?: string;
  toName?: string;
  time?: number;
};

// =========================================
// CONFIGURAR PAINEL
// =========================================

async function setupPanel() {
  const role = await OBR.player.getRole();

  const isGM = role === "GM";

  if (isGM) {
    app.innerHTML = `
      <div class="panel">

        <div class="header">
          <h1>
            ⚽ Blue Lock Ball
          </h1>

          <div class="subtitle">
            MATCH CONTROL
          </div>
        </div>

        <section>

          <h2>
            Status da Bola
          </h2>

          <div id="ball-status">
            Carregando...
          </div>

        </section>

        <section>

          <h2>
            Posse Atual
          </h2>

          <div id="ball-holder">
            Carregando...
          </div>

        </section>

        <section>

          <div class="history-header">

            <h2>
              Histórico da Partida
            </h2>

            <div class="history-actions">

              <button
                id="export-history"
                class="export-button"
                title="Exportar histórico"
              >
                📄
              </button>

              <button
                id="clear-history"
                class="clear-button"
                title="Limpar histórico"
              >
                🧹
              </button>

            </div>

          </div>

          <div id="pass-history">
            Nenhum evento ainda.
          </div>

        </section>

      </div>
    `;

    setupHistoryButtons();

  } else {

    app.innerHTML = `
      <div class="panel">

        <div class="header">

          <h1>
            ⚽ Blue Lock Ball
          </h1>

          <div class="subtitle">
            MATCH CONTROL
          </div>

        </div>

        <section>

          <h2>
            Posse Atual
          </h2>

          <div id="ball-holder">
            Carregando...
          </div>

        </section>

        <section>

          <h2>
            Histórico da Partida
          </h2>

          <div id="pass-history">
            Nenhum evento ainda.
          </div>

        </section>

        <div class="player-help">

          ⚽ Para passar a bola,
          clique com o botão direito
          no seu personagem.

          <br><br>

          🛡️ Para interceptar,
          selecione seu personagem
          e escolha "Interceptar".

        </div>

      </div>
    `;
  }

  await renderPanel(isGM);

  OBR.scene.onMetadataChange(() => {
    void renderPanel(isGM);
  });

  OBR.scene.items.onChange(() => {
    void renderPanel(isGM);
  });
}

// =========================================
// BOTÕES DO HISTÓRICO
// =========================================

function setupHistoryButtons() {

  const clearButton =
    document.querySelector<HTMLButtonElement>(
      "#clear-history"
    );

  if (clearButton) {

    clearButton.addEventListener(
      "click",
      async () => {

        const confirmed =
          confirm(
            "⚠️ Tem certeza que deseja apagar TODO o histórico da partida?"
          );

        if (!confirmed) {
          return;
        }

        await OBR.scene.setMetadata({
          [`${ID}/history`]: [],
        });

        
      }
    );
  }

  const exportButton =
    document.querySelector<HTMLButtonElement>(
      "#export-history"
    );

  if (exportButton) {

    exportButton.addEventListener(
      "click",
      () => {
        void exportHistory();
      }
    );
  }
}

// =========================================
// EXPORTAR HISTÓRICO
// =========================================

async function exportHistory() {

  try {

    const metadata =
      await OBR.scene.getMetadata();

    const historyData =
      metadata[`${ID}/history`];

    if (
      !Array.isArray(historyData) ||
      historyData.length === 0
    ) {

      alert(
        "⚠️ Não existem eventos para exportar."
      );

      return;
    }

    const history =
      historyData as HistoryEvent[];

    const now =
      new Date();

    const date =
      now.toLocaleDateString(
        "pt-BR"
      );

    const time =
      now.toLocaleTimeString(
        "pt-BR"
      );

    // =====================================
    // CONTAGEM DE ESTATÍSTICAS
    // =====================================

    const stats =
      new Map<
        string,
        {
          name: string;
          passes: number;
          interceptions: number;
          shots: number;
          goals: number;
          assists: number;
        }
      >();

    for (const event of history) {

      // -------------------------------------
      // PASSE
      // -------------------------------------

      if (event.type === "pass") {

        const name =
          event.fromName ||
          "Desconhecido";

        const existing =
          stats.get(event.from);

        if (existing) {

          existing.passes++;
          if (event.assist) existing.assists++;

        } else {

          stats.set(
            event.from,
            {
              name,
              passes: 1,
              interceptions: 0,
              shots: 0,
              goals: 0,
              assists: event.assist ? 1 : 0,
            }
          );
        }
      }

      // -------------------------------------
      // INTERCEPTAÇÃO
      // -------------------------------------

      if (
        event.type === "interception" ||
        event.type === "steal"
      ) {

        const name =
          event.toName ||
          "Desconhecido";

        const existing =
          stats.get(event.to);

        if (existing) {

          existing.interceptions++;

        } else {

          stats.set(
            event.to,
            {
              name,
              passes: 0,
              interceptions: 1,
              shots: 0,
              goals: 0,
              assists: 0,
            }
          );
        }
      }
    }

    // -------------------------------------
    // CHUTES E GOLS
    // -------------------------------------

    for (const event of history) {
      if (event.type !== "shot") continue;

      const name = event.fromName || "Desconhecido";
      const existing = stats.get(event.from);

      if (existing) {
        existing.shots++;
        if (event.result === "goal") existing.goals++;
      } else {
        stats.set(event.from, {
          name,
          passes: 0,
          interceptions: 0,
          shots: 1,
          goals: event.result === "goal" ? 1 : 0,
          assists: 0,
        });
      }
    }

    // =====================================
    // ORDENAR ESTATÍSTICAS
    // =====================================

    const sortedStats =
      Array.from(
        stats.values()
      ).sort(
        (a, b) => {

          const totalA =
            a.passes +
            a.interceptions +
            a.shots;

          const totalB =
            b.passes +
            b.interceptions +
            b.shots;

          return totalB - totalA;
        }
      );

    // =====================================
    // MONTAR ARQUIVO
    // =====================================

    let text =
      "BLUE LOCK RPG\n";

    text +=
      "RELATÓRIO DA PARTIDA\n";

    text +=
      "========================================\n\n";

    text +=
      `Data da exportação: ${date}\n`;

    text +=
      `Hora da exportação: ${time}\n`;

    text +=
      `Total de eventos: ${history.length}\n\n`;

    // =====================================
    // ESTATÍSTICAS
    // =====================================

    text +=
      "========================================\n";

    text +=
      "ESTATÍSTICAS\n";

    text +=
      "========================================\n\n";

    if (sortedStats.length === 0) {

      text +=
        "Nenhuma estatística registrada.\n\n";

    } else {

      sortedStats.forEach(
        (
          player,
          index
        ) => {

          text +=
            `${String(
              index + 1
            ).padStart(
              2,
              "0"
            )}. ${player.name}\n`;

          text +=
            `    Passes: ${player.passes}\n`;

          text +=
            `    Assistências: ${player.assists}\n`;

          text +=
            `    Desarmes/Interceptações: ${player.interceptions}\n`;

          text +=
            `    Chutes a gol: ${player.shots}\n`;

          text +=
            `    Gols: ${player.goals}\n`;

          text +=
            `    Conversão: ${player.shots > 0 ? ((player.goals / player.shots) * 100).toFixed(1) : "0.0"}%\n\n`;
        }
      );
    }

    // =====================================
    // HISTÓRICO COMPLETO
    // =====================================

    text +=
      "========================================\n";

    text +=
      "HISTÓRICO COMPLETO\n";

    text +=
      "========================================\n\n";

    history.forEach(
      (
        event,
        index
      ) => {

        const fromName =
          event.fromName ||
          "Desconhecido";

        const toName =
          event.toName ||
          "Desconhecido";

        // -----------------------------------
        // PASSE
        // -----------------------------------

        if (event.type === "pass") {

          text +=
            `${String(
              index + 1
            ).padStart(
              3,
              "0"
            )}. ⚽ ${fromName} deu assistência para ${toName}${event.assist ? " — ASSISTÊNCIA" : ""}\n`;

        }

        // -----------------------------------
        // INTERCEPTAÇÃO
        // -----------------------------------

        else if (
          event.type === "interception" ||
          event.type === "steal"
        ) {

          text +=
            `${String(
              index + 1
            ).padStart(
              3,
              "0"
            )}. 🛡️ ${toName} interceptou ${fromName}\n`;

        }

        // -----------------------------------
        // CHUTE
        // -----------------------------------

        else if (event.type === "shot") {

          const result =
            event.result === "goal"
              ? "GOOOOOL"
              : event.result === "shot"
                ? "chute a gol"
                : "Realizou um chute e......";

          text +=
            `${String(
              index + 1
            ).padStart(
              3,
              "0"
            )}. 🎯 ${fromName}: ${result}\n`;

        }

        // -----------------------------------
        // EVENTO DESCONHECIDO
        // -----------------------------------

        else {

          text +=
            `${String(
              index + 1
            ).padStart(
              3,
              "0"
            )}. ${fromName} → ${toName}\n`;
        }
      }
    );

    text +=
      "\n========================================\n";

    text +=
      "Fim do relatório.\n";

    // =====================================
    // DOWNLOAD
    // =====================================

    const blob =
      new Blob(
        [text],
        {
          type:
            "text/plain;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `blue-lock-partida-${date.replaceAll(
        "/",
        "-"
      )}.txt`;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      url
    );

    

  } catch (error) {

    console.error(
      "❌ Erro ao exportar histórico:",
      error
    );

    alert(
      "❌ Não foi possível exportar o histórico."
    );
  }
}

// =========================================
// EXCLUIR EVENTO
// =========================================

async function deleteEvent(
  index: number
) {

  try {

    const metadata =
      await OBR.scene.getMetadata();

    const historyData =
      metadata[
        `${ID}/history`
      ];

    if (
      !Array.isArray(historyData)
    ) {
      return;
    }

    const realIndex =
      historyData.length -
      1 -
      index;

    if (
      realIndex < 0 ||
      realIndex >=
        historyData.length
    ) {
      return;
    }

    const event =
      historyData[
        realIndex
      ] as HistoryEvent;

    const fromName =
      event.fromName ||
      "Desconhecido";

    const toName =
      event.toName ||
      "Desconhecido";

    let description =
      `${fromName} → ${toName}`;

    if (
      event.type === "interception" ||
      event.type === "steal"
    ) {

      description =
        `${toName} interceptou ${fromName}`;

    } else if (
      event.type === "pass"
    ) {

      description =
        `${fromName} deu assistência para ${toName}`;

    } else if (
      event.type === "shot"
    ) {

      description =
        `${fromName} — ${event.result === "goal" ? "chute a gol + GOL" : "chute a gol"}`;
    }

    const confirmed =
      confirm(
        `⚠️ Excluir este evento?\n\n${description}`
      );

    if (!confirmed) {
      return;
    }

    const updatedHistory =
      historyData.filter(
        (
          _event,
          i
        ) =>
          i !==
          realIndex
      );

    await OBR.scene.setMetadata({
      [`${ID}/history`]:
        updatedHistory,
    });

    

  } catch (error) {

    console.error(
      "❌ Erro ao excluir evento:",
      error
    );
  }
}

// =========================================
// ALTERAR ASSISTÊNCIA DO PASSE
// =========================================

async function setPassAssist(
  index: number,
  assist: boolean
) {
  try {
    const metadata = await OBR.scene.getMetadata();
    const historyData = metadata[`${ID}/history`];

    if (!Array.isArray(historyData)) return;
    if (index < 0 || index >= historyData.length) return;

    const event = historyData[index] as HistoryEvent;
    if (event.type !== "pass") return;

    const updatedHistory = historyData.map((entry, i) =>
      i === index
        ? { ...entry, assist }
        : entry
    );

    await OBR.scene.setMetadata({
      [`${ID}/history`]: updatedHistory,
    });
  } catch (error) {
    console.error("❌ Erro ao atualizar assistência do passe:", error);
  }
}

// =========================================
// BOTÕES DE ASSISTÊNCIA
// =========================================

function setupPassAssistButtons() {
  const buttons =
    document.querySelectorAll<HTMLButtonElement>(
      ".assist-result"
    );

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const assist = button.dataset.assist === "true";
      void setPassAssist(index, assist);
    });
  });
}

// =========================================
// MENU DE ASSISTÊNCIA
// =========================================

function setupPassAssistSettings() {
  const toggles =
    document.querySelectorAll<HTMLButtonElement>(
      ".assist-settings-toggle"
    );

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();

      const id = toggle.dataset.assistMenu;
      if (!id) return;

      document
        .querySelectorAll<HTMLElement>(".assist-settings-menu")
        .forEach((menu) => {
          if (menu.dataset.assistMenuPanel === id) {
            menu.hidden = !menu.hidden;
          } else {
            menu.hidden = true;
          }
        });
    });
  });
}

// =========================================
// ALTERAR RESULTADO DO CHUTE
// =========================================

async function setShotResult(
  index: number,
  result: "shot" | "goal"
) {
  try {
    const metadata = await OBR.scene.getMetadata();
    const historyData = metadata[`${ID}/history`];

    if (!Array.isArray(historyData)) return;
    if (index < 0 || index >= historyData.length) return;

    const event = historyData[index] as HistoryEvent;
    if (event.type !== "shot") return;

    const updatedHistory = historyData.map((entry, i) =>
      i === index
        ? { ...entry, result }
        : entry
    );

    await OBR.scene.setMetadata({
      [`${ID}/history`]: updatedHistory,
    });

    
  } catch (error) {
    console.error("❌ Erro ao atualizar resultado do chute:", error);
  }
}

// =========================================
// BOTÕES DE EXCLUSÃO
// =========================================

function setupIndividualDeleteButtons() {

  const buttons =
    document.querySelectorAll<HTMLButtonElement>(
      ".delete-pass"
    );

  buttons.forEach(
    (button) => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset.index
            );

          void deleteEvent(
            index
          );
        }
      );
    }
  );
}

// =========================================
// BOTÕES DE RESULTADO DO CHUTE
// =========================================

function setupShotResultButtons() {
  const buttons =
    document.querySelectorAll<HTMLButtonElement>(
      ".shot-result"
    );

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const result = button.dataset.result as "shot" | "goal";
      void setShotResult(index, result);
    });
  });
}

// =========================================
// MENU DE RESULTADO DO CHUTE
// =========================================

function setupShotSettings() {
  const toggles =
    document.querySelectorAll<HTMLButtonElement>(
      ".shot-settings-toggle"
    );

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();

      const id = toggle.dataset.shotMenu;
      if (!id) return;

      document
        .querySelectorAll<HTMLElement>(".shot-settings-menu")
        .forEach((menu) => {
          if (menu.dataset.shotMenuPanel === id) {
            menu.hidden = !menu.hidden;
          } else {
            menu.hidden = true;
          }
        });
    });
  });

  document.addEventListener("click", () => {
    document
      .querySelectorAll<HTMLElement>(".shot-settings-menu")
      .forEach((menu) => {
        menu.hidden = true;
      });
  }, { once: true });
}

// =========================================
// RENDERIZAR PAINEL
// =========================================

async function renderPanel(
  isGM: boolean
) {

  try {

    const metadata =
      await OBR.scene.getMetadata();

    const ballId =
      metadata[
        `${ID}/ball`
      ];

    const holderId =
      metadata[
        `${ID}/holder`
      ];

    const historyData =
      metadata[
        `${ID}/history`
      ];

    const items =
      await OBR.scene.items.getItems();

    // =====================================
    // STATUS DA BOLA
    // =====================================

    if (isGM) {

      const ballStatus =
        document.querySelector<HTMLDivElement>(
          "#ball-status"
        );

      if (!ballStatus) {
        return;
      }

      if (
        typeof ballId !==
        "string"
      ) {

        ballStatus.innerHTML = `
          <div class="status danger">
            🔴 Nenhuma bola definida
          </div>
        `;

      } else {

        const ball =
          items.find(
            (item) =>
              item.id ===
              ballId
          );

        if (!ball) {

          ballStatus.innerHTML = `
            <div class="status danger">
              🔴 Bola não encontrada
            </div>
          `;

        } else {

          ballStatus.innerHTML = `
            <div class="status success">
              🟢 Bola definida
            </div>

            <div class="info">

              <strong>
                ${escapeHtml(
                  ball.name ||
                  "Sem nome"
                )}
              </strong>

            </div>

            <div class="id">

              ${escapeHtml(
                ball.id
              )}

            </div>
          `;
        }
      }
    }

    // =====================================
    // POSSE
    // =====================================

    const ballHolder =
      document.querySelector<HTMLDivElement>(
        "#ball-holder"
      );

    if (!ballHolder) {
      return;
    }

    if (
      typeof holderId !==
      "string"
    ) {

      ballHolder.innerHTML = `
        <div class="status warning">
          🟡 Bola livre
        </div>
      `;

    } else {

      const holder =
        items.find(
          (item) =>
            item.id ===
            holderId
        );

      if (holder) {

        ballHolder.innerHTML = `
          <div class="holder">

            ⚽

            <strong>
              ${escapeHtml(
                holder.name ||
                "Sem nome"
              )}
            </strong>

          </div>
        `;

      } else {

        ballHolder.innerHTML = `
          <div class="status warning">
            🟡 Posse desconhecida
          </div>
        `;
      }
    }

    // =====================================
    // HISTÓRICO
    // =====================================

    const passHistory =
      document.querySelector<HTMLDivElement>(
        "#pass-history"
      );

    if (!passHistory) {
      return;
    }

    if (
      !Array.isArray(historyData) ||
      historyData.length === 0
    ) {

      passHistory.innerHTML = `
        <div class="empty">
          Nenhum evento ainda.
        </div>
      `;

      return;
    }

    const history =
      historyData as HistoryEvent[];

    // SOMENTE OS 8 ÚLTIMOS

    const recent =
      [
        ...history,
      ]
        .reverse()
        .slice(
          0,
          VISIBLE_HISTORY
        );

    passHistory.innerHTML =
      recent
        .map(
          (
            event,
            index
          ) => {

            const fromName =
              event.fromName ||
              "Desconhecido";

            const toName =
              event.toName ||
              "Desconhecido";

            let content = "";

            // ---------------------------------
            // INTERCEPTAÇÃO
            // ---------------------------------

            if (
              event.type === "interception" ||
              event.type === "steal"
            ) {

              content = `
                <span class="pass-ball">
                  🛡️
                </span>

                <strong>
                  ${escapeHtml(
                    toName
                  )}
                </strong>

                <span class="arrow">
                  interceptou
                </span>

                <strong>
                  ${escapeHtml(
                    fromName
                  )}
                </strong>
              `;

            }

            // ---------------------------------
            // CHUTE
            // ---------------------------------

            else if (event.type === "shot") {

              content = `
                <span class="pass-ball">
                  🎯
                </span>

                <strong>
                  ${escapeHtml(fromName)}
                </strong>

                <span class="arrow">
                  ${event.result === "goal"
                    ? "GOOOOOL"
                    : event.result === "shot"
                      ? "chute a gol"
                      : "Realizou um chute e......"}
                </span>
              `;
            }

            // ---------------------------------
            // PASSE
            // ---------------------------------

            else {

              content = `
                <span class="pass-ball">
                  ⚽
                </span>

                <strong>
                  ${escapeHtml(
                    fromName
                  )}
                </strong>

                <span class="arrow">
                  deu assistência para
                </span>

                <strong>
                  ${escapeHtml(
                    toName
                  )}
                </strong>

                ${event.assist ? '<span class="assist-badge">ASSISTÊNCIA</span>' : ""}
              `;
            }

            const realIndex =
              history.length - 1 - index;

            const passAssistButtons =
              isGM && event.type === "pass"
                ? `
                  <div class="assist-settings">
                    <button
                      class="assist-settings-toggle"
                      data-assist-menu="${realIndex}"
                      title="Alterar assistência"
                      aria-label="Alterar assistência"
                    >
                      ⚙
                    </button>

                    <div
                      class="assist-settings-menu"
                      data-assist-menu-panel="${realIndex}"
                      hidden
                    >
                      <button
                        class="assist-result assist-result-on"
                        data-index="${realIndex}"
                        data-assist="true"
                      >
                        ASSISTÊNCIA
                      </button>
                      <button
                        class="assist-result assist-result-off"
                        data-index="${realIndex}"
                        data-assist="false"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                `
                : "";

            const shotButtons =
              isGM && event.type === "shot"
                ? `
                  <div class="shot-settings">
                    <button
                      class="shot-settings-toggle"
                      data-shot-menu="${realIndex}"
                      title="Alterar resultado do chute"
                      aria-label="Alterar resultado do chute"
                    >
                      ⚙
                    </button>

                    <div
                      class="shot-settings-menu"
                      data-shot-menu-panel="${realIndex}"
                      hidden
                    >
                      <button
                        class="shot-result shot-result-shot"
                        data-index="${realIndex}"
                        data-result="shot"
                      >
                        Chute a gol
                      </button>
                      <button
                        class="shot-result shot-result-goal"
                        data-index="${realIndex}"
                        data-result="goal"
                      >
                        GOOOOL
                      </button>
                    </div>
                  </div>
                `
                : "";

            const deleteButton =
              isGM
                ? `
                  <button
                    class="delete-pass"
                    data-index="${index}"
                    title="Excluir este evento"
                  >
                    🗑
                  </button>
                `
                : "";

            return `
              <div class="pass">

                <div class="pass-info">

                  ${content}

                </div>

                ${passAssistButtons}
                ${shotButtons}

                ${deleteButton}

              </div>
            `;
          }
        )
        .join("");

    if (isGM) {
      setupIndividualDeleteButtons();
      setupShotResultButtons();
      setupShotSettings();
      setupPassAssistButtons();
      setupPassAssistSettings();
    }

  } catch (error) {

    console.error(
      "Erro ao atualizar painel:",
      error
    );
  }
}

// =========================================
// ESCAPAR HTML
// =========================================

function escapeHtml(
  value: string
) {

  return value
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

// =========================================
// OWLBEAR
// =========================================

OBR.onReady(() => {

  setupContextMenu();

  setupPassMode();

  void setupPanel();

});
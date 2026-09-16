import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { setupContextMenu } from "./contextMenu";
import { setupPassMode } from "./passMode";

const ID = "com.bluelock.ball";
const VISIBLE_HISTORY = 8;

const app = document.querySelector<HTMLDivElement>("#app")!;

type HistoryEvent = {
  type: "pass" | "interception" | "steal";
  from: string;
  to: string;
  fromName?: string;
  toName?: string;
  time?: number;
};

type PlayerInfo = {
  id: string;
  name: string;
};

let currentGMTab: "match" | "manage" = "match";

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
          <div>
            <h1>⚽ Blue Lock Ball</h1>
            <div class="subtitle">MATCH CONTROL</div>
          </div>
        </div>

        <div class="gm-tabs">
          <button id="tab-match" class="gm-tab active">
            📊 Partida
          </button>

          <button id="tab-manage" class="gm-tab">
            👑 Gerenciar
          </button>
        </div>

        <div id="gm-content"></div>

      </div>
    `;

    setupGMTabs();
    await renderGMTab();
  } else {
    app.innerHTML = `
      <div class="panel">

        <div class="header">
          <div>
            <h1>⚽ Blue Lock Ball</h1>
            <div class="subtitle">MATCH CONTROL</div>
          </div>
        </div>

        <section>
          <h2>Posse Atual</h2>

          <div id="ball-holder">
            Carregando...
          </div>
        </section>

        <section>
          <div class="history-header">
            <h2>Histórico</h2>
          </div>

          <div id="pass-history">
            Nenhum evento ainda.
          </div>
        </section>

        <div class="player-help">
          <strong>⚽ Passe</strong>
          <br>
          Clique com o botão direito no seu personagem.
          <br><br>

          <strong>🛡️ Interceptar</strong>
          <br>
          Selecione seu personagem e escolha
          "Interceptar".
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

  if (isGM) {
    OBR.party.onChange(async () => {
      await renderGMTab();
      await renderPanel(true);
    });
  }
}

// =========================================
// ABAS DO GM
// =========================================

function setupGMTabs() {
  const matchTab =
    document.querySelector<HTMLButtonElement>("#tab-match");

  const manageTab =
    document.querySelector<HTMLButtonElement>("#tab-manage");

  matchTab?.addEventListener("click", async () => {
    currentGMTab = "match";
    updateGMTabs();

    await renderGMTab();
    await renderPanel(true);
  });

  manageTab?.addEventListener("click", async () => {
    currentGMTab = "manage";
    updateGMTabs();

    await renderGMTab();
    await renderPanel(true);
  });
}

function updateGMTabs() {
  const matchTab =
    document.querySelector<HTMLButtonElement>("#tab-match");

  const manageTab =
    document.querySelector<HTMLButtonElement>("#tab-manage");

  matchTab?.classList.toggle(
    "active",
    currentGMTab === "match"
  );

  manageTab?.classList.toggle(
    "active",
    currentGMTab === "manage"
  );
}

async function renderGMTab() {
  const content =
    document.querySelector<HTMLDivElement>("#gm-content");

  if (!content) return;

  if (currentGMTab === "match") {
    content.innerHTML = `
      <div class="gm-content">

        <section>
          <h2>Status da Bola</h2>

          <div id="ball-status">
            Carregando...
          </div>
        </section>

        <section>
          <h2>Posse Atual</h2>

          <div id="ball-holder">
            Carregando...
          </div>
        </section>

        <section>
          <div class="history-header">
            <h2>Histórico</h2>

            <div class="history-actions">
              <button
                id="export-history"
                class="icon-button"
                title="Exportar histórico"
              >
                📄
              </button>

              <button
                id="clear-history"
                class="icon-button danger-button"
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
    content.innerHTML = `
      <div class="gm-content">

        <section>
          <div class="section-top">
            <div>
              <h2>👥 Jogadores</h2>
              <div class="section-description">
                Personagens atribuídos a cada jogador.
              </div>
            </div>
          </div>

          <div id="owner-list">
            Carregando...
          </div>
        </section>

        <section>
          <h2>⚽ Bola</h2>

          <div id="manage-ball-status">
            Carregando...
          </div>
        </section>

      </div>
    `;

    await renderGMManage();
  }
}

// =========================================
// GERENCIAMENTO DE DONOS
// =========================================

async function getConnectedPlayers(): Promise<PlayerInfo[]> {
  const players = await OBR.party.getPlayers();

  return players
    .map((player) => {
      const storedName =
        player.metadata?.[`${ID}/name`];

      return {
        id: player.id,

        name:
          typeof storedName === "string" &&
          storedName.trim()
            ? storedName
            : player.name || "Jogador",
      };
    })
    .sort((a, b) =>
      a.name.localeCompare(
        b.name,
        "pt-BR"
      )
    );
}

async function renderGMManage() {
  const container =
    document.querySelector<HTMLDivElement>(
      "#owner-list"
    );

  const ballStatus =
    document.querySelector<HTMLDivElement>(
      "#manage-ball-status"
    );

  if (!container || !ballStatus) return;

  const items =
    await OBR.scene.items.getItems();

  const characters = items.filter(
    (item) =>
      item.layer === "CHARACTER"
  );

  const players =
    await getConnectedPlayers();

  // =========================================
  // SINCRONIZAR DONOS AUTOMÁTICOS
  // =========================================

  for (const character of characters) {
    const metadata = character.metadata || {};

    const currentOwner =
      metadata[`${ID}/ownerId`];

    const creatorId =
      character.createdUserId;

    if (
      typeof currentOwner !== "string" &&
      typeof creatorId === "string"
    ) {
      await OBR.scene.items.updateItems(
        [character.id],
        (items) => {
          for (const item of items) {
            item.metadata[`${ID}/ownerId`] =
              creatorId;
          }
        }
      );
    }
  }

  // Buscar novamente após sincronização
  const updatedItems =
    await OBR.scene.items.getItems();

  const updatedCharacters =
    updatedItems.filter(
      (item) =>
        item.layer === "CHARACTER"
    );

  // =========================================
  // AGRUPAR
  // =========================================

  const assigned = new Map<
    string,
    typeof updatedCharacters
  >();

  for (const player of players) {
    assigned.set(
      player.id,
      []
    );
  }

  const unassigned: typeof updatedCharacters = [];

  for (const character of updatedCharacters) {
    const ownerId =
      character.metadata?.[
        `${ID}/ownerId`
      ];

    if (
      typeof ownerId === "string" &&
      assigned.has(ownerId)
    ) {
      assigned
        .get(ownerId)!
        .push(character);
    } else {
      unassigned.push(character);
    }
  }

  // =========================================
  // HTML
  // =========================================

  let html = "";

  for (const player of players) {
    const playerCharacters =
      assigned.get(player.id) || [];

    html += `
      <div class="owner-player">

        <div class="owner-player-header">

          <div class="owner-player-name">
            👤 ${escapeHtml(player.name)}
          </div>

          <div class="owner-token-count">
            ${playerCharacters.length}
            ${
              playerCharacters.length === 1
                ? "personagem"
                : "personagens"
            }
          </div>

        </div>
    `;

    if (playerCharacters.length === 0) {
      html += `
        <div class="owner-empty">
          Nenhum personagem atribuído.
        </div>
      `;
    } else {
      for (const character of playerCharacters) {
        html += `
          <div class="owner-token owner-assigned">

            <div class="owner-token-info">

              <div class="owner-token-name">
                ${escapeHtml(
                  character.name ||
                    "Sem nome"
                )}
              </div>

              <div class="owner-token-status">
                🟢 Dono definido
              </div>

            </div>

          </div>
        `;
      }
    }

    html += `</div>`;
  }

  // =========================================
  // SEM DONO
  // =========================================

  html += `
    <div class="owner-player unassigned">

      <div class="owner-player-header">

        <div class="owner-player-name">
          ⚠️ Sem dono
        </div>

        <div class="owner-token-count">
          ${unassigned.length}
        </div>

      </div>
  `;

  if (unassigned.length === 0) {
    html += `
      <div class="owner-empty">
        Todos os personagens possuem dono.
      </div>
    `;
  } else {
    for (const character of unassigned) {
      html += `
        <div class="owner-token owner-unassigned">

          <div class="owner-token-info">

            <div class="owner-token-name">
              ${escapeHtml(
                character.name ||
                  "Sem nome"
              )}
            </div>

            <div class="owner-token-status">
              🔴 Precisa definir dono pelo menu do token
            </div>

          </div>

        </div>
      `;
    }
  }

  html += `</div>`;

  container.innerHTML = html;

  // =========================================
  // STATUS DA BOLA
  // =========================================

  const metadata =
    await OBR.scene.getMetadata();

  const ballId =
    metadata[`${ID}/ball`];

  if (
    typeof ballId !== "string"
  ) {
    ballStatus.innerHTML = `
      <div class="status danger">
        🔴 Nenhuma bola definida
      </div>
    `;
    return;
  }

  const ball =
    updatedItems.find(
      (item) =>
        item.id === ballId
    );

  if (!ball) {
    ballStatus.innerHTML = `
      <div class="status danger">
        🔴 Bola não encontrada
      </div>
    `;
    return;
  }

  const holderId =
    metadata[`${ID}/holder`];

  const holder =
    updatedItems.find(
      (item) =>
        item.id === holderId
    );

  ballStatus.innerHTML = `
    <div class="gm-ball-row">

      <div>
        <strong>🟢 Bola definida</strong>

        <div class="small-text">
          ${escapeHtml(
            ball.name ||
              "Bola"
          )}
        </div>
      </div>

      <div class="ball-holder-small">
        ${
          holder
            ? `⚽ ${escapeHtml(
                holder.name ||
                  "Sem nome"
              )}`
            : "⚪ Sem posse"
        }
      </div>

    </div>
  `;
}

// =========================================
// HISTÓRICO
// =========================================

function setupHistoryButtons() {
  const clearButton =
    document.querySelector<HTMLButtonElement>(
      "#clear-history"
    );

  clearButton?.addEventListener(
    "click",
    async () => {
      const confirmed =
        confirm(
          "⚠️ Tem certeza que deseja apagar TODO o histórico da partida?"
        );

      if (!confirmed) return;

      await OBR.scene.setMetadata({
        [`${ID}/history`]: [],
      });
    }
  );

  const exportButton =
    document.querySelector<HTMLButtonElement>(
      "#export-history"
    );

  exportButton?.addEventListener(
    "click",
    () => {
      void exportHistory();
    }
  );
}

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

    const stats = new Map<
      string,
      {
        name: string;
        passes: number;
        interceptions: number;
      }
    >();

    for (const event of history) {
      const fromName =
        event.fromName ||
        "Desconhecido";

      const toName =
        event.toName ||
        "Desconhecido";

      if (event.type === "pass") {
        const existing =
          stats.get(event.from);

        if (existing) {
          existing.passes++;
        } else {
          stats.set(
            event.from,
            {
              name: fromName,
              passes: 1,
              interceptions: 0,
            }
          );
        }
      }

      if (
        event.type === "interception" ||
        event.type === "steal"
      ) {
        const existing =
          stats.get(event.to);

        if (existing) {
          existing.interceptions++;
        } else {
          stats.set(
            event.to,
            {
              name: toName,
              passes: 0,
              interceptions: 1,
            }
          );
        }
      }
    }

    let text =
      "BLUE LOCK RPG\n";

    text +=
      "RELATÓRIO DA PARTIDA\n";

    text +=
      "========================================\n\n";

    text +=
      `Data: ${new Date().toLocaleDateString(
        "pt-BR"
      )}\n`;

    text +=
      `Hora: ${new Date().toLocaleTimeString(
        "pt-BR"
      )}\n`;

    text +=
      `Total de eventos: ${history.length}\n\n`;

    text +=
      "========================================\n";

    text +=
      "ESTATÍSTICAS\n";

    text +=
      "========================================\n\n";

    for (const player of stats.values()) {
      text +=
        `${player.name}\n`;

      text +=
        `  Passes: ${player.passes}\n`;

      text +=
        `  Desarmes/Interceptações: ${player.interceptions}\n\n`;
    }

    text +=
      "========================================\n";

    text +=
      "HISTÓRICO COMPLETO\n";

    text +=
      "========================================\n\n";

    history.forEach(
      (event, index) => {
        const fromName =
          event.fromName ||
          "Desconhecido";

        const toName =
          event.toName ||
          "Desconhecido";

        if (event.type === "pass") {
          text +=
            `${String(index + 1).padStart(
              3,
              "0"
            )}. ⚽ ${fromName} → ${toName}\n`;
        } else {
          text +=
            `${String(index + 1).padStart(
              3,
              "0"
            )}. 🛡️ ${toName} interceptou ${fromName}\n`;
        }
      }
    );

    const blob =
      new Blob(
        [text],
        {
          type:
            "text/plain;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `blue-lock-partida-${new Date()
        .toLocaleDateString("pt-BR")
        .replaceAll("/", "-")}.txt`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

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
// RENDERIZAR PAINEL
// =========================================

async function renderPanel(
  isGM: boolean
) {
  try {
    const metadata =
      await OBR.scene.getMetadata();

    const ballId =
      metadata[`${ID}/ball`];

    const holderId =
      metadata[`${ID}/holder`];

    const historyData =
      metadata[`${ID}/history`];

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

      if (ballStatus) {
        if (
          typeof ballId !== "string"
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
                item.id === ballId
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
                ${escapeHtml(
                  ball.name ||
                    "Sem nome"
                )}
              </div>
            `;
          }
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

    if (ballHolder) {
      if (
        typeof holderId !== "string"
      ) {
        ballHolder.innerHTML = `
          <div class="status neutral">
            ⚪ Ninguém está com a bola
          </div>
        `;
      } else {
        const holder =
          items.find(
            (item) =>
              item.id === holderId
          );

        if (!holder) {
          ballHolder.innerHTML = `
            <div class="status danger">
              🔴 Jogador não encontrado
            </div>
          `;
        } else {
          ballHolder.innerHTML = `
            <div class="holder-card">
              <span class="holder-ball">⚽</span>

              <div>
                <div class="holder-label">
                  POSSE ATUAL
                </div>

                <strong>
                  ${escapeHtml(
                    holder.name ||
                      "Sem nome"
                  )}
                </strong>
              </div>
            </div>
          `;
        }
      }
    }

    // =====================================
    // HISTÓRICO
    // =====================================

    const history =
      Array.isArray(historyData)
        ? historyData as HistoryEvent[]
        : [];

    const historyContainer =
      document.querySelector<HTMLDivElement>(
        "#pass-history"
      );

    if (!historyContainer) return;

    if (history.length === 0) {
      historyContainer.innerHTML = `
        <div class="history-empty">
          Nenhum evento ainda.
        </div>
      `;
      return;
    }

    const visibleHistory =
      history
        .slice(-VISIBLE_HISTORY)
        .reverse();

    historyContainer.innerHTML =
      visibleHistory
        .map(
          (event) => {
            const fromName =
              event.fromName ||
              "Desconhecido";

            const toName =
              event.toName ||
              "Desconhecido";

            const content =
              event.type === "pass"
                ? `
                  <span class="pass-ball">
                    ⚽
                  </span>

                  <strong>
                    ${escapeHtml(fromName)}
                  </strong>

                  <span class="arrow">
                    →
                  </span>

                  <strong>
                    ${escapeHtml(toName)}
                  </strong>
                `
                : `
                  <span class="pass-ball">
                    🛡️
                  </span>

                  <strong>
                    ${escapeHtml(toName)}
                  </strong>

                  <span class="arrow">
                    interceptou
                  </span>

                  <strong>
                    ${escapeHtml(fromName)}
                  </strong>
                `;

            return `
              <div class="pass">
                <div class="pass-info">
                  ${content}
                </div>
              </div>
            `;
          }
        )
        .join("");

  } catch (error) {
    console.error(
      "❌ Erro ao atualizar painel:",
      error
    );
  }
}

// =========================================
// ESCAPAR HTML
// =========================================

function escapeHtml(
  value: string
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =========================================
// OWLBEAR
// =========================================

OBR.onReady(() => {
  setupContextMenu();
  setupPassMode();
  void setupPanel();
});
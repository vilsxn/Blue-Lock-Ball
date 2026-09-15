import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { setupContextMenu } from "./contextMenu";
import { setupPassMode } from "./passMode";

const ID = "com.bluelock.ball";
const VISIBLE_HISTORY = 8;

const app =
  document.querySelector<HTMLDivElement>("#app")!;

// =========================================
// TIPOS
// =========================================

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
          <h1>⚽ Blue Lock Ball</h1>
          <div class="subtitle">MATCH CONTROL</div>
        </div>

        <div class="gm-tabs">
          <button
            id="tab-match"
            class="gm-tab active"
          >
            📊 Partida
          </button>

          <button
            id="tab-manage"
            class="gm-tab"
          >
            👑 Gerenciar
          </button>
        </div>

        <div id="gm-content"></div>

      </div>
    `;

    setupGMTabs();
  } else {
    app.innerHTML = `
      <div class="panel">

        <div class="header">
          <h1>⚽ Blue Lock Ball</h1>
          <div class="subtitle">MATCH CONTROL</div>
        </div>

        <section>
          <h2>Posse Atual</h2>

          <div id="ball-holder">
            Carregando...
          </div>
        </section>

        <section>
          <div class="history-header">
            <h2>Histórico da Partida</h2>
          </div>

          <div id="pass-history">
            Nenhum evento ainda.
          </div>
        </section>

        <div class="player-help">
          ⚽ Para passar a bola, clique com o botão direito
          no seu personagem.

          <br><br>

          🛡️ Para interceptar, selecione seu personagem
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

  if (isGM) {
    OBR.party.onChange(() => {
      if (currentGMTab === "manage") {
        void renderGMManage();
      }
    });
  }
}

// =========================================
// ABAS DO GM
// =========================================

function setupGMTabs() {
  const matchTab =
    document.querySelector<HTMLButtonElement>(
      "#tab-match"
    );

  const manageTab =
    document.querySelector<HTMLButtonElement>(
      "#tab-manage"
    );

  matchTab?.addEventListener("click", () => {
    currentGMTab = "match";

    updateGMTabButtons();
    void renderGMMatch();
  });

  manageTab?.addEventListener("click", () => {
    currentGMTab = "manage";

    updateGMTabButtons();
    void renderGMManage();
  });
}

function updateGMTabButtons() {
  const matchTab =
    document.querySelector<HTMLButtonElement>(
      "#tab-match"
    );

  const manageTab =
    document.querySelector<HTMLButtonElement>(
      "#tab-manage"
    );

  matchTab?.classList.toggle(
    "active",
    currentGMTab === "match"
  );

  manageTab?.classList.toggle(
    "active",
    currentGMTab === "manage"
  );
}

// =========================================
// ABA PARTIDA
// =========================================

async function renderGMMatch() {
  const content =
    document.querySelector<HTMLDivElement>(
      "#gm-content"
    );

  if (!content) return;

  content.innerHTML = `
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
        <h2>Histórico da Partida</h2>

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
  `;

  setupHistoryButtons();

  await renderMatchData();
}

// =========================================
// DADOS DA PARTIDA
// =========================================

async function renderMatchData() {
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

  // =======================================
  // STATUS DA BOLA
  // =======================================

  const ballStatus =
    document.querySelector<HTMLDivElement>(
      "#ball-status"
    );

  if (ballStatus) {
    if (typeof ballId !== "string") {
      ballStatus.innerHTML = `
        <div class="status danger">
          🔴 Nenhuma bola definida
        </div>
      `;
    } else {
      const ball =
        items.find(
          (item) => item.id === ballId
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
                ball.name || "Sem nome"
              )}
            </strong>
          </div>
        `;
      }
    }
  }

  // =======================================
  // POSSE
  // =======================================

  renderHolder(
    items,
    holderId
  );

  // =======================================
  // HISTÓRICO
  // =======================================

  renderHistory(
    historyData,
    true
  );
}

// =========================================
// ABA GERENCIAR
// =========================================

async function renderGMManage() {
  const content =
    document.querySelector<HTMLDivElement>(
      "#gm-content"
    );

  if (!content) return;

  const players =
    await getConnectedPlayers();

  const items =
    await OBR.scene.items.getItems();

  const characters =
    items.filter(
      (item) =>
        item.layer === "CHARACTER"
    );

  // =======================================
  // AGRUPAR PERSONAGENS POR DONO
  // =======================================

  const groups =
    new Map<string, {
      player: PlayerInfo;
      characters: typeof characters;
    }>();

  for (const player of players) {
    groups.set(player.id, {
      player,
      characters: [],
    });
  }

  const unassigned =
    characters.filter((character) => {
      const ownerId =
        character.metadata?.[
          `${ID}/ownerId`
        ];

      return (
        typeof ownerId !== "string" ||
        !groups.has(ownerId)
      );
    });

  for (const character of characters) {
    const ownerId =
      character.metadata?.[
        `${ID}/ownerId`
      ];

    if (
      typeof ownerId !== "string"
    ) {
      continue;
    }

    const group =
      groups.get(ownerId);

    if (group) {
      group.characters.push(
        character
      );
    }
  }

  // =======================================
  // CABEÇALHO
  // =======================================

  let html = `
    <section class="manage-section">

      <div class="section-top">
        <div>
          <h2>Jogadores</h2>
          <div class="section-description">
            Personagens atribuídos a cada jogador
          </div>
        </div>

        <div class="gm-count">
          ${players.length}
        </div>
      </div>

      <div class="owner-list">
  `;

  // =======================================
  // JOGADORES
  // =======================================

  for (const group of groups.values()) {
    const playerName =
      group.player.name;

    html += `
      <div class="owner-player">

        <div class="owner-player-header">

          <div class="owner-player-name">
            👤 ${escapeHtml(playerName)}
          </div>

          <div class="owner-token-count">
            ${group.characters.length}
          </div>

        </div>

        <div class="owner-token-list">
    `;

    if (
      group.characters.length === 0
    ) {
      html += `
        <div class="owner-empty">
          Nenhum personagem atribuído
        </div>
      `;
    } else {
      for (
        const character of
        group.characters
      ) {
        html += `
          <div class="owner-token">

            <span>
              ⚽ ${escapeHtml(
                character.name ||
                "Sem nome"
              )}
            </span>

            <span class="owner-assigned">
              ATRIBUÍDO
            </span>

          </div>
        `;
      }
    }

    html += `
        </div>
      </div>
    `;
  }

  // =======================================
  // SEM DONO
  // =======================================

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

        <div class="owner-token-list">
  `;

  if (unassigned.length === 0) {
    html += `
      <div class="owner-empty">
        Todos os personagens possuem dono
      </div>
    `;
  } else {
    for (
      const character of
      unassigned
    ) {
      html += `
        <div class="owner-token">

          <span>
            ⚽ ${escapeHtml(
              character.name ||
              "Sem nome"
            )}
          </span>

          <span class="owner-unassigned">
            SEM DONO
          </span>

        </div>
      `;
    }
  }

  html += `
        </div>
      </div>

    </div>

    </section>
  `;

  // =======================================
  // RESUMO DA BOLA
  // =======================================

  const metadata =
    await OBR.scene.getMetadata();

  const ballId =
    metadata[`${ID}/ball`];

  const holderId =
    metadata[`${ID}/holder`];

  const ball =
    items.find(
      (item) => item.id === ballId
    );

  const holder =
    items.find(
      (item) => item.id === holderId
    );

  html += `
    <section>

      <h2>Resumo da Bola</h2>

      <div class="gm-ball-row">
        <span>Bola</span>

        <strong>
          ${
            ball
              ? escapeHtml(
                  ball.name ||
                  "Sem nome"
                )
              : "Não definida"
          }
        </strong>
      </div>

      <div class="gm-ball-row">
        <span>Posse</span>

        <strong>
          ${
            holder
              ? escapeHtml(
                  holder.name ||
                  "Sem nome"
                )
              : "Bola livre"
          }
        </strong>
      </div>

    </section>
  `;

  content.innerHTML = html;
}

// =========================================
// JOGADORES CONECTADOS
// =========================================

async function getConnectedPlayers(): Promise<PlayerInfo[]> {
  const players =
    await OBR.party.getPlayers();

  return players
    .map((player) => {
      const storedName =
        player.metadata?.[
          `${ID}/name`
        ];

      return {
        id: player.id,

        name:
          typeof storedName === "string" &&
          storedName.trim()
            ? storedName
            : player.name ||
              "Jogador",
      };
    })
    .sort((a, b) =>
      a.name.localeCompare(
        b.name,
        "pt-BR"
      )
    );
}

// =========================================
// RENDER HOLDER
// =========================================

function renderHolder(
  items: Awaited<
    ReturnType<
      typeof OBR.scene.items.getItems
    >
  >,
  holderId: unknown
) {
  const holderElement =
    document.querySelector<HTMLDivElement>(
      "#ball-holder"
    );

  if (!holderElement) return;

  if (
    typeof holderId !== "string"
  ) {
    holderElement.innerHTML = `
      <div class="status warning">
        🟡 Bola livre
      </div>
    `;

    return;
  }

  const holder =
    items.find(
      (item) =>
        item.id === holderId
    );

  if (!holder) {
    holderElement.innerHTML = `
      <div class="status warning">
        🟡 Posse desconhecida
      </div>
    `;

    return;
  }

  holderElement.innerHTML = `
    <div class="holder">

      <span class="holder-ball">
        ⚽
      </span>

      <div>
        <div class="holder-label">
          COM A BOLA
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

// =========================================
// HISTÓRICO
// =========================================

function renderHistory(
  historyData: unknown,
  isGM: boolean
) {
  const passHistory =
    document.querySelector<HTMLDivElement>(
      "#pass-history"
    );

  if (!passHistory) return;

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

  const recent =
    [...history]
      .reverse()
      .slice(
        0,
        VISIBLE_HISTORY
      );

  passHistory.innerHTML =
    recent
      .map(
        (event, index) => {
          const fromName =
            event.fromName ||
            "Desconhecido";

          const toName =
            event.toName ||
            "Desconhecido";

          let content = "";

          if (
            event.type ===
              "interception" ||
            event.type === "steal"
          ) {
            content = `
              <span class="event-icon">
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
          } else {
            content = `
              <span class="event-icon">
                ⚽
              </span>

              <strong>
                ${escapeHtml(
                  fromName
                )}
              </strong>

              <span class="arrow">
                passou para
              </span>

              <strong>
                ${escapeHtml(
                  toName
                )}
              </strong>
            `;
          }

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

              ${deleteButton}

            </div>
          `;
        }
      )
      .join("");

  if (isGM) {
    setupIndividualDeleteButtons();
  }
}

// =========================================
// BOTÕES DO HISTÓRICO
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

      console.log(
        "🧹 Histórico apagado."
      );
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

// =========================================
// EXCLUIR EVENTO
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
      !Array.isArray(
        historyData
      )
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

    const description =
      event.type ===
          "interception" ||
        event.type === "steal"
        ? `${toName} interceptou ${fromName}`
        : `${fromName} passou para ${toName}`;

    const confirmed =
      confirm(
        `⚠️ Excluir este evento?\n\n${description}`
      );

    if (!confirmed) return;

    const updatedHistory =
      historyData.filter(
        (_event, i) =>
          i !== realIndex
      );

    await OBR.scene.setMetadata({
      [`${ID}/history`]:
        updatedHistory,
    });

    console.log(
      "🗑 Evento removido."
    );
  } catch (error) {
    console.error(
      "❌ Erro ao excluir evento:",
      error
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
      metadata[
        `${ID}/history`
      ];

    if (
      !Array.isArray(
        historyData
      ) ||
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

    const stats =
      new Map<
        string,
        {
          name: string;
          passes: number;
          interceptions: number;
        }
      >();

    for (const event of history) {
      if (
        event.type === "pass"
      ) {
        const existing =
          stats.get(event.from);

        if (existing) {
          existing.passes++;
        } else {
          stats.set(
            event.from,
            {
              name:
                event.fromName ||
                "Desconhecido",
              passes: 1,
              interceptions: 0,
            }
          );
        }
      }

      if (
        event.type ===
          "interception" ||
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
              name:
                event.toName ||
                "Desconhecido",
              passes: 0,
              interceptions: 1,
            }
          );
        }
      }
    }

    const sortedStats =
      Array.from(
        stats.values()
      ).sort(
        (a, b) => {
          const totalA =
            a.passes +
            a.interceptions;

          const totalB =
            b.passes +
            b.interceptions;

          return (
            totalB - totalA
          );
        }
      );

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

    text +=
      "========================================\n";

    text +=
      "ESTATÍSTICAS\n";

    text +=
      "========================================\n\n";

    if (
      sortedStats.length === 0
    ) {
      text +=
        "Nenhuma estatística registrada.\n\n";
    } else {
      sortedStats.forEach(
        (player, index) => {
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
            `    Desarmes/Interceptações: ${player.interceptions}\n\n`;
        }
      );
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

        if (
          event.type === "pass"
        ) {
          text +=
            `${String(
              index + 1
            ).padStart(
              3,
              "0"
            )}. ⚽ ${fromName} passou para ${toName}\n`;
        } else if (
          event.type ===
            "interception" ||
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
      }
    );

    text +=
      "\n========================================\n";

    text +=
      "Fim do relatório.\n";

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

    console.log(
      "📄 Relatório exportado!"
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
// RENDER GERAL
// =========================================

async function renderPanel(
  isGM: boolean
) {
  try {
    if (!isGM) {
      const metadata =
        await OBR.scene.getMetadata();

      const items =
        await OBR.scene.items.getItems();

      const holderId =
        metadata[
          `${ID}/holder`
        ];

      renderHolder(
        items,
        holderId
      );

      renderHistory(
        metadata[
          `${ID}/history`
        ],
        false
      );

      return;
    }

    if (
      currentGMTab === "match"
    ) {
      await renderGMMatch();
    } else {
      await renderGMManage();
    }
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
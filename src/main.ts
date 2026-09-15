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

        <!-- ABAS DO GM -->

        <div class="gm-tabs">

          <button
            id="tab-match"
            class="gm-tab active"
          >
            📊 Partida
          </button>

          <button
            id="tab-gm"
            class="gm-tab"
          >
            👑 GM
          </button>

        </div>

        <!-- ================================= -->
        <!-- ABA PARTIDA -->
        <!-- ================================= -->

        <div id="gm-match-tab">

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

        <!-- ================================= -->
        <!-- ABA GM -->
        <!-- ================================= -->

        <div
          id="gm-owner-tab"
          style="display: none;"
        >

          <section>

            <div class="history-header">

              <h2>
                Donos dos Personagens
              </h2>

              <span
                id="owner-count"
                class="gm-count"
              >
                0
              </span>

            </div>

            <div id="owner-list">
              Carregando...
            </div>

          </section>

          <section>

            <h2>
              Resumo da Bola
            </h2>

            <div id="gm-ball-summary">
              Carregando...
            </div>

          </section>

          <div class="player-help">

            👑 Esta área é exclusiva do GM.

            <br><br>

            Aqui você pode visualizar qual personagem
            está atribuído a cada jogador.

            <br><br>

            A atribuição dos donos será feita pelo menu
            <strong>👤 Definir dono</strong>.

          </div>

        </div>

      </div>
    `;

    setupGMTabButtons();
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

  if (isGM) {
    OBR.party.onChange(() => {
      void renderGMOwners();
    });
  }
}

// =========================================
// ABAS DO GM
// =========================================

function setupGMTabButtons() {

  const matchTab =
    document.querySelector<HTMLButtonElement>(
      "#tab-match"
    );

  const gmTab =
    document.querySelector<HTMLButtonElement>(
      "#tab-gm"
    );

  const matchContent =
    document.querySelector<HTMLDivElement>(
      "#gm-match-tab"
    );

  const gmContent =
    document.querySelector<HTMLDivElement>(
      "#gm-owner-tab"
    );

  if (
    !matchTab ||
    !gmTab ||
    !matchContent ||
    !gmContent
  ) {
    return;
  }

  matchTab.addEventListener("click", () => {

    matchTab.classList.add("active");
    gmTab.classList.remove("active");

    matchContent.style.display = "block";
    gmContent.style.display = "none";

  });

  gmTab.addEventListener("click", () => {

    matchTab.classList.remove("active");
    gmTab.classList.add("active");

    matchContent.style.display = "none";
    gmContent.style.display = "block";

    void renderGMOwners();

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

        console.log("🧹 Histórico apagado.");
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

        } else {

          stats.set(
            event.from,
            {
              name,
              passes: 1,
              interceptions: 0,
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
            }
          );
        }
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
            a.interceptions;

          const totalB =
            b.passes +
            b.interceptions;

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
            `    Desarmes/Interceptações: ${player.interceptions}\n\n`;
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
            )}. ⚽ ${fromName} passou para ${toName}\n`;

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
        `${fromName} passou para ${toName}`;
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

    } else {

      const history =
        historyData as HistoryEvent[];

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

    // =====================================
    // ABA GM
    // =====================================

    if (isGM) {
      void renderGMOwners();
    }

  } catch (error) {

    console.error(
      "Erro ao atualizar painel:",
      error
    );
  }
}

// =========================================
// LISTA DE DONOS — GM
// =========================================

async function renderGMOwners() {

  try {

    const ownerList =
      document.querySelector<HTMLDivElement>(
        "#owner-list"
      );

    const ownerCount =
      document.querySelector<HTMLSpanElement>(
        "#owner-count"
      );

    const ballSummary =
      document.querySelector<HTMLDivElement>(
        "#gm-ball-summary"
      );

    if (
      !ownerList ||
      !ownerCount ||
      !ballSummary
    ) {
      return;
    }

    const items =
      await OBR.scene.items.getItems();

    // Somente personagens
    const characters =
      items.filter(
        (item) =>
          item.layer === "CHARACTER"
      );

    // Jogadores conectados
    const players =
      await OBR.party.getPlayers();

    // =====================================
    // MAPA DE JOGADORES
    // =====================================

    const playerMap =
      new Map<
        string,
        {
          name: string;
          id: string;
        }
      >();

    for (const player of players) {

      const storedName =
        player.metadata[
          `${ID}/name`
        ];

      const name =
        typeof storedName === "string" &&
        storedName.trim().length > 0
          ? storedName
          : `Jogador ${player.id.slice(0, 6)}`;

      playerMap.set(
        player.id,
        {
          name,
          id: player.id,
        }
      );
    }

    // =====================================
    // AGRUPAR PERSONAGENS
    // =====================================

    const grouped =
      new Map<
        string,
        typeof characters
      >();

    const unassigned: typeof characters = [];

    for (const character of characters) {

      const ownerId =
        character.metadata[
          `${ID}/ownerId`
        ];

      if (
        typeof ownerId !== "string"
      ) {

        unassigned.push(
          character
        );

        continue;
      }

      const existing =
        grouped.get(
          ownerId
        );

      if (existing) {

        existing.push(
          character
        );

      } else {

        grouped.set(
          ownerId,
          [character]
        );
      }
    }

    // =====================================
    // CONTAGEM
    // =====================================

    ownerCount.textContent =
      String(characters.length);

    // =====================================
    // GERAR LISTA
    // =====================================

    let html = "";

    // Jogadores conectados
    for (const player of players) {

      const owned =
        grouped.get(
          player.id
        ) || [];

      const storedName =
        player.metadata[
          `${ID}/name`
        ];

      const playerName =
        typeof storedName === "string" &&
        storedName.trim().length > 0
          ? storedName
          : `Jogador ${player.id.slice(0, 6)}`;

      html += `
        <div class="owner-player">

          <div class="owner-player-header">

            <span class="owner-player-name">
              👤 ${escapeHtml(
                playerName
              )}
            </span>

            <span class="owner-token-count">
              ${owned.length}
            </span>

          </div>

          <div class="owner-token-list">
      `;

      if (owned.length === 0) {

        html += `
            <div class="owner-empty">
              Nenhum personagem atribuído
            </div>
        `;

      } else {

        for (const character of owned) {

          html += `
            <div class="owner-token">

              <span>
                ⚽
                ${escapeHtml(
                  character.name ||
                  "Sem nome"
                )}
              </span>

              <span class="owner-token-id">
                ${escapeHtml(
                  character.id.slice(0, 8)
                )}
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

    // =====================================
    // PERSONAGENS SEM DONO
    // =====================================

    if (unassigned.length > 0) {

      html += `
        <div class="owner-player unassigned">

          <div class="owner-player-header">

            <span class="owner-player-name">
              ⚠️ Sem dono
            </span>

            <span class="owner-token-count">
              ${unassigned.length}
            </span>

          </div>

          <div class="owner-token-list">
      `;

      for (const character of unassigned) {

        html += `
          <div class="owner-token">

            <span>
              ⚠️
              ${escapeHtml(
                character.name ||
                "Sem nome"
              )}
            </span>

            <span class="owner-token-id">
              ${escapeHtml(
                character.id.slice(0, 8)
              )}
            </span>

          </div>
        `;
      }

      html += `
          </div>

        </div>
      `;
    }

    if (
      characters.length === 0
    ) {

      html = `
        <div class="empty">
          Nenhum personagem encontrado.
        </div>
      `;
    }

    ownerList.innerHTML =
      html;

    // =====================================
    // RESUMO DA BOLA
    // =====================================

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

    const ball =
      typeof ballId === "string"
        ? items.find(
            (item) =>
              item.id === ballId
          )
        : undefined;

    const holder =
      typeof holderId === "string"
        ? items.find(
            (item) =>
              item.id === holderId
          )
        : undefined;

    ballSummary.innerHTML = `
      <div class="gm-ball-row">

        <span>
          ⚽ Bola
        </span>

        <strong>
          ${escapeHtml(
            ball?.name ||
            "Nenhuma definida"
          )}
        </strong>

      </div>

      <div class="gm-ball-row">

        <span>
          🏃 Posse
        </span>

        <strong>
          ${escapeHtml(
            holder?.name ||
            "Bola livre"
          )}
        </strong>

      </div>
    `;

  } catch (error) {

    console.error(
      "❌ Erro ao renderizar donos:",
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
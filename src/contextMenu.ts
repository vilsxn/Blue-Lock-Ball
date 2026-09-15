import OBR from "@owlbear-rodeo/sdk";
import { startPass, startInterception } from "./passMode";

const ID = "com.bluelock.ball";

// Ícone das ações
const ICON = "/blue-lock-icon.png?v=2";

// =========================================
// REGISTRAR NOME DO JOGADOR
// =========================================

async function registerPlayerName() {
  try {
    const name = await OBR.player.getName();

    await OBR.player.setMetadata({
      [`${ID}/name`]: name,
    });

    console.log(
      "👤 Nome registrado na extensão:",
      name
    );
  } catch (error) {
    console.error(
      "❌ Erro ao registrar nome do jogador:",
      error
    );
  }
}

// =========================================
// INICIALIZAR DONOS AUTOMATICAMENTE
// =========================================

async function initializeOwners() {
  try {
    const role = await OBR.player.getRole();

    // Somente o GM faz essa inicialização
    if (role !== "GM") {
      return;
    }

    const items =
      await OBR.scene.items.getItems();

    const characters =
      items.filter(
        (item) =>
          item.layer === "CHARACTER"
      );

    const unassigned =
      characters.filter((item) => {

        const ownerId =
          item.metadata[
            `${ID}/ownerId`
          ];

        return (
          typeof ownerId !== "string" &&
          typeof item.createdUserId === "string"
        );
      });

    if (unassigned.length === 0) {
      return;
    }

    await OBR.scene.items.updateItems(
      unassigned.map(
        (item) => item.id
      ),
      (items) => {

        for (const item of items) {

          const ownerId =
            item.metadata[
              `${ID}/ownerId`
            ];

          if (
            typeof ownerId !== "string" &&
            typeof item.createdUserId === "string"
          ) {

            item.metadata[
              `${ID}/ownerId`
            ] =
              item.createdUserId;
          }
        }
      }
    );

    console.log(
      `👤 ${unassigned.length} personagem(ns) receberam dono automaticamente.`
    );

  } catch (error) {

    console.error(
      "❌ Erro ao inicializar donos:",
      error
    );
  }
}

// =========================================
// VERIFICAR DONO
// =========================================

async function isCharacterOwner(
  item: typeof OBR.scene.items extends never
    ? never
    : any
): Promise<boolean> {

  const role =
    await OBR.player.getRole();

  // GM sempre pode
  if (role === "GM") {
    return true;
  }

  const ownerId =
    item.metadata[
      `${ID}/ownerId`
    ];

  return (
    ownerId ===
    OBR.player.id
  );
}

// =========================================
// CONFIGURAR MENU
// =========================================

export function setupContextMenu() {

  // Registra o nome desse jogador
  void registerPlayerName();

  // Inicializa donos automaticamente
  void initializeOwners();

  // =========================================
  // DEFINIR BOLA
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/define-ball`,
    icons: [
      {
        icon: ICON,
        label: "⚽ Definir como bola (GM)",
        filter: {
          max: 1,
          roles: ["GM"],
        },
      },
    ],

    async onClick(context) {

      const selectedItem =
        context.items[0];

      if (!selectedItem) {
        return;
      }

      await OBR.scene.setMetadata({
        [`${ID}/ball`]:
          selectedItem.id,

        [`${ID}/holder`]:
          undefined,
      });

      console.log(
        "⚽ Bola definida:",
        selectedItem.id
      );
    },
  });

  // =========================================
  // DAR POSSE
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/give-ball`,

    icons: [
      {
        icon: ICON,
        label: "⚽ Dar posse (GM)",

        filter: {
          max: 1,
          roles: ["GM"],
        },
      },
    ],

    async onClick(context) {

      const player =
        context.items[0];

      if (!player) {
        return;
      }

      const metadata =
        await OBR.scene.getMetadata();

      const ballId =
        metadata[
          `${ID}/ball`
        ];

      if (
        typeof ballId !== "string"
      ) {

        console.log(
          "❌ Nenhuma bola foi definida."
        );

        return;
      }

      const items =
        await OBR.scene.items.getItems();

      const ball =
        items.find(
          (item) =>
            item.id === ballId
        );

      if (!ball) {

        console.log(
          "❌ Bola não encontrada."
        );

        return;
      }

      await OBR.scene.items.updateItems(
        [ball.id],
        (items) => {

          for (const item of items) {

            item.attachedTo =
              player.id;
          }
        }
      );

      await OBR.scene.setMetadata({
        [`${ID}/holder`]:
          player.id,
      });

      console.log(
        "⚽ Posse dada para:",
        player.name
      );
    },
  });

  // =========================================
  // SOLTAR BOLA
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/release-ball`,

    icons: [
      {
        icon: ICON,
        label: "🔓 Soltar bola (GM)",

        filter: {
          max: 1,
          roles: ["GM"],
        },
      },
    ],

    async onClick(context) {

      const selectedItem =
        context.items[0];

      if (!selectedItem) {
        return;
      }

      const metadata =
        await OBR.scene.getMetadata();

      const ballId =
        metadata[
          `${ID}/ball`
        ];

      if (
        typeof ballId !== "string"
      ) {

        console.log(
          "❌ Nenhuma bola foi definida."
        );

        return;
      }

      const items =
        await OBR.scene.items.getItems();

      const ball =
        items.find(
          (item) =>
            item.id === ballId
        );

      if (!ball) {

        console.log(
          "❌ Bola não encontrada."
        );

        return;
      }

      await OBR.scene.items.updateItems(
        [ball.id],
        (items) => {

          for (const item of items) {

            item.attachedTo =
              undefined;
          }
        }
      );

      await OBR.scene.setMetadata({
        [`${ID}/holder`]:
          undefined,
      });

      console.log(
        "🔓 Bola desanexada!"
      );
    },
  });

  // =========================================
  // PASSAR BOLA
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/pass-ball`,

    icons: [

      // -------------------------------------
      // GM
      // -------------------------------------

      {
        icon: ICON,
        label: "⚽ Passar bola",

        filter: {
          max: 1,
          roles: ["GM"],

          every: [
            {
              key: "layer",
              value: "CHARACTER",
            },
          ],
        },
      },

      // -------------------------------------
      // PLAYER
      // -------------------------------------

      {
        icon: ICON,
        label: "⚽ Passar bola",

        filter: {
          max: 1,
          roles: ["PLAYER"],

          every: [
            {
              key: "layer",
              value: "CHARACTER",
            },

            {
              key: [
                "metadata",
                `${ID}/ownerId`,
              ],

              value:
                OBR.player.id,
            },
          ],
        },
      },
    ],

    async onClick(context) {

      const player =
        context.items[0];

      if (!player) {
        return;
      }

      // =====================================
      // SEGUNDA BARREIRA DE SEGURANÇA
      // =====================================

      const canControl =
        await isCharacterOwner(
          player
        );

      if (!canControl) {

        console.log(
          "❌ Você não é o dono deste personagem."
        );

        return;
      }

      // =====================================
      // VERIFICAR POSSE
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

      if (
        typeof ballId !== "string"
      ) {

        console.log(
          "❌ Não existe uma bola definida."
        );

        return;
      }

      if (
        holderId !== player.id
      ) {

        console.log(
          "❌ Este jogador não está com a bola."
        );

        console.log(
          "👤 Selecionado:",
          player.id
        );

        console.log(
          "⚽ Dono da bola:",
          holderId
        );

        return;
      }

      console.log(
        "⚽ Passe iniciado por:",
        player.name
      );

      startPass(
        player.id
      );
    },
  });

  // =========================================
  // INTERCEPTAR
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/intercept-ball`,

    icons: [

      // -------------------------------------
      // GM
      // -------------------------------------

      {
        icon: ICON,
        label: "🛡️ Interceptar",

        filter: {
          max: 1,
          roles: ["GM"],

          every: [
            {
              key: "layer",
              value: "CHARACTER",
            },
          ],
        },
      },

      // -------------------------------------
      // PLAYER
      // -------------------------------------

      {
        icon: ICON,
        label: "🛡️ Interceptar",

        filter: {
          max: 1,
          roles: ["PLAYER"],

          every: [
            {
              key: "layer",
              value: "CHARACTER",
            },

            {
              key: [
                "metadata",
                `${ID}/ownerId`,
              ],

              value:
                OBR.player.id,
            },
          ],
        },
      },
    ],

    async onClick(context) {

      const interceptor =
        context.items[0];

      if (!interceptor) {
        return;
      }

      // =====================================
      // SEGUNDA BARREIRA DE SEGURANÇA
      // =====================================

      const canControl =
        await isCharacterOwner(
          interceptor
        );

      if (!canControl) {

        console.log(
          "❌ Você não é o dono deste personagem."
        );

        return;
      }

      // =====================================
      // VERIFICAR BOLA
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

      if (
        typeof ballId !== "string"
      ) {

        console.log(
          "❌ Não existe uma bola definida."
        );

        return;
      }

      if (
        typeof holderId !== "string"
      ) {

        console.log(
          "❌ Ninguém está com a posse da bola."
        );

        return;
      }

      if (
        holderId ===
        interceptor.id
      ) {

        console.log(
          "❌ Este jogador já está com a bola."
        );

        return;
      }

      console.log(
        `🛡️ ${interceptor.name} vai interceptar a bola de quem estiver com a posse.`
      );

      startInterception(
        interceptor.id
      );
    },
  });

  // =========================================
  // DEFINIR DONO
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/define-owner`,

    icons: [
      {
        icon: ICON,
        label: "👤 Definir dono (GM)",

        filter: {
          max: 1,
          roles: ["GM"],

          every: [
            {
              key: "layer",
              value: "CHARACTER",
            },
          ],
        },
      },
    ],

    async onClick(context) {

      const selectedItem =
        context.items[0];

      if (!selectedItem) {
        return;
      }

      // =====================================
      // JOGADORES CONECTADOS
      // =====================================

      const players =
        await OBR.party.getPlayers();

      if (
        players.length === 0
      ) {

        alert(
          "⚠️ Nenhum jogador conectado."
        );

        return;
      }

      // =====================================
      // MONTAR LISTA
      // =====================================

      const playerOptions =
        players
          .map(
            (
              player,
              index
            ) => {

              const storedName =
                player.metadata[
                  `${ID}/name`
                ];

              const name =
                typeof storedName === "string" &&
                storedName.trim().length > 0
                  ? storedName
                  : `Jogador ${player.id.slice(0, 6)}`;

              return `${index + 1}. ${name}`;
            }
          )
          .join("\n");

      const answer =
        window.prompt(
          `👤 Escolha o dono de "${selectedItem.name || "Sem nome"}":\n\n${playerOptions}\n\nDigite o número do jogador:`
        );

      if (
        answer === null
      ) {
        return;
      }

      const selectedNumber =
        Number(answer);

      const playerIndex =
        selectedNumber - 1;

      if (
        !Number.isInteger(
          selectedNumber
        ) ||
        playerIndex < 0 ||
        playerIndex >= players.length
      ) {

        alert(
          "❌ Número de jogador inválido."
        );

        return;
      }

      const selectedPlayer =
        players[playerIndex];

      const storedName =
        selectedPlayer.metadata[
          `${ID}/name`
        ];

      const playerName =
        typeof storedName === "string" &&
        storedName.trim().length > 0
          ? storedName
          : `Jogador ${selectedPlayer.id.slice(0, 6)}`;

      // =====================================
      // SALVAR DONO
      // =====================================

      await OBR.scene.items.updateItems(
        [selectedItem.id],
        (items) => {

          for (const item of items) {

            item.metadata[
              `${ID}/ownerId`
            ] =
              selectedPlayer.id;

            item.metadata[
              `${ID}/ownerName`
            ] =
              playerName;
          }
        }
      );

      console.log(
        `👤 Dono definido: ${selectedItem.name} → ${playerName}`
      );
    },
  });

  // =========================================
  // REMOVER DONO
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/clear-owner`,

    icons: [
      {
        icon: ICON,
        label: "🚫 Remover dono (GM)",

        filter: {
          max: 1,
          roles: ["GM"],

          every: [
            {
              key: "layer",
              value: "CHARACTER",
            },
          ],
        },
      },
    ],

    async onClick(context) {

      const selectedItem =
        context.items[0];

      if (!selectedItem) {
        return;
      }

      await OBR.scene.items.updateItems(
        [selectedItem.id],
        (items) => {

          for (const item of items) {

            delete item.metadata[
              `${ID}/ownerId`
            ];

            delete item.metadata[
              `${ID}/ownerName`
            ];
          }
        }
      );

      console.log(
        "🚫 Dono removido:",
        selectedItem.name
      );
    },
  });
}
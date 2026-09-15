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

    console.log("👤 Nome registrado:", name);
  } catch (error) {
    console.error("❌ Erro ao registrar nome:", error);
  }
}

// =========================================
// INICIALIZAR DONOS AUTOMATICAMENTE
// =========================================

async function initializeOwners() {
  try {
    const items = await OBR.scene.items.getItems();

    const characterItems = items.filter(
      (item) => item.layer === "CHARACTER"
    );

    const itemsToUpdate = characterItems.filter((item) => {
      const ownerId = item.metadata?.[`${ID}/ownerId`];

      return typeof ownerId !== "string";
    });

    if (itemsToUpdate.length === 0) return;

    await OBR.scene.items.updateItems(
      itemsToUpdate.map((item) => item.id),
      (items) => {
        for (const item of items) {
          const createdUserId = item.createdUserId;

          if (typeof createdUserId === "string") {
            item.metadata[`${ID}/ownerId`] = createdUserId;
          }
        }
      }
    );

    console.log(
      "👤 Donos iniciais dos personagens configurados."
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
  item: {
    metadata: Record<string, unknown>;
  }
): Promise<boolean> {
  const role = await OBR.player.getRole();

  if (role === "GM") {
    return true;
  }

  const ownerId = item.metadata?.[`${ID}/ownerId`];

  return ownerId === OBR.player.id;
}

// =========================================
// SETUP
// =========================================

export async function setupContextMenu() {
  await registerPlayerName();
  await initializeOwners();

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
      const selectedItem = context.items[0];

      if (!selectedItem) return;

      await OBR.scene.setMetadata({
        [`${ID}/ball`]: selectedItem.id,
        [`${ID}/holder`]: undefined,
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
      const player = context.items[0];

      if (!player) return;

      const metadata = await OBR.scene.getMetadata();

      const ballId =
        metadata[`${ID}/ball`];

      if (typeof ballId !== "string") {
        console.log(
          "❌ Nenhuma bola foi definida."
        );
        return;
      }

      const items =
        await OBR.scene.items.getItems();

      const ball = items.find(
        (item) => item.id === ballId
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
            item.attachedTo = player.id;
          }
        }
      );

      await OBR.scene.setMetadata({
        [`${ID}/holder`]: player.id,
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

      if (!selectedItem) return;

      const metadata =
        await OBR.scene.getMetadata();

      const ballId =
        metadata[`${ID}/ball`];

      if (typeof ballId !== "string") {
        console.log(
          "❌ Nenhuma bola foi definida."
        );
        return;
      }

      const items =
        await OBR.scene.items.getItems();

      const ball = items.find(
        (item) => item.id === ballId
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
            item.attachedTo = undefined;
          }
        }
      );

      await OBR.scene.setMetadata({
        [`${ID}/holder`]: undefined,
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
      // GM
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

      // PLAYER — SOMENTE DONO
      {
        icon: ICON,
        label: "⚽ Passar bola",
        filter: {
          max: 1,
          roles: ["PLAYER"],

          permissions: [
            "CHARACTER_UPDATE",
          ],

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
              value: OBR.player.id,
            },
          ],
        },
      },
    ],

    async onClick(context) {
      const player = context.items[0];

      if (!player) return;

      const role =
        await OBR.player.getRole();

      // GM pode usar normalmente
      if (role !== "GM") {
        const owner =
          await isCharacterOwner(player);

        if (!owner) {
          console.log(
            "❌ Este personagem não pertence a você."
          );
          return;
        }

        const hasPermission =
          await OBR.player.hasPermission(
            "CHARACTER_UPDATE"
          );

        if (!hasPermission) {
          console.log(
            "❌ Você não tem permissão para controlar este personagem."
          );
          return;
        }
      }

      const metadata =
        await OBR.scene.getMetadata();

      const ballId =
        metadata[`${ID}/ball`];

      const holderId =
        metadata[`${ID}/holder`];

      if (typeof ballId !== "string") {
        console.log(
          "❌ Não existe uma bola definida."
        );
        return;
      }

      if (holderId !== player.id) {
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

      startPass(player.id);
    },
  });

  // =========================================
  // INTERCEPTAR
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/intercept-ball`,

    icons: [
      // GM
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

      // PLAYER — SOMENTE DONO
      {
        icon: ICON,
        label: "🛡️ Interceptar",
        filter: {
          max: 1,
          roles: ["PLAYER"],

          permissions: [
            "CHARACTER_UPDATE",
          ],

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
              value: OBR.player.id,
            },
          ],
        },
      },
    ],

    async onClick(context) {
      const interceptor =
        context.items[0];

      if (!interceptor) return;

      const role =
        await OBR.player.getRole();

      // GM pode usar normalmente
      if (role !== "GM") {
        const owner =
          await isCharacterOwner(
            interceptor
          );

        if (!owner) {
          console.log(
            "❌ Este personagem não pertence a você."
          );
          return;
        }

        const hasPermission =
          await OBR.player.hasPermission(
            "CHARACTER_UPDATE"
          );

        if (!hasPermission) {
          console.log(
            "❌ Você não tem permissão para controlar este personagem."
          );
          return;
        }
      }

      const metadata =
        await OBR.scene.getMetadata();

      const ballId =
        metadata[`${ID}/ball`];

      const holderId =
        metadata[`${ID}/holder`];

      if (typeof ballId !== "string") {
        console.log(
          "❌ Não existe uma bola definida."
        );
        return;
      }

      if (typeof holderId !== "string") {
        console.log(
          "❌ Ninguém está com a posse da bola."
        );
        return;
      }

      if (holderId === interceptor.id) {
        console.log(
          "❌ Este jogador já está com a bola."
        );
        return;
      }

      console.log(
        `🛡️ ${interceptor.name} vai interceptar a bola.`
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
    id: `${ID}/set-owner`,

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
      const character =
        context.items[0];

      if (!character) return;

      const players =
        await OBR.party.getPlayers();

      if (players.length === 0) {
        window.alert(
          "Não há jogadores conectados."
        );
        return;
      }

      // Organiza pelo nome
      const sortedPlayers =
        [...players].sort((a, b) => {
          const nameA =
            String(
              a.metadata?.[`${ID}/name`] ||
                a.name ||
                "Jogador"
            ).toLowerCase();

          const nameB =
            String(
              b.metadata?.[`${ID}/name`] ||
                b.name ||
                "Jogador"
            ).toLowerCase();

          return nameA.localeCompare(nameB);
        });

      const playerList =
        sortedPlayers
          .map((player, index) => {
            const playerName =
              String(
                player.metadata?.[
                  `${ID}/name`
                ] ||
                  player.name ||
                  `Jogador ${index + 1}`
              );

            return `${index + 1} — ${playerName}`;
          })
          .join("\n");

      const answer =
        window.prompt(
          `👤 DEFINIR DONO\n\n` +
          `Personagem: ${character.name || "Sem nome"}\n\n` +
          `Escolha o jogador:\n\n` +
          `${playerList}\n\n` +
          `Digite o NÚMERO ou o NOME do jogador:`
        );

      if (answer === null) {
        return;
      }

      const input =
        answer.trim();

      if (!input) {
        window.alert(
          "❌ Você não digitou nada."
        );
        return;
      }

      let selectedPlayer:
        typeof sortedPlayers[number] |
        undefined;

      // =====================================
      // TENTAR PELO NÚMERO
      // =====================================

      const number =
        Number(input);

      if (
        Number.isInteger(number) &&
        number >= 1 &&
        number <= sortedPlayers.length
      ) {
        selectedPlayer =
          sortedPlayers[number - 1];
      }

      // =====================================
      // TENTAR PELO NOME
      // =====================================

      if (!selectedPlayer) {
        const normalizedInput =
          input.toLowerCase();

        selectedPlayer =
          sortedPlayers.find(
            (player) => {
              const name =
                String(
                  player.metadata?.[
                    `${ID}/name`
                  ] ||
                    player.name ||
                    ""
                );

              return (
                name.toLowerCase() ===
                normalizedInput
              );
            }
          );
      }

      if (!selectedPlayer) {
        window.alert(
          "❌ Jogador não encontrado.\n\n" +
          "Digite o número mostrado na lista ou o nome exatamente como aparece."
        );

        return;
      }

      const selectedName =
        String(
          selectedPlayer.metadata?.[
            `${ID}/name`
          ] ||
            selectedPlayer.name ||
            "Jogador"
        );

      await OBR.scene.items.updateItems(
        [character.id],
        (items) => {
          for (const item of items) {
            item.metadata[
              `${ID}/ownerId`
            ] = selectedPlayer!.id;

            item.metadata[
              `${ID}/ownerName`
            ] = selectedName;
          }
        }
      );

      console.log(
        `👤 Dono definido: ${character.name} → ${selectedName}`
      );

      window.alert(
        `✅ Dono definido!\n\n` +
        `${character.name || "Personagem"} → ${selectedName}`
      );
    },
  });

  // =========================================
  // REMOVER DONO
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/remove-owner`,

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
      const character =
        context.items[0];

      if (!character) return;

      await OBR.scene.items.updateItems(
        [character.id],
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
        `🚫 Dono removido de: ${character.name}`
      );

      window.alert(
        `🚫 Dono removido de ${
          character.name || "personagem"
        }.`
      );
    },
  });

  console.log(
    "⚽ Blue Lock Ball — menus configurados."
  );
}
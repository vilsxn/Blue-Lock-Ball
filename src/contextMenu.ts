import OBR from "@owlbear-rodeo/sdk";
import { startPass, startInterception } from "./passMode";

const ID = "com.bluelock.ball";

// Ícone das ações
const ICON = "/blue-lock-icon.png?v=2";

export function setupContextMenu() {
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

      console.log("⚽ Bola definida:", selectedItem.id);
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
      const ballId = metadata[`${ID}/ball`];

      if (typeof ballId !== "string") {
        console.log("❌ Nenhuma bola foi definida.");
        return;
      }

      const items = await OBR.scene.items.getItems();
      const ball = items.find((item) => item.id === ballId);

      if (!ball) {
        console.log("❌ Bola não encontrada.");
        return;
      }

      await OBR.scene.items.updateItems([ball.id], (items) => {
        for (const item of items) {
          item.attachedTo = player.id;
        }
      });

      await OBR.scene.setMetadata({
        [`${ID}/holder`]: player.id,
      });

      console.log("⚽ Posse dada para:", player.name);
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
      const selectedItem = context.items[0];
      if (!selectedItem) return;

      const metadata = await OBR.scene.getMetadata();
      const ballId = metadata[`${ID}/ball`];

      if (typeof ballId !== "string") {
        console.log("❌ Nenhuma bola foi definida.");
        return;
      }

      const items = await OBR.scene.items.getItems();
      const ball = items.find((item) => item.id === ballId);

      if (!ball) {
        console.log("❌ Bola não encontrada.");
        return;
      }

      await OBR.scene.items.updateItems([ball.id], (items) => {
        for (const item of items) {
          item.attachedTo = undefined;
        }
      });

      await OBR.scene.setMetadata({
        [`${ID}/holder`]: undefined,
      });

      console.log("🔓 Bola desanexada!");
    },
  });

  // =========================================
  // PASSAR BOLA
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/pass-ball`,
    icons: [
      {
        icon: ICON,
        label: "⚽ Passar bola",
        filter: {
          max: 1,
          roles: ["GM", "PLAYER"],

          // 🔐 Só aparece para quem pode atualizar
          // o personagem selecionado.
          permissions: ["CHARACTER_UPDATE"],

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
      const player = context.items[0];
      if (!player) return;

      // 🔐 Segunda barreira de segurança.
      const role = await OBR.player.getRole();

      if (role !== "GM") {
        const hasPermission =
          await OBR.player.hasPermission("CHARACTER_UPDATE");

        if (!hasPermission) {
          console.log(
            "❌ Você não tem permissão para controlar este personagem."
          );
          return;
        }
      }

      const metadata = await OBR.scene.getMetadata();

      const ballId = metadata[`${ID}/ball`];
      const holderId = metadata[`${ID}/holder`];

      if (typeof ballId !== "string") {
        console.log("❌ Não existe uma bola definida.");
        return;
      }

      if (holderId !== player.id) {
        console.log("❌ Este jogador não está com a bola.");
        console.log("👤 Selecionado:", player.id);
        console.log("⚽ Dono da bola:", holderId);
        return;
      }

      console.log("⚽ Passe iniciado por:", player.name);

      startPass(player.id);
    },
  });

  // =========================================
  // INTERCEPTAR
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/intercept-ball`,
    icons: [
      {
        icon: ICON,
        label: "🛡️ Interceptar",
        filter: {
          max: 1,
          roles: ["GM", "PLAYER"],

          // 🔐 Só aparece para quem pode controlar
          // o personagem selecionado.
          permissions: ["CHARACTER_UPDATE"],

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
      const interceptor = context.items[0];
      if (!interceptor) return;

      // 🔐 Segunda barreira de segurança.
      const role = await OBR.player.getRole();

      if (role !== "GM") {
        const hasPermission =
          await OBR.player.hasPermission("CHARACTER_UPDATE");

        if (!hasPermission) {
          console.log(
            "❌ Você não tem permissão para controlar este personagem."
          );
          return;
        }
      }

      const metadata = await OBR.scene.getMetadata();

      const ballId = metadata[`${ID}/ball`];
      const holderId = metadata[`${ID}/holder`];

      if (typeof ballId !== "string") {
        console.log("❌ Não existe uma bola definida.");
        return;
      }

      if (typeof holderId !== "string") {
        console.log("❌ Ninguém está com a posse da bola.");
        return;
      }

      if (holderId === interceptor.id) {
        console.log("❌ Este jogador já está com a bola.");
        return;
      }

      console.log(
        `🛡️ ${interceptor.name} vai interceptar a bola de quem estiver com a posse.`
      );

      startInterception(interceptor.id);
    },
  });
}
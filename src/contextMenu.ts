import OBR from "@owlbear-rodeo/sdk";
import { startPass, startInterception, recordShot } from "./passMode";

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
        
        return;
      }

      const items = await OBR.scene.items.getItems();
      const ball = items.find((item) => item.id === ballId);

      if (!ball) {
        
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
        
        return;
      }

      const items = await OBR.scene.items.getItems();
      const ball = items.find((item) => item.id === ballId);

      if (!ball) {
        
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
      const player = context.items[0];
      if (!player) return;

      const metadata = await OBR.scene.getMetadata();

      const ballId = metadata[`${ID}/ball`];
      const holderId = metadata[`${ID}/holder`];

      if (typeof ballId !== "string") {
        
        return;
      }

      if (holderId !== player.id) {
        
        
        
        return;
      }

      

      startPass(player.id);
    },
  });

  // =========================================
  // CHUTAR
  // =========================================

  OBR.contextMenu.create({
    id: `${ID}/shoot-ball`,
    icons: [
      {
        icon: ICON,
        label: "🎯 Chutar",
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
      const shooter = context.items[0];
      if (!shooter) return;

      const metadata = await OBR.scene.getMetadata();
      const ballId = metadata[`${ID}/ball`];
      const holderId = metadata[`${ID}/holder`];

      if (typeof ballId !== "string") {
        
        return;
      }

      if (holderId !== shooter.id) {
        
        return;
      }

      await recordShot(shooter.id);
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
      const interceptor = context.items[0];
      if (!interceptor) return;

      const metadata = await OBR.scene.getMetadata();

      const ballId = metadata[`${ID}/ball`];
      const holderId = metadata[`${ID}/holder`];

      if (typeof ballId !== "string") {
        
        return;
      }

      if (typeof holderId !== "string") {
        
        return;
      }

      if (holderId === interceptor.id) {
        
        return;
      }

      

      startInterception(interceptor.id);
    },
  });
}
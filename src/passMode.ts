import OBR from "@owlbear-rodeo/sdk";

const ID = "com.bluelock.ball";

const MAX_HISTORY = 250;

let waitingForReceiver = false;
let passerId: string | null = null;

// =========================================
// HISTÓRICO
// =========================================

type HistoryEvent =
  | {
      type: "pass";
      from: string;
      to: string;
      fromName: string;
      toName: string;
      time: number;
    }
  | {
      type: "interception";
      from: string;
      to: string;
      fromName: string;
      toName: string;
      time: number;
    }
  | {
      type: "shot";
      from: string;
      to: string;
      fromName: string;
      toName: string;
      result: "pending" | "shot" | "goal";
      time: number;
    };

// =========================================
// CONFIGURAÇÃO
// =========================================

export function setupPassMode() {

  OBR.player.onChange((player) => {
    if (!waitingForReceiver) return;

    const selection = player.selection ?? [];

    if (selection.length === 0) return;

    const receiverId = selection[0];
    const currentPasserId = passerId;

    console.log("🎯 Receptor selecionado:", receiverId);

    waitingForReceiver = false;
    passerId = null;

    if (!currentPasserId) {
      console.log("❌ Não foi possível identificar o passador.");
      return;
    }

    if (currentPasserId === receiverId) {
      console.log("❌ O receptor não pode ser o próprio passador.");
      return;
    }

    void performPass(currentPasserId, receiverId);
  });
}

// =========================================
// INICIAR PASSE
// =========================================

export function startPass(passerIdFromContext: string) {
  waitingForReceiver = true;
  passerId = passerIdFromContext;

  console.log("⚽ Passe iniciado por:", passerIdFromContext);
  console.log("⚽ Escolha o jogador que vai receber o passe.");
}


// =========================================
// INICIAR CHUTE
// =========================================

export async function startShot(shooterIdFromContext: string) {
  const metadata = await OBR.scene.getMetadata();
  const ballId = metadata[`${ID}/ball`];
  const holderId = metadata[`${ID}/holder`];

  if (typeof ballId !== "string") {
    console.log("❌ Não existe uma bola definida.");
    return;
  }

  if (holderId !== shooterIdFromContext) {
    console.log("❌ Este jogador não está com a bola.");
    return;
  }

  const items = await OBR.scene.items.getItems();
  const shooter = items.find((item) => item.id === shooterIdFromContext);

  if (!shooter) {
    console.log("❌ Jogador do chute não encontrado.");
    return;
  }

  await addHistoryEvent({
    type: "shot",
    from: shooter.id,
    to: "",
    fromName: shooter.name || "Sem nome",
    toName: "",
    result: "pending",
    time: Date.now(),
  });

  console.log("🎯 Chute registrado no histórico:", shooter.name);
}

// =========================================
// INICIAR INTERCEPTAÇÃO
// =========================================

export function startInterception(interceptorId: string) {
  console.log("🛡️ Interceptação iniciada por:", interceptorId);

  // Não espera seleção.
  // O alvo é automaticamente quem estiver com a posse.
  void performInterception(interceptorId);
}

// =========================================
// EXECUTAR PASSE
// =========================================

async function performPass(
  passerId: string,
  receiverId: string
) {
  try {
    const metadata = await OBR.scene.getMetadata();

    const ballId = metadata[`${ID}/ball`];
    const holderId = metadata[`${ID}/holder`];

    if (typeof ballId !== "string") {
      console.log("❌ Bola não encontrada.");
      return;
    }

    if (holderId !== passerId) {
      console.log("❌ O jogador não está mais com a bola.");
      return;
    }

    const items = await OBR.scene.items.getItems();

    const ball = items.find((item) => item.id === ballId);
    const passer = items.find((item) => item.id === passerId);
    const receiver = items.find((item) => item.id === receiverId);

    if (!ball || !passer || !receiver) {
      console.log("❌ Não foi possível encontrar os personagens.");
      return;
    }

    const startX = ball.position.x;
    const startY = ball.position.y;

    const gridSize = await OBR.scene.grid.getDpi();

    const targetX = receiver.position.x + gridSize * 0.36;
    const targetY = receiver.position.y + gridSize * 0.36;

    console.log("📍 Posição inicial:", startX, startY);
    console.log("🎯 Destino:", targetX, targetY);

    // Solta a bola mantendo exatamente a posição atual.
    await OBR.scene.items.updateItems([ball.id], (items) => {
      for (const item of items) {
        item.attachedTo = undefined;
        item.position.x = startX;
        item.position.y = startY;
      }
    });

    console.log("🏃 Bola solta!");

    const updatedItems = await OBR.scene.items.getItems([ball.id]);
    const updatedBall = updatedItems[0];

    if (!updatedBall) {
      console.log("❌ Bola desapareceu durante o passe.");
      return;
    }

    const interaction =
      await OBR.interaction.startItemInteraction(updatedBall);

    const [update, stop] = interaction;

    console.log("🎬 Interação da bola iniciada!");

    const duration = 550;
    const intervalTime = 25;

    const steps = Math.ceil(duration / intervalTime);

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;

      const progress = Math.min(currentStep / steps, 1);

      // Smoothstep
      const smooth =
        progress * progress * (3 - 2 * progress);

      const x =
        startX + (targetX - startX) * smooth;

      const y =
        startY + (targetY - startY) * smooth;

      update((item) => {
        item.position.x = x;
        item.position.y = y;
      });

      if (currentStep >= steps) {
        clearInterval(timer);

        update((item) => {
          item.position.x = targetX;
          item.position.y = targetY;
        });

        stop();

        void finishPass(
          ball.id,
          passer.id,
          receiver.id,
          targetX,
          targetY
        );
      }
    }, intervalTime);
  } catch (error) {
    console.error("❌ Erro durante o passe:", error);
  }
}

// =========================================
// FINALIZAR PASSE
// =========================================

async function finishPass(
  ballId: string,
  passerId: string,
  receiverId: string,
  targetX: number,
  targetY: number
) {
  const items = await OBR.scene.items.getItems();

  const passer = items.find((item) => item.id === passerId);
  const receiver = items.find((item) => item.id === receiverId);

  if (!passer || !receiver) return;

  await OBR.scene.items.updateItems([ballId], (items) => {
    for (const item of items) {
      item.position.x = targetX;
      item.position.y = targetY;
      item.attachedTo = receiverId;
    }
  });

  await OBR.scene.setMetadata({
    [`${ID}/holder`]: receiverId,
  });

  await addHistoryEvent({
    type: "pass",
    from: passerId,
    to: receiverId,
    fromName: passer.name || "Sem nome",
    toName: receiver.name || "Sem nome",
    time: Date.now(),
  });

  console.log(
    `⚽ Passe concluído: ${passer.name} → ${receiver.name}`
  );
}

// =========================================
// EXECUTAR CHUTE
// =========================================

async function performShot(
  shooterId: string,
  targetX: number,
  targetY: number
) {
  try {
    const metadata = await OBR.scene.getMetadata();
    const ballId = metadata[`${ID}/ball`];
    const holderId = metadata[`${ID}/holder`];

    if (typeof ballId !== "string") {
      console.log("❌ Bola não encontrada.");
      return;
    }

    if (holderId !== shooterId) {
      console.log("❌ O jogador não está mais com a bola.");
      return;
    }

    const items = await OBR.scene.items.getItems();
    const ball = items.find((item) => item.id === ballId);
    const shooter = items.find((item) => item.id === shooterId);

    if (!ball || !shooter) {
      console.log("❌ Não foi possível encontrar a bola ou o jogador.");
      return;
    }

    const startX = ball.position.x;
    const startY = ball.position.y;

    console.log("📍 Início do chute:", startX, startY);
    console.log("🎯 Destino do chute:", targetX, targetY);

    await OBR.scene.items.updateItems([ball.id], (items) => {
      for (const item of items) {
        item.attachedTo = undefined;
        item.position.x = startX;
        item.position.y = startY;
      }
    });

    await OBR.scene.setMetadata({
      [`${ID}/holder`]: undefined,
    });

    const updatedItems = await OBR.scene.items.getItems([ball.id]);
    const updatedBall = updatedItems[0];

    if (!updatedBall) {
      console.log("❌ Bola desapareceu durante o chute.");
      return;
    }

    const interaction = await OBR.interaction.startItemInteraction(updatedBall);
    const [update, stop] = interaction;

    const duration = 650;
    const intervalTime = 25;
    const steps = Math.ceil(duration / intervalTime);
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(currentStep / steps, 1);
      const smooth = progress * progress * (3 - 2 * progress);

      update((item) => {
        item.position.x = startX + (targetX - startX) * smooth;
        item.position.y = startY + (targetY - startY) * smooth;
      });

      if (currentStep >= steps) {
        clearInterval(timer);

        update((item) => {
          item.position.x = targetX;
          item.position.y = targetY;
        });

        stop();
        void finishShot(
          ball.id,
          shooter.id,
          targetX,
          targetY
        );
      }
    }, intervalTime);
  } catch (error) {
    console.error("❌ Erro durante o chute:", error);
  }
}

// =========================================
// FINALIZAR CHUTE
// =========================================

async function finishShot(
  ballId: string,
  shooterId: string,
  targetX: number,
  targetY: number
) {
  const items = await OBR.scene.items.getItems();
  const shooter = items.find((item) => item.id === shooterId);

  if (!shooter) return;

  await OBR.scene.items.updateItems([ballId], (items) => {
    for (const item of items) {
      item.position.x = targetX;
      item.position.y = targetY;
      item.attachedTo = undefined;
    }
  });

  await OBR.scene.setMetadata({
    [`${ID}/holder`]: undefined,
  });

  await addHistoryEvent({
    type: "shot",
    from: shooterId,
    to: "",
    fromName: shooter.name || "Sem nome",
    toName: "",
    result: "pending",
    time: Date.now(),
  });

  console.log(`🎯 Chute concluído: ${shooter.name}`);
}

// =========================================
// EXECUTAR INTERCEPTAÇÃO
// =========================================

async function performInterception(interceptorId: string) {
  try {
    const metadata = await OBR.scene.getMetadata();

    const ballId = metadata[`${ID}/ball`];

    // IMPORTANTE:
    // Lê quem está com a bola AGORA.
    const holderId = metadata[`${ID}/holder`];

    if (typeof ballId !== "string") {
      console.log("❌ Bola não encontrada.");
      return;
    }

    if (typeof holderId !== "string") {
      console.log("❌ Ninguém está com a bola.");
      return;
    }

    if (holderId === interceptorId) {
      console.log("❌ O jogador já está com a bola.");
      return;
    }

    const items = await OBR.scene.items.getItems();

    const ball = items.find((item) => item.id === ballId);
    const holder = items.find((item) => item.id === holderId);
    const interceptor = items.find(
      (item) => item.id === interceptorId
    );

    if (!ball || !holder || !interceptor) {
      console.log(
        "❌ Não foi possível encontrar a bola ou um dos jogadores."
      );
      return;
    }

    console.log(
      `🛡️ ${interceptor.name} interceptou ${holder.name}`
    );

    const startX = ball.position.x;
    const startY = ball.position.y;

    const gridSize = await OBR.scene.grid.getDpi();

    const targetX =
      interceptor.position.x + gridSize * 0.36;

    const targetY =
      interceptor.position.y + gridSize * 0.36;

    // Solta a bola na posição atual.
    await OBR.scene.items.updateItems([ball.id], (items) => {
      for (const item of items) {
        item.attachedTo = undefined;
        item.position.x = startX;
        item.position.y = startY;
      }
    });

    console.log("🏃 Bola solta para a interceptação!");

    const updatedItems =
      await OBR.scene.items.getItems([ball.id]);

    const updatedBall = updatedItems[0];

    if (!updatedBall) {
      console.log("❌ Bola desapareceu.");
      return;
    }

    const interaction =
      await OBR.interaction.startItemInteraction(updatedBall);

    const [update, stop] = interaction;

    console.log("🎬 Interação da interceptação iniciada!");

    const duration = 450;
    const intervalTime = 25;

    const steps = Math.ceil(duration / intervalTime);

    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;

      const progress = Math.min(currentStep / steps, 1);

      const smooth =
        progress * progress * (3 - 2 * progress);

      const x =
        startX + (targetX - startX) * smooth;

      const y =
        startY + (targetY - startY) * smooth;

      update((item) => {
        item.position.x = x;
        item.position.y = y;
      });

      if (currentStep >= steps) {
        clearInterval(timer);

        update((item) => {
          item.position.x = targetX;
          item.position.y = targetY;
        });

        stop();

        void finishInterception(
          ball.id,
          holder.id,
          interceptor.id,
          targetX,
          targetY
        );
      }
    }, intervalTime);
  } catch (error) {
    console.error(
      "❌ Erro durante a interceptação:",
      error
    );
  }
}

// =========================================
// FINALIZAR INTERCEPTAÇÃO
// =========================================

async function finishInterception(
  ballId: string,
  holderId: string,
  interceptorId: string,
  targetX: number,
  targetY: number
) {
  const items = await OBR.scene.items.getItems();

  const holder = items.find(
    (item) => item.id === holderId
  );

  const interceptor = items.find(
    (item) => item.id === interceptorId
  );

  if (!holder || !interceptor) return;

  await OBR.scene.items.updateItems([ballId], (items) => {
    for (const item of items) {
      item.position.x = targetX;
      item.position.y = targetY;
      item.attachedTo = interceptorId;
    }
  });

  // Agora o interceptor é o novo dono.
  await OBR.scene.setMetadata({
    [`${ID}/holder`]: interceptorId,
  });

  await addHistoryEvent({
    type: "interception",
    from: holderId,
    to: interceptorId,
    fromName: holder.name || "Sem nome",
    toName: interceptor.name || "Sem nome",
    time: Date.now(),
  });

  console.log(
    `🛡️ Interceptação concluída: ${interceptor.name} tomou a bola de ${holder.name}`
  );
}

// =========================================
// ADICIONAR EVENTO AO HISTÓRICO
// =========================================

async function addHistoryEvent(event: HistoryEvent) {
  const metadata = await OBR.scene.getMetadata();

  const oldHistory = metadata[`${ID}/history`];

  const history: HistoryEvent[] =
    Array.isArray(oldHistory) ? oldHistory : [];

  const updatedHistory = [
    ...history,
    event,
  ].slice(-MAX_HISTORY);

  await OBR.scene.setMetadata({
    [`${ID}/history`]: updatedHistory,
  });

  console.log("📜 Evento registrado:", event);
}
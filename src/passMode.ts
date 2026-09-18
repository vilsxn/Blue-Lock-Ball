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

    

    waitingForReceiver = false;
    passerId = null;

    if (!currentPasserId) {
      
      return;
    }

    if (currentPasserId === receiverId) {
      
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

  
  
}


// =========================================
// INICIAR CHUTE
// =========================================

export async function recordShot(shooterIdFromContext: string) {
  const metadata = await OBR.scene.getMetadata();
  const ballId = metadata[`${ID}/ball`];
  const holderId = metadata[`${ID}/holder`];

  if (typeof ballId !== "string") {
    
    return;
  }

  if (holderId !== shooterIdFromContext) {
    
    return;
  }

  const items = await OBR.scene.items.getItems();
  const shooter = items.find((item) => item.id === shooterIdFromContext);

  if (!shooter) {
    
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

  
}

// =========================================
// INICIAR INTERCEPTAÇÃO
// =========================================

export function startInterception(interceptorId: string) {
  

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
      
      return;
    }

    if (holderId !== passerId) {
      
      return;
    }

    const items = await OBR.scene.items.getItems();

    const ball = items.find((item) => item.id === ballId);
    const passer = items.find((item) => item.id === passerId);
    const receiver = items.find((item) => item.id === receiverId);

    if (!ball || !passer || !receiver) {
      
      return;
    }

    const startX = ball.position.x;
    const startY = ball.position.y;

    const gridSize = await OBR.scene.grid.getDpi();

    const targetX = receiver.position.x + gridSize * 0.36;
    const targetY = receiver.position.y + gridSize * 0.36;

    
    

    // Solta a bola mantendo exatamente a posição atual.
    await OBR.scene.items.updateItems([ball.id], (items) => {
      for (const item of items) {
        item.attachedTo = undefined;
        item.position.x = startX;
        item.position.y = startY;
      }
    });

    

    const updatedItems = await OBR.scene.items.getItems([ball.id]);
    const updatedBall = updatedItems[0];

    if (!updatedBall) {
      
      return;
    }

    const interaction =
      await OBR.interaction.startItemInteraction(updatedBall);

    const [update, stop] = interaction;

    

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
      
      return;
    }

    if (typeof holderId !== "string") {
      
      return;
    }

    if (holderId === interceptorId) {
      
      return;
    }

    const items = await OBR.scene.items.getItems();

    const ball = items.find((item) => item.id === ballId);
    const holder = items.find((item) => item.id === holderId);
    const interceptor = items.find(
      (item) => item.id === interceptorId
    );

    if (!ball || !holder || !interceptor) {
      
      return;
    }

    

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

    

    const updatedItems =
      await OBR.scene.items.getItems([ball.id]);

    const updatedBall = updatedItems[0];

    if (!updatedBall) {
      
      return;
    }

    const interaction =
      await OBR.interaction.startItemInteraction(updatedBall);

    const [update, stop] = interaction;

    

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

  
}
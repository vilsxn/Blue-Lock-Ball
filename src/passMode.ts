import OBR from "@owlbear-rodeo/sdk";

const ID = "com.bluelock.ball";

const MAX_HISTORY = 250;

const ACTION_LOCK_KEY = `${ID}/action`;
const ACTION_LOCK_TIMEOUT = 15000;

let waitingForReceiver = false;
let passerId: string | null = null;
let waitingActionId: string | null = null;
let waitingTimeout: ReturnType<typeof setTimeout> | null = null;

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
    };

type BallAction = {
  id: string;
  type: "pass" | "interception";
  playerId: string;
  startedAt: number;
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
    const currentActionId = waitingActionId;

    console.log("🎯 Receptor selecionado:", receiverId);

    waitingForReceiver = false;
    passerId = null;
    waitingActionId = null;

    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
      waitingTimeout = null;
    }

    if (!currentPasserId) {
      console.log("❌ Não foi possível identificar o passador.");
      void releaseAction(currentActionId);
      return;
    }

    if (!currentActionId) {
      console.log("❌ Ação de passe não encontrada.");
      return;
    }

    if (currentPasserId === receiverId) {
      console.log("❌ O receptor não pode ser o próprio passador.");
      void releaseAction(currentActionId);
      return;
    }

    void performPass(
      currentPasserId,
      receiverId,
      currentActionId
    );
  });
}

// =========================================
// INICIAR PASSE
// =========================================

export function startPass(passerIdFromContext: string) {
  void beginPass(passerIdFromContext);
}

async function beginPass(passerIdFromContext: string) {
  const actionId = createActionId();

  const locked = await tryStartAction({
    id: actionId,
    type: "pass",
    playerId: passerIdFromContext,
    startedAt: Date.now(),
  });

  if (!locked) {
    console.log(
      "🔒 A bola já está sendo utilizada por outra ação."
    );

    return;
  }

  waitingForReceiver = true;
  passerId = passerIdFromContext;
  waitingActionId = actionId;

  console.log(
    "⚽ Passe iniciado por:",
    passerIdFromContext
  );

  console.log(
    "⚽ Escolha o jogador que vai receber o passe."
  );

  // Evita deixar a bola travada caso ninguém escolha um receptor.
  waitingTimeout = setTimeout(() => {
    if (
      waitingForReceiver &&
      waitingActionId === actionId
    ) {
      console.log(
        "⏱️ Passe cancelado: nenhum receptor foi selecionado."
      );

      waitingForReceiver = false;
      passerId = null;
      waitingActionId = null;
      waitingTimeout = null;

      void releaseAction(actionId);
    }
  }, ACTION_LOCK_TIMEOUT);
}

// =========================================
// INICIAR INTERCEPTAÇÃO
// =========================================

export function startInterception(interceptorId: string) {
  void beginInterception(interceptorId);
}

async function beginInterception(interceptorId: string) {
  const actionId = createActionId();

  const locked = await tryStartAction({
    id: actionId,
    type: "interception",
    playerId: interceptorId,
    startedAt: Date.now(),
  });

  if (!locked) {
    console.log(
      "🔒 A bola já está sendo utilizada por outra ação."
    );

    return;
  }

  console.log(
    "🛡️ Interceptação iniciada por:",
    interceptorId
  );

  void performInterception(
    interceptorId,
    actionId
  );
}

// =========================================
// ID DA AÇÃO
// =========================================

function createActionId(): string {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

// =========================================
// TRAVA DA BOLA
// =========================================

async function tryStartAction(
  action: BallAction
): Promise<boolean> {
  try {
    const metadata =
      await OBR.scene.getMetadata();

    const currentAction =
      metadata[ACTION_LOCK_KEY];

    if (
      currentAction &&
      typeof currentAction === "object"
    ) {
      const existing =
        currentAction as Partial<BallAction>;

      const startedAt =
        typeof existing.startedAt === "number"
          ? existing.startedAt
          : 0;

      const elapsed =
        Date.now() - startedAt;

      if (
        typeof existing.id === "string" &&
        elapsed < ACTION_LOCK_TIMEOUT
      ) {
        console.log(
          "🔒 Ação bloqueada:",
          existing.type,
          existing.id
        );

        return false;
      }

      console.log(
        "⚠️ Ação antiga encontrada. Liberando trava."
      );
    }

    await OBR.scene.setMetadata({
      [ACTION_LOCK_KEY]: action,
    });

    // Confirma que a ação gravada é realmente a nossa.
    const confirmation =
      await OBR.scene.getMetadata();

    const confirmedAction =
      confirmation[ACTION_LOCK_KEY];

    if (
      !confirmedAction ||
      typeof confirmedAction !== "object"
    ) {
      return false;
    }

    const confirmed =
      confirmedAction as Partial<BallAction>;

    if (confirmed.id !== action.id) {
      console.log(
        "🔒 Outra ação assumiu a bola antes da confirmação."
      );

      return false;
    }

    console.log(
      "🔓 Trava da bola adquirida:",
      action.id
    );

    return true;
  } catch (error) {
    console.error(
      "❌ Erro ao tentar bloquear a bola:",
      error
    );

    return false;
  }
}

// =========================================
// LIBERAR TRAVA
// =========================================

async function releaseAction(
  actionId: string | null
) {
  if (!actionId) return;

  try {
    const metadata =
      await OBR.scene.getMetadata();

    const currentAction =
      metadata[ACTION_LOCK_KEY];

    if (
      !currentAction ||
      typeof currentAction !== "object"
    ) {
      return;
    }

    const action =
      currentAction as Partial<BallAction>;

    // Só a ação que possui a trava pode liberá-la.
    if (action.id !== actionId) {
      return;
    }

    await OBR.scene.setMetadata({
      [ACTION_LOCK_KEY]: null,
    });

    console.log(
      "🔓 Trava da bola liberada:",
      actionId
    );
  } catch (error) {
    console.error(
      "❌ Erro ao liberar trava:",
      error
    );
  }
}

// =========================================
// VERIFICAR TRAVA
// =========================================

async function isActionOwner(
  actionId: string
): Promise<boolean> {
  try {
    const metadata =
      await OBR.scene.getMetadata();

    const currentAction =
      metadata[ACTION_LOCK_KEY];

    if (
      !currentAction ||
      typeof currentAction !== "object"
    ) {
      return false;
    }

    const action =
      currentAction as Partial<BallAction>;

    return action.id === actionId;
  } catch {
    return false;
  }
}

// =========================================
// PASSE
// =========================================

async function performPass(
  passerId: string,
  receiverId: string,
  actionId: string
) {
  try {
    if (!(await isActionOwner(actionId))) {
      console.log(
        "🔒 Passe cancelado: a ação não possui mais a trava."
      );

      return;
    }

    const metadata =
      await OBR.scene.getMetadata();

    const ballId =
      metadata[`${ID}/ball`];

    const holderId =
      metadata[`${ID}/holder`];

    if (typeof ballId !== "string") {
      console.log("❌ Bola não encontrada.");
      return;
    }

    if (holderId !== passerId) {
      console.log(
        "❌ O jogador não está mais com a bola."
      );

      return;
    }

    const items =
      await OBR.scene.items.getItems();

    const ball =
      items.find(
        (item) => item.id === ballId
      );

    const passer =
      items.find(
        (item) => item.id === passerId
      );

    const receiver =
      items.find(
        (item) => item.id === receiverId
      );

    if (!ball || !passer || !receiver) {
      console.log(
        "❌ Não foi possível encontrar os personagens."
      );

      return;
    }

    const startX =
      ball.position.x;

    const startY =
      ball.position.y;

    const gridSize =
      await OBR.scene.grid.getDpi();

    const targetX =
      receiver.position.x +
      gridSize * 0.36;

    const targetY =
      receiver.position.y +
      gridSize * 0.36;

    await OBR.scene.items.updateItems(
      [ball.id],
      (items) => {
        for (const item of items) {
          item.attachedTo = undefined;
          item.position.x = startX;
          item.position.y = startY;
        }
      }
    );

    const updatedItems =
      await OBR.scene.items.getItems(
        [ball.id]
      );

    const updatedBall =
      updatedItems[0];

    if (!updatedBall) {
      console.log(
        "❌ Bola desapareceu durante o passe."
      );

      return;
    }

    const interaction =
      await OBR.interaction.startItemInteraction(
        updatedBall
      );

    const [update, stop] =
      interaction;

    // =====================================
    // ANIMAÇÃO POR TEMPO REAL
    // =====================================

    const duration = 550;

    const startTime =
      performance.now();

    let animationFrame:
      number | null = null;

    const animate = (
      currentTime: number
    ) => {
      const elapsed =
        currentTime - startTime;

      const progress =
        Math.min(
          elapsed / duration,
          1
        );

      const smooth =
        progress *
        progress *
        (3 - 2 * progress);

      const x =
        startX +
        (targetX - startX) *
          smooth;

      const y =
        startY +
        (targetY - startY) *
          smooth;

      update((item) => {
        item.position.x = x;
        item.position.y = y;
      });

      if (progress >= 1) {
        if (animationFrame !== null) {
          cancelAnimationFrame(
            animationFrame
          );
        }

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
          targetY,
          actionId
        );

        return;
      }

      animationFrame =
        requestAnimationFrame(
          animate
        );
    };

    animationFrame =
      requestAnimationFrame(
        animate
      );
  } catch (error) {
    console.error(
      "❌ Erro durante o passe:",
      error
    );

    await releaseAction(actionId);
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
  targetY: number,
  actionId: string
) {
  try {
    if (!(await isActionOwner(actionId))) {
      console.log(
        "🔒 Passe ignorado: a trava pertence a outra ação."
      );

      return;
    }

    const items =
      await OBR.scene.items.getItems();

    const passer =
      items.find(
        (item) => item.id === passerId
      );

    const receiver =
      items.find(
        (item) => item.id === receiverId
      );

    if (!passer || !receiver) {
      return;
    }

    await OBR.scene.items.updateItems(
      [ballId],
      (items) => {
        for (const item of items) {
          item.position.x = targetX;
          item.position.y = targetY;
          item.attachedTo = receiverId;
        }
      }
    );

    await OBR.scene.setMetadata({
      [`${ID}/holder`]: receiverId,
    });

    await addHistoryEvent({
      type: "pass",
      from: passerId,
      to: receiverId,
      fromName:
        passer.name ||
        "Sem nome",
      toName:
        receiver.name ||
        "Sem nome",
      time: Date.now(),
    });

    console.log(
      `⚽ Passe concluído: ${passer.name} → ${receiver.name}`
    );
  } catch (error) {
    console.error(
      "❌ Erro ao finalizar passe:",
      error
    );
  } finally {
    await releaseAction(actionId);
  }
}

// =========================================
// INTERCEPTAÇÃO
// =========================================

async function performInterception(
  interceptorId: string,
  actionId: string
) {
  try {
    if (!(await isActionOwner(actionId))) {
      console.log(
        "🔒 Interceptação cancelada: a ação não possui mais a trava."
      );

      return;
    }

    const metadata =
      await OBR.scene.getMetadata();

    const ballId =
      metadata[`${ID}/ball`];

    const holderId =
      metadata[`${ID}/holder`];

    if (typeof ballId !== "string") {
      console.log(
        "❌ Bola não encontrada."
      );

      return;
    }

    if (typeof holderId !== "string") {
      console.log(
        "❌ Ninguém está com a bola."
      );

      return;
    }

    if (
      holderId === interceptorId
    ) {
      console.log(
        "❌ O jogador já está com a bola."
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

    const holder =
      items.find(
        (item) =>
          item.id === holderId
      );

    const interceptor =
      items.find(
        (item) =>
          item.id === interceptorId
      );

    if (
      !ball ||
      !holder ||
      !interceptor
    ) {
      console.log(
        "❌ Não foi possível encontrar a bola ou um dos jogadores."
      );

      return;
    }

    console.log(
      `🛡️ ${interceptor.name} interceptou ${holder.name}`
    );

    const startX =
      ball.position.x;

    const startY =
      ball.position.y;

    const gridSize =
      await OBR.scene.grid.getDpi();

    const targetX =
      interceptor.position.x +
      gridSize * 0.36;

    const targetY =
      interceptor.position.y +
      gridSize * 0.36;

    await OBR.scene.items.updateItems(
      [ball.id],
      (items) => {
        for (const item of items) {
          item.attachedTo = undefined;
          item.position.x = startX;
          item.position.y = startY;
        }
      }
    );

    const updatedItems =
      await OBR.scene.items.getItems(
        [ball.id]
      );

    const updatedBall =
      updatedItems[0];

    if (!updatedBall) {
      console.log(
        "❌ Bola desapareceu."
      );

      return;
    }

    const interaction =
      await OBR.interaction.startItemInteraction(
        updatedBall
      );

    const [update, stop] =
      interaction;

    // =====================================
    // ANIMAÇÃO POR TEMPO REAL
    // =====================================

    const duration = 450;

    const startTime =
      performance.now();

    let animationFrame:
      number | null = null;

    const animate = (
      currentTime: number
    ) => {
      const elapsed =
        currentTime - startTime;

      const progress =
        Math.min(
          elapsed / duration,
          1
        );

      const smooth =
        progress *
        progress *
        (3 - 2 * progress);

      const x =
        startX +
        (targetX - startX) *
          smooth;

      const y =
        startY +
        (targetY - startY) *
          smooth;

      update((item) => {
        item.position.x = x;
        item.position.y = y;
      });

      if (progress >= 1) {
        if (animationFrame !== null) {
          cancelAnimationFrame(
            animationFrame
          );
        }

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
          targetY,
          actionId
        );

        return;
      }

      animationFrame =
        requestAnimationFrame(
          animate
        );
    };

    animationFrame =
      requestAnimationFrame(
        animate
      );
  } catch (error) {
    console.error(
      "❌ Erro durante a interceptação:",
      error
    );

    await releaseAction(actionId);
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
  targetY: number,
  actionId: string
) {
  try {
    if (!(await isActionOwner(actionId))) {
      console.log(
        "🔒 Interceptação ignorada: a trava pertence a outra ação."
      );

      return;
    }

    const items =
      await OBR.scene.items.getItems();

    const holder =
      items.find(
        (item) =>
          item.id === holderId
      );

    const interceptor =
      items.find(
        (item) =>
          item.id === interceptorId
      );

    if (
      !holder ||
      !interceptor
    ) {
      return;
    }

    await OBR.scene.items.updateItems(
      [ballId],
      (items) => {
        for (const item of items) {
          item.position.x = targetX;
          item.position.y = targetY;
          item.attachedTo =
            interceptorId;
        }
      }
    );

    await OBR.scene.setMetadata({
      [`${ID}/holder`]:
        interceptorId,
    });

    await addHistoryEvent({
      type: "interception",
      from: holderId,
      to: interceptorId,
      fromName:
        holder.name ||
        "Sem nome",
      toName:
        interceptor.name ||
        "Sem nome",
      time: Date.now(),
    });

    console.log(
      `🛡️ Interceptação concluída: ${interceptor.name} tomou a bola de ${holder.name}`
    );
  } catch (error) {
    console.error(
      "❌ Erro ao finalizar interceptação:",
      error
    );
  } finally {
    await releaseAction(actionId);
  }
}

// =========================================
// HISTÓRICO
// =========================================

async function addHistoryEvent(
  event: HistoryEvent
) {
  const metadata =
    await OBR.scene.getMetadata();

  const oldHistory =
    metadata[`${ID}/history`];

  const history: HistoryEvent[] =
    Array.isArray(oldHistory)
      ? oldHistory
      : [];

  const updatedHistory = [
    ...history,
    event,
  ].slice(-MAX_HISTORY);

  await OBR.scene.setMetadata({
    [`${ID}/history`]:
      updatedHistory,
  });

  console.log(
    "📜 Evento registrado:",
    event
  );
}
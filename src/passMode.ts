import OBR, { Item } from "@owlbear-rodeo/sdk";

const ID = "com.bluelock.ball";

const MAX_HISTORY = 250;

// Chave onde fica a "solicitação" de ação (passe/interceptação).
// Qualquer jogador pode escrever aqui — só o cliente do GM executa de fato.
const PENDING_KEY = `${ID}/pendingAction`;

// Tempo máximo que uma ação pode ficar pendente antes de ser
// considerada expirada (ex: ninguém com papel de GM está conectado).
const PENDING_TIMEOUT = 15000;

// Tempo que o passador tem pra escolher o receptor após clicar em
// "Passar bola", antes de cancelar automaticamente.
const SELECT_RECEIVER_TIMEOUT = 15000;

let waitingForReceiver = false;
let passerId: string | null = null;
let waitingTimeout: ReturnType<typeof setTimeout> | null = null;

// Evita que o mesmo cliente GM processe a mesma ação duas vezes.
const processedActionIds = new Set<string>();

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

type PendingAction =
  | {
      id: string;
      type: "pass";
      passerId: string;
      receiverId: string;
      requestedAt: number;
      claimedBy?: string;
    }
  | {
      id: string;
      type: "interception";
      interceptorId: string;
      requestedAt: number;
      claimedBy?: string;
    };

// =========================================
// CONFIGURAÇÃO
// =========================================

export function setupPassMode() {
  // Escolha do receptor do passe — só interessa a quem iniciou o passe.
  OBR.player.onChange((player) => {
    if (!waitingForReceiver) return;

    const selection = player.selection ?? [];

    if (selection.length === 0) return;

    const receiverId = selection[0];
    const currentPasserId = passerId;

    waitingForReceiver = false;
    passerId = null;

    if (waitingTimeout) {
      clearTimeout(waitingTimeout);
      waitingTimeout = null;
    }

    if (!currentPasserId) {
      console.log(
        "❌ Não foi possível identificar o passador."
      );
      return;
    }

    if (currentPasserId === receiverId) {
      window.alert(
        "❌ O receptor não pode ser o próprio passador."
      );
      return;
    }

    void requestPass(currentPasserId, receiverId);
  });

  // Sempre que o metadata da cena mudar, verifica se surgiu uma ação
  // pendente que este cliente (se for GM) precisa processar.
  OBR.scene.onMetadataChange((metadata) => {
    void tryProcessPendingAction(metadata);
  });

  // Cobre o caso de já existir uma ação pendente quando o GM abre
  // (ou reabre) a extensão.
  void OBR.scene
    .getMetadata()
    .then((metadata) => tryProcessPendingAction(metadata));
}

// =========================================
// INICIAR PASSE (lado de quem está com a bola)
// =========================================

export function startPass(passerIdFromContext: string) {
  void beginPass(passerIdFromContext);
}

async function beginPass(passerIdFromContext: string) {
  const busy = await isBusy();

  if (busy) {
    window.alert(
      "🔒 A bola já está sendo usada em outra ação. Aguarde alguns segundos e tente de novo."
    );

    return;
  }

  waitingForReceiver = true;
  passerId = passerIdFromContext;

  console.log(
    "⚽ Passe iniciado por:",
    passerIdFromContext
  );

  console.log(
    "⚽ Escolha o jogador que vai receber o passe."
  );

  waitingTimeout = setTimeout(() => {
    if (waitingForReceiver) {
      console.log(
        "⏱️ Passe cancelado: nenhum receptor foi selecionado."
      );

      waitingForReceiver = false;
      passerId = null;
      waitingTimeout = null;
    }
  }, SELECT_RECEIVER_TIMEOUT);
}

async function requestPass(
  passerIdVal: string,
  receiverId: string
) {
  const request: PendingAction = {
    id: createActionId(),
    type: "pass",
    passerId: passerIdVal,
    receiverId,
    requestedAt: Date.now(),
  };

  const ok = await publishPendingAction(request);

  if (!ok) {
    window.alert(
      "🔒 A bola já está sendo usada em outra ação. Tente novamente em alguns segundos."
    );
  }
}

// =========================================
// INICIAR INTERCEPTAÇÃO
// =========================================

export function startInterception(interceptorId: string) {
  void requestInterception(interceptorId);
}

async function requestInterception(interceptorId: string) {
  const request: PendingAction = {
    id: createActionId(),
    type: "interception",
    interceptorId,
    requestedAt: Date.now(),
  };

  const ok = await publishPendingAction(request);

  if (!ok) {
    window.alert(
      "🔒 A bola já está sendo usada em outra ação. Tente novamente em alguns segundos."
    );
  }
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
// PUBLICAR / VERIFICAR SOLICITAÇÃO
// =========================================
// Qualquer cliente (GM ou Player) consegue escrever aqui: metadata
// de cena é de escrita ampla, diferente de um item específico.

async function isBusy(): Promise<boolean> {
  try {
    const metadata = await OBR.scene.getMetadata();
    const current = metadata[PENDING_KEY];

    if (!current || typeof current !== "object") {
      return false;
    }

    const pending = current as Partial<PendingAction>;

    const requestedAt =
      typeof pending.requestedAt === "number"
        ? pending.requestedAt
        : 0;

    return Date.now() - requestedAt < PENDING_TIMEOUT;
  } catch (error) {
    console.error(
      "❌ Erro ao verificar ação pendente:",
      error
    );

    return false;
  }
}

async function publishPendingAction(
  action: PendingAction
): Promise<boolean> {
  try {
    if (await isBusy()) {
      return false;
    }

    await OBR.scene.setMetadata({
      [PENDING_KEY]: action,
    });

    console.log(
      "📨 Ação solicitada:",
      action
    );

    return true;
  } catch (error) {
    console.error(
      "❌ Erro ao solicitar ação:",
      error
    );

    return false;
  }
}

async function clearPendingAction(actionId: string) {
  try {
    const metadata = await OBR.scene.getMetadata();
    const current = metadata[PENDING_KEY];

    if (
      current &&
      typeof current === "object" &&
      (current as Partial<PendingAction>).id === actionId
    ) {
      await OBR.scene.setMetadata({
        [PENDING_KEY]: null,
      });
    }
  } catch (error) {
    console.error(
      "❌ Erro ao limpar ação pendente:",
      error
    );
  }
}

// =========================================
// PROCESSAMENTO (SÓ RODA NO CLIENTE DO GM)
// =========================================

async function tryProcessPendingAction(
  metadata: Record<string, unknown>
) {
  const pendingRaw = metadata[PENDING_KEY];

  if (!pendingRaw || typeof pendingRaw !== "object") {
    return;
  }

  const pending =
    pendingRaw as Partial<PendingAction>;

  if (typeof pending.id !== "string") return;

  if (processedActionIds.has(pending.id)) return;

  // Só o GM tem garantia de permissão pra mexer em qualquer token
  // (inclusive a bola, que não é dele). Por isso só ele executa.
  const role = await OBR.player.getRole();

  if (role !== "GM") return;

  const requestedAt =
    typeof pending.requestedAt === "number"
      ? pending.requestedAt
      : 0;

  // Ação velha demais (ex: ninguém com papel de GM estava conectado
  // pra processá-la a tempo) — descarta sem executar.
  if (Date.now() - requestedAt > PENDING_TIMEOUT) {
    processedActionIds.add(pending.id);
    await clearPendingAction(pending.id);
    return;
  }

  const claimed = await claimAction(pending.id);

  if (!claimed) return;

  processedActionIds.add(pending.id);

  if (
    pending.type === "pass" &&
    typeof pending.passerId === "string" &&
    typeof pending.receiverId === "string"
  ) {
    await executePass(
      pending.passerId,
      pending.receiverId,
      pending.id
    );
  } else if (
    pending.type === "interception" &&
    typeof pending.interceptorId === "string"
  ) {
    await executeInterception(
      pending.interceptorId,
      pending.id
    );
  } else {
    await clearPendingAction(pending.id);
  }
}

// Marca a ação como "reivindicada" por este GM, pra reduzir (não
// eliminar por completo, mas isso é raríssimo) a chance de dois GMs
// conectados ao mesmo tempo processarem a mesma ação.
async function claimAction(
  actionId: string
): Promise<boolean> {
  try {
    const metadata = await OBR.scene.getMetadata();
    const current = metadata[PENDING_KEY];

    if (!current || typeof current !== "object") {
      return false;
    }

    const pending =
      current as Partial<PendingAction>;

    if (pending.id !== actionId) return false;
    if (pending.claimedBy) return false;

    await OBR.scene.setMetadata({
      [PENDING_KEY]: {
        ...pending,
        claimedBy: OBR.player.id,
      },
    });

    const confirmation =
      await OBR.scene.getMetadata();

    const confirmed =
      confirmation[PENDING_KEY] as
        | (Partial<PendingAction> & {
            claimedBy?: string;
          })
        | undefined;

    return (
      confirmed?.id === actionId &&
      confirmed?.claimedBy === OBR.player.id
    );
  } catch (error) {
    console.error(
      "❌ Erro ao reivindicar ação:",
      error
    );

    return false;
  }
}

// =========================================
// EXECUTAR PASSE (GM)
// =========================================

async function executePass(
  passerIdVal: string,
  receiverId: string,
  actionId: string
) {
  try {
    const metadata = await OBR.scene.getMetadata();

    const ballId = metadata[`${ID}/ball`];
    const holderId = metadata[`${ID}/holder`];

    if (typeof ballId !== "string") {
      console.log("❌ Bola não encontrada.");
      return;
    }

    if (holderId !== passerIdVal) {
      console.log(
        "❌ O jogador não está mais com a bola."
      );
      return;
    }

    const items = await OBR.scene.items.getItems();

    const ball = items.find(
      (item) => item.id === ballId
    );

    const passer = items.find(
      (item) => item.id === passerIdVal
    );

    const receiver = items.find(
      (item) => item.id === receiverId
    );

    if (!ball || !passer || !receiver) {
      console.log(
        "❌ Não foi possível encontrar os personagens."
      );
      return;
    }

    const startX = ball.position.x;
    const startY = ball.position.y;

    const gridSize = await OBR.scene.grid.getDpi();

    const targetX =
      receiver.position.x + gridSize * 0.36;

    const targetY =
      receiver.position.y + gridSize * 0.36;

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
      await OBR.scene.items.getItems([ball.id]);

    const updatedBall = updatedItems[0];

    if (!updatedBall) {
      console.log(
        "❌ Bola desapareceu durante o passe."
      );
      return;
    }

    await animateBall(
      updatedBall,
      startX,
      startY,
      targetX,
      targetY,
      550
    );

    await finishPass(
      ball.id,
      passer.id,
      receiver.id,
      targetX,
      targetY
    );
  } catch (error) {
    console.error(
      "❌ Erro durante o passe:",
      error
    );
  } finally {
    await clearPendingAction(actionId);
  }
}

async function finishPass(
  ballId: string,
  passerIdVal: string,
  receiverId: string,
  targetX: number,
  targetY: number
) {
  try {
    const items = await OBR.scene.items.getItems();

    const passer = items.find(
      (item) => item.id === passerIdVal
    );

    const receiver = items.find(
      (item) => item.id === receiverId
    );

    if (!passer || !receiver) return;

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
      from: passerIdVal,
      to: receiverId,
      fromName: passer.name || "Sem nome",
      toName: receiver.name || "Sem nome",
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
  }
}

// =========================================
// EXECUTAR INTERCEPTAÇÃO (GM)
// =========================================

async function executeInterception(
  interceptorId: string,
  actionId: string
) {
  try {
    const metadata = await OBR.scene.getMetadata();

    const ballId = metadata[`${ID}/ball`];
    const holderId = metadata[`${ID}/holder`];

    if (typeof ballId !== "string") {
      console.log("❌ Bola não encontrada.");
      return;
    }

    if (typeof holderId !== "string") {
      console.log(
        "❌ Ninguém está com a bola."
      );
      return;
    }

    if (holderId === interceptorId) {
      console.log(
        "❌ O jogador já está com a bola."
      );
      return;
    }

    const items = await OBR.scene.items.getItems();

    const ball = items.find(
      (item) => item.id === ballId
    );

    const holder = items.find(
      (item) => item.id === holderId
    );

    const interceptor = items.find(
      (item) => item.id === interceptorId
    );

    if (!ball || !holder || !interceptor) {
      console.log(
        "❌ Não foi possível encontrar a bola ou um dos jogadores."
      );
      return;
    }

    const startX = ball.position.x;
    const startY = ball.position.y;

    const gridSize = await OBR.scene.grid.getDpi();

    const targetX =
      interceptor.position.x + gridSize * 0.36;

    const targetY =
      interceptor.position.y + gridSize * 0.36;

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
      await OBR.scene.items.getItems([ball.id]);

    const updatedBall = updatedItems[0];

    if (!updatedBall) {
      console.log("❌ Bola desapareceu.");
      return;
    }

    await animateBall(
      updatedBall,
      startX,
      startY,
      targetX,
      targetY,
      450
    );

    await finishInterception(
      ball.id,
      holder.id,
      interceptor.id,
      targetX,
      targetY
    );
  } catch (error) {
    console.error(
      "❌ Erro durante a interceptação:",
      error
    );
  } finally {
    await clearPendingAction(actionId);
  }
}

async function finishInterception(
  ballId: string,
  holderId: string,
  interceptorId: string,
  targetX: number,
  targetY: number
) {
  try {
    const items = await OBR.scene.items.getItems();

    const holder = items.find(
      (item) => item.id === holderId
    );

    const interceptor = items.find(
      (item) => item.id === interceptorId
    );

    if (!holder || !interceptor) return;

    await OBR.scene.items.updateItems(
      [ballId],
      (items) => {
        for (const item of items) {
          item.position.x = targetX;
          item.position.y = targetY;
          item.attachedTo = interceptorId;
        }
      }
    );

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
  } catch (error) {
    console.error(
      "❌ Erro ao finalizar interceptação:",
      error
    );
  }
}

// =========================================
// ANIMAÇÃO COMPARTILHADA
// =========================================
// Sempre resolve a Promise, mesmo se algo falhar no meio do caminho —
// isso é o que garante que a trava (pendingAction) nunca fique presa
// pra sempre por causa de um erro no meio da animação.

function animateBall(
  ball: Item,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  duration: number
): Promise<void> {
  return new Promise((resolve) => {
    void (async () => {
      let stopInteraction: (() => void) | null = null;

      try {
        const interaction =
          await OBR.interaction.startItemInteraction(
            ball
          );

        const [update, stop] = interaction;
        stopInteraction = stop;

        const startTime = performance.now();

        let animationFrame: number | null = null;

        const animate = (currentTime: number) => {
          try {
            const elapsed = currentTime - startTime;

            const progress = Math.min(
              elapsed / duration,
              1
            );

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

            if (progress >= 1) {
              if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame);
              }

              update((item) => {
                item.position.x = targetX;
                item.position.y = targetY;
              });

              stop();
              resolve();
              return;
            }

            animationFrame =
              requestAnimationFrame(animate);
          } catch (error) {
            console.error(
              "❌ Erro durante a animação:",
              error
            );

            try {
              stop();
            } catch {
              // já parada ou inválida, ignora
            }

            resolve();
          }
        };

        animationFrame =
          requestAnimationFrame(animate);
      } catch (error) {
        console.error(
          "❌ Erro ao iniciar animação:",
          error
        );

        try {
          stopInteraction?.();
        } catch {
          // ignora
        }

        resolve();
      }
    })();
  });
}

// =========================================
// HISTÓRICO
// =========================================

async function addHistoryEvent(event: HistoryEvent) {
  const metadata = await OBR.scene.getMetadata();

  const oldHistory = metadata[`${ID}/history`];

  const history: HistoryEvent[] = Array.isArray(
    oldHistory
  )
    ? oldHistory
    : [];

  const updatedHistory = [...history, event].slice(
    -MAX_HISTORY
  );

  await OBR.scene.setMetadata({
    [`${ID}/history`]: updatedHistory,
  });

  console.log("📜 Evento registrado:", event);
}
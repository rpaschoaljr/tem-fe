import {setGlobalOptions} from "firebase-functions";
import {onDocumentWritten, FirestoreEvent, onDocumentWrittenWithAuthContext} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {Change} from "firebase-functions/v2/firestore";

admin.initializeApp({
  projectId: "demo-sistematemfe",
});

setGlobalOptions({region: "southamerica-east1", maxInstances: 10});

/**
 * Trigger para atualizar os Custom Claims de um usuário quando suas permissões mudam.
 */
export const onPermissionUpdate = onDocumentWritten("permissions/{permId}", async (event: FirestoreEvent<Change<admin.firestore.DocumentSnapshot> | undefined>) => {
  try {
    const data = event.data?.after.data();
    const permId = event.params.permId;

    logger.info(`🔥 TRIGGER DISPARADA: onPermissionUpdate para ${permId}`);

    if (!data) {
      logger.info(`Permissão ${permId} deletada.`);
      return;
    }

    // Se for uma permissão de usuário (ID é o email)
    if (data.type === "user") {
      await updateClaimsByEmail(permId, data);
    } else if (data.type === "role") {
      const roleName = data.target;
      const membersSnap = await admin.firestore().collection("members")
          .where("role", "==", roleName)
          .get();

      const updates = membersSnap.docs.map((doc) => {
        const member = doc.data();
        return updateClaimsByEmail(member.email, null);
      });

      await Promise.all(updates);
      logger.info(`Claims atualizados para ${updates.length} usuários da role ${roleName}`);
    }
  } catch (err) {
    logger.error("Erro na trigger onPermissionUpdate:", err);
  }
});

import { onCall } from "firebase-functions/v2/https";

/**
 * Função chamável pelo frontend para forçar a sincronização de Claims
 */
export const syncUserClaims = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error("Não autenticado");
    }

    const email = request.auth.token.email;
    if (!email) {
      throw new Error("Email não encontrado no token");
    }

    logger.info(`🔄 FORCING SYNC for user: ${email}`);
    await updateClaimsByEmail(email, null);

    return { success: true };
  } catch (error) {
    logger.error("Erro no syncUserClaims:", error);
    throw error;
  }
});

/**
 * Função chamável pelo frontend para obter o status de mensalidade do usuário logado de forma segura
 */
export const getMyDuesStatus = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error("Não autenticado");
    }

    const email = request.auth.token.email;
    if (!email) {
      throw new Error("Email não encontrado no token");
    }
    const firestore = admin.firestore();

    const memberQuery = await firestore.collection("members")
        .where("email", "==", email)
        .limit(1)
        .get();

    if (memberQuery.empty) {
      return { status: "ok", alertMsg: "", dueDate: null };
    }

    const memberSnap = memberQuery.docs[0];
    const member = memberSnap.data() || {};
    const memberId = memberSnap.id;

    if (member.deleted || (member.status !== "Ativo" && member.status !== "Em Curso")) {
      return { status: "ok", alertMsg: "", dueDate: null };
    }

    if (member.isExempt) {
      return { status: "exempt", alertMsg: "", dueDate: null };
    }

    const configSnap = await firestore.collection("system_configs").doc("finance").get();
    const config = (configSnap.exists ? configSnap.data() : {}) || {};
    const params = (config as any).customParams || {};
    const defaultDueDay = params.defaultDuesDueDay ?? 10;

    const dueDay = member.duesDueDay ?? defaultDueDay;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const dueDate = new Date(currentYear, currentMonth, dueDay);
    dueDate.setHours(0, 0, 0, 0);

    const todayZero = new Date();
    todayZero.setHours(0, 0, 0, 0);

    const txSnap = await firestore.collection("transactions")
        .where("memberId", "==", memberId)
        .where("category", "==", "MENSALIDADE")
        .where("refMonth", "==", currentMonth)
        .where("refYear", "==", currentYear)
        .where("deleted", "==", false)
        .limit(1)
        .get();

    if (!txSnap.empty) {
      return { status: "ok", alertMsg: "", dueDate: dueDate.toISOString() };
    }

    const diffTime = dueDate.getTime() - todayZero.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const formattedDate = `${String(dueDate.getDate()).padStart(2, "0")}/${String(dueDate.getMonth() + 1).padStart(2, "0")}/${dueDate.getFullYear()}`;

    if (diffDays < 0) {
      return {
        status: "overdue",
        alertMsg: `Atenção: Sua mensalidade está atrasada (venceu em ${formattedDate}). Por favor, regularize com a tesouraria.`,
        dueDate: dueDate.toISOString(),
      };
    } else if (diffDays <= 5) {
      if (diffDays === 0) {
        return {
          status: "warning",
          alertMsg: "Aviso: Sua mensalidade vence HOJE. Evite atrasos!",
          dueDate: dueDate.toISOString(),
        };
      } else {
        return {
          status: "warning",
          alertMsg: `Aviso: Sua mensalidade vence em ${diffDays} ${diffDays === 1 ? "dia" : "dias"} (${formattedDate}).`,
          dueDate: dueDate.toISOString(),
        };
      }
    }

    return { status: "ok", alertMsg: "", dueDate: dueDate.toISOString() };
  } catch (error) {
    logger.error("Erro no getMyDuesStatus:", error);
    throw error;
  }
});

/**
 * Função auxiliar para normalizar strings (remover acentos e espaços)
 */
function normalize(val: string): string {
  if (!val) return "";
  return val.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

/**
 * Função auxiliar para consolidar permissões e salvar no Token
 */
async function updateClaimsByEmail(email: string, userPermDoc: any) {
  try {
    const user = await admin.auth().getUserByEmail(email);

    // 1. Busca permissões INDIVIDUAIS
    let userPerm = userPermDoc;
    if (!userPerm) {
      const uSnap = await admin.firestore().collection("permissions").doc(email).get();
      userPerm = uSnap.exists ? uSnap.data() : null;
    }

    // 2. Busca o cargo do membro
    const memberSnap = await admin.firestore().collection("members")
        .where("email", "==", email).limit(1).get();

    let rolePerm = null;
    if (!memberSnap.empty) {
      const member = memberSnap.docs[0].data();
      const roleId = `role_${normalize(member.role).replace(/[^A-Z0-9]/g, "")}`;
      const rSnap = await admin.firestore().collection("permissions").doc(roleId).get();
      rolePerm = rSnap.exists ? rSnap.data() : null;
    }

    // 3. Hierarquia
    const userHLevel = userPerm?.hierarchyLevel ?? 0;
    const roleHLevel = rolePerm?.hierarchyLevel ?? 0;
    const hierarchyLevel = Math.max(userHLevel, roleHLevel);

    // 4. Consolidação
    const perms: any = {};
    const modules = ["members", "finance", "stock", "settings", "notices", "dashboard"];
    modules.forEach((mod) => {
      const rM = rolePerm?.modules?.[mod] || {read: false, write: false};
      const uM = userPerm?.modules?.[mod];
      perms[mod] = {
        read: uM?.read !== undefined ? uM.read : rM.read,
        write: uM?.write !== undefined ? uM.write : rM.write,
      };
    });

    const finalClaims = {hierarchyLevel, perms};
    await admin.auth().setCustomUserClaims(user.uid, finalClaims);
    logger.info(`✅ Claims sincronizados com sucesso para ${email}`);
  } catch (error) {
    logger.error(`❌ ERRO CLAIMS (${email}):`, error);
  }
}

/**
 * Tarefa agendada para rodar todo dia à meia-noite
 */
export const processScheduledTransactions = onSchedule("0 0 * * *", async () => {
  const now = new Date();
  const firestore = admin.firestore();

  const snap = await firestore.collection("scheduled_transactions")
      .where("active", "==", true)
      .where("deleted", "==", false)
      .get();

  let processed = 0;

  for (const doc of snap.docs) {
    const scheduled = doc.data();
    const nextDue = new Date(scheduled.nextDueDate.toDate());

    if (nextDue <= now) {
      try {
        await applySchedule(doc.id, scheduled);
        processed++;
      } catch (err) {
        logger.error(`Erro ao processar agendamento ${doc.id}:`, err);
      }
    }
  }

  logger.info(`Cron Financeiro finalizado. Processados: ${processed}`);
});

async function applySchedule(id: string, scheduled: any) {
  const firestore = admin.firestore();
  const signedValue = scheduled.type === "Saída" ?
    -Math.abs(scheduled.value) : Math.abs(scheduled.value);

  const txRef = firestore.collection("transactions").doc();
  await txRef.set({
    description: scheduled.description,
    type: scheduled.type,
    category: scheduled.category,
    date: admin.firestore.Timestamp.fromDate(new Date(scheduled.nextDueDate.toDate())),
    value: signedValue,
    deleted: false,
    memberId: scheduled.memberId,
    memberName: scheduled.memberName,
    scheduledId: id,
  });

  const nextDue = calculateNextDueDate(scheduled);
  const isOnce = scheduled.recurrence === "once";

  await firestore.collection("scheduled_transactions").doc(id).update({
    lastAppliedDate: admin.firestore.Timestamp.now(),
    nextDueDate: admin.firestore.Timestamp.fromDate(nextDue),
    active: !isOnce,
  });
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function calculateNextDueDate(scheduled: any): Date {
  const base = new Date(scheduled.nextDueDate.toDate());

  switch (scheduled.recurrence) {
    case "monthly": {
      const next = new Date(base);
      next.setDate(1); // Evita estouro de mês
      next.setMonth(base.getMonth() + 1);
      const targetDay = scheduled.dayOfMonth || base.getDate();
      next.setDate(Math.min(targetDay, daysInMonth(next.getFullYear(), next.getMonth())));
      return next;
    }
    case "weekly": {
      const next = new Date(base);
      next.setDate(next.getDate() + 7);
      return next;
    }
    case "yearly": {
      const next = new Date(base);
      next.setFullYear(next.getFullYear() + 1);
      return next;
    }
    default:
      return base;
  }
}

/**
 * Auxiliar para calcular a diferença (diff) entre dois documentos
 */
function getDiff(before: any, after: any): Record<string, { old: any; new: any }> {
  const diff: Record<string, { old: any; new: any }> = {};
  const beforeKeys = Object.keys(before || {});
  const afterKeys = Object.keys(after || {});
  const allKeys = new Set([...beforeKeys, ...afterKeys]);

  allKeys.forEach((key) => {
    // Ignorar campos de timestamp internos comuns que mudam toda escrita
    if (key === "updatedAt" || key === "createdAt" || key === "timestamp") return;

    const beforeVal = before?.[key];
    const afterVal = after?.[key];

    // Compara os valores serializados
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff[key] = {
        old: beforeVal === undefined ? null : beforeVal,
        new: afterVal === undefined ? null : afterVal,
      };
    }
  });

  return diff;
}

/**
 * Função genérica para criar log de auditoria
 */
async function createAuditLog(
  event: any,
  collectionName: string
) {
  try {
    const change = event.data;
    if (!change) return;

    const beforeDoc = change.before;
    const afterDoc = change.after;

    const beforeData = beforeDoc && beforeDoc.exists ? beforeDoc.data() : null;
    const afterData = afterDoc && afterDoc.exists ? afterDoc.data() : null;

    if (!beforeData && !afterData) return;

    // Determinar ação principal
    let action: "CREATE" | "UPDATE" | "DELETE" = "UPDATE";
    if (!beforeData && afterData) {
      action = "CREATE";
    } else if (beforeData && !afterData) {
      action = "DELETE";
    } else if (beforeData && afterData) {
      // Caso seja deleção lógica
      if (!beforeData.deleted && afterData.deleted) {
        action = "DELETE";
      }
    }

    const { authType, authId } = event;
    let userId = authId || "system";
    let userEmail = "";
    let userName = "";

    if (authType === "user" && authId) {
      try {
        const userRecord = await admin.auth().getUser(authId);
        userEmail = userRecord.email || "";

        if (userEmail) {
          const memberSnap = await admin.firestore().collection("members")
            .where("email", "==", userEmail.toLowerCase())
            .limit(1)
            .get();

          if (!memberSnap.empty) {
            userName = memberSnap.docs[0].data().name || "";
          }
        }
      } catch (authErr) {
        logger.error(`Erro ao obter detalhes de autenticação para UID: ${authId}`, authErr);
      }
    } else if (authType === "admin") {
      userId = "admin-console";
      userName = "Console Firebase / Admin";
    } else if (authType === "system") {
      userId = "system";
      userName = "Sistema (Cron/Trigger)";
    }

    const diff = getDiff(beforeData, afterData);

    // Se for um update mas nada relevante mudou, não registra log
    if (action === "UPDATE" && Object.keys(diff).length === 0) {
      return;
    }

    const auditData = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      collection: collectionName,
      documentId: event.params.id || (afterDoc && afterDoc.id) || (beforeDoc && beforeDoc.id),
      action,
      userId,
      userEmail,
      userName,
      oldData: beforeData,
      newData: afterData,
      diff
    };

    await admin.firestore().collection("audit_logs").add(auditData);
    logger.info(`📝 LOG DE AUDITORIA: [${action}] na coleção [${collectionName}] por [${userEmail || userId}]`);
  } catch (err) {
    logger.error(`Erro ao criar log de auditoria para ${collectionName}:`, err);
  }
}

// Triggers para Auditoria nas principais coleções do sistema
export const auditMembers = onDocumentWrittenWithAuthContext("members/{id}", async (event) => {
  await createAuditLog(event, "members");
});

export const auditMembersPrivate = onDocumentWrittenWithAuthContext("members_private/{id}", async (event) => {
  await createAuditLog(event, "members_private");
});

export const auditMembersSpiritual = onDocumentWrittenWithAuthContext("members_spiritual/{id}", async (event) => {
  await createAuditLog(event, "members_spiritual");
});

export const auditTransactions = onDocumentWrittenWithAuthContext("transactions/{id}", async (event) => {
  await createAuditLog(event, "transactions");
});

export const auditStock = onDocumentWrittenWithAuthContext("stock/{id}", async (event) => {
  await createAuditLog(event, "stock");
});

export const auditSales = onDocumentWrittenWithAuthContext("sales/{id}", async (event) => {
  await createAuditLog(event, "sales");
});

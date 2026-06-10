import {setGlobalOptions} from "firebase-functions";
import {onDocumentWritten, FirestoreEvent} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {Change} from "firebase-functions/v2/firestore";

admin.initializeApp({
  projectId: "demo-sistematemfe",
});

setGlobalOptions({region: "southamerica-east1", maxInstances: 10});

/**
 * FUNÇÃO DE TESTE: Acesse http://localhost:5001/demo-sistematemfe/southamerica-east1/helloWorld
 */
export const helloWorld = onRequest({cors: true}, (req, res) => {
  logger.info("👋 HELLO WORLD: O Emulador de Functions está vivo!");
  res.status(200).send({
    message: "Axé! O backend de Functions está funcionando perfeitamente.",
    timestamp: new Date().toISOString(),
    projectId: "demo-sistematemfe",
  });
});

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

function calculateNextDueDate(scheduled: any): Date {
  const base = new Date(scheduled.nextDueDate.toDate());
  const next = new Date(base);

  switch (scheduled.recurrence) {
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

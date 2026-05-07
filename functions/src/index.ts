import {setGlobalOptions} from "firebase-functions";
import {onDocumentWritten, FirestoreEvent} from "firebase-functions/v2/firestore";
import {onSchedule, ScheduledEvent} from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {Change} from "firebase-functions/v2/firestore";

admin.initializeApp();

setGlobalOptions({region: "southamerica-east1", maxInstances: 10});

/**
 * Trigger para atualizar os Custom Claims de um usuário quando suas permissões mudam.
 */
export const onPermissionUpdate = onDocumentWritten("permissions/{permId}", async (event: FirestoreEvent<Change<admin.firestore.DocumentSnapshot> | undefined>) => {
  const data = event.data?.after.data();
  const permId = event.params.permId;

  if (!data) {
    logger.info(`Permissão ${permId} deletada.`);
    return;
  }

  // Se for uma permissão de usuário (ID é o email)
  if (data.type === "user") {
    await updateClaimsByEmail(permId, data);
  } 
  else if (data.type === "role") {
    const roleName = data.target;
    const membersSnap = await admin.firestore().collection("members")
        .where("role", "==", roleName)
        .get();

    const updates = membersSnap.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => {
      const member = doc.data();
      return updateClaimsByEmail(member.email, null); 
    });

    await Promise.all(updates);
    logger.info(`Claims atualizados para ${updates.length} usuários da role ${roleName}`);
  }
});

/**
 * Função auxiliar para consolidar permissões e salvar no Token
 */
async function updateClaimsByEmail(email: string, userPermDoc: any) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    
    let userPerm = userPermDoc;
    if (!userPerm) {
      const uSnap = await admin.firestore().collection("permissions").doc(email).get();
      userPerm = uSnap.exists ? uSnap.data() : null;
    }

    const memberSnap = await admin.firestore().collection("members")
        .where("email", "==", email).limit(1).get();
    
    let rolePerm = null;
    if (!memberSnap.empty) {
      const member = memberSnap.docs[0].data();
      const roleId = `role_${member.role.replace(/\//g, "_")}`;
      const rSnap = await admin.firestore().collection("permissions").doc(roleId).get();
      rolePerm = rSnap.exists ? rSnap.data() : null;
    }

    const hierarchyLevel = Math.max(userPerm?.hierarchyLevel || 0, rolePerm?.hierarchyLevel || 0);
    const perms: any = {};

    const modules = ["members", "finance", "stock", "settings", "notices"];
    modules.forEach((mod) => {
      const rM = rolePerm?.modules?.[mod] || {read: false, write: false};
      const uM = userPerm?.modules?.[mod];
      
      perms[mod] = {
        read: uM?.read !== undefined ? uM.read : rM.read,
        write: uM?.write !== undefined ? uM.write : rM.write,
      };
    });

    await admin.auth().setCustomUserClaims(user.uid, {
      hierarchyLevel,
      perms,
    });

    logger.info(`Claims atualizados para ${email}: Nível ${hierarchyLevel}`);
  } catch (error) {
    logger.error(`Erro ao atualizar claims para ${email}:`, error);
  }
}

/**
 * Tarefa agendada para rodar todo dia à meia-noite
 */
export const processScheduledTransactions = onSchedule("0 0 * * *", async (event: ScheduledEvent) => {
  const now = new Date();
  const firestore = admin.firestore();
  
  const snap = await firestore.collection("scheduled_transactions")
      .where("active", "==", true)
      .where("deleted", "==", false)
      .get();

  let processed = 0;

  for (const doc of snap.docs) {
    const scheduled = doc.data();
    const nextDue = new Date(scheduled.nextDueDate.toDate()); // Converte Timestamp para Date

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

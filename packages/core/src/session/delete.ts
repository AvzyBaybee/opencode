export * as SessionDelete from "./delete"

import { and, eq } from "drizzle-orm"
import { DateTime, Effect } from "effect"
import { Database } from "../database/database"
import { EventV2 } from "../event"
import { SessionEvent } from "./event"
import { MessageNotFoundError } from "./revert"
import { SessionMessage } from "./message"
import { SessionSchema } from "./schema"
import { SessionMessageTable } from "./sql"

export const remove = Effect.fn("SessionDelete.remove")(function* (input: {
  readonly sessionID: SessionSchema.ID
  readonly messageID: SessionMessage.ID
}) {
  const db = (yield* Database.Service).db
  const row = yield* db
    .select({ id: SessionMessageTable.id })
    .from(SessionMessageTable)
    .where(and(eq(SessionMessageTable.session_id, input.sessionID), eq(SessionMessageTable.id, input.messageID)))
    .get()
    .pipe(Effect.orDie)
  if (!row) return yield* new MessageNotFoundError(input)

  const events = yield* EventV2.Service
  yield* events.publish(SessionEvent.MessageEvent.Deleted, {
    sessionID: input.sessionID,
    messageID: input.messageID,
    timestamp: yield* DateTime.now,
  })
})

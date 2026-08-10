export * as SessionEdit from "./edit"

import { and, eq } from "drizzle-orm"
import { DateTime, Effect, Schema } from "effect"
import { Database } from "../database/database"
import { EventV2 } from "../event"
import { SessionEvent } from "./event"
import { MessageNotFoundError } from "./revert"
import { SessionMessage } from "./message"
import { SessionSchema } from "./schema"
import { SessionMessageTable } from "./sql"

export class MessageNotEditableError extends Schema.TaggedErrorClass<MessageNotEditableError>()(
  "Session.MessageNotEditableError",
  {
    sessionID: SessionSchema.ID,
    messageID: SessionMessage.ID,
  },
) {}

export const edit = Effect.fn("SessionEdit.edit")(function* (input: {
  readonly sessionID: SessionSchema.ID
  readonly messageID: SessionMessage.ID
  readonly text: string
}) {
  const db = (yield* Database.Service).db
  const row = yield* db
    .select({ type: SessionMessageTable.type })
    .from(SessionMessageTable)
    .where(and(eq(SessionMessageTable.session_id, input.sessionID), eq(SessionMessageTable.id, input.messageID)))
    .get()
    .pipe(Effect.orDie)
  if (!row) return yield* new MessageNotFoundError(input)
  if (row.type !== "user" && row.type !== "assistant")
    return yield* new MessageNotEditableError({
      sessionID: input.sessionID,
      messageID: input.messageID,
    })

  const events = yield* EventV2.Service
  yield* events.publish(SessionEvent.MessageEvent.Edited, {
    sessionID: input.sessionID,
    messageID: input.messageID,
    text: input.text,
    timestamp: yield* DateTime.now,
  })
})

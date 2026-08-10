export * as ConfigAva from "./ava"

import { Schema } from "effect"

export class Info extends Schema.Class<Info>("Config.Ava")({
  fileHeadersOnRead: Schema.Boolean.pipe(Schema.optional),
}) {}

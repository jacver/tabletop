import {
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

/**
 * A user's own game system, the root of game systems → factions → unit
 * templates. Column names are snake_case in SQL via `casing: "snake_case"`.
 * `owner_id` gets its FK to `user.id` once auth tables exist (F04).
 */
export const gameSystems = pgTable(
	"game_systems",
	{
		id: uuid().primaryKey().defaultRandom(),
		ownerId: text().notNull(),
		name: text().notNull(),
		canaryNote: text(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp({ withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	// Leads with owner_id, so it also serves owner-filtered queries.
	(table) => [
		uniqueIndex("game_systems_owner_name_uq").on(table.ownerId, table.name),
	],
);

export type GameSystem = typeof gameSystems.$inferSelect;
export type NewGameSystem = typeof gameSystems.$inferInsert;

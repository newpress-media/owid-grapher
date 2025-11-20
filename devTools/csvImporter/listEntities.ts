#!/usr/bin/env tsx
/**
 * List Entities - Helper utility for CSV Importer
 *
 * This script exports all entities from the database to help with
 * entity name matching when importing CSV data.
 *
 * Usage:
 *   yarn tsx devTools/csvImporter/listEntities.ts
 *   yarn tsx devTools/csvImporter/listEntities.ts --output entities.json
 */

import * as fs from "fs"
import * as minimist from "minimist"
import { closeTypeOrmAndKnexConnections, knexInstance } from "../../db/db.js"

const argv = minimist.default(process.argv.slice(2), {
    string: ["output"],
    alias: {
        o: "output",
    },
})

interface EntityInfo {
    id: number
    name: string
    code?: string
}

async function main() {
    console.log("\n📋 Exporting Entities from Database")
    console.log("===================================\n")

    try {
        const entities = await knexInstance()<EntityInfo>("entities")
            .select("id", "name", "code")
            .orderBy("name")

        console.log(`Found ${entities.length} entities\n`)

        const outputPath = argv.output || "entities.json"

        // Create a more useful format
        const output = {
            count: entities.length,
            entities: entities,
            byName: Object.fromEntries(
                entities.map((e) => [e.name, { id: e.id, code: e.code }])
            ),
            byCode: Object.fromEntries(
                entities
                    .filter((e) => e.code)
                    .map((e) => [e.code!, { id: e.id, name: e.name }])
            ),
        }

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

        console.log(`✅ Entities exported to ${outputPath}`)
        console.log("\nSample entities:")
        entities.slice(0, 10).forEach((e) => {
            console.log(`  - ${e.name}${e.code ? ` (${e.code})` : ""}`)
        })
        console.log(`  ... and ${entities.length - 10} more`)
    } catch (error) {
        console.error("Error:", error)
        process.exit(1)
    } finally {
        await closeTypeOrmAndKnexConnections()
    }
}

main()

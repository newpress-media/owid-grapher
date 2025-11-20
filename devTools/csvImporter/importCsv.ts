#!/usr/bin/env tsx
/**
 * CSV Importer for OWID Grapher
 *
 * This script imports CSV data into the OWID Grapher database.
 * It creates datasets, variables, and data files for visualization.
 *
 * Usage:
 *   yarn tsx devTools/csvImporter/importCsv.ts --config config.json
 *   yarn tsx devTools/csvImporter/importCsv.ts --config config.json --dry-run
 *   yarn tsx devTools/csvImporter/importCsv.ts --config config.json --update
 *
 * For more information, see README.md
 */

import * as fs from "fs"
import * as path from "path"
import * as Papa from "papaparse"
import * as minimist from "minimist"
import { closeTypeOrmAndKnexConnections, knexInstance } from "../../db/db.js"

// Parse command line arguments
const argv = minimist.default(process.argv.slice(2), {
    string: ["config", "storage"],
    boolean: ["dry-run", "update", "verbose", "help"],
    alias: {
        c: "config",
        d: "dry-run",
        u: "update",
        v: "verbose",
        h: "help",
    },
})

if (argv.help) {
    console.log(`
CSV Importer for OWID Grapher

Usage:
  yarn tsx devTools/csvImporter/importCsv.ts [options]

Options:
  -c, --config <file>    Path to configuration JSON file (required)
  -d, --dry-run          Validate without making changes
  -u, --update           Update existing dataset if it exists
  -v, --verbose          Show detailed progress information
  --storage <type>       Storage type: 'local' (default) or 's3'
  -h, --help             Show this help message

Examples:
  yarn tsx devTools/csvImporter/importCsv.ts --config config.json
  yarn tsx devTools/csvImporter/importCsv.ts --config config.json --dry-run
  yarn tsx devTools/csvImporter/importCsv.ts --config config.json --update

For more information, see devTools/csvImporter/README.md
`)
    process.exit(0)
}

if (!argv.config) {
    console.error("Error: --config parameter is required")
    console.error("Run with --help for usage information")
    process.exit(1)
}

interface CsvImportConfig {
    datasetName: string
    datasetDescription?: string
    namespace?: string
    version?: string
    files: Array<{
        path: string
        variableName: string
        variableDescription?: string
        unit?: string
        shortName: string
        display?: Record<string, any>
    }>
    entityMapping?: Record<string, string>
    userId?: number
}

interface EntityInfo {
    id: number
    name: string
    code?: string
}

interface ValidationResult {
    valid: boolean
    errors: string[]
    warnings: string[]
}

class CsvImporter {
    private config: CsvImportConfig
    private dryRun: boolean
    private update: boolean
    private verbose: boolean
    private storageType: string
    private entityCache: Map<string, EntityInfo> = new Map()
    private validationErrors: string[] = []
    private validationWarnings: string[] = []

    constructor(
        config: CsvImportConfig,
        options: {
            dryRun?: boolean
            update?: boolean
            verbose?: boolean
            storage?: string
        } = {}
    ) {
        this.config = config
        this.dryRun = options.dryRun ?? false
        this.update = options.update ?? false
        this.verbose = options.verbose ?? false
        this.storageType = options.storage ?? "local"
    }

    async run(): Promise<void> {
        console.log("\n🚀 CSV Importer for OWID Grapher")
        console.log("================================\n")

        if (this.dryRun) {
            console.log("⚠️  DRY RUN MODE - No changes will be made\n")
        }

        try {
            // Load entity cache
            await this.loadEntities()

            // Validate configuration
            const validation = await this.validate()
            if (!validation.valid) {
                console.error("\n❌ Validation failed:")
                validation.errors.forEach((err) => console.error(`  - ${err}`))
                process.exit(1)
            }

            if (validation.warnings.length > 0) {
                console.warn("\n⚠️  Warnings:")
                validation.warnings.forEach((warn) =>
                    console.warn(`  - ${warn}`)
                )
            }

            if (this.dryRun) {
                console.log("\n✅ Validation passed!")
                console.log(
                    "\nRun without --dry-run to perform the actual import."
                )
                return
            }

            // Perform import
            await this.import()

            console.log("\n✅ Import completed successfully!")
        } catch (error) {
            console.error("\n❌ Import failed:", error)
            throw error
        } finally {
            await closeTypeOrmAndKnexConnections()
        }
    }

    private async loadEntities(): Promise<void> {
        if (this.verbose) {
            console.log("Loading entities from database...")
        }

        const entities = await knexInstance()<EntityInfo>("entities").select(
            "id",
            "name",
            "code"
        )

        for (const entity of entities) {
            this.entityCache.set(entity.name.toLowerCase(), entity)
            if (entity.code) {
                this.entityCache.set(entity.code.toLowerCase(), entity)
            }
        }

        console.log(`Loaded ${entities.length} entities from database\n`)
    }

    private findEntity(name: string): EntityInfo | undefined {
        // Try exact match
        let entity = this.entityCache.get(name.toLowerCase())
        if (entity) return entity

        // Try with entity mapping
        if (this.config.entityMapping?.[name]) {
            const mappedName = this.config.entityMapping[name]
            entity = this.entityCache.get(mappedName.toLowerCase())
            if (entity) return entity
        }

        // Try fuzzy matching (common variations)
        const variations = [
            name.trim(),
            name.replace(/\s+/g, " "),
            name.replace("_", " "),
        ]

        for (const variation of variations) {
            entity = this.entityCache.get(variation.toLowerCase())
            if (entity) return entity
        }

        return undefined
    }

    private async validate(): Promise<ValidationResult> {
        console.log("Validating configuration and data...\n")

        const errors: string[] = []
        const warnings: string[] = []

        // Validate dataset configuration
        if (!this.config.datasetName) {
            errors.push("Dataset name is required")
        }

        if (!this.config.files || this.config.files.length === 0) {
            errors.push("At least one file must be specified")
        }

        // Validate each file
        for (const file of this.config.files) {
            if (!file.path) {
                errors.push("File path is required")
                continue
            }

            if (!fs.existsSync(file.path)) {
                errors.push(`File not found: ${file.path}`)
                continue
            }

            if (!file.variableName) {
                errors.push(`Variable name is required for ${file.path}`)
            }

            if (!file.shortName) {
                errors.push(`Short name is required for ${file.path}`)
            }

            // Validate CSV format
            try {
                const csvContent = fs.readFileSync(file.path, "utf-8")
                const parsed = Papa.parse(csvContent, {
                    header: true,
                    skipEmptyLines: true,
                })
                const records = parsed.data as any[]

                if (records.length === 0) {
                    errors.push(`No data found in ${file.path}`)
                    continue
                }

                // Check for required columns
                const firstRow = records[0]
                if (!firstRow.entity && !firstRow.country) {
                    errors.push(
                        `Missing 'entity' or 'country' column in ${file.path}`
                    )
                }
                if (!firstRow.year) {
                    errors.push(`Missing 'year' column in ${file.path}`)
                }
                if (!firstRow.value) {
                    errors.push(`Missing 'value' column in ${file.path}`)
                }

                // Validate entities
                let unmatchedEntities = 0
                const entityColumn = firstRow.entity ? "entity" : "country"
                for (const record of records) {
                    const entityName = record[entityColumn]
                    if (!this.findEntity(entityName)) {
                        unmatchedEntities++
                        if (unmatchedEntities <= 5) {
                            warnings.push(
                                `Entity not found: "${entityName}" in ${file.path}`
                            )
                        }
                    }
                }

                if (unmatchedEntities > 5) {
                    warnings.push(
                        `... and ${unmatchedEntities - 5} more unmatched entities in ${file.path}`
                    )
                }

                console.log(
                    `  ✓ ${file.path}: ${records.length} rows, ${unmatchedEntities} unmatched entities`
                )
            } catch (error) {
                errors.push(`Failed to parse ${file.path}: ${error}`)
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        }
    }

    private async import(): Promise<void> {
        console.log("\nStarting import...\n")

        // Create or find dataset
        const datasetId = await this.createDataset()
        console.log(`  Dataset ID: ${datasetId}`)

        // Import each file
        for (const file of this.config.files) {
            console.log(`\n  Processing ${file.path}...`)
            const variableId = await this.createVariable(datasetId, file)
            console.log(`    Variable ID: ${variableId}`)

            const { dataCount, entityCount } = await this.importData(
                variableId,
                file
            )
            console.log(
                `    Imported ${dataCount} data points for ${entityCount} entities`
            )
        }
    }

    private async createDataset(): Promise<number> {
        const userId = this.config.userId ?? 1

        // Check if dataset exists
        if (this.update) {
            const existing = await knexInstance()("datasets")
                .where({ name: this.config.datasetName })
                .first()

            if (existing) {
                console.log(`  Found existing dataset: ${existing.id}`)
                return existing.id
            }
        }

        const [result] = await knexInstance()("datasets").insert({
            name: this.config.datasetName,
            description: this.config.datasetDescription ?? "",
            namespace: this.config.namespace ?? "custom",
            version: this.config.version ?? new Date().toISOString().split("T")[0],
            createdByUserId: userId,
            dataEditedByUserId: userId,
            metadataEditedByUserId: userId,
            isPrivate: false,
        })

        return result
    }

    private async createVariable(
        datasetId: number,
        file: CsvImportConfig["files"][0]
    ): Promise<number> {
        const catalogPath = `${this.config.namespace ?? "custom"}/${this.config.datasetName.toLowerCase().replace(/\s+/g, "_")}#${file.shortName}`

        const [result] = await knexInstance()("variables").insert({
            name: file.variableName,
            description: file.variableDescription ?? "",
            unit: file.unit ?? "",
            shortName: file.shortName,
            catalogPath: catalogPath,
            datasetId: datasetId,
            schemaVersion: 2,
            display: JSON.stringify(file.display ?? {}),
        })

        return result
    }

    private async importData(
        variableId: number,
        file: CsvImportConfig["files"][0]
    ): Promise<{ dataCount: number; entityCount: number }> {
        // Read and parse CSV
        const csvContent = fs.readFileSync(file.path, "utf-8")
        const parsed = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
        })
        const records = parsed.data as any[]

        // Transform to Grapher format
        const data = {
            years: [] as number[],
            entities: [] as number[],
            values: [] as (number | string)[],
        }

        const entityColumn = records[0].entity ? "entity" : "country"
        const uniqueEntities = new Set<number>()

        for (const record of records) {
            const entityName = record[entityColumn]
            const entity = this.findEntity(entityName)

            if (!entity) {
                if (this.verbose) {
                    console.warn(`    Skipping unmatched entity: ${entityName}`)
                }
                continue
            }

            const year = parseInt(record.year)
            const value = parseFloat(record.value)

            if (isNaN(year) || isNaN(value)) {
                if (this.verbose) {
                    console.warn(
                        `    Skipping invalid data: ${entityName}, ${record.year}, ${record.value}`
                    )
                }
                continue
            }

            data.years.push(year)
            data.entities.push(entity.id)
            data.values.push(value)
            uniqueEntities.add(entity.id)
        }

        // Write data file
        await this.writeDataFile(variableId, data)

        // Write metadata file
        await this.writeMetadataFile(variableId, file)

        return {
            dataCount: data.values.length,
            entityCount: uniqueEntities.size,
        }
    }

    private async writeDataFile(
        variableId: number,
        data: { years: number[]; entities: number[]; values: (number | string)[] }
    ): Promise<void> {
        if (this.storageType === "local") {
            const dataDir = path.join(process.cwd(), "public", "data", "variables")
            fs.mkdirSync(dataDir, { recursive: true })

            const dataPath = path.join(dataDir, `${variableId}.data.json`)
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))

            if (this.verbose) {
                console.log(`    Wrote data file: ${dataPath}`)
            }
        } else {
            // S3/R2 storage would be implemented here
            console.warn("    S3 storage not yet implemented")
        }
    }

    private async writeMetadataFile(
        variableId: number,
        file: CsvImportConfig["files"][0]
    ): Promise<void> {
        if (this.storageType === "local") {
            const dataDir = path.join(process.cwd(), "public", "data", "variables")
            fs.mkdirSync(dataDir, { recursive: true })

            const metadata = {
                id: variableId,
                name: file.variableName,
                description: file.variableDescription ?? "",
                unit: file.unit ?? "",
                shortName: file.shortName,
                display: file.display ?? {},
                // Add more metadata fields as needed
            }

            const metadataPath = path.join(dataDir, `${variableId}.metadata.json`)
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

            if (this.verbose) {
                console.log(`    Wrote metadata file: ${metadataPath}`)
            }
        } else {
            // S3/R2 storage would be implemented here
            console.warn("    S3 storage not yet implemented")
        }
    }
}

// Main execution
async function main() {
    try {
        // Load configuration
        const configPath = path.resolve(argv.config)
        if (!fs.existsSync(configPath)) {
            console.error(`Error: Configuration file not found: ${configPath}`)
            process.exit(1)
        }

        const config: CsvImportConfig = JSON.parse(
            fs.readFileSync(configPath, "utf-8")
        )

        // Create importer
        const importer = new CsvImporter(config, {
            dryRun: argv["dry-run"],
            update: argv.update,
            verbose: argv.verbose,
            storage: argv.storage,
        })

        // Run import
        await importer.run()
    } catch (error) {
        console.error("Fatal error:", error)
        process.exit(1)
    }
}

main()

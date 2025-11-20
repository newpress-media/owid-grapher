# CSV Data Importer for OWID Grapher

This utility helps import CSV data into OWID Grapher for testing and development purposes.

## Overview

The CSV Importer is a TypeScript utility that:
- Reads CSV files and converts them to Grapher-compatible format
- Creates necessary database records (datasets, variables, sources)
- Generates data and metadata JSON files
- Handles entity (country/region) name mapping
- Validates data before import
- Provides detailed error reporting

## Prerequisites

1. OWID Grapher development environment set up and running
2. Access to MySQL database (default port 3307)
3. Node.js 22+ and Yarn installed
4. Sample CSV data files prepared

## CSV Format Requirements

### Basic Format

```csv
entity,year,value
United States,2020,328.2
United Kingdom,2020,67.9
Germany,2020,83.2
France,2020,67.4
```

### Column Requirements

- **entity**: Country, region, or organization name (must match database entities)
- **year**: Year for the data point (integer)
- **value**: Numeric value for the indicator
- Additional metadata columns can be included but will be ignored

### Multiple Variables

For multiple variables in one dataset, use separate CSV files:

```
data/
  population.csv
  gdp.csv
  life_expectancy.csv
```

Or use a wide format (one CSV with multiple value columns):

```csv
entity,year,population,gdp,life_expectancy
United States,2020,328.2,20940,78.9
```

## Usage

### 1. Prepare Your Data

Place your CSV files in a directory:

```bash
mkdir -p data/my-dataset
cp your-data.csv data/my-dataset/population.csv
```

### 2. Create Configuration File

Create a `config.json` file describing your import:

```json
{
  "datasetName": "My Custom Dataset",
  "datasetDescription": "Description of the dataset",
  "namespace": "custom",
  "version": "2024-11-20",
  "files": [
    {
      "path": "data/my-dataset/population.csv",
      "variableName": "Population",
      "variableDescription": "Total population",
      "unit": "people",
      "shortName": "population"
    }
  ],
  "entityMapping": {
    "USA": "United States",
    "UK": "United Kingdom"
  }
}
```

### 3. Run the Importer

```bash
yarn tsx devTools/csvImporter/importCsv.ts --config config.json
```

### 4. Verify Import

1. Open Admin UI: `http://localhost:3030/admin/datasets`
2. Find your dataset by name
3. Click to view variables and charts
4. Create a test chart to verify data

## Configuration Options

### Dataset Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `datasetName` | string | Yes | Display name for the dataset |
| `datasetDescription` | string | No | Description of what the dataset contains |
| `namespace` | string | No | Dataset namespace (default: "custom") |
| `version` | string | No | Version identifier (default: current date) |
| `files` | array | Yes | Array of CSV files to import |
| `entityMapping` | object | No | Map CSV entity names to database entities |
| `userId` | number | No | User ID for created records (default: 1) |

### File Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Path to CSV file |
| `variableName` | string | Yes | Display name for the variable |
| `variableDescription` | string | No | Description of the variable |
| `unit` | string | No | Unit of measurement |
| `shortName` | string | Yes | Short identifier for the variable |
| `display` | object | No | Custom display configuration |

## Entity Mapping

The importer needs to match entity names in your CSV to entities in the database. 

### Automatic Matching

The script will attempt to automatically match entity names. It uses fuzzy matching for:
- Case-insensitive matches
- Common variations (USA → United States)
- Trimming whitespace

### Manual Mapping

For non-standard names, provide a mapping in the config:

```json
{
  "entityMapping": {
    "US": "United States",
    "UK": "United Kingdom",
    "Deutschland": "Germany",
    "World Bank": "World"
  }
}
```

### Viewing Available Entities

To see all entities in the database:

```bash
yarn tsx devTools/csvImporter/listEntities.ts
```

This will output a file `entities.json` with all available entities.

## Data Storage

The importer can store data in two ways:

### Option 1: Local Filesystem (Default for Development)

Data is written to:
- `public/data/variables/{variableId}.data.json`
- `public/data/variables/{variableId}.metadata.json`

Configure in your `.env`:
```
DATA_API_URL=http://localhost:3030
```

### Option 2: S3/R2 Storage (For Production)

Configure S3 credentials in `.env`:
```
R2_ENDPOINT=https://...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
```

Then run with `--storage s3`:
```bash
yarn tsx devTools/csvImporter/importCsv.ts --config config.json --storage s3
```

## Validation

The importer performs several validation checks:

1. **CSV Format:** Ensures required columns exist
2. **Entity Matching:** Verifies all entities can be found
3. **Data Types:** Validates years and values are numeric
4. **Duplicates:** Checks for duplicate entity-year combinations
5. **Missing Data:** Reports rows with missing values

### Handling Validation Errors

Errors are reported to console and written to `import-errors.log`:

```
Error: Entity not found: "Atlantis"
  Line 15 in population.csv
  Suggestion: Use entity mapping or check spelling

Warning: Missing value for United States, 2019
  Treating as null
```

## Advanced Features

### Batch Import

Import multiple datasets at once:

```bash
yarn tsx devTools/csvImporter/importCsv.ts --batch import-configs/
```

This will process all `.json` files in the directory.

### Update Existing Dataset

To update an existing dataset:

```bash
yarn tsx devTools/csvImporter/importCsv.ts --config config.json --update
```

This will:
- Find existing dataset by name
- Update variable data
- Preserve existing metadata
- Update checksums

### Dry Run

Test the import without making changes:

```bash
yarn tsx devTools/csvImporter/importCsv.ts --config config.json --dry-run
```

This will:
- Validate CSV files
- Check entity matching
- Report what would be created
- Not modify database or create files

## Troubleshooting

### Common Issues

**Problem:** "Entity not found" errors  
**Solution:** 
- Check entity names in CSV match database entities
- Use entity mapping in config
- Run `listEntities.ts` to see available entities

**Problem:** Data doesn't appear in charts  
**Solution:**
- Verify data files were created in `public/data/variables/`
- Check browser console for 404 errors
- Ensure `DATA_API_URL` is configured correctly

**Problem:** Database connection errors  
**Solution:**
- Verify MySQL is running: `docker ps`
- Check port in `.env` (default 3307)
- Verify credentials

**Problem:** "Duplicate entry" database errors  
**Solution:**
- Use `--update` flag to update existing dataset
- Or change dataset name to create new one

### Debug Mode

Run with verbose output:

```bash
yarn tsx devTools/csvImporter/importCsv.ts --config config.json --verbose
```

This will show:
- SQL queries executed
- Entity matching details
- File operations
- Detailed progress

## Examples

### Example 1: Simple Single Variable

**Config:** `examples/population-config.json`
```json
{
  "datasetName": "World Population Data",
  "datasetDescription": "Population by country from 1950-2020",
  "files": [
    {
      "path": "examples/data/population.csv",
      "variableName": "Total Population",
      "unit": "people",
      "shortName": "population"
    }
  ]
}
```

**Command:**
```bash
yarn tsx devTools/csvImporter/importCsv.ts --config examples/population-config.json
```

### Example 2: Multiple Variables

**Config:** `examples/development-indicators-config.json`
```json
{
  "datasetName": "Development Indicators",
  "files": [
    {
      "path": "examples/data/gdp.csv",
      "variableName": "GDP per capita",
      "unit": "international-$ in 2017 prices",
      "shortName": "gdp_per_capita"
    },
    {
      "path": "examples/data/life-expectancy.csv",
      "variableName": "Life expectancy at birth",
      "unit": "years",
      "shortName": "life_expectancy"
    }
  ]
}
```

### Example 3: With Entity Mapping

**Config:** `examples/trade-data-config.json`
```json
{
  "datasetName": "International Trade",
  "files": [
    {
      "path": "examples/data/exports.csv",
      "variableName": "Total Exports",
      "unit": "current US$",
      "shortName": "exports"
    }
  ],
  "entityMapping": {
    "USA": "United States",
    "UK": "United Kingdom",
    "UAE": "United Arab Emirates",
    "Congo (DRC)": "Democratic Republic of Congo"
  }
}
```

## Limitations

This utility is designed for **development and testing** purposes. It has several limitations:

1. **No ETL Integration:** Bypasses OWID's ETL system and validation
2. **Limited Metadata:** Doesn't capture all metadata fields used by ETL
3. **No Automated Updates:** Manual re-import needed for data updates
4. **Entity Matching:** May fail for non-standard entity names
5. **Performance:** Not optimized for very large datasets (>1M rows)
6. **No Conflict Resolution:** Doesn't handle merging with existing data

For production use, consider integrating with the OWID ETL system.

## Contributing

To improve this utility:

1. Add new entity name variations to `entityMapping.ts`
2. Enhance validation rules in `validator.ts`
3. Add support for new CSV formats
4. Improve error messages and suggestions

## License

Same as OWID Grapher (MIT License)

## Support

For issues and questions:
1. Check troubleshooting section above
2. Review OWID Grapher documentation
3. Open a GitHub discussion
4. Contact your team lead

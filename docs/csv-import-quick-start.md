# Quick Start Guide: Testing CSV Import with OWID Grapher

This guide provides step-by-step instructions for testing the CSV import capability with 5-6 sample datasets.

## Prerequisites

Before starting, ensure you have:
- [ ] Docker installed and running
- [ ] Node.js 22+ installed
- [ ] Yarn package manager installed
- [ ] Basic command line familiarity

## Step 1: Set Up Local Environment (30-60 minutes)

### 1.1 Clone and Configure

```bash
# Clone the repository
git clone https://github.com/owid/owid-grapher.git
cd owid-grapher

# Copy environment configuration
cp .env.example-grapher .env
```

### 1.2 Start Development Environment

```bash
# This will download the database and start all services
make up
```

**What to expect:**
- Database download: 10-20 minutes (first time only)
- You'll see a tmux interface with 4 tabs
- Wait for "✅ All done, grapher DB is loaded ✅"

### 1.3 Verify Setup

1. Open browser to: `http://localhost:3030/admin/charts`
2. You should see the admin interface with existing charts
3. Browse a few charts to ensure everything works

## Step 2: Prepare Your CSV Data (15 minutes)

### 2.1 CSV Format

Your CSV files should have this format:

```csv
entity,year,value
United States,2020,328.2
United Kingdom,2020,67.9
Germany,2020,83.2
```

**Requirements:**
- `entity`: Country/region name (must match database entities)
- `year`: Year (integer)
- `value`: Numeric value

### 2.2 Check Available Entities

Run this to see all available entities:

```bash
yarn tsx devTools/csvImporter/listEntities.ts
```

This creates `entities.json` with all available countries and regions.

**Important:** Your CSV entity names must match these exactly (or use entity mapping).

### 2.3 Organize Your Files

```bash
mkdir -p data/my-project
# Copy your CSV files here
cp your-data-1.csv data/my-project/
cp your-data-2.csv data/my-project/
# ... etc
```

## Step 3: Test with Example Data (10 minutes)

### 3.1 Try the Built-in Example

We've included sample data for testing:

```bash
# Test with dry-run first (validates without importing)
yarn tsx devTools/csvImporter/importCsv.ts \
  --config devTools/csvImporter/examples/simple-config.json \
  --dry-run

# If validation passes, run the actual import
yarn tsx devTools/csvImporter/importCsv.ts \
  --config devTools/csvImporter/examples/simple-config.json
```

### 3.2 Verify in Admin UI

1. Go to: `http://localhost:3030/admin/datasets`
2. Look for "Simple Population Example"
3. Click on it to see the imported data
4. Click "Create new chart" to visualize the data

### 3.3 Create a Test Chart

1. In the dataset view, click "Create new chart"
2. Select "Total Population" variable
3. Choose chart type (e.g., Line chart)
4. Add a few countries
5. Preview and save

**Success!** You've imported your first CSV data.

## Step 4: Import Your Own Data (30-60 minutes)

### 4.1 Create Configuration File

Create `my-import-config.json`:

```json
{
  "datasetName": "My Custom Dataset",
  "datasetDescription": "Description of what this data represents",
  "namespace": "custom",
  "version": "2024-11-20",
  "files": [
    {
      "path": "data/my-project/indicator1.csv",
      "variableName": "My First Indicator",
      "variableDescription": "What this indicator measures",
      "unit": "units",
      "shortName": "indicator1"
    },
    {
      "path": "data/my-project/indicator2.csv",
      "variableName": "My Second Indicator",
      "unit": "different units",
      "shortName": "indicator2"
    }
  ],
  "entityMapping": {
    "USA": "United States",
    "UK": "United Kingdom"
  }
}
```

**Tips:**
- `shortName`: lowercase, no spaces, use underscores
- `entityMapping`: Add any non-standard entity names here
- `unit`: Be specific (e.g., "people", "USD", "years")

### 4.2 Validate Before Importing

```bash
yarn tsx devTools/csvImporter/importCsv.ts \
  --config my-import-config.json \
  --dry-run \
  --verbose
```

**Check the output for:**
- ✅ All CSV files found
- ✅ All entities matched
- ⚠️ Any warnings about unmatched entities
- ❌ Any errors to fix

### 4.3 Fix Entity Matching Issues

If you see "Entity not found" errors:

1. Check entity spelling in your CSV
2. Add mappings to `entityMapping` in config
3. Use `entities.json` to find exact names
4. Re-run validation

### 4.4 Perform the Import

Once validation passes:

```bash
yarn tsx devTools/csvImporter/importCsv.ts \
  --config my-import-config.json \
  --verbose
```

**What happens:**
- Database records created (dataset, variables)
- Data files written to `public/data/variables/`
- Progress shown in console

### 4.5 Verify and Visualize

1. Go to: `http://localhost:3030/admin/datasets`
2. Find your dataset
3. Check that all variables are listed
4. Create test charts for each variable
5. Verify data looks correct

## Step 5: Import Remaining Datasets (1-2 hours)

Repeat Step 4 for each of your datasets. You can:

### Option A: Create separate configs
```bash
yarn tsx devTools/csvImporter/importCsv.ts --config dataset1-config.json
yarn tsx devTools/csvImporter/importCsv.ts --config dataset2-config.json
# etc.
```

### Option B: Combine into one config
```json
{
  "datasetName": "Combined Dataset",
  "files": [
    { "path": "data/indicator1.csv", ... },
    { "path": "data/indicator2.csv", ... },
    { "path": "data/indicator3.csv", ... },
    { "path": "data/indicator4.csv", ... },
    { "path": "data/indicator5.csv", ... },
    { "path": "data/indicator6.csv", ... }
  ]
}
```

## Step 6: Document Your Findings (30 minutes)

As you go through this process, document:

### What Worked Well
- [ ] Which steps were straightforward?
- [ ] What was easier than expected?
- [ ] Any pleasant surprises?

### Challenges Encountered
- [ ] Entity matching issues?
- [ ] Data format problems?
- [ ] Configuration complexity?
- [ ] Performance issues?
- [ ] Missing features?

### Time Tracking
- Setup time: _____ minutes
- Per-dataset import time: _____ minutes
- Total time: _____ hours

### Data Quality Issues
- [ ] Missing data handling
- [ ] Invalid values
- [ ] Duplicate entries
- [ ] Entity name mismatches

## Troubleshooting

### Problem: Database not connecting

```bash
# Check Docker is running
docker ps

# Should see a MySQL container
# If not, restart Docker and run:
make up
```

### Problem: Entity not found errors

```bash
# Export all entities
yarn tsx devTools/csvImporter/listEntities.ts

# Check entities.json for exact names
# Add mappings to your config file
```

### Problem: Data doesn't appear in charts

```bash
# Check data files were created
ls -la public/data/variables/

# Check browser console for errors
# Verify DATA_API_URL in .env
```

### Problem: Import script fails

```bash
# Run with verbose mode for details
yarn tsx devTools/csvImporter/importCsv.ts \
  --config your-config.json \
  --dry-run \
  --verbose
```

## Next Steps

After completing the test import:

### Evaluate Feasibility
- Is the effort worthwhile for your use case?
- How does it compare to alternative tools?
- What would be needed for production use?

### Consider Improvements
- Would a UI-based import be helpful?
- Is automated entity mapping needed?
- Should there be data validation rules?
- Is S3/R2 storage necessary?

### Plan for Scale
- How many datasets will you ultimately have?
- How often will data be updated?
- Who else needs access?
- What's the long-term maintenance plan?

## Summary Checklist

At the end of testing, you should have:

- [ ] Local OWID Grapher instance running
- [ ] Successfully imported 5-6 CSV datasets
- [ ] Created test charts for each dataset
- [ ] Documented time spent and challenges
- [ ] List of entity mapping issues
- [ ] Assessment of tool feasibility
- [ ] Recommendations for improvements

## Getting Help

If you get stuck:

1. Check the main documentation: `docs/csv-import-feasibility-assessment.md`
2. Review the CSV importer README: `devTools/csvImporter/README.md`
3. Check OWID Grapher docs: https://github.com/owid/owid-grapher
4. Review database schema: `db/docs/`

## Appendix: Example Import Session

Here's what a typical import session looks like:

```bash
# Start in the project root
cd owid-grapher

# Check database is running
docker ps

# Test with dry run
yarn tsx devTools/csvImporter/importCsv.ts \
  --config my-config.json \
  --dry-run

# Output:
# 🚀 CSV Importer for OWID Grapher
# ================================
#
# ⚠️  DRY RUN MODE - No changes will be made
#
# Loaded 200 entities from database
#
# Validating configuration and data...
#
#   ✓ data/indicator1.csv: 150 rows, 0 unmatched entities
#   ✓ data/indicator2.csv: 180 rows, 0 unmatched entities
#
# ✅ Validation passed!

# Perform actual import
yarn tsx devTools/csvImporter/importCsv.ts \
  --config my-config.json \
  --verbose

# Output:
# Starting import...
#
#   Dataset ID: 5001
#
#   Processing data/indicator1.csv...
#     Variable ID: 10001
#     Imported 150 data points for 5 entities
#
#   Processing data/indicator2.csv...
#     Variable ID: 10002
#     Imported 180 data points for 6 entities
#
# ✅ Import completed successfully!

# Verify in browser
open http://localhost:3030/admin/datasets
```

Success! Your data is now in OWID Grapher.

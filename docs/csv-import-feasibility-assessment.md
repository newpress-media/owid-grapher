# CSV Data Import Feasibility Assessment for OWID Grapher

**Date:** November 20, 2024  
**Purpose:** Assess the feasibility of using OWID Grapher with custom CSV data

## Executive Summary

OWID Grapher is a sophisticated data visualization platform that was primarily designed to work with OWID's own data pipeline (the ETL system). While it's possible to use custom CSV data, there are significant challenges and limitations. This assessment outlines the current architecture, setup complexity, integration challenges, and provides recommendations.

### Key Findings

- **Local Setup Difficulty:** Medium-High (requires Docker, MySQL, Node.js, and 10-20 minutes database download)
- **Team Access Setup:** High (requires individual developer setup or cloud-hosted infrastructure)
- **CSV Integration:** Not natively supported - requires database-level integration
- **Risk Level:** Medium-High for production use without significant infrastructure investment

## 1. Current Architecture Overview

### 1.1 Data Flow

OWID Grapher's data architecture consists of several key components:

1. **ETL System (External):** Python-based system in a separate repository (`owid/etl`) that:
   - Processes raw data from various sources
   - Transforms and validates data
   - Uploads to MySQL database and S3 storage
   - Generates metadata and checksums

2. **MySQL Database:** Central data store containing:
   - `datasets`: Collections of related variables
   - `variables`: Individual indicators/metrics (time series data)
   - `sources`: Data source metadata
   - `origins`: Detailed provenance information
   - Chart configurations and relationships

3. **S3/R2 Storage:** Stores actual data values as JSON files:
   - Variable data: `/data/variables/{variableId}.data.json`
   - Variable metadata: `/data/variables/{variableId}.metadata.json`

4. **Grapher Admin UI:** Web interface for:
   - Creating and editing charts
   - Browsing datasets and variables
   - Managing metadata
   - Publishing charts

### 1.2 Database Schema Insights

The database schema reveals important constraints:

- **Variables** are the fundamental unit (individual time series)
- Each variable must belong to a **Dataset**
- Variables reference **Sources** and **Origins** for provenance
- Data values are stored externally (not in MySQL)
- Extensive metadata is required: `catalogPath`, `shortName`, checksums, etc.
- The system expects ETL-managed fields: `grapherConfigIdETL`, `dataChecksum`, etc.

## 2. Local Setup Assessment

### 2.1 Prerequisites

Required software:
- Docker (for MySQL database)
- Node.js 22+ and Yarn
- MySQL client tools
- tmux (for development environment)
- Git

For Windows users:
- Windows Subsystem for Linux (WSL)
- Additional tools: `build-essential`, `finger`

### 2.2 Setup Steps

1. **Clone repository**
   ```bash
   git clone https://github.com/owid/owid-grapher.git
   cd owid-grapher
   ```

2. **Configure environment**
   ```bash
   cp .env.example-grapher .env
   ```

3. **Start development environment**
   ```bash
   make up
   ```

4. **Wait for database download and setup** (10-20 minutes first time)

### 2.3 Setup Challenges

**Time Investment:**
- First-time setup: 30-60 minutes (includes database download)
- Subsequent starts: 2-5 minutes

**Technical Complexity:**
- Multiple interconnected services (Docker, TypeScript compiler, Vite, Admin server)
- Large database download (~500MB+)
- Port conflicts if running multiple instances
- Memory requirements (8GB+ RAM recommended)

**Knowledge Requirements:**
- Understanding of Docker Compose
- Familiarity with Node.js/TypeScript ecosystem
- Basic database concepts
- Command-line proficiency

### 2.4 Difficulty Rating: Medium-High

**Pros:**
- Well-documented setup process
- Automated with `make up` command
- Includes sample data for testing

**Cons:**
- Requires multiple tools and dependencies
- Long initial download time
- Complex multi-service architecture
- Troubleshooting requires understanding of the full stack

## 3. Team Access Setup Assessment

### 3.1 Current Options

**Option 1: Individual Local Setup**
- Each team member sets up their own local instance
- **Pros:** Full control, no infrastructure costs
- **Cons:** Time-consuming, inconsistent environments, no shared data

**Option 2: Shared Development Server**
- Set up a single server accessible by the team
- **Pros:** Consistent environment, shared data
- **Cons:** Requires DevOps expertise, security considerations, hosting costs

**Option 3: Cloud Development Environments**
- Use GitPod or similar services
- **Pros:** Quick start, consistent environments
- **Cons:** Not actively maintained by OWID, potential costs, limited customization

### 3.2 Collaboration Challenges

1. **Database Synchronization:** No built-in mechanism for team members to share custom datasets
2. **Version Control:** Charts and data are in database, not easily version-controlled
3. **Access Control:** Limited multi-user authentication in development mode
4. **Data Consistency:** Each developer has independent database state

### 3.3 Difficulty Rating: High

Without significant infrastructure investment, team collaboration is challenging. The system was designed for OWID's centralized production environment, not distributed team development.

## 4. Custom CSV Data Integration Challenges

### 4.1 No Built-in CSV Import

**Critical Finding:** OWID Grapher does **not** have a built-in CSV import feature in the Admin UI.

The current workflow requires:
1. Data to be processed by the ETL system (Python)
2. ETL writes to MySQL database
3. ETL uploads data to S3/R2 storage
4. Admin UI reads from database and S3

### 4.2 Database Integration Requirements

To add custom CSV data, you must:

1. **Create Dataset Record**
   ```sql
   INSERT INTO datasets (name, namespace, description, createdByUserId, dataEditedByUserId, metadataEditedByUserId, shortName, version)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?);
   ```

2. **Create Variable Record(s)**
   ```sql
   INSERT INTO variables (name, datasetId, unit, description, shortName, catalogPath, schemaVersion)
   VALUES (?, ?, ?, ?, ?, ?, ?);
   ```

3. **Upload Data to S3/R2**
   - Format: `{ years: [...], entities: [...], values: [...] }`
   - Location: `/data/variables/{variableId}.data.json`

4. **Upload Metadata to S3/R2**
   - Extensive metadata structure required
   - Location: `/data/variables/{variableId}.metadata.json`

5. **Create Source/Origin Records** (optional but recommended)

### 4.3 Technical Challenges

**Data Format Requirements:**
- CSV must be transformed to specific JSON structure
- Entity names must match database entities (countries, regions)
- Time dimension must be properly formatted
- Missing data handling

**Metadata Requirements:**
- `catalogPath`: Unique identifier in ETL catalog format
- `shortName`: Short identifier for the variable
- Checksums: `dataChecksum`, `metadataChecksum`
- Schema version: Must be compatible (currently version 2+)
- Display configurations: JSON format

**Storage Integration:**
- Requires S3-compatible storage (AWS S3, Cloudflare R2, or local mock)
- Proper access credentials
- Correct file paths and naming

**Entity Matching:**
- CSV country/region names must match database entities
- May require entity mapping/transformation
- Aggregates (World, continents) must be pre-calculated

### 4.4 Difficulty Rating: High

Without the ETL system, manual database manipulation is required, which is:
- Error-prone
- Time-consuming
- Requires deep understanding of the schema
- Bypasses data validation and quality checks

## 5. Risk Assessment

### 5.1 Technical Risks

**Data Integrity:**
- Manual database inserts may violate constraints
- Missing checksums can cause sync issues
- Improper metadata can break charts

**System Stability:**
- Database schema changes in OWID updates may break custom data
- S3 storage configuration errors can cause data loss
- Performance issues with large datasets

**Maintenance:**
- Custom scripts need updates as schema evolves
- No automated migration path for custom data
- Difficult to keep in sync with OWID updates

### 5.2 Capability Limitations

**What You CAN Do:**
- Create visualizations with custom data (if properly imported)
- Use all chart types (line, scatter, map, bar, etc.)
- Customize chart appearance and behavior
- Export charts as SVG, PNG, or interactive embeds

**What You CANNOT Do (Easily):**
- Import CSV files through the UI
- Bulk import multiple datasets
- Automated data updates from CSV sources
- Validate data quality automatically
- Version control your data easily

### 5.3 Scalability Concerns

**Small Scale (5-6 datasets, manual import):**
- Feasible but tedious
- High setup cost for small benefit
- Suitable for proof-of-concept only

**Medium Scale (10-50 datasets):**
- Manual import becomes impractical
- Need custom automation scripts
- Database management overhead increases

**Large Scale (100+ datasets, regular updates):**
- Requires full ETL system integration
- Professional DevOps support needed
- May be more cost-effective to use alternative tools

## 6. Step-by-Step Guide: Importing 5-6 CSV Datasets

### Prerequisites
- Local OWID Grapher instance running
- Access to MySQL database (port 3307)
- Node.js/TypeScript development environment
- Sample CSV files prepared

### Step 1: Prepare CSV Data

**CSV Format Requirements:**
```csv
entity,year,value
United States,2020,100
United Kingdom,2020,95
France,2020,90
...
```

**Considerations:**
- Use standard entity names (country names as they appear in database)
- Year column for time series data
- One column per variable (or multiple CSVs)
- Handle missing data (empty cells or specific value)

### Step 2: Set Up Database Connection

Create a TypeScript script to connect to MySQL:

```typescript
// scripts/importCsv.ts
import mysql from 'mysql2/promise'
import fs from 'fs'
import Papa from 'papaparse'

const connection = await mysql.createConnection({
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: 'weeniest-stretch-contaminate-gnarl',
  database: 'owid'
})
```

### Step 3: Create Dataset

```typescript
const [result] = await connection.execute(
  `INSERT INTO datasets 
   (name, namespace, description, createdByUserId, dataEditedByUserId, 
    metadataEditedByUserId, shortName, version)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    'My Custom Dataset',
    'custom',
    'Dataset imported from CSV',
    1, // user ID
    1,
    1,
    'my_custom_dataset',
    '2024-11-20'
  ]
)
const datasetId = result.insertId
```

### Step 4: Parse CSV and Create Variables

```typescript
const csvData = fs.readFileSync('data.csv', 'utf-8')
const parsed = Papa.parse(csvData, { header: true })

// Create variable
const [varResult] = await connection.execute(
  `INSERT INTO variables 
   (name, datasetId, unit, description, shortName, catalogPath, schemaVersion)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
  [
    'My Indicator',
    datasetId,
    'units',
    'Description of the indicator',
    'my_indicator',
    `custom/my_custom_dataset#my_indicator`,
    2
  ]
)
const variableId = varResult.insertId
```

### Step 5: Transform and Upload Data to S3

```typescript
// Transform CSV to Grapher data format
const data = {
  years: [],
  entities: [],
  values: []
}

for (const row of parsed.data) {
  // Get entity ID from database
  const [entity] = await connection.execute(
    'SELECT id FROM entities WHERE name = ?',
    [row.entity]
  )
  
  if (entity.length > 0) {
    data.years.push(parseInt(row.year))
    data.entities.push(entity[0].id)
    data.values.push(parseFloat(row.value))
  }
}

// Upload to S3/R2 (requires S3 client setup)
// For local testing, can write to local file system
fs.writeFileSync(
  `public/data/variables/${variableId}.data.json`,
  JSON.stringify(data)
)
```

### Step 6: Create Metadata

```typescript
const metadata = {
  id: variableId,
  name: 'My Indicator',
  unit: 'units',
  description: 'Description',
  // ... extensive metadata structure
}

fs.writeFileSync(
  `public/data/variables/${variableId}.metadata.json`,
  JSON.stringify(metadata)
)
```

### Step 7: Update Data API Configuration

Ensure the admin server is configured to serve data from the correct location (S3 or local filesystem).

### Step 8: Create Chart in Admin UI

1. Navigate to `http://localhost:3030/admin/charts`
2. Click "Create new chart"
3. In the "Data" tab, search for your dataset
4. Select your variable(s)
5. Configure chart type and appearance
6. Save and preview

### Challenges with This Approach

1. **Entity Matching:** CSV entity names must exactly match database entities
2. **Manual Process:** Must repeat for each dataset
3. **No Validation:** No automated quality checks
4. **Metadata Complexity:** Extensive metadata structure required
5. **S3 Integration:** Requires proper S3/R2 setup or local mock
6. **Error Handling:** Manual troubleshooting of issues

## 7. Recommendations for Improvements

### 7.1 Short-Term Solutions (For Testing/POC)

**1. Create a CSV Import Utility Script**

Develop a TypeScript/Node.js script that:
- Reads CSV files from a directory
- Validates data format
- Creates database records (datasets, variables)
- Generates JSON data files
- Handles entity mapping automatically
- Provides error reporting

**Estimated Effort:** 2-3 days development + testing

**2. Use Local File System for Data Storage**

Instead of S3/R2, serve data from local filesystem:
- Simpler setup
- Faster iteration
- Suitable for development/testing
- Configure `DATA_API_URL` to point to local files

**Estimated Effort:** 1 day configuration

**3. Create Entity Mapping Configuration**

Build a mapping file for CSV entity names to database entities:
```json
{
  "USA": "United States",
  "UK": "United Kingdom",
  "Deutschland": "Germany"
}
```

**Estimated Effort:** 1 day + ongoing maintenance

### 7.2 Medium-Term Solutions (For Team Use)

**1. Develop a Minimal Admin UI Extension**

Add a CSV import panel to the Admin UI:
- Upload CSV files
- Map columns to variables
- Preview data before import
- Automated validation
- Progress tracking

**Estimated Effort:** 1-2 weeks development

**2. Set Up Shared Development Environment**

Deploy a team-accessible instance:
- Cloud-hosted MySQL database
- Shared S3-compatible storage
- Multi-user authentication
- Backup and restore procedures

**Estimated Effort:** 1 week setup + ongoing maintenance

**3. Create Data Update Automation**

Build scripts for:
- Scheduled CSV import from URLs
- Automated entity matching
- Data validation and reporting
- Email notifications on errors

**Estimated Effort:** 1-2 weeks development

### 7.3 Long-Term Solutions (For Production)

**1. Integrate with ETL System**

Adopt OWID's ETL system:
- Clone and configure `owid/etl` repository
- Create custom data sources
- Use built-in validation and quality checks
- Benefit from automated data updates

**Estimated Effort:** 2-4 weeks integration + learning curve

**2. Build Custom Data Pipeline**

Develop your own ETL-like system:
- CSV ingestion service
- Data transformation engine
- Validation framework
- Automated deployment
- Monitoring and alerts

**Estimated Effort:** 1-3 months development

**3. Consider Alternative Tools**

Evaluate other visualization platforms:
- Tableau
- Plotly Dash
- Observable
- Datawrapper
- Custom D3.js solution

These may offer better CSV import capabilities and require less infrastructure.

### 7.4 Recommended Approach for Initial Testing

For testing with 5-6 CSV datasets, we recommend:

1. **Week 1: Setup and Familiarization**
   - Set up local OWID Grapher instance
   - Explore the Admin UI with existing data
   - Understand the database schema
   - Review sample CSV data

2. **Week 2: Create Import Utility**
   - Develop TypeScript script for CSV import
   - Implement entity mapping
   - Add basic validation
   - Test with 1-2 datasets

3. **Week 3: Import and Visualization**
   - Import remaining 3-4 datasets
   - Create sample charts for each dataset
   - Document issues and limitations
   - Evaluate usability

4. **Week 4: Assessment and Decision**
   - Compile lessons learned
   - Estimate effort for scaling
   - Compare with alternative solutions
   - Make go/no-go decision

## 8. Cost-Benefit Analysis

### Costs

**Time Investment:**
- Initial setup: 40-60 hours
- Per-dataset import (manual): 2-4 hours
- Per-dataset import (with tooling): 0.5-1 hour
- Ongoing maintenance: 5-10 hours/month

**Infrastructure:**
- Local development: Minimal ($0)
- Shared environment: $50-200/month (cloud hosting)
- Production deployment: $500-2000/month (depending on scale)

**Development:**
- Import utility: $2,000-4,000 (contractor) or 1-2 weeks (in-house)
- UI extension: $10,000-20,000 (contractor) or 1 month (in-house)
- Full ETL integration: $50,000+ (contractor) or 2-3 months (in-house)

### Benefits

**If Using for 5-6 Static Datasets:**
- Limited benefits
- High cost-to-value ratio
- Consider simpler alternatives

**If Scaling to 50+ Datasets with Regular Updates:**
- Powerful visualization capabilities
- Professional-quality charts
- Interactive features
- Worth the investment

**If Building Long-Term Data Platform:**
- Future-proof architecture
- Scalable solution
- Community support (OWID is open source)
- Justifies larger investment

## 9. Alternatives to Consider

### 9.1 Simpler Visualization Tools

**Datawrapper:**
- CSV import built-in
- Quick chart creation
- Hosted solution
- Limited customization

**Flourish:**
- Excellent CSV support
- Template-based
- Hosted with free tier
- Great for non-technical users

**Plotly Chart Studio:**
- Direct CSV upload
- Python/R integration
- Free for public charts
- Good for data scientists

### 9.2 Developer-Focused Tools

**Observable:**
- JavaScript notebooks
- CSV import with D3.js
- Collaborative environment
- Steep learning curve

**Plotly Dash:**
- Python-based
- Good CSV support
- Self-hosted
- Requires development

**Streamlit:**
- Python-based
- Very simple CSV handling
- Quick prototyping
- Limited styling

### 9.3 When to Choose OWID Grapher

Choose OWID Grapher if:
- You need highly customizable, interactive visualizations
- You have significant data engineering resources
- You plan to manage 50+ datasets long-term
- You want full control over the platform
- You can invest in ETL infrastructure

Avoid OWID Grapher if:
- You just need to visualize a few CSVs
- Your team is non-technical
- You want quick results
- You have budget constraints
- You need frequent data updates from external sources

## 10. Conclusion

### Summary of Findings

**Local Setup Difficulty:** Medium-High
- Well-documented but complex
- Requires multiple tools
- 30-60 minutes for experienced developers
- Ongoing maintenance needed

**Team Access Setup:** High
- No built-in collaboration features
- Requires infrastructure investment
- Complex to coordinate across team

**CSV Integration:** High Difficulty
- No native CSV import
- Requires custom development
- Database manipulation needed
- S3/R2 storage integration required

### Feasibility Verdict

**For Testing with 5-6 Datasets:**
- **Feasible:** Yes, but with significant effort
- **Recommended:** Only if evaluating for larger-scale use
- **Time Required:** 3-4 weeks for complete testing
- **Effort Required:** 40-80 hours

**For Production Use:**
- **Small Scale (<10 datasets):** Not recommended - use simpler tools
- **Medium Scale (10-50 datasets):** Feasible with custom tooling investment
- **Large Scale (50+ datasets):** Good fit with proper ETL integration

### Final Recommendations

1. **For Immediate Testing:**
   - Set up local instance
   - Create import utility script (included in next section)
   - Test with 2-3 datasets first
   - Document all challenges encountered

2. **Before Scaling:**
   - Evaluate alternative tools
   - Calculate total cost of ownership
   - Assess team technical capabilities
   - Consider long-term maintenance burden

3. **If Proceeding:**
   - Invest in proper tooling from the start
   - Plan for ETL system integration
   - Budget for infrastructure and development
   - Allocate time for team training

4. **Decision Framework:**
   - If benefits > 2x costs → Proceed
   - If benefits ≈ costs → Evaluate alternatives
   - If benefits < costs → Choose simpler solution

---

## Appendices

### Appendix A: Useful Resources

- [OWID Grapher Repository](https://github.com/owid/owid-grapher)
- [OWID ETL Repository](https://github.com/owid/etl)
- [Setup Documentation](https://github.com/owid/owid-grapher/tree/master/docs)
- [Database Schema](https://github.com/owid/owid-grapher/tree/master/db/docs)

### Appendix B: Common Issues and Solutions

**Issue:** Database download fails  
**Solution:** Check internet connection, retry, or manually download

**Issue:** Port conflicts  
**Solution:** Configure different ports in `.env` file

**Issue:** Entity names don't match  
**Solution:** Create mapping file and use entity lookup

**Issue:** Charts don't display data  
**Solution:** Verify S3/R2 paths, check data format, review browser console

### Appendix C: Glossary

- **Dataset:** Collection of related variables
- **Variable:** Individual time series/indicator
- **Entity:** Country, region, or other geographic/organizational unit
- **ETL:** Extract, Transform, Load - data pipeline process
- **Catalog Path:** Unique identifier for variables in ETL system
- **Grapher Config:** Chart configuration JSON
- **S3/R2:** Cloud storage services (AWS S3, Cloudflare R2)

---

**Document Version:** 1.0  
**Last Updated:** November 20, 2024  
**Next Review:** After testing phase completion

#!/usr/bin/env python3
"""
Simple Parquet → Supabase Import
Batch upload without streaming
"""

import pyarrow.parquet as pq
import os
from supabase import create_client, Client

# Load environment
from dotenv import load_dotenv
load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
PARQUET_PATH = 'data/bolagsverket_data.parquet'
BATCH_SIZE = 500

def main():
    print("🚀 Starting simple Parquet → Supabase import\n")

    # Connect to Supabase
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✓ Connected to Supabase\n")

    # Read Parquet
    print(f"📂 Reading {PARQUET_PATH}...")
    table = pq.read_table(PARQUET_PATH)
    df = table.to_pandas()

    # Clean column names
    df.columns = df.columns.str.lower()
    if '__index_level_0__' in df.columns:
        df = df.drop(columns=['__index_level_0__'])

    total_rows = len(df)
    print(f"✓ Loaded {total_rows:,} rows\n")

    # Replace NaN with None (critical for JSON serialization)
    import numpy as np
    df = df.replace({np.nan: None})

    # Clean organisationsnamn (remove $ suffix)
    if 'organisationsnamn' in df.columns:
        df['organisationsnamn'] = df['organisationsnamn'].str.split('$').str[0]

    # Import in batches
    total_batches = (total_rows + BATCH_SIZE - 1) // BATCH_SIZE
    imported = 0
    errors = 0

    for i in range(0, total_rows, BATCH_SIZE):
        batch_num = (i // BATCH_SIZE) + 1
        batch = df.iloc[i:i+BATCH_SIZE]

        # Convert to dict, explicitly handle None/NaN
        records = []
        for _, row in batch.iterrows():
            record = {}
            for k, v in row.to_dict().items():
                # Skip None values and ensure no NaN sneaks through
                if v is not None and v == v:  # v == v is False for NaN
                    record[k] = v
            if record:  # Only add if not empty
                records.append(record)

        print(f"📥 Batch {batch_num}/{total_batches}: Importing {len(records)} rows... ", end='', flush=True)

        try:
            # Upsert to Supabase
            result = supabase.table('companies').upsert(
                records,
                on_conflict='organisationsidentitet'
            ).execute()

            imported += len(records)
            progress = (imported / total_rows) * 100
            print(f"✓ ({imported:,}/{total_rows:,} = {progress:.1f}%)")

        except Exception as e:
            errors += 1
            print(f"❌ Error: {str(e)[:100]}")

    print("\n" + "="*60)
    print("✅ IMPORT COMPLETE")
    print(f"Imported: {imported:,} companies")
    print(f"Errors: {errors}")
    print("="*60)

if __name__ == '__main__':
    main()
